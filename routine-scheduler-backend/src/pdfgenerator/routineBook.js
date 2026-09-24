import PDFDocument from "pdfkit";
import { connect } from "../config/database.js";
import { termTitle, teacherLine, compareRooms } from "./format.js";
import { effectiveRoomSQL } from "../theory_room_assignment/roomUse.js";

/*
 * The department's routine books (level-term, teacher, part-time teacher,
 * room and department routines), drawn like the printed ones: US Letter,
 * a day-by-period grid per routine, labs three periods wide, and classes that
 * overlap on a day stacked in rows. Geometry is in points, measured from the
 * printed routines.
 */

const CURRENT_SESSION = "(SELECT value FROM configs WHERE key='CURRENT_SESSION')";

// Left edges of the vertical rules: Day, then the nine periods
const COLUMN_X = [22.2, 70.3, 137.4, 204.5, 271.6, 328.4, 395.5, 443.6, 491.7, 539.9, 588.0];
const RULE = 0.9;
const HEAD_ROW = 11.63; // title, "Class Routine: …" and the period header
const DAY_ROW = 34.8; // one row of classes in a day
const TABLE_GAP = 11.6;
const STACK_CENTRE = 389.5; // routines on a page are centred on this line
const STACK_TOP = 44; // … but never start above it
const FONT_SIZE = 8;
const LINE_PITCH = 10.2;
const BASELINE_SHIFT = 2.8; // baseline below a line's vertical centre
const LAB_PERIODS = 3;

// The routines: a title, "Class Routine: …" and the period header above the
// grid. The sessional distribution: a narrower grid with only the header.
const ROUTINE_GRID = { columnX: COLUMN_X, headRow: HEAD_ROW, dayRow: DAY_ROW, titled: true };
const DISTRIBUTION_GRID = {
  columnX: Array.from({ length: 11 }, (_, i) => 64.5 + i * 48.12),
  headRow: 24.1,
  dayRow: 24.1,
  titled: false,
};

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];
const romanLevelTerm = (lt) =>
  lt.replace(/L-(\d+) T-(\d+)/, (_, l, t) => `L-${ROMAN[l] || l} T-${ROMAN[t] || t}`);
const letterOf = (section) => (section.match(/^[A-Za-z]+/) || [section])[0];
const isMainSection = (section) => /^[A-Za-z]+$/.test(section);

/* ------------------------------------------------------------------ data */

async function loadRoutineData() {
  const client = await connect();
  try {
    const cfg = Object.fromEntries(
      (
        await client.query(
          "SELECT key, value FROM configs WHERE key IN ('days', 'times', 'CURRENT_SESSION')"
        )
      ).rows.map((r) => [r.key, r.value])
    );
    const parse = (v, fallback) => {
      try {
        return JSON.parse(v);
      } catch {
        return fallback;
      }
    };
    const days = parse(cfg.days, ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"]);
    const times = parse(cfg.times, [8, 9, 10, 11, 12, 1, 2, 3, 4]).map(Number);

    const rows = (
      await client.query(
        `SELECT sa.course_id, sa.batch, sa.section, sa.department, sa.day, sa."time",
                ${effectiveRoomSQL()} AS room_no,
                sa.teachers, c.type, c.class_per_week, c.optional, c.optional_section_count,
                c."from", c."to", s.level_term
         FROM schedule_assignment sa
         JOIN courses c ON c.course_id = sa.course_id AND c.session = sa.session
         JOIN sections s ON s.department = sa.department AND s.batch = sa.batch AND s.section = sa.section
         WHERE sa.session = ${CURRENT_SESSION}`
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
    const sections = (
      await client.query("SELECT department, batch, section, type, level_term FROM sections")
    ).rows;
    const teachers = (
      await client.query(
        `SELECT initial, name, full_time_status, offers_thesis_1, offers_thesis_2, active
         FROM teachers ORDER BY seniority_rank NULLS LAST, initial`
      )
    ).rows;
    const rooms = (await client.query("SELECT room, type FROM rooms")).rows
      .sort(compareRooms)
      .map((r) => r.room);
    const levelTerms = (
      await client.query(
        `SELECT level_term, department, batch, thesis FROM level_term_unique
         WHERE active ORDER BY department, level_term`
      )
    ).rows;
    const thesisSlots = (await client.query("SELECT * FROM thesis_slots")).rows;

    return {
      days,
      times,
      term: termTitle(cfg.CURRENT_SESSION),
      classes: buildClasses(rows, labTeachers, sections, times),
      sections,
      teachers,
      rooms,
      levelTerms,
      thesisSlots,
    };
  } finally {
    client.release();
  }
}

/**
 * One entry per class in the routine: its span of periods, the label of the
 * students it is for (A, A1, A1/A2 for a 0.75-credit lab, A/B/C for an
 * elective every section takes), its room and teachers. Thesis hours of a
 * section are merged into one block.
 */
function buildClasses(rows, labTeachers, sections, times) {
  const mainsOf = new Map();
  const subsOf = new Map();
  for (const s of sections) {
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
  for (const t of labTeachers) {
    const k = `${t.course_id}|${t.batch}|${t.section}`;
    if (!labTeachersOf.has(k)) labTeachersOf.set(k, []);
    labTeachersOf.get(k).push(t);
  }

  const classes = [];
  const thesisHours = new Map();
  for (const r of rows) {
    const start = times.indexOf(Number(r.time));
    if (start < 0) continue;
    const type = Number(r.type);
    if (type === 2) {
      const k = `${r.department}|${r.batch}|${r.section}|${r.day}`;
      if (!thesisHours.has(k)) thesisHours.set(k, { row: r, hours: [] });
      thesisHours.get(k).hours.push(start);
      continue;
    }
    const batchKey = `${r.department}|${r.batch}`;
    const singleGroup = Boolean(r.optional) && Number(r.optional_section_count) <= 1;
    let label = r.section;
    if (singleGroup) {
      label = (mainsOf.get(batchKey) || [letterOf(r.section)]).join("/");
    } else if (type === 1 && isMainSection(r.section)) {
      const subs = subsOf.get(`${batchKey}|${r.section}`);
      if (subs && subs.length) label = subs.join("/");
    }

    let initials = (r.teachers || []).filter(Boolean);
    let teacherText = initials.length ? initials.join(", ") : "";
    if (type === 1) {
      const assigned = labTeachersOf.get(`${r.course_id}|${r.batch}|${r.section}`) || [];
      if (assigned.length) {
        initials = assigned.map((t) => t.initial);
        teacherText = teacherLine(assigned);
      }
    }

    classes.push({
      course_id: r.course_id,
      department: r.department,
      batch: r.batch,
      section: r.section,
      mainSection: letterOf(r.section),
      levelTerm: r.level_term,
      from: r.from,
      to: r.to,
      day: r.day,
      start,
      span: type === 1 ? Math.min(LAB_PERIODS, times.length - start) : 1,
      type,
      elective: singleGroup,
      label,
      room: r.room_no || "",
      initials,
      teachers: teacherText ? `[ ${teacherText} ]` : "",
    });
  }
  for (const { row, hours } of thesisHours.values()) {
    hours.sort((a, b) => a - b);
    // contiguous blocks of thesis hours
    let first = hours[0];
    for (let i = 1; i <= hours.length; i++) {
      if (i === hours.length || hours[i] !== hours[i - 1] + 1) {
        classes.push({
          course_id: row.course_id,
          department: row.department,
          batch: row.batch,
          section: row.section,
          mainSection: letterOf(row.section),
          levelTerm: row.level_term,
          day: row.day,
          start: first,
          span: hours[i - 1] - first + 1,
          type: 2,
          label: row.section,
          room: "",
          initials: [],
          teachers: "",
        });
        if (i < hours.length) first = hours[i];
      }
    }
  }
  return classes;
}

// The same class listed once per section (an elective for A/B/C) counts once
function uniqueClasses(classes) {
  const seen = new Set();
  return classes.filter((c) => {
    const k = `${c.course_id}|${c.department}|${c.batch}|${c.label}|${c.day}|${c.start}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const compact = (lines) => lines.filter((l) => l !== "" && l !== null && l !== undefined);

/* ----------------------------------------------------------------- books */

function levelTermTables(data, { levelTerm } = {}) {
  const tables = [];
  const cse = data.levelTerms
    .filter((lt) => lt.department === "CSE" && (!levelTerm || lt.level_term === levelTerm))
    .sort((a, b) => a.level_term.localeCompare(b.level_term));
  for (const lt of cse) {
    const mains = data.sections
      .filter((s) => s.department === "CSE" && s.batch === lt.batch && s.type === 0 && isMainSection(s.section))
      .map((s) => s.section)
      .sort();
    const [, level, term] = lt.level_term.match(/L-(\d+) T-(\d+)/) || [];
    // A class for part of the section, or for several sections, names them:
    // "CSE102 (A1)", "CSE406 (A1/A2)", "CSE423 (A/B/C)"; the section's own
    // classes need no label in its routine
    const named = (name, label) => (label && !isMainSection(label) ? `${name} (${label})` : name);
    for (const main of mains) {
      const items = data.classes
        .filter((c) => c.department === "CSE" && c.batch === lt.batch && c.mainSection === main)
        .map((c) => {
          if (c.type === 2) return item(c, [named(`THESIS (${romanLevelTerm(lt.level_term)})`, c.label)], { last: true });
          if (c.course_id === "CT") return item(c, [named("CT", c.label)]);
          return item(c, compact([named(c.course_id, c.label), c.room, c.teachers]));
        });
      tables.push({
        group: lt.level_term,
        title: `Level ${level}, Term ${term} (Sec ${main})`,
        items,
      });
    }
  }
  return tables;
}

function teacherTables(data, { initial, partTimeOnly = false } = {}) {
  const tables = [];
  const thesisOf = (n) => data.levelTerms.filter((lt) => Number(lt.thesis) === n);
  for (const t of data.teachers) {
    if (initial ? t.initial !== initial : !t.active) continue;
    if (partTimeOnly && t.full_time_status) continue;
    const items = uniqueClasses(
      data.classes.filter((c) => c.type !== 2 && c.course_id !== "CT" && c.initials.includes(t.initial))
    ).map((c) => item(c, compact([`${c.course_id}(${c.label})`, c.teachers, c.room])));
    for (const n of [1, 2]) {
      if (!(n === 1 ? t.offers_thesis_1 : t.offers_thesis_2)) continue;
      const slot = data.thesisSlots.find((s) => Number(s.thesis) === n);
      if (!slot) continue;
      const start = data.times.indexOf(Number(slot.start_time));
      const end = data.times.indexOf(Number(slot.end_time));
      if (start < 0 || end < start) continue;
      for (const lt of thesisOf(n)) {
        items.push({
          day: slot.day,
          start,
          span: end - start + 1,
          lines: [`THESIS (${lt.level_term})`],
          last: true,
        });
      }
    }
    // Every teacher is listed, even one with no class this term
    tables.push({ group: "", title: `${t.name} (${t.initial})`, items });
  }
  return tables;
}

function roomTables(data, { room } = {}) {
  const used = [...new Set(data.classes.map((c) => c.room).filter(Boolean))];
  const order = [...data.rooms.filter((r) => used.includes(r)), ...used.filter((r) => !data.rooms.includes(r)).sort()];
  const tables = [];
  for (const r of order) {
    if (room && r !== room) continue;
    const items = uniqueClasses(data.classes.filter((c) => c.room === r && c.type !== 2)).map((c) =>
      item(c, compact([c.course_id, c.label, c.teachers]))
    );
    tables.push({ group: "", title: `Room No: ${r}`, items });
  }
  return tables;
}

// Courses CSE takes from, or gives to, another department
function departmentTables(data, { department } = {}) {
  const byCourse = new Map();
  for (const c of data.classes) {
    if (c.type === 2 || c.course_id === "CT") continue;
    const dept = c.from !== "CSE" && c.to === "CSE" ? c.from : c.from === "CSE" && c.to !== "CSE" ? c.to : null;
    if (!dept || (department && dept !== department)) continue;
    const k = `${dept}|${c.levelTerm}|${c.course_id}`;
    if (!byCourse.has(k)) byCourse.set(k, { dept, levelTerm: c.levelTerm, course: c.course_id, theirs: c.from === dept, classes: [] });
    byCourse.get(k).classes.push(c);
  }
  return [...byCourse.values()]
    .sort(
      (a, b) =>
        a.dept.localeCompare(b.dept) ||
        a.levelTerm.localeCompare(b.levelTerm) ||
        Number(b.theirs) - Number(a.theirs) ||
        a.course.localeCompare(b.course, undefined, { numeric: true })
    )
    .map((g) => ({
      group: g.dept,
      title: `Class Routine For : Department of ${g.dept} (${romanLevelTerm(g.levelTerm)}) ${g.course}`,
      items: uniqueClasses(g.classes).map((c) => item(c, compact([c.course_id, `(${c.label})`, c.room]))),
    }));
}

const item = (c, lines, extra = {}) => ({ day: c.day, start: c.start, span: c.span, lines, ...extra });

/* ---------------------------------------------------------------- layout */

/**
 * Stacks a day's classes in rows (a class goes in the first row it fits),
 * lets a one-period class grow down over rows left empty under it, and fills
 * the rest with empty cells, one per period, each as tall as the free rows
 * allow — as the department's routine workbook merges its cells.
 */
function layoutDay(items, periods) {
  const sorted = [...items].sort(
    (a, b) => Number(Boolean(a.last)) - Number(Boolean(b.last)) || a.start - b.start || a.lines[0].localeCompare(b.lines[0], undefined, { numeric: true })
  );
  const grid = [];
  const placed = [];
  for (const it of sorted) {
    const end = Math.min(periods, it.start + it.span);
    let row = 0;
    for (;;) {
      if (!grid[row]) grid[row] = new Array(periods).fill(null);
      let free = true;
      for (let p = it.start; p < end; p++) if (grid[row][p]) free = false;
      if (free) break;
      row++;
    }
    for (let p = it.start; p < end; p++) grid[row][p] = it;
    placed.push({ item: it, row, rows: 1, start: it.start, end });
  }
  const rows = Math.max(1, grid.length);
  for (let r = 0; r < rows; r++) if (!grid[r]) grid[r] = new Array(periods).fill(null);

  const claimed = grid.map((row) => row.map((cell) => Boolean(cell)));
  // Only a one-period class grows down; a lab or thesis block keeps its row
  for (const pl of placed.sort((a, b) => a.row - b.row)) {
    if (pl.end - pl.start > 1) continue;
    let r = pl.row + 1;
    while (r < rows) {
      let free = true;
      for (let p = pl.start; p < pl.end; p++) if (claimed[r][p]) free = false;
      if (!free) break;
      for (let p = pl.start; p < pl.end; p++) claimed[r][p] = true;
      pl.rows++;
      r++;
    }
  }
  const empties = [];
  for (let p = 0; p < periods; p++) {
    let r = 0;
    while (r < rows) {
      if (claimed[r][p]) {
        r++;
        continue;
      }
      let len = 0;
      while (r + len < rows && !claimed[r + len][p]) len++;
      empties.push({ start: p, end: p + 1, row: r, rows: len });
      r += len;
    }
  }
  return { rows, placed, empties };
}

function layoutTable(table, data, geo = ROUTINE_GRID) {
  const periods = data.times.length;
  const days = data.days.map((day) => {
    const lay = layoutDay(
      table.items.filter((it) => it.day === day),
      periods
    );
    return { day, ...lay };
  });
  const height = (geo.titled ? 3 : 1) * geo.headRow + days.reduce((h, d) => h + d.rows * geo.dayRow, 0);
  return { ...table, days, height };
}

// Pages of routines: a new page per group (e.g. per level-term) when asked,
// and as many routines per page as fit
function paginate(tables, { maxHeight = 660, maxPerPage = Infinity, breakOnGroup = false }) {
  const pages = [];
  let page = [];
  let height = 0;
  for (const t of tables) {
    const needed = page.length ? height + TABLE_GAP + t.height : t.height;
    const newGroup = breakOnGroup && page.length && page[page.length - 1].group !== t.group;
    if (page.length && (needed > maxHeight || page.length >= maxPerPage || newGroup)) {
      pages.push(page);
      page = [];
      height = 0;
    }
    height = page.length ? height + TABLE_GAP + t.height : t.height;
    page.push(t);
  }
  if (page.length) pages.push(page);
  return pages;
}

/* --------------------------------------------------------------- drawing */

function rule(doc, x, y, w, h) {
  doc.rect(x, y, w, h).fill("#000");
}

function box(doc, x0, x1, y0, y1) {
  rule(doc, x0, y0, x1 - x0 + RULE, RULE);
  rule(doc, x0, y1, x1 - x0 + RULE, RULE);
  rule(doc, x0, y0, RULE, y1 - y0 + RULE);
  rule(doc, x1, y0, RULE, y1 - y0 + RULE);
}

// Lines of text centred in a box. A line too wide for the box wraps at its
// spaces, as the workbook's cells do; a word still too wide is shrunk to fit.
function centredText(doc, lines, x0, x1, y0, y1, { bold = false, size = FONT_SIZE } = {}) {
  const font = bold ? "Helvetica-Bold" : "Helvetica";
  const cx = (x0 + RULE + x1) / 2;
  const cy = (y0 + RULE + y1) / 2;
  const room = x1 - x0 - RULE - 2;
  doc.font(font).fontSize(size);
  const wrapped = [];
  for (const line of lines) {
    if (doc.widthOfString(line) <= room) {
      wrapped.push(line);
      continue;
    }
    let current = "";
    for (const word of line.split(" ")) {
      const next = current ? `${current} ${word}` : word;
      if (current && doc.widthOfString(next) > room) {
        wrapped.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) wrapped.push(current);
  }
  wrapped.forEach((line, i) => {
    doc.font(font).fontSize(size);
    const w = doc.widthOfString(line);
    if (w > room) doc.fontSize(Math.max(4.5, (size * room) / w));
    const width = doc.widthOfString(line);
    const baseline = cy - ((wrapped.length - 1) * LINE_PITCH) / 2 + i * LINE_PITCH + BASELINE_SHIFT;
    doc.text(line, cx - width / 2, baseline, { lineBreak: false, baseline: "alphabetic" });
  });
}

function drawTable(doc, table, top, data, geo = ROUTINE_GRID) {
  const X = geo.columnX;
  const left = X[0];
  const right = X[X.length - 1];
  let y = top;
  if (geo.titled) {
    box(doc, left, right, y, y + geo.headRow);
    centredText(doc, [table.title], left, right, y, y + geo.headRow, { bold: true });
    y += geo.headRow;
    box(doc, left, right, y, y + geo.headRow);
    centredText(doc, [`Class Routine: ${data.term}`], left, right, y, y + geo.headRow);
    y += geo.headRow;
  }
  if (!table.continued) {
    const labels = ["Day", ...data.times.map(String)];
    labels.forEach((label, i) => {
      box(doc, X[i], X[i + 1], y, y + geo.headRow);
      centredText(doc, [label], X[i], X[i + 1], y, y + geo.headRow);
    });
    y += geo.headRow;
  }

  for (const d of table.days) {
    const h = d.rows * geo.dayRow;
    box(doc, X[0], X[1], y, y + h);
    centredText(doc, [d.day.slice(0, 3).toUpperCase()], X[0], X[1], y, y + h);
    for (const pl of d.placed) {
      const x0 = X[pl.start + 1];
      const x1 = X[pl.end + 1];
      const y0 = y + pl.row * geo.dayRow;
      const y1 = y0 + pl.rows * geo.dayRow;
      box(doc, x0, x1, y0, y1);
      centredText(doc, pl.item.lines, x0, x1, y0, y1);
    }
    for (const e of d.empties) {
      const y0 = y + e.row * geo.dayRow;
      box(doc, X[e.start + 1], X[e.end + 1], y0, y0 + e.rows * geo.dayRow);
    }
    y += h;
  }
}

function drawHeader(doc, header) {
  if (!header) return;
  const [bold, plain] = header;
  doc.font("Helvetica-Bold").fontSize(12);
  const w1 = doc.widthOfString(bold);
  doc.font("Helvetica").fontSize(10);
  const w2 = doc.widthOfString(plain);
  const gap = 12;
  const x = (doc.page.width - w1 - gap - w2) / 2;
  doc.font("Helvetica-Bold").fontSize(12).text(bold, x, 33.2, { lineBreak: false, baseline: "alphabetic" });
  doc.font("Helvetica").fontSize(10).text(plain, x + w1 + gap, 33.2, { lineBreak: false, baseline: "alphabetic" });
}

function newDocument(title) {
  const doc = new PDFDocument({
    size: "LETTER",
    margin: 0,
    autoFirstPage: false,
    info: { Title: title, Author: "Department of CSE, BUET" },
  });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  return { doc, done };
}

function renderBook(tables, data, { title, header, maxPerPage, breakOnGroup }) {
  const laid = tables.map((t) => layoutTable(t, data));
  const pages = paginate(laid, { maxPerPage, breakOnGroup });
  const { doc, done } = newDocument(title);
  if (pages.length === 0) {
    doc.addPage();
    drawHeader(doc, header);
    doc.font("Helvetica").fontSize(10).text("No classes in the routine yet.", 0, 380, { width: doc.page.width, align: "center" });
  }
  for (const page of pages) {
    doc.addPage();
    drawHeader(doc, header);
    const height = page.reduce((h, t) => h + t.height, 0) + TABLE_GAP * (page.length - 1);
    let top = Math.max(STACK_TOP, STACK_CENTRE - height / 2);
    for (const t of page) {
      drawTable(doc, t, top, data);
      top += t.height + TABLE_GAP;
    }
  }
  doc.end();
  return done;
}

/* ------------------------------------------------------------------- API */

export async function levelTermBook(options = {}) {
  const data = await loadRoutineData();
  return renderBook(levelTermTables(data, options), data, {
    title: "Level-Term Routine",
    header: ["LEVEL-TERM ROUTINE", "Dept of CSE, BUET"],
    breakOnGroup: true,
  });
}

export async function teacherBook(options = {}) {
  const data = await loadRoutineData();
  return renderBook(teacherTables(data, options), data, {
    title: options.partTimeOnly ? "Part-Time Teacher Routine" : "Teacher Routine",
    maxPerPage: 2,
  });
}

export async function roomBook(options = {}) {
  const data = await loadRoutineData();
  return renderBook(roomTables(data, options), data, {
    title: "Room Routine",
    header: ["ROOM ROUTINE", "Dept of CSE, BUET"],
    maxPerPage: 2,
  });
}

/**
 * The sessional distribution: every CSE lab of the week in one grid, a day's
 * labs stacked in rows, "CSE216(A1), DBL" over "[ KRV, FRA, STP ]". A day
 * is kept on one page.
 */
export async function sessionalDistributionBook() {
  const data = await loadRoutineData();
  const geo = DISTRIBUTION_GRID;
  const items = data.classes
    .filter((c) => c.type === 1 && c.from === "CSE")
    .map((c) => item(c, compact([`${c.course_id}(${c.label})${c.room ? `, ${c.room}` : ""}`, c.teachers])));
  const table = layoutTable({ title: "", items }, data, geo);
  const { doc, done } = newDocument("Sessional Distribution");
  const TITLE_TOP = 62;
  const PAGE_TOP = 54;
  const PAGE_BOTTOM = 745;

  let pageDays = [];
  let y = 0;
  let first = true;
  const flush = () => {
    doc.addPage();
    let top = PAGE_TOP;
    if (first) {
      doc.font("Helvetica-BoldOblique").fontSize(12);
      ["Department of CSE", `Term Beginning from ${data.term}`, "Sessional Distribution"].forEach((line, i) => {
        const w = doc.widthOfString(line);
        doc.text(line, (doc.page.width - w) / 2, TITLE_TOP + 9 + i * 14.5, { lineBreak: false, baseline: "alphabetic" });
      });
      top = 113.9;
    }
    drawTable(doc, { days: pageDays, continued: !first }, top, data, geo);
    first = false;
    pageDays = [];
  };
  y = 113.9 + geo.headRow;
  for (const d of table.days) {
    const h = d.rows * geo.dayRow;
    if (pageDays.length && y + h > PAGE_BOTTOM) {
      flush();
      y = PAGE_TOP;
    }
    pageDays.push(d);
    y += h;
  }
  flush();
  doc.end();
  return done;
}

export async function departmentBook(options = {}) {
  const data = await loadRoutineData();
  return renderBook(departmentTables(data, options), data, { title: "Departmental Routine" });
}

// Exposed for tests
export { layoutDay, buildClasses, romanLevelTerm };
