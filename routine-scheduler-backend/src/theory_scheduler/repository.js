import { createHash } from "node:crypto";
import { connect } from "../config/database.js";
import { HttpError } from "../config/error-handle.js";
import { validateTheoryAssignments } from "./algorithm.js";

const keyOf = (department, batch, section) =>
  `${department}|${batch}|${String(section).replace(/[0-9]+$/, "")}`;
const unique = (items) => [...new Set(items.filter(Boolean))];

export async function loadTheoryProblemDB(department, levelTerm, existingClient = null) {
  const client = existingClient || await connect();
  try {
    const session = (await client.query("SELECT value FROM configs WHERE key = 'CURRENT_SESSION'")).rows[0]?.value;
    if (!session) throw new HttpError(400, "Current session is not configured");
    const sectionRows = (await client.query(
      `SELECT s.department, s.batch, s.section, s.level_term
       FROM sections s
       JOIN level_term_unique lt ON lt.department = s.department AND lt.level_term = s.level_term
       WHERE lt.active AND lt.batch = s.batch AND s.type = 0 AND s.department = $1 AND s.level_term = $2
       ORDER BY s.section`,
      [department, levelTerm]
    )).rows;
    if (!sectionRows.length) throw new HttpError(400, "No active sections for this level-term");
    const batch = sectionRows[0].batch;
    const sectionKeys = sectionRows.map((s) => keyOf(s.department, s.batch, s.section));
    const configRows = (await client.query(
      "SELECT key, value FROM configs WHERE key IN ('days', 'times') ORDER BY key"
    )).rows;
    const config = Object.fromEntries(configRows.map((r) => [r.key, JSON.parse(r.value)]));
    const days = config.days || ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"];
    const times = (config.times || [8, 9, 10, 11, 12, 1, 2, 3, 4]).map(Number);
    const slots = days.flatMap((day) =>
      times.filter((time) => time !== 1).map((time) => ({ day, time })));

    const courseRows = (await client.query(
      `SELECT cs.course_id, cs.department, cs.batch, cs.section, cs.teachers,
              c.class_per_week, c.optional, c.optional_section_count, c.option_group
       FROM courses_sections cs
       JOIN courses c ON c.course_id = cs.course_id AND c.session = cs.session
       JOIN sections s ON s.department = cs.department AND s.batch = cs.batch AND s.section = cs.section
       WHERE cs.session = $1 AND cs.department = $2 AND s.level_term = $3
         AND s.type = 0 AND c.type = 0 AND cs.course_id <> 'CT'
       ORDER BY cs.course_id, cs.section`,
      [session, department, levelTerm]
    )).rows;
    const allSectionRows = (await client.query(
      "SELECT department, batch, section FROM sections WHERE type = 0 ORDER BY department, batch, section"
    )).rows;
    const mainSections = new Map();
    for (const s of allSectionRows) {
      const k = `${s.department}|${s.batch}`;
      if (!mainSections.has(k)) mainSections.set(k, []);
      mainSections.get(k).push(keyOf(s.department, s.batch, s.section));
    }
    const csRows = (await client.query(
      `SELECT course_id, department, batch, section, teachers
       FROM courses_sections WHERE session = $1
       ORDER BY course_id, department, batch, section`,
      [session]
    )).rows;
    const csTeachers = new Map(csRows.map((r) => [
      `${r.course_id}|${r.department}|${r.batch}|${r.section}`, r.teachers || [],
    ]));
    const labTeacherRows = (await client.query(
      `SELECT course_id, batch, section, initial, share::float AS share
       FROM teacher_sessional_assignment WHERE session = $1
       ORDER BY course_id, batch, section, initial`,
      [session]
    )).rows;
    const labTeachers = new Map();
    const halfLabTeachers = new Map();
    for (const r of labTeacherRows) {
      const k = `${r.course_id}|${r.batch}|${r.section}`;
      labTeachers.set(k, [...(labTeachers.get(k) || []), r.initial]);
      if (Number(r.share) === 0.5) halfLabTeachers.set(k, [...(halfLabTeachers.get(k) || []), r.initial]);
    }
    const scheduleRows = (await client.query(
      `SELECT sa.course_id, sa.department, sa.batch, sa.section, sa.day, sa.time,
              sa.teachers, sa.locked, c.type, c.optional, c.optional_section_count, c.option_group
       FROM schedule_assignment sa
       LEFT JOIN courses c ON c.course_id = sa.course_id AND c.session = sa.session
       WHERE sa.session = $1
       ORDER BY sa.department, sa.batch, sa.section, sa.day, sa.time, sa.course_id`,
      [session]
    )).rows;
    const marker = `THEORY_GENERATED:${session}:${department}:${batch}`;
    const initialized = (await client.query(
      "SELECT value FROM configs WHERE key = $1", [marker]
    )).rows[0]?.value === "1";
    const offered = new Set(courseRows.map((r) => r.course_id));
    const generatedRow = (r) =>
      initialized && r.department === department && Number(r.batch) === Number(batch) &&
      Number(r.type) === 0 && offered.has(r.course_id) && !r.locked;
    const fixedRows = scheduleRows.filter((r) => !generatedRow(r));
    const fixed = fixedRows.map((r) => {
      const singleOptional = Number(r.optional) === 1 && Number(r.optional_section_count) <= 1;
      const sections = singleOptional
        ? mainSections.get(`${r.department}|${r.batch}`) || [keyOf(r.department, r.batch, r.section)]
        : [keyOf(r.department, r.batch, r.section)];
      const start = times.indexOf(Number(r.time));
      const hours = Number(r.type) === 1 && start >= 0
        ? times.slice(start, start + 3)
        : [Number(r.time)];
      return {
        course_id: r.course_id,
        type: r.type == null ? null : Number(r.type),
        sections,
        teachers: unique([
          ...(r.teachers || []),
          ...(csTeachers.get(`${r.course_id}|${r.department}|${r.batch}|${r.section}`) || []),
          ...(labTeachers.get(`${r.course_id}|${r.batch}|${r.section}`) || []),
        ]).filter(initial => Number(r.type) !== 1 ||
          !(halfLabTeachers.get(`${r.course_id}|${r.batch}|${r.section}`) || []).includes(initial)),
        day: r.day, time: Number(r.time), hours,
        optional: Number(r.optional) === 1,
        option_group: r.option_group,
      };
    });

    // Supervisors' thesis blocks appear in the teacher routine even though
    // thesis rows themselves have no teacher array.
    const thesisSlots = (await client.query(
      "SELECT thesis, day, start_time, end_time FROM thesis_slots ORDER BY thesis"
    )).rows;
    const activeTheses = new Set((await client.query(
      "SELECT DISTINCT thesis FROM level_term_unique WHERE active AND thesis IS NOT NULL ORDER BY thesis"
    )).rows.map((r) => Number(r.thesis)));
    const teacherRows = (await client.query(
      "SELECT initial, offers_thesis_1, offers_thesis_2 FROM teachers WHERE active = 1 ORDER BY initial"
    )).rows;
    for (const teacher of teacherRows) {
      for (const slot of thesisSlots) {
        if (!activeTheses.has(Number(slot.thesis))) continue;
        if (!(slot.thesis === 1 ? teacher.offers_thesis_1 : teacher.offers_thesis_2)) continue;
        const first = times.indexOf(Number(slot.start_time));
        const last = times.indexOf(Number(slot.end_time));
        if (first >= 0 && last >= first) fixed.push({
          course_id: `THESIS ${slot.thesis}`, sections: [], teachers: [teacher.initial],
          day: slot.day, time: Number(slot.start_time), hours: times.slice(first, last + 1),
          optional: false, option_group: null,
        });
      }
    }

    const byCourse = new Map();
    for (const row of courseRows) {
      if (!byCourse.has(row.course_id)) byCourse.set(row.course_id, []);
      byCourse.get(row.course_id).push(row);
    }
    const units = [];
    const sectionsForCourse = {};
    const preflight = [];
    if (!courseRows.length) preflight.push("No theory courses are offered for this level-term");
    for (const row of fixedRows) {
      if (row.department === department && Number(row.batch) === Number(batch) &&
          row.course_id === "CT" && Number(row.time) !== 8) {
        preflight.push(`CT (${row.section}) is fixed at ${row.time}:00; move it to 8 AM before generating`);
      }
      if (row.department === department && Number(row.batch) === Number(batch) &&
          Number(row.type) === 0 && offered.has(row.course_id) && Number(row.time) === 1) {
        preflight.push(`${row.course_id} (${row.section}) is fixed at 1 PM; move it manually before generating`);
      }
    }
    for (const [courseId, rows] of byCourse) {
      const meetings = Number(rows[0].class_per_week);
      if (!Number.isInteger(meetings) || meetings < 0) {
        preflight.push(`${courseId}: weekly theory meetings must be a nonnegative integer`);
        continue;
      }
      if (meetings > days.length) {
        preflight.push(`${courseId}: ${meetings} weekly meetings cannot fit on ${days.length} distinct days`);
        continue;
      }
      // More than one optional group is a capacity allocation, not one
      // meeting per offered section. Do not silently overschedule it until
      // the group's section membership is explicitly represented.
      if (Number(rows[0].optional) === 1 &&
          Number(rows[0].optional_section_count) > 1 &&
          rows.length > Number(rows[0].optional_section_count)) {
        preflight.push(`${courseId}: multiple optional groups need explicit section allocation before automatic scheduling`);
        continue;
      }
      sectionsForCourse[courseId] = rows.map((r) => keyOf(r.department, r.batch, r.section));
      const singleOptional = Number(rows[0].optional) === 1 &&
        Number(rows[0].optional_section_count) <= 1;
      const groups = singleOptional ? [rows] : rows.map((r) => [r]);
      for (const group of groups) {
        const sections = group.map((r) => keyOf(r.department, r.batch, r.section));
        const previous = fixedRows.filter((r) =>
          r.course_id === courseId && r.department === department &&
          Number(r.batch) === Number(batch) &&
          (singleOptional || group.some((g) => g.section === r.section)));
        const fixedMeetings = unique(previous.map((r) => `${r.day}|${r.time}`));
        const fixedDays = fixedMeetings.map((x) => x.split("|")[0]);
        if (fixedDays.length !== new Set(fixedDays).size) {
          preflight.push(`${courseId} (${group.map((r) => r.section).join("/")}): already fixed twice on one day`);
        }
        if (fixedMeetings.length > meetings) {
          preflight.push(`${courseId} (${group.map((r) => r.section).join("/")}): ${fixedMeetings.length} fixed classes exceed ${meetings} weekly meetings`);
        }
        const perSectionTeachers = Object.fromEntries(group.map((r) => [
          r.section, unique(r.teachers || []),
        ]));
        for (let i = fixedMeetings.length; i < meetings; i++) {
          units.push({
            key: `${courseId}|${group[0].section}|${i + 1}`,
            course_id: courseId,
            sections,
            sectionNames: group.map((r) => r.section),
            teachers: unique(group.flatMap((r) => r.teachers || [])),
            perSectionTeachers,
            optional: Number(rows[0].optional) === 1,
            option_group: rows[0].option_group,
          });
        }
      }
    }
    const fingerprint = createHash("sha256").update(JSON.stringify({
      session, sectionRows, allSectionRows, configRows, courseRows, csRows, labTeacherRows, scheduleRows,
      teacherRows, thesisSlots, activeTheses: [...activeTheses], initialized,
    })).digest("hex");
    const warnings = unique(courseRows.filter((r) => !(r.teachers || []).length)
      .map((r) => `${r.course_id} has no assigned teacher for section ${r.section}; teacher clashes cannot be checked there`));
    const previewRows = fixedRows.filter((r) =>
      r.department === department && Number(r.batch) === Number(batch) &&
      sectionKeys.includes(keyOf(r.department, r.batch, r.section)))
      .map((r) => ({
        course_id: r.course_id, section: r.section, day: r.day,
        time: Number(r.time), type: r.type == null ? null : Number(r.type),
        optional: Number(r.optional) === 1,
        optional_section_count: Number(r.optional_section_count),
      }));
    return {
      department, levelTerm, session, batch, marker, initialized, fingerprint,
      days, times, slots, sections: sectionKeys,
      sectionNames: sectionRows.map((s) => s.section), previewRows, sectionsForCourse,
      courseIds: [...byCourse.keys()], units, fixed, preflight, warnings,
    };
  } finally {
    if (!existingClient) client.release();
  }
}

export async function applyTheorySuggestionDB({ department, levelTerm, fingerprint, assignments }) {
  const client = await connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    const problem = await loadTheoryProblemDB(department, levelTerm, client);
    if (problem.fingerprint !== fingerprint) {
      throw new HttpError(409, "The routine changed after this suggestion. Generate again before applying.");
    }
    if (problem.preflight.length) throw new HttpError(409, problem.preflight.join("; "));
    const issues = validateTheoryAssignments(problem, assignments);
    if (issues.length) throw new HttpError(409, issues.slice(0, 3).join("; "));

    const courseIds = problem.courseIds;
    if (!problem.initialized) {
      // Legacy manual rows have locked=false. Make them explicit fixed rows
      // before the first generated suggestion is saved.
      await client.query(
        `UPDATE schedule_assignment SET locked = true
         WHERE session = $1 AND department = $2 AND batch = $3
           AND course_id = ANY($4::varchar[])`,
        [problem.session, department, problem.batch, courseIds]
      );
    } else {
      await client.query(
        `DELETE FROM schedule_assignment
         WHERE session = $1 AND department = $2 AND batch = $3
           AND course_id = ANY($4::varchar[]) AND NOT locked`,
        [problem.session, department, problem.batch, courseIds]
      );
    }
    const unitOf = new Map(problem.units.map((u) => [u.key, u]));
    for (const a of assignments) {
      const unit = unitOf.get(a.key);
      for (const section of unit.sectionNames) {
        await client.query(
          `INSERT INTO schedule_assignment
             (course_id, session, department, batch, section, day, "time", room_no, teachers, locked)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8, false)`,
          [unit.course_id, problem.session, department, problem.batch, section,
            a.day, Number(a.time), unit.perSectionTeachers[section] || []]
        );
      }
    }
    await client.query(
      `INSERT INTO configs (key, value) VALUES ($1, '1')
       ON CONFLICT (key) DO UPDATE SET value = '1'`,
      [problem.marker]
    );
    await client.query("COMMIT");
    return { saved: assignments.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
