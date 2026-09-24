import { createHash } from "node:crypto";
import { connect } from "../config/database.js";
import { HttpError } from "../config/error-handle.js";
import { displacedByPins, validatePinnedClasses, validateTheoryAssignments } from "./algorithm.js";

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
              c.name, c.class_per_week, c.optional, c.optional_section_count, c.option_group
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
    const toEvent = (r) => {
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
    };
    const fixed = fixedRows.map(toEvent);
    // Classes a previous suggestion placed; a shared optional class has a
    // row in every section but is one meeting.
    const generated = [...new Map(scheduleRows.filter(generatedRow).map((r) => {
      const event = toEvent(r);
      return [`${r.course_id}|${event.sections.join(",")}|${r.day}|${r.time}`, event];
    })).values()];

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
    // Per course and section: meetings fixed by hand, which the generator
    // keeps, and meetings a previous suggestion placed, which it replaces.
    const slotOrder = (r) => days.indexOf(r.day) * 100 + times.indexOf(Number(r.time));
    const ownRows = scheduleRows.filter((r) => r.department === department &&
      Number(r.batch) === Number(batch) && Number(r.type) === 0 && offered.has(r.course_id))
      .sort((a, b) => slotOrder(a) - slotOrder(b));
    const courseStatus = [...byCourse].map(([courseId, rows]) => ({
      course_id: courseId,
      name: rows[0].name,
      class_per_week: Number(rows[0].class_per_week),
      shared: Number(rows[0].optional) === 1 && Number(rows[0].optional_section_count) <= 1,
      sections: rows.map((row) => {
        const meetings = ownRows.filter((r) => r.course_id === courseId && r.section === row.section);
        const slot = (r) => ({ day: r.day, time: Number(r.time) });
        return {
          section: row.section,
          fixed: meetings.filter((r) => !generatedRow(r)).map(slot),
          generated: meetings.filter(generatedRow).map(slot),
        };
      }),
    }));
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
      courseIds: [...byCourse.keys()], units, fixed, generated, courseStatus,
      batchSectionNames: (mainSections.get(`${department}|${batch}`) || []).map((k) => k.split("|")[2]),
      preflight, warnings,
    };
  } finally {
    if (!existingClient) client.release();
  }
}

// From the first generation on, only locked theory classes are fixed.
// Legacy manual rows have locked=false, so they are locked beforehand.
async function markInitialized(client, problem) {
  if (problem.initialized) return;
  await client.query(
    `UPDATE schedule_assignment SET locked = true
     WHERE session = $1 AND department = $2 AND batch = $3
       AND course_id = ANY($4::varchar[])`,
    [problem.session, problem.department, problem.batch, problem.courseIds]
  );
  await client.query(
    `INSERT INTO configs (key, value) VALUES ($1, '1')
     ON CONFLICT (key) DO UPDATE SET value = '1'`,
    [problem.marker]
  );
}

const namesOf = (sectionKeys) => sectionKeys.map((key) => key.split("|")[2]);

/**
 * Fixes meetings of one theory course before generation, e.g. IPE493 on
 * Wednesday at 9 for A, 10 for B and 11 for C. `placements` are
 * { section, day, time }; a course every section takes together needs one.
 * Generated meetings in the way are released for the next generation.
 */
export async function fixTheoryClassesDB({ department, levelTerm, courseId, placements }) {
  const client = await connect();
  try {
    await client.query("BEGIN");
    const problem = await loadTheoryProblemDB(department, levelTerm, client);
    const status = problem.courseStatus.find((c) => c.course_id === courseId);
    if (!status) throw new HttpError(404, `${courseId} is not a theory course of ${levelTerm}`);
    const pins = placements.map(({ section, day, time }) => {
      const unit = problem.units.find((u) => u.course_id === courseId && u.sectionNames.includes(section));
      const group = status.sections.find((s) => s.section === section);
      if (!group) throw new HttpError(400, `${courseId} is not offered to section ${section}`);
      if (!unit) {
        throw new HttpError(409, `${courseId} (${section}): all ${status.class_per_week} weekly meetings are already fixed; unpin one first`);
      }
      if (!problem.days.includes(day)) throw new HttpError(400, `${day} is not a teaching day`);
      return { ...unit, day, time: Number(time) };
    });
    const issues = validatePinnedClasses(problem, pins);
    if (issues.length) throw new HttpError(409, issues.join("; "));

    const released = displacedByPins(pins, problem.generated);
    for (const event of released) {
      await client.query(
        `DELETE FROM schedule_assignment
         WHERE session = $1 AND department = $2 AND batch = $3 AND course_id = $4
           AND section = ANY($5::varchar[]) AND day = $6 AND "time" = $7 AND NOT locked`,
        [problem.session, department, problem.batch, event.course_id,
          namesOf(event.sections), event.day, event.time]
      );
    }
    const roomOf = new Map((await client.query(
      "SELECT section, room FROM sections WHERE department = $1 AND batch = $2 AND type = 0",
      [department, problem.batch]
    )).rows.map((r) => [r.section, r.room]));
    for (const [i, pin] of pins.entries()) {
      for (const section of pin.sectionNames) {
        await client.query(
          `INSERT INTO schedule_assignment
             (course_id, session, department, batch, section, day, "time", room_no, teachers, locked)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
          [courseId, problem.session, department, problem.batch, section, pin.day, pin.time,
            roomOf.get(placements[i].section) || null, pin.perSectionTeachers[section] || []]
        );
      }
    }
    await client.query("COMMIT");
    return {
      fixed: pins.length,
      released: released.map((e) =>
        `${e.course_id} (${namesOf(e.sections).join("/")}) ${e.day} ${e.time}:00`),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Lets the generator move a fixed theory meeting on the next generation. */
export async function unfixTheoryClassDB({ department, levelTerm, courseId, section, day, time }) {
  const client = await connect();
  try {
    await client.query("BEGIN");
    const problem = await loadTheoryProblemDB(department, levelTerm, client);
    const status = problem.courseStatus.find((c) => c.course_id === courseId);
    const entry = status?.sections.find((s) => s.section === section);
    if (!entry?.fixed.some((m) => m.day === day && m.time === Number(time))) {
      throw new HttpError(404, `${courseId} (${section}) has no fixed class on ${day} at ${time}:00`);
    }
    await markInitialized(client, problem);
    const sections = status.shared ? status.sections.map((s) => s.section) : [section];
    await client.query(
      `UPDATE schedule_assignment SET locked = false
       WHERE session = $1 AND department = $2 AND batch = $3 AND course_id = $4
         AND section = ANY($5::varchar[]) AND day = $6 AND "time" = $7`,
      [problem.session, department, problem.batch, courseId, sections, day, Number(time)]
    );
    await client.query("COMMIT");
    return { unfixed: sections.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
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

    await markInitialized(client, problem);
    await client.query(
      `DELETE FROM schedule_assignment
       WHERE session = $1 AND department = $2 AND batch = $3
         AND course_id = ANY($4::varchar[]) AND NOT locked`,
      [problem.session, department, problem.batch, problem.courseIds]
    );
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
    await client.query("COMMIT");
    return { saved: assignments.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
