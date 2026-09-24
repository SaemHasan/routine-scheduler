import PDFDocument from "pdfkit";
import { connect } from "../config/database.js";
import { termTitle } from "./format.js";

/*
 * The department's list reports, laid out like its routine workbook:
 * - Course Teacher: the theory courses with their teachers, and the
 *   sessional courses with their day, time and teachers (by nickname);
 * - Course Load: each teacher's courses and load in credit hours.
 */

const CURRENT_SESSION = "(SELECT value FROM configs WHERE key='CURRENT_SESSION')";
const MARGIN = 36;
const FONT_SIZE = 8;
const LINE_PITCH = 9.6;
const RULE = 0.6;

const letterOf = (section) => (section.match(/^[A-Za-z]+/) || [section])[0];
const isMainSection = (section) => /^[A-Za-z]+$/.test(section);
// Weekly hours of a lab: 3 hours a week per 1.5 credits (a 0.75-credit lab,
// every other week, counts 3 too)
const labHours = (credit) => (Number(credit) <= 0.75 ? 3 : 2 * Number(credit));
// 3, 1.5, 13.5 — never 3.0
const hours = (n) => String(Math.round(n * 100) / 100);

/* ------------------------------------------------------------------ data */

async function loadReportData() {
  const client = await connect();
  try {
    const session = (await client.query(`SELECT value FROM configs WHERE key='CURRENT_SESSION'`)).rows[0]?.value;
    const teachers = (
      await client.query(
        `SELECT initial, name, surname, active, offers_thesis_1, offers_thesis_2, offers_msc
         FROM teachers WHERE active = 1 ORDER BY seniority_rank NULLS LAST, initial`
      )
    ).rows;
    const courseSections = (
      await client.query(
        `SELECT cs.course_id, cs.batch, cs.section, cs.department, cs.teachers,
                c.type, c.class_per_week, c.optional, c.optional_section_count, c."from", c."to"
         FROM courses_sections cs
         JOIN courses c ON c.course_id = cs.course_id AND c.session = cs.session
         WHERE cs.session = ${CURRENT_SESSION} AND c."from" = 'CSE' AND cs.course_id <> 'CT'
         ORDER BY cs.course_id, cs.section`
      )
    ).rows;
    const labTeachers = (
      await client.query(
        `SELECT tsa.course_id, tsa.batch, tsa.section, tsa.initial, tsa.share::float AS share
         FROM teacher_sessional_assignment tsa
         LEFT JOIN teachers t ON t.initial = tsa.initial
         WHERE tsa.session = ${CURRENT_SESSION}
         ORDER BY t.seniority_rank NULLS LAST, tsa.initial`
      )
    ).rows;
    const slots = (
      await client.query(
        `SELECT course_id, batch, section, department, day, "time"
         FROM schedule_assignment WHERE session = ${CURRENT_SESSION}
         ORDER BY course_id, section, day, "time"`
      )
    ).rows;
    const sections = (await client.query("SELECT department, batch, section, type FROM sections")).rows;
    const thesis = (
      await client.query("SELECT DISTINCT thesis FROM level_term_unique WHERE active AND thesis IS NOT NULL")
    ).rows.map((r) => Number(r.thesis));
    return { term: termTitle(session), teachers, courseSections, labTeachers, slots, sections, thesis };
  } finally {
    client.release();
  }
}

/**
 * Courses with the students each class is for: an elective every section
 * takes is one class for A/B/C; a 0.75-credit lab is written A1/A2.
 */
function courseClasses(data) {
  const mainsOf = new Map();
  const subsOf = new Map();
  for (const s of data.sections) {
    const k = `${s.department}|${s.batch}`;
    if (isMainSection(s.section) && s.type === 0) {
      if (!mainsOf.has(k)) mainsOf.set(k, []);
      mainsOf.get(k).push(s.section);
    } else if (!isMainSection(s.section)) {
      const m = `${k}|${letterOf(s.section)}`;
      if (!subsOf.has(m)) subsOf.set(m, []);
      subsOf.get(m).push(s.section);
    }
  }
  for (const list of [...mainsOf.values(), ...subsOf.values()]) list.sort();

  const labTeachersOf = new Map();
  for (const t of data.labTeachers) {
    const k = `${t.course_id}|${t.batch}|${t.section}`;
    if (!labTeachersOf.has(k)) labTeachersOf.set(k, []);
    labTeachersOf.get(k).push(t);
  }
  // Every weekly class of a section (a 3-credit lab meets twice)
  const slotsOf = new Map();
  for (const s of data.slots) {
    const k = `${s.course_id}|${s.department}|${s.batch}|${s.section}`;
    if (!slotsOf.has(k)) slotsOf.set(k, []);
    slotsOf.get(k).push(s);
  }

  const seen = new Set();
  const classes = [];
  for (const cs of data.courseSections) {
    const type = Number(cs.type);
    if (type === 2) continue;
    const batchKey = `${cs.department}|${cs.batch}`;
    const singleGroup = Boolean(cs.optional) && Number(cs.optional_section_count) <= 1;
    let label = cs.section;
    if (singleGroup) label = (mainsOf.get(batchKey) || [cs.section]).join("/");
    else if (type === 1 && isMainSection(cs.section)) {
      const subs = subsOf.get(`${batchKey}|${cs.section}`);
      if (subs && subs.length) label = subs.join("/");
    }
    const key = `${cs.course_id}|${batchKey}|${label}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Teaching slots: one per teacher, two half-lab teachers share one
    let teacherSlots = (cs.teachers || []).filter(Boolean).map((t) => [t]);
    if (type === 1) {
      teacherSlots = [];
      let open = null;
      for (const t of labTeachersOf.get(`${cs.course_id}|${cs.batch}|${cs.section}`) || []) {
        if (Number(t.share) !== 0.5) teacherSlots.push([t.initial]);
        else if (open) {
          open.push(t.initial);
          open = null;
        } else {
          open = [t.initial];
          teacherSlots.push(open);
        }
      }
    }
    const slots = slotsOf.get(`${cs.course_id}|${cs.department}|${cs.batch}|${cs.section}`) || [];
    classes.push({
      course_id: cs.course_id,
      type,
      credit: Number(cs.class_per_week),
      departmental: cs.to === "CSE",
      label,
      teacherSlots,
      day: slots.map((s) => s.day.slice(0, 3).toUpperCase()).join(", "),
      time: slots.map((s) => String(s.time)).join(", "),
    });
  }
  const byCourse = (a, b) =>
    a.course_id.localeCompare(b.course_id, undefined, { numeric: true }) ||
    a.label.localeCompare(b.label, undefined, { numeric: true });
  return {
    theory: classes.filter((c) => c.type === 0).sort(byCourse),
    // departmental labs first, then the labs CSE runs for other departments
    sessional: classes
      .filter((c) => c.type === 1)
      .sort((a, b) => Number(b.departmental) - Number(a.departmental) || byCourse(a, b)),
  };
}

/* ---------------------------------------------------------------- tables */

function textWidth(doc, text, bold) {
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(FONT_SIZE);
  return Math.max(...String(text).split("\n").map((l) => doc.widthOfString(l)));
}

function rule(doc, x, y, w, h) {
  doc.rect(x, y, w, h).fill("#000");
}

function drawCell(doc, x, y, w, h, text, { bold = false } = {}) {
  rule(doc, x, y, w + RULE, RULE);
  rule(doc, x, y + h, w + RULE, RULE);
  rule(doc, x, y, RULE, h + RULE);
  rule(doc, x + w, y, RULE, h + RULE);
  const lines = String(text ?? "").split("\n").filter((l) => l !== "");
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(FONT_SIZE);
  const cy = y + h / 2;
  lines.forEach((line, i) => {
    let size = FONT_SIZE;
    let width = doc.widthOfString(line);
    if (width > w - 3) {
      size = Math.max(5, (FONT_SIZE * (w - 3)) / width);
      doc.fontSize(size);
      width = doc.widthOfString(line);
    }
    const baseline = cy - ((lines.length - 1) * LINE_PITCH) / 2 + i * LINE_PITCH + 2.8;
    doc.text(line, x + (w - width) / 2, baseline, { lineBreak: false, baseline: "alphabetic" });
    doc.fontSize(FONT_SIZE);
  });
}

function drawTitle(doc, lines, y, width) {
  doc.font("Helvetica-BoldOblique").fontSize(10);
  lines.forEach((line, i) => {
    const w = doc.widthOfString(line);
    doc.text(line, (width - w) / 2, y + 11 + i * 12.5, { lineBreak: false, baseline: "alphabetic" });
  });
  return y + lines.length * 12.5 + 6;
}

/**
 * A table spread over as many pages as it needs, its title on the first
 * page and its header row on every page.
 * header: [{ text, span }], rows: [[text…]], widths: column widths.
 */
function drawPagedTable(doc, { title, header, rows, widths, rowHeight, headerHeight, layout }) {
  const tableWidth = widths.reduce((a, b) => a + b, 0);
  let first = true;
  let i = 0;
  while (i < rows.length || first) {
    doc.addPage({ size: "LETTER", layout, margin: 0 });
    const pageW = doc.page.width;
    const pageH = doc.page.height;
    let y = MARGIN;
    if (first) y = drawTitle(doc, title, y, pageW);
    const x0 = (pageW - tableWidth) / 2;
    let x = x0;
    let col = 0;
    for (const h of header) {
      const w = widths.slice(col, col + (h.span || 1)).reduce((a, b) => a + b, 0);
      drawCell(doc, x, y, w, headerHeight, h.text, { bold: true });
      x += w;
      col += h.span || 1;
    }
    y += headerHeight;
    while (i < rows.length && y + rowHeight <= pageH - MARGIN) {
      x = x0;
      rows[i].forEach((text, c) => {
        drawCell(doc, x, y, widths[c], rowHeight, text);
        x += widths[c];
      });
      y += rowHeight;
      i++;
    }
    first = false;
  }
}

function columnWidths(doc, rows, header, min) {
  const n = Math.max(...rows.map((r) => r.length), header.length);
  const widths = new Array(n).fill(min);
  for (const r of rows) r.forEach((t, c) => (widths[c] = Math.max(widths[c], textWidth(doc, t) + 10)));
  return widths;
}

function newDoc(title) {
  const doc = new PDFDocument({ autoFirstPage: false, margin: 0, info: { Title: title, Author: "Department of CSE, BUET" } });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  return { doc, done };
}

/* ------------------------------------------------------------------- API */

export async function courseTeacherBook() {
  const data = await loadReportData();
  const nick = new Map(data.teachers.map((t) => [t.initial, t.surname || t.initial]));
  const name = (slot) => slot.map((i) => nick.get(i) || i).join("/");
  const { theory, sessional } = courseClasses(data);
  const { doc, done } = newDoc("Course Teacher");

  const theoryRows = theory.map((c) => [c.course_id, c.label, ...c.teacherSlots.map(name)]);
  const tMax = Math.max(1, ...theory.map((c) => c.teacherSlots.length));
  const theoryHeader = [{ text: "Course" }, { text: "Section" }, { text: "Teacher", span: tMax }];
  const theoryWidths = columnWidths(doc, theoryRows, [1, 1, ...new Array(tMax).fill(1)], 56);
  while (theoryWidths.length < 2 + tMax) theoryWidths.push(56);
  drawPagedTable(doc, {
    title: ["Department of CSE", `Term Beginning from ${data.term}`, "Theory Courses"],
    header: theoryHeader,
    rows: theoryRows.map((r) => [...r, ...new Array(2 + tMax - r.length).fill("")]),
    widths: theoryWidths,
    rowHeight: 12,
    headerHeight: 12,
    layout: "portrait",
  });

  const sessRows = sessional.map((c) => [c.course_id, c.label, c.day, c.time, ...c.teacherSlots.map(name)]);
  const sMax = Math.max(1, ...sessional.map((c) => c.teacherSlots.length));
  const sessWidths = columnWidths(doc, sessRows, new Array(4 + sMax).fill(1), 48);
  while (sessWidths.length < 4 + sMax) sessWidths.push(48);
  drawPagedTable(doc, {
    title: ["Department of CSE", `Term Beginning from ${data.term}`, "Sessional Courses"],
    header: [{ text: "Course" }, { text: "Section" }, { text: "Day" }, { text: "Time" }, { text: "Teacher", span: sMax }],
    rows: sessRows.map((r) => [...r, ...new Array(4 + sMax - r.length).fill("")]),
    widths: sessWidths,
    rowHeight: 12,
    headerHeight: 12,
    layout: "portrait",
  });
  doc.end();
  return done;
}

/**
 * Each teacher's load, as the department counts it: a theory section is its
 * credit shared by the section's teachers; a lab slot is its weekly hours (3,
 * or 6 for a 3-credit lab that meets twice; half for two teachers sharing
 * it); thesis 6 hours for each thesis supervised and an MSc course 3.
 */
export function teacherLoads(data) {
  const { theory, sessional } = courseClasses(data);
  return data.teachers.map((t) => {
    const entries = [];
    let total = 0;
    for (const c of [...theory, ...sessional]) {
      const slot = c.teacherSlots.find((s) => s.includes(t.initial));
      if (!slot) continue;
      const load = (c.type === 1 ? labHours(c.credit) : c.credit) / slot.length;
      total += c.type === 1 ? load : load / c.teacherSlots.length;
      entries.push({ text: `${c.course_id}(${c.label})`, load });
    }
    const thesis =
      (t.offers_thesis_1 && data.thesis.includes(1) ? 6 : 0) + (t.offers_thesis_2 && data.thesis.includes(2) ? 6 : 0);
    if (thesis) {
      entries.push({ text: "Thesis", load: thesis });
      total += thesis;
    }
    if (t.offers_msc) {
      entries.push({ text: "MSc.", load: 3 });
      total += 3;
    }
    return { initial: t.initial, name: t.name, total, entries };
  });
}

export async function courseLoadBook() {
  const data = await loadReportData();
  const loads = teacherLoads(data);
  const { doc, done } = newDoc("Course Load");
  const maxCol = Math.max(1, ...loads.map((l) => l.entries.length));
  const rows = loads.map((l) => [
    l.name,
    `[ ${hours(l.total)} ]`,
    ...l.entries.map((e) => `${e.text}\n[ ${hours(e.load)} ]`),
    ...new Array(maxCol - l.entries.length).fill(""),
  ]);
  const nameWidth = Math.max(130, ...loads.map((l) => textWidth(doc, l.name) + 12));
  const colWidth = Math.min(64, (792 - 2 * MARGIN - nameWidth - 56) / maxCol);
  drawPagedTable(doc, {
    title: ["Department of CSE", `Term Beginning from ${data.term}`, "Load Calculation"],
    header: [{ text: "Teacher's Name" }, { text: "Total Load\n[CrHr]" }, { text: "CourseName(Sec)\n[Load in CrHr]", span: maxCol }],
    rows,
    widths: [nameWidth, 56, ...new Array(maxCol).fill(colWidth)],
    rowHeight: 24,
    headerHeight: 24,
    layout: "landscape",
  });
  doc.end();
  return done;
}

export { loadReportData, courseClasses };
