import pdf from "pdf-creator-node";
import { connect } from "../config/database.js";
import { optionalSectionLabelSQL } from "../sessional_scheduler/sectionLabel.js";

/*
 * The sessional distribution as a PDF, laid out like the department's
 * printed routines: one block of rows per day, each lab a three-hour cell
 * with "CSE216(A1), DBL" and its teachers "[ KRV, FRA, IAH/STP ]".
 */

const CURRENT_SESSION = "(SELECT value FROM configs WHERE key='CURRENT_SESSION')";
const MONTHS = {
  jan: "January", feb: "February", mar: "March", apr: "April", may: "May", jun: "June",
  jul: "July", aug: "August", sep: "September", oct: "October", nov: "November", dec: "December",
};

// "July-25" → "July 2025"
function termTitle(session) {
  const m = /^([A-Za-z]+)[-\s]*(\d{2,4})$/.exec((session || "").trim());
  if (!m) return session || "";
  const month = MONTHS[m[1].slice(0, 3).toLowerCase()] || m[1];
  const year = m[2].length === 2 ? `20${m[2]}` : m[2];
  return `${month} ${year}`;
}

const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Teachers in slot order, pairing half-lab teachers: KRV, ADR, IAH/STP
function teacherLine(teachers) {
  const slots = [];
  let openHalf = null;
  for (const t of teachers) {
    if (Number(t.share) !== 0.5) {
      slots.push([t.initial]);
    } else if (openHalf) {
      openHalf.push(t.initial);
      openHalf = null;
    } else {
      openHalf = [t.initial];
      slots.push(openHalf);
    }
  }
  return slots.map((s) => s.join("/")).join(", ");
}

async function loadDistribution() {
  const client = await connect();
  try {
    const cfg = Object.fromEntries(
      (
        await client.query(
          "SELECT key, value FROM configs WHERE key IN ('days', 'times', 'possibleLabTimes', 'CURRENT_SESSION')"
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
    const labTimes = parse(cfg.possibleLabTimes, [8, 11, 2]).map(Number);

    const rows = (
      await client.query(
        `SELECT sa.course_id, sa.batch, sa.section, sa.department, sa.day, sa."time", sa.room_no,
                c.class_per_week,
                ${optionalSectionLabelSQL("c", "sa.department", "sa.batch")} AS section_label
         FROM schedule_assignment sa
         JOIN courses c ON c.course_id = sa.course_id AND c.session = sa.session
         WHERE sa.session = ${CURRENT_SESSION} AND c.type = 1 AND sa.course_id LIKE 'CSE%'
         ORDER BY sa.course_id, sa.section`
      )
    ).rows;
    const subsections = (
      await client.query("SELECT department, batch, section FROM sections WHERE type = 1")
    ).rows;
    const teachers = (
      await client.query(
        `SELECT tsa.course_id, tsa.batch, tsa.section, tsa.initial, tsa.share::float AS share
         FROM teacher_sessional_assignment tsa
         JOIN teachers t ON t.initial = tsa.initial
         WHERE tsa.session = ${CURRENT_SESSION}
         ORDER BY t.seniority_rank`
      )
    ).rows;

    const entries = rows.map((r) => {
      // A whole-section lab is written as its subsections: A1/A2
      const subs = subsections
        .filter(
          (s) =>
            s.department === r.department &&
            s.batch === r.batch &&
            s.section !== r.section &&
            s.section.startsWith(r.section)
        )
        .map((s) => s.section)
        .sort();
      const section =
        r.section_label || (/^[A-Za-z]+$/.test(r.section) && subs.length ? subs.join("/") : r.section);
      const own = teachers.filter(
        (t) => t.course_id === r.course_id && t.batch === r.batch && t.section === r.section
      );
      return {
        day: r.day,
        time: Number(r.time),
        title: `${r.course_id}(${section}),${r.room_no ? ` ${r.room_no}` : ""}`,
        teachers: own.length ? `[ ${teacherLine(own)} ]` : "",
      };
    });

    return { days, times, labTimes, entries, term: termTitle(cfg.CURRENT_SESSION) };
  } finally {
    client.release();
  }
}

function buildHtml({ days, times, labTimes, entries, term }) {
  // Lab slots, each three periods wide, in the order of the day
  const blocks = [];
  for (let i = 0; i < times.length; ) {
    if (labTimes.includes(times[i])) {
      const span = Math.min(3, times.length - i);
      blocks.push({ start: times[i], span, lab: true });
      i += span;
    } else {
      blocks.push({ start: times[i], span: 1, lab: false });
      i += 1;
    }
  }
  const periods = blocks.reduce((n, b) => n + b.span, 0);
  // Same column widths in every table, so the day tables line up
  const colgroup = `<colgroup><col style="width:9%">${`<col style="width:${91 / periods}%">`.repeat(periods)}</colgroup>`;
  const byCourse = (a, b) => a.title.localeCompare(b.title, undefined, { numeric: true });

  // Each day is its own table so a page break never splits a day
  let body = "";
  for (const day of days) {
    const byBlock = blocks.map((b) =>
      b.lab ? entries.filter((e) => e.day === day && e.time === b.start).sort(byCourse) : []
    );
    const rows = Math.max(1, ...byBlock.map((list) => list.length));
    body += `<table class="day-table">${colgroup}<tbody>`;
    for (let r = 0; r < rows; r++) {
      body += "<tr>";
      if (r === 0) {
        body += `<td class="day" rowspan="${rows}">${escapeHtml(day.slice(0, 3).toUpperCase())}</td>`;
      }
      blocks.forEach((b, bi) => {
        const list = byBlock[bi];
        if (r < list.length) {
          const e = list[r];
          body += `<td class="lab" colspan="${b.span}">${escapeHtml(e.title)}${
            e.teachers ? `<br>${escapeHtml(e.teachers)}` : ""
          }</td>`;
        } else {
          // The rest of the block reads as one tall empty cell per period: side
          // borders only, closed at the bottom of the day. (Tall cells made
          // with rowspan lose their borders in the PDF renderer.)
          const cls = r === rows - 1 ? "empty last" : "empty";
          for (let k = 0; k < b.span; k++) body += `<td class="${cls}">&nbsp;</td>`;
        }
      });
      body += "</tr>";
    }
    body += "</tbody></table>";
  }

  const header = blocks
    .flatMap((b) => times.slice(times.indexOf(b.start), times.indexOf(b.start) + b.span))
    .map((t) => `<th>${t}</th>`)
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #000; }
  .title { text-align: center; font-weight: bold; font-style: italic; font-size: 13px; line-height: 1.35; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.day-table { margin-top: -1px; page-break-inside: avoid; }
  th, td { border: 1px solid #000; text-align: center; vertical-align: middle; }
  th { font-weight: normal; font-size: 10px; height: 26px; }
  td.day { font-size: 10px; }
  td.lab { font-size: 9px; line-height: 1.3; padding: 2px 3px; height: 24px; }
  td.empty { padding: 0; border-top: none; border-bottom: none; }
  td.empty.last { border-bottom: 1px solid #000; }
  tr { page-break-inside: avoid; }
</style>
</head>
<body>
  <div class="title">Department of CSE<br>Term Beginning from ${escapeHtml(term)}<br>Sessional Distribution</div>
  <table>${colgroup}<thead><tr><th>Day</th>${header}</tr></thead></table>
  ${body}
</body>
</html>`;
}

export async function sessionalDistributionPDF(req, res, next) {
  try {
    const data = await loadDistribution();
    const buffer = await pdf.create(
      { html: "{{{body}}}", data: { body: buildHtml(data) }, type: "buffer" },
      { format: "Letter", orientation: "portrait", border: "12mm" }
    );
    const name = `Sessional_Distribution_${data.term.replace(/\s+/g, "_")}.pdf`;
    res
      .status(200)
      .set("Content-Type", "application/pdf")
      .set("Content-Disposition", `attachment; filename="${name}"`)
      .send(buffer);
  } catch (err) {
    next(err);
  }
}

// Exposed for tests
export { buildHtml, termTitle, teacherLine };
