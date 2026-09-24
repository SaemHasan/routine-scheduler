import ExcelJS from "exceljs";
import { connect } from "../config/database.js";
import { termTitle } from "./format.js";

/*
 * The term's course load plan, as the department's "Course Load" workbook
 * works it out: the theory and sessional load the term needs, what the
 * full-time teachers take, and how many part-time lecturers make up the rest.
 * Tabs: input, Total Load, Theory, Sessional — with live formulas.
 */

const CURRENT_SESSION = "(SELECT value FROM configs WHERE key='CURRENT_SESSION')";
const letterOf = (section) => (section.match(/^[A-Za-z]+/) || [section])[0];
const isMainSection = (section) => /^[A-Za-z]+$/.test(section);
const courseName = (id) => id.replace(/^([A-Za-z]+)(\d)/, "$1 $2"); // CSE101 → CSE 101
const levelTermShort = (lt) => lt.replace(/L-(\d+) T-(\d+)/, "$1-$2"); // L-1 T-1 → 1-1

// Load of each designation, and the lecturer load a part-time teacher takes
const DESIGNATION_LOADS = [
  { name: "Head of the Department", code: "HoD", load: 12 },
  { name: "Professor and Associate Professor", code: "P", load: 15 },
  { name: "Assistant Professor", code: "AP", load: 18 },
  { name: "Lecturer", code: "L", load: 21 },
];
const LAB_CODES = { DEPT_SW: "D-S/W", DEPT_HW: "D-H/W", DEPT_PRESENTATION: "D-PL", NON_DEPT: "ND" };
function designationCode(designation) {
  const d = String(designation || "").toLowerCase();
  if (d.includes("assistant")) return "AP";
  if (d.includes("professor")) return "P";
  if (d.includes("head")) return "HoD";
  return "L";
}

/* ------------------------------------------------------------------ data */

async function loadPlanData() {
  const client = await connect();
  const q = async (sql) => (await client.query(sql)).rows;
  try {
    const session = (await q(`SELECT value FROM configs WHERE key='CURRENT_SESSION'`))[0]?.value;
    const courseSections = await q(
      `SELECT cs.course_id, cs.batch, cs.section, cs.department, cs.teachers,
              c.name, c.type, c.class_per_week, c.optional, c.optional_section_count, c.option_group,
              c.sessional_type, c."to", c.level_term
       FROM courses_sections cs
       JOIN courses c ON c.course_id = cs.course_id AND c.session = cs.session
       WHERE cs.session = ${CURRENT_SESSION} AND c."from" = 'CSE' AND c.type IN (0, 1)
         AND cs.course_id <> 'CT'
       ORDER BY cs.course_id, cs.section`
    );
    const sections = await q(`SELECT department, batch, section, type FROM sections`);
    const levelTerms = await q(`SELECT level_term, department, batch, thesis FROM level_term_unique WHERE active`);
    const labTypes = await q(`SELECT code, name, teacher_count FROM sessional_types ORDER BY sort_order, code`);
    const teachers = await q(
      `SELECT initial, name, designation, teacher_credits_offered, offers_thesis_1, offers_thesis_2, offers_msc
       FROM teachers WHERE active = 1 AND full_time_status
       ORDER BY seniority_rank NULLS LAST, initial`
    );
    return { term: termTitle(session), courseSections, sections, levelTerms, labTypes, teachers };
  } finally {
    client.release();
  }
}

/** The numbers of the plan, as rows for each tab and a summary. */
export async function courseLoadPlan() {
  const data = await loadPlanData();
  const batchOf = new Map(data.levelTerms.map((lt) => [`${lt.department}|${lt.level_term}`, lt.batch]));
  const subsOf = new Map();
  for (const s of data.sections) {
    if (isMainSection(s.section)) continue;
    const k = `${s.department}|${s.batch}|${letterOf(s.section)}`;
    subsOf.set(k, (subsOf.get(k) || 0) + 1);
  }

  // Courses with the sections they run in: an elective alone in its option
  // runs in every section; one sharing its option is a single class
  const byCourse = new Map();
  for (const r of data.courseSections) {
    if (!byCourse.has(r.course_id)) byCourse.set(r.course_id, { ...r, rows: [] });
    byCourse.get(r.course_id).rows.push(r);
  }
  const courses = [...byCourse.values()].map((c) => {
    const single = Boolean(c.optional) && Number(c.optional_section_count) <= 1;
    let rows = c.rows;
    if (c.optional) {
      const letters = [...new Set(rows.map((r) => letterOf(r.section)))].sort();
      const keep = new Set(letters.slice(0, Math.max(1, Number(c.optional_section_count) || 1)));
      rows = rows.filter((r) => keep.has(letterOf(r.section)));
    }
    return { ...c, rows, single, credit: Number(c.class_per_week), batch: batchOf.get(`${c.to}|${c.level_term}`) };
  });
  const deptOrder = (a, b) =>
    Number(b.to === "CSE") - Number(a.to === "CSE") || a.to.localeCompare(b.to) ||
    a.level_term.localeCompare(b.level_term) || a.course_id.localeCompare(b.course_id, undefined, { numeric: true });

  // Theory: a course's sections; the electives of one option count as one row
  const theory = [];
  const optionRows = new Map();
  for (const c of courses.filter((c) => Number(c.type) === 0).sort(deptOrder)) {
    if (c.single && c.option_group) {
      const k = `${c.to}|${c.level_term}|${c.option_group}`;
      if (!optionRows.has(k)) {
        const row = { department: c.to, level_term: c.level_term, batch: c.batch, course: `OPTION ${c.option_group}`, credit: c.credit, sections: 0 };
        optionRows.set(k, row);
        theory.push(row);
      }
      optionRows.get(k).sections++;
      continue;
    }
    theory.push({ department: c.to, level_term: c.level_term, batch: c.batch, course: courseName(c.course_id), credit: c.credit, sections: c.rows.length });
  }

  // Sessional: weekly hours of one lab section (a 0.75-credit lab is 3 hours
  // every other week: 1.5) and the lab sections, subsections counted
  const teacherCount = new Map(data.labTypes.map((t) => [t.code, t.teacher_count]));
  const sessional = courses
    .filter((c) => Number(c.type) === 1)
    .sort(deptOrder)
    .map((c) => {
      const code = c.to === "CSE" ? c.sessional_type || "DEPT_SW" : "NON_DEPT";
      const labSections = c.rows.reduce(
        (n, r) => n + (isMainSection(r.section) ? subsOf.get(`${r.department}|${r.batch}|${r.section}`) || 1 : 1),
        0
      );
      return {
        department: c.to,
        level_term: c.level_term,
        batch: c.to === "CSE" ? c.batch : null,
        course: courseName(c.course_id),
        title: c.name,
        type: LAB_CODES[code] || code,
        typeCode: code,
        credit: 2 * c.credit,
        sections: labSections,
        teachers: teacherCount.get(code) || 2,
      };
    });

  // What each full-time teacher takes: a theory course's load (credit ×
  // sections) shared by its teachers, MSc 3, each thesis 6, and labs the rest
  const theses = new Set(data.levelTerms.map((lt) => Number(lt.thesis)).filter(Boolean));
  const theoryShare = new Map();
  for (const c of courses.filter((c) => Number(c.type) === 0 && c.course_id.startsWith("CSE"))) {
    const teachers = [...new Set(c.rows.flatMap((r) => r.teachers || []))];
    if (!teachers.length) continue;
    const share = (c.credit * c.rows.length) / teachers.length;
    for (const t of teachers) theoryShare.set(t, (theoryShare.get(t) || 0) + share);
  }
  const loads = data.teachers.map((t) => ({
    name: t.name,
    code: designationCode(t.designation),
    theory: Math.round((theoryShare.get(t.initial) || 0) * 100) / 100,
    msc: t.offers_msc ? 3 : 0,
    thesis: (t.offers_thesis_1 && theses.has(1) ? 6 : 0) + (t.offers_thesis_2 && theses.has(2) ? 6 : 0),
    load: Number(t.teacher_credits_offered) || 0,
  }));

  const sum = (rows, f) => rows.reduce((n, r) => n + f(r), 0);
  const theoryHours = sum(theory, (r) => r.credit * r.sections);
  const theorySections = sum(theory, (r) => r.sections);
  const sessionalHours = sum(sessional, (r) => r.credit * r.sections * r.teachers);
  const ft = {
    theory: sum(loads, (l) => l.theory),
    msc: sum(loads, (l) => l.msc),
    thesis: sum(loads, (l) => l.thesis),
    load: sum(loads, (l) => l.load),
  };
  ft.lab = ft.load - ft.theory - ft.msc - ft.thesis;
  const loadPerPartTimer = DESIGNATION_LOADS.find((d) => d.code === "L").load;
  const remaining = {
    sessional: sessionalHours - ft.lab,
    theory: theoryHours - ft.theory,
    extra: 0,
  };
  remaining.total = remaining.sessional + remaining.theory + remaining.extra;
  return {
    term: data.term,
    theory,
    sessional,
    loads,
    labTypes: data.labTypes,
    designationLoads: DESIGNATION_LOADS,
    summary: {
      theoryHours,
      theorySections,
      theorySectionsTaken: ft.theory / 3,
      sessionalHours,
      fullTime: ft,
      remaining,
      loadPerPartTimer,
      partTimersNeeded: Math.max(0, Math.ceil(remaining.total / loadPerPartTimer)),
      teacherCounts: {
        P: loads.filter((l) => l.code === "P" || l.code === "HoD").length,
        AP: loads.filter((l) => l.code === "AP").length,
        L: loads.filter((l) => l.code === "L").length,
      },
    },
  };
}

/* ---------------------------------------------------------------- workbook */

const FONT = { name: "Calibri", size: 12 };
const THIN = { style: "thin" };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const CENTER = { horizontal: "center", vertical: "middle", wrapText: true };
const YELLOW = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
const GREEN = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EAD3" } };

function put(ws, addr, value, { bold = false, fill, align = CENTER, border = true } = {}) {
  const cell = ws.getCell(addr);
  cell.value = value;
  cell.font = { ...FONT, bold };
  cell.alignment = align;
  if (border) cell.border = BORDER;
  if (fill) cell.fill = fill;
  return cell;
}
const f = (formula, result) => ({ formula, result });

/** The plan as the department's Course Load workbook. */
export async function courseLoadWorkbook() {
  const plan = await courseLoadPlan();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Department of CSE, BUET";
  const input = wb.addWorksheet("input", { views: [{ state: "frozen", ySplit: 1 }] });
  const total = wb.addWorksheet("Total Load", { views: [{ state: "frozen", ySplit: 1 }] });
  const theory = wb.addWorksheet("Theory");
  const sessional = wb.addWorksheet("Sessional");
  const s = plan.summary;

  /* Theory */
  theory.columns = [12, 12, 8, 12, 8, 10, 16, 18].map((width) => ({ width }));
  ["Department", "Level-Term", "Batch", "Course", "Credit", "Sections", "Teacher Count", "Total Credit Hours"].forEach((h, i) =>
    put(theory, `${String.fromCharCode(65 + i)}1`, h, { bold: true })
  );
  plan.theory.forEach((r, i) => {
    const n = i + 2;
    put(theory, `A${n}`, r.department);
    put(theory, `B${n}`, levelTermShort(r.level_term));
    put(theory, `C${n}`, r.department === "CSE" ? r.batch : null);
    put(theory, `D${n}`, r.course);
    put(theory, `E${n}`, r.credit);
    put(theory, `F${n}`, r.sections);
    put(theory, `G${n}`, f(`F${n}`, r.sections));
    put(theory, `H${n}`, f(`E${n}*F${n}`, r.credit * r.sections));
  });
  mergeRuns(theory, plan.theory, 2, [["A", (r) => r.department], ["B", (r) => `${r.department}|${r.level_term}`], ["C", (r) => `${r.department}|${r.level_term}`]]);
  const tEnd = plan.theory.length + 1;
  const tTot = tEnd + 1;
  put(theory, `E${tTot}`, "Total Theory Teachers", { bold: true });
  put(theory, `F${tTot}`, f(`SUM(F2:F${tEnd})`, s.theorySections), { bold: true });
  put(theory, `G${tTot}`, f(`SUM(G2:G${tEnd})`, s.theorySections), { bold: true });
  put(theory, `H${tTot}`, f(`SUM(H2:H${tEnd})`, s.theoryHours), { bold: true });
  [3, 2, 1].forEach((k, i) => {
    put(theory, `I${tTot + 3 + i}`, `Courses with ${k} teacher${k > 1 ? "s" : ""}`);
    put(theory, `J${tTot + 3 + i}`, f(`COUNTIF(G2:G${tEnd},${k})`, plan.theory.filter((r) => r.sections === k).length));
  });
  theory.getColumn("I").width = 24;

  /* Sessional */
  sessional.columns = [12, 12, 8, 12, 50, 9, 8, 13, 18, 15, 19, 15].map((width) => ({ width }));
  ["Department", "Level-Term", "Batch", "Course", "Title", "Type", "Credit", "Lab Sections", "Total Credit Hours", "Teacher Count", "Total Teacher Hours", "Lab Room Slot"].forEach(
    (h, i) => put(sessional, `${String.fromCharCode(65 + i)}1`, h, { bold: true })
  );
  const labTypeRows = plan.labTypes.length;
  plan.sessional.forEach((r, i) => {
    const n = i + 2;
    put(sessional, `A${n}`, r.department);
    put(sessional, `B${n}`, levelTermShort(r.level_term));
    put(sessional, `C${n}`, r.batch);
    put(sessional, `D${n}`, r.course);
    put(sessional, `E${n}`, r.title);
    put(sessional, `F${n}`, r.type);
    put(sessional, `G${n}`, r.credit);
    put(sessional, `H${n}`, r.sections);
    put(sessional, `I${n}`, f(`G${n}*H${n}`, r.credit * r.sections));
    put(sessional, `J${n}`, f(`INDEX(input!$C$8:$C$${7 + labTypeRows},MATCH(F${n},input!$B$8:$B$${7 + labTypeRows},0))`, r.teachers));
    put(sessional, `K${n}`, f(`I${n}*J${n}`, r.credit * r.sections * r.teachers));
    put(sessional, `L${n}`, f(`H${n}*G${n}/3`, (r.sections * r.credit) / 3));
  });
  mergeRuns(sessional, plan.sessional, 2, [["A", (r) => r.department], ["B", (r) => `${r.department}|${r.level_term}`], ["C", (r) => `${r.department}|${r.level_term}`]]);
  const sEnd = plan.sessional.length + 1;
  const sTot = sEnd + 1;
  const sumOf = (k) => plan.sessional.reduce((n, r) => n + k(r), 0);
  put(sessional, `H${sTot}`, f(`SUM(H2:H${sEnd})`, sumOf((r) => r.sections)), { bold: true });
  put(sessional, `I${sTot}`, f(`SUM(I2:I${sEnd})`, sumOf((r) => r.credit * r.sections)), { bold: true });
  put(sessional, `J${sTot}`, "Total Sessional Load", { bold: true });
  put(sessional, `K${sTot}`, f(`SUM(K2:K${sEnd})`, s.sessionalHours), { bold: true });
  put(sessional, `L${sTot}`, f(`SUM(L2:L${sEnd})`, sumOf((r) => (r.sections * r.credit) / 3)), { bold: true });

  /* Total Load */
  total.columns = [36, 6, 11, 13, 16, 9, 20, 11, 20].map((width) => ({ width }));
  ["Teacher Name", "", "UG theory", "MSc theory*", "Thesis Load", "Lab hrs", "Total load Assigned", "Total Load", "Remarks"].forEach((h, i) =>
    put(total, `${String.fromCharCode(65 + i)}1`, h, { bold: true })
  );
  plan.loads.forEach((l, i) => {
    const n = i + 2;
    const fill = l.code === "P" || l.code === "HoD" ? GREEN : undefined;
    const lab = l.load - (l.thesis + l.msc + l.theory);
    put(total, `A${n}`, l.name, { fill, align: { vertical: "middle" } });
    put(total, `B${n}`, l.code, { fill });
    put(total, `C${n}`, l.theory, { fill });
    put(total, `D${n}`, l.msc, { fill });
    put(total, `E${n}`, l.thesis, { fill });
    put(total, `F${n}`, f(`H${n}-(E${n}+D${n}+C${n})`, lab), { fill });
    put(total, `G${n}`, f(`SUM(C${n}:F${n})`, l.load), { fill });
    put(total, `H${n}`, l.load, { fill });
    put(total, `I${n}`, null, { fill });
  });
  const lEnd = plan.loads.length + 1;
  const lTot = lEnd + 1;
  const ft = s.fullTime;
  put(total, `A${lTot}`, "Total", { bold: true, align: { vertical: "middle" } });
  [["C", ft.theory], ["D", ft.msc], ["E", ft.thesis], ["F", ft.lab], ["G", ft.load], ["H", ft.load]].forEach(([col, v]) =>
    put(total, `${col}${lTot}`, f(`SUM(${col}2:${col}${lEnd})`, v), { bold: true })
  );
  put(total, `A${lTot + 3}`, "*Subject to BPGS meeting resolution on next semester's MSc course list", { border: false, align: { wrapText: true } });
  const r0 = lTot + 5;
  const rows = [
    ["Total Sessional Load Remaining", f(`Sessional!K${sTot}-F${lTot}`, s.remaining.sessional)],
    ["Total Theory Load Remaining", f(`Theory!H${tTot}-C${lTot}`, s.remaining.theory)],
    ["Extra Load", 0],
    ["Total Load Remaining", f(`C${r0}+C${r0 + 1}+C${r0 + 2}`, s.remaining.total)],
    ["Total Theory Course Sections", f(`Theory!G${tTot}`, s.theorySections)],
    ["Total Theory Course Sections Taken", f(`C${lTot}/3`, s.theorySectionsTaken)],
    ["Total Theory Course Sections Remaining", f(`C${r0 + 4}-C${r0 + 5}`, s.theorySections - s.theorySectionsTaken)],
    null,
    ["Load per Part-time Lecturer", f(`input!C5`, s.loadPerPartTimer)],
    ["Total Part-time Lecturer Needed", f(`CEILING(C${r0 + 3}/C${r0 + 8},1)`, s.partTimersNeeded)],
  ];
  rows.forEach((row, i) => {
    if (!row) return;
    const n = r0 + i;
    total.mergeCells(`A${n}:B${n}`);
    const last = i === rows.length - 1;
    put(total, `A${n}`, row[0], { bold: last, fill: last ? YELLOW : undefined });
    put(total, `C${n}`, row[1], { bold: last, fill: last ? YELLOW : undefined });
  });
  const remainingRow = r0;

  /* input */
  input.columns = [36, 13, 16, 4, 4, 38, 12, 4, 36, 12].map((width) => ({ width }));
  put(input, "A1", "Designation", { bold: true });
  put(input, "B1", "Code", { bold: true });
  put(input, "C1", "Load (credits)", { bold: true });
  DESIGNATION_LOADS.forEach((d, i) => {
    put(input, `A${i + 2}`, d.name, { align: { vertical: "middle" } });
    put(input, `B${i + 2}`, d.code);
    put(input, `C${i + 2}`, d.load);
  });
  put(input, "A7", "Lab Type", { bold: true });
  put(input, "B7", "Code", { bold: true });
  put(input, "C7", "Teacher Count", { bold: true });
  plan.labTypes.forEach((t, i) => {
    put(input, `A${i + 8}`, t.name, { align: { vertical: "middle" } });
    put(input, `B${i + 8}`, LAB_CODES[t.code] || t.code);
    put(input, `C${i + 8}`, t.teacher_count);
  });
  const ref = (label, formula, value, row, { highlight = false } = {}) => {
    put(input, `F${row}`, label, { fill: highlight ? YELLOW : undefined, bold: highlight });
    put(input, `G${row}`, f(formula, value), { bold: highlight });
  };
  ref("Total Sessional Load Remaining", `'Total Load'!C${remainingRow}`, s.remaining.sessional, 2);
  ref("Total Theory Load Remaining", `'Total Load'!C${remainingRow + 1}`, s.remaining.theory, 3);
  ref("Extra Load", `'Total Load'!C${remainingRow + 2}`, 0, 4);
  ref("Total Load Remaining", `'Total Load'!C${remainingRow + 3}`, s.remaining.total, 5);
  ref("Total Theory Course Sections", `'Total Load'!C${remainingRow + 4}`, s.theorySections, 6);
  ref("Total Theory Course Sections Taken", `'Total Load'!C${remainingRow + 5}`, s.theorySectionsTaken, 7);
  ref("Total Theory Course Sections Remaining", `'Total Load'!C${remainingRow + 6}`, s.theorySections - s.theorySectionsTaken, 8);
  ref("Load per Part-time Lecturer", `'Total Load'!C${remainingRow + 8}`, s.loadPerPartTimer, 10);
  ref("Total Part-time Lecturer Needed", `'Total Load'!C${remainingRow + 9}`, s.partTimersNeeded, 11, { highlight: true });
  const counts = [
    ["Professor and Associate Professor", `COUNTIF('Total Load'!$B$2:$B$${lEnd},"P")+COUNTIF('Total Load'!$B$2:$B$${lEnd},"HoD")`, s.teacherCounts.P],
    ["Assistant Professor", `COUNTIF('Total Load'!$B$2:$B$${lEnd},"AP")`, s.teacherCounts.AP],
    ["Lecturer", `COUNTIF('Total Load'!$B$2:$B$${lEnd},"L")`, s.teacherCounts.L],
  ];
  put(input, "J2", "Count", { bold: true });
  counts.forEach(([label, formula, v], i) => {
    put(input, `I${i + 3}`, label, { align: { vertical: "middle" } });
    put(input, `J${i + 3}`, f(formula, v));
  });
  [
    ["Total Load Available", `'Total Load'!H${lTot}`, ft.load],
    ["Thesis Load", `'Total Load'!E${lTot}`, ft.thesis],
    ["MSc Load", `'Total Load'!D${lTot}`, ft.msc],
    ["UG Theory Load", `'Total Load'!C${lTot}`, ft.theory],
    ["Sessional Load of FT Teachers", "J7-(J8+J9+J10)", ft.lab],
  ].forEach(([label, formula, v], i) => {
    put(input, `I${i + 7}`, label, { align: { vertical: "middle" } });
    put(input, `J${i + 7}`, f(formula, v));
  });
  [
    ["Total Theory Load", `Theory!H${tTot}`, s.theoryHours],
    ["Total Sessional Load", `Sessional!K${sTot}`, s.sessionalHours],
    ["Total Load", "SUM(J13:J14)", s.theoryHours + s.sessionalHours],
  ].forEach(([label, formula, v], i) => {
    put(input, `I${i + 13}`, label, { align: { vertical: "middle" } });
    put(input, `J${i + 13}`, f(formula, v));
  });

  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), plan };
}

// Merges runs of equal values in a column (a department's rows, a
// level-term's rows), as the workbook shows them
function mergeRuns(ws, rows, firstRow, columns) {
  for (const [col, key] of columns) {
    let start = 0;
    for (let i = 1; i <= rows.length; i++) {
      if (i === rows.length || key(rows[i]) !== key(rows[start])) {
        if (i - 1 > start) ws.mergeCells(`${col}${firstRow + start}:${col}${firstRow + i - 1}`);
        start = i;
      }
    }
  }
}
