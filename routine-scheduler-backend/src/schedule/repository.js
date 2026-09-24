import { connect } from "../config/database.js";
import { HttpError } from "../config/error-handle.js";
import { getTheoryTeacherAssignmentDB } from "../assignment/repository.js";
import { findSectionClashes } from "../sessional_scheduler/repository.js";
import { optionalSectionLabelSQL } from "../sessional_scheduler/sectionLabel.js";
import { effectiveRoomSQL } from "../theory_room_assignment/roomUse.js";

/**
 * Get schedule configuration values (times, days, possibleLabTimes)
 * @returns {Object} Schedule configuration values
 */
export async function getScheduleConfigs() {
  const client = await connect();
  try {
    // Get all schedule-related config values
    const query = `
      SELECT key, value
      FROM configs
      WHERE key IN ('times', 'days', 'possibleLabTimes')
    `;
    const results = await client.query(query);
    
    // Process the results
    const configs = {};
    for (const row of results.rows) {
      try {
        configs[row.key] = JSON.parse(row.value);
      } catch (e) {
        configs[row.key] = row.value;
      }
    }
    
    // Set defaults if not found
    if (!configs.times) configs.times = [8, 9, 10, 11, 12, 1, 2, 3, 4];
    if (!configs.days) configs.days = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"];
    if (!configs.possibleLabTimes) configs.possibleLabTimes = [8, 11, 2];
    
    return configs;
  } finally {
    client.release();
  }
}

export async function getTheorySchedule(department, batch, section) {
  // A single-group optional sessional is stored once (usually under A) but
  // students from every main section can take it. Project it into each
  // section's display without inserting duplicate schedule assignments.
  const query = `
    SELECT sa.course_id, c.type, c.name, c.optional, c.optional_section_count, sa."day", sa."time",
           sa.department,
           CASE WHEN c.type = 1 AND c.optional = 1 AND c.optional_section_count <= 1
                THEN $3 ELSE sa."section" END AS section,
           c.class_per_week, ${effectiveRoomSQL("sa", "c", "home")} AS room_no
    FROM schedule_assignment sa
    JOIN courses c ON c.course_id = sa.course_id AND c.session = sa.session
    LEFT JOIN sections home
      ON home.department = sa.department AND home.batch = sa.batch AND home.section = sa.section
    WHERE sa.department = $1 AND sa.batch = $2
      AND (sa."section" = $3 OR sa."section" LIKE $4
           OR (c.type = 1 AND c.optional = 1 AND c.optional_section_count <= 1
               AND EXISTS (
                 SELECT 1 FROM sections target
                 WHERE target.department = $1 AND target.batch = $2
                   AND target.section = $3 AND target.type = 0
               )))
      AND sa."session" = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
    ORDER BY sa."section", sa."day", sa."time", sa.course_id
  `;
  const values = [department, batch, section, `${section}%`];
  const client = await connect();
  const results = await client.query(query, values);
  client.release();

  // Organize results with subsections grouped under their main section
  const mainSectionSchedules = results.rows.filter(row => row.section === section);
  const subsectionSchedules = {};

  // Group subsection schedules
  results.rows.forEach(row => {
    if (row.section !== section) {
      if (!subsectionSchedules[row.section]) {
        subsectionSchedules[row.section] = [];
      }
      subsectionSchedules[row.section].push(row);
    }
  });

  return {
    mainSection: mainSectionSchedules,
    subsections: subsectionSchedules
  };
}

export async function setTheorySchedule(batch, section, course, schedule) {
  // Accepts: batch (int), section (string), course (string or empty), schedule (array of {day, time})
  const client = await connect();
  try {
    await client.query("BEGIN");
    const deleteQuery = `
      DELETE FROM schedule_assignment
      WHERE batch = $1
      AND "section" = $2
      AND "day" = $3
      AND "time" = $4
      AND "session" = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
      AND course_id NOT IN (SELECT course_id FROM courses WHERE type = 2)`;
    // Thesis hours are set on the Level Term page, not here
    if (course !== "None" && course !== "") {
      for (const slot of schedule) {
        const thesis = await client.query(
          `SELECT sa.course_id FROM schedule_assignment sa
           JOIN courses c ON c.course_id = sa.course_id AND c.session = sa.session
           WHERE sa.batch = $1 AND sa.section = $2 AND sa.day = $3 AND sa."time" = $4
             AND c.type = 2
             AND sa.session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')`,
          [batch, section, slot.day, slot.time]
        );
        if (thesis.rowCount > 0) {
          throw new HttpError(409, `Section ${section} has thesis on ${slot.day} at ${slot.time}:00`);
        }
      }
    }
    for (const slot of schedule) {
      await client.query(deleteQuery, [batch, section, slot.day, slot.time]);
    }
    if (course === "None" || course === "") {
      // Do nothing
    } else {
      // Insert each slot in schedule
      for (const slot of schedule) {
        // Insert new slot
        const getDeptQuery = `SELECT "to" FROM courses WHERE course_id = $1`;
        const deptResult = await client.query(getDeptQuery, [course]);
        const department = deptResult.rows[0].to;
        const teacherAssignments = await getTheoryTeacherAssignmentDB(course, section);
        const insertQuery = `
          INSERT INTO schedule_assignment (batch, "section", "session", course_id, "day", "time", department, room_no, teachers, locked)
          VALUES ($1, $2::varchar, (SELECT value FROM configs WHERE key='CURRENT_SESSION'), $3, $4, $5, $6::varchar, (SELECT room FROM sections WHERE batch = $1 AND section = $2::varchar AND department = $6::varchar), $7, true)
        `;
        await client.query(insertQuery, [batch, section, course, slot.day, slot.time, department, teacherAssignments]);
      }
    }
    await client.query("COMMIT");
    return true;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// What keeps main `sections` (with their lab subsections) busy in a period
// besides CT: a theory class, thesis, or a three-period lab covering it.
async function otherSectionsBusy(client, { session, department, batch, day, time, sections }) {
  const cfg = (await client.query("SELECT value FROM configs WHERE key = 'times'")).rows[0];
  const times = (cfg ? JSON.parse(cfg.value) : [8, 9, 10, 11, 12, 1, 2, 3, 4]).map(Number);
  const rows = (
    await client.query(
      `SELECT sa.course_id, sa.section, sa."time", c.type, c.optional, c.optional_section_count
       FROM schedule_assignment sa
       JOIN courses c ON c.course_id = sa.course_id AND c.session = sa.session
       WHERE sa.session = $1 AND sa.department = $2 AND sa.batch = $3 AND sa.day = $4
         AND sa.course_id <> 'CT'
       ORDER BY sa.section, sa."time", sa.course_id`,
      [session, department, batch, day]
    )
  ).rows;
  const busy = [];
  for (const row of rows) {
    const main = String(row.section).replace(/[0-9]+$/, "");
    // A lab every section takes as one group is stored under one section only
    const everyone = Number(row.type) === 1 && row.optional && Number(row.optional_section_count) <= 1;
    const affected = everyone ? sections : sections.filter((s) => s === main);
    if (!affected.length) continue;
    const start = times.indexOf(Number(row.time));
    const hours = Number(row.type) === 1 && start >= 0 ? times.slice(start, start + 3) : [Number(row.time)];
    if (!hours.includes(Number(time))) continue;
    busy.push(`${affected.join("/")} ${affected.length > 1 ? "have" : "has"} ${row.course_id}` +
      (Number(row.time) !== Number(time) ? ` (from ${row.time}:00)` : ""));
  }
  return [...new Set(busy)];
}

/**
 * Sets the theory classes a section has in one period. `course_ids` is the
 * whole list for the cell: classes not in it are taken out, new ones put in.
 * Labs and thesis in the cell are left alone.
 *
 * Only electives share a period (the courses of an option run side by side).
 * An elective that runs as a single group is taken by students of every
 * section, so it is placed in, and taken out of, all the batch's sections
 * together, in one room. CT is likewise set in all sections together.
 */
export async function setTheoryCellDB({ department, batch, section, day, time, course_ids }) {
  const client = await connect();
  try {
    await client.query("BEGIN");
    const session = (await client.query(`SELECT value FROM configs WHERE key='CURRENT_SESSION'`)).rows[0].value;
    const wanted = [...new Set((course_ids || []).filter(Boolean))];

    const courses = (
      await client.query(
        `SELECT course_id, type, optional, optional_section_count
         FROM courses WHERE session = $1 AND course_id = ANY($2::varchar[])`,
        [session, wanted]
      )
    ).rows;
    const courseOf = new Map(courses.map((c) => [c.course_id, c]));
    // Labs and thesis are set elsewhere; CT is a theory period of its own
    const theoryIds = wanted.filter((id) => courseOf.get(id) && Number(courseOf.get(id).type) === 0);
    const unknown = wanted.filter((id) => !courseOf.has(id));
    if (unknown.length) throw new HttpError(404, `${unknown.join(", ")} is not running this session`);
    if (theoryIds.length > 1 && theoryIds.some((id) => !courseOf.get(id).optional)) {
      throw new HttpError(409, `Only electives can share a period (${theoryIds.join(", ")})`);
    }

    const thesis = await client.query(
      `SELECT 1 FROM schedule_assignment sa
       JOIN courses c ON c.course_id = sa.course_id AND c.session = sa.session
       WHERE sa.department = $1 AND sa.batch = $2 AND sa.section = $3 AND sa.day = $4
         AND sa."time" = $5 AND c.type = 2 AND sa.session = $6`,
      [department, batch, section, day, time, session]
    );
    if (thesis.rowCount > 0 && theoryIds.length > 0) {
      throw new HttpError(409, `Section ${section} has thesis on ${day} at ${time}:00`);
    }

    const mainSections = (
      await client.query(
        `SELECT section, room FROM sections
         WHERE department = $1 AND batch = $2 AND type = 0 ORDER BY section`,
        [department, batch]
      )
    ).rows;
    const roomOf = new Map(mainSections.map((s) => [s.section, s.room]));
    const singleGroup = async (id) => {
      const c = courseOf.get(id) ||
        (await client.query(
          "SELECT optional, optional_section_count, type FROM courses WHERE course_id = $1 AND session = $2",
          [id, session]
        )).rows[0];
      return Boolean(c && c.optional && Number(c.type) === 0 && Number(c.optional_section_count) <= 1);
    };
    // The sections a class of this course occupies when put in `section`.
    // CT is common to the level-term, so it is in every section at once.
    const sectionsFor = async (id) =>
      id === "CT" || (await singleGroup(id)) ? mainSections.map((s) => s.section) : [section];

    const present = (
      await client.query(
        `SELECT sa.course_id FROM schedule_assignment sa
         JOIN courses c ON c.course_id = sa.course_id AND c.session = sa.session
         WHERE sa.department = $1 AND sa.batch = $2 AND sa.section = $3 AND sa.day = $4
           AND sa."time" = $5 AND sa.session = $6 AND c.type = 0`,
        [department, batch, section, day, time, session]
      )
    ).rows.map((r) => r.course_id);

    if (theoryIds.includes("CT") && !present.includes("CT")) {
      const busy = await otherSectionsBusy(client, {
        session, department, batch, day, time,
        sections: mainSections.map((s) => s.section).filter((s) => s !== section),
      });
      if (busy.length) {
        throw new HttpError(409, `CT is held in every section at once, but on ${day} at ${time}:00 ${busy.join(", ")}`);
      }
    }

    for (const id of present.filter((id) => !theoryIds.includes(id))) {
      await client.query(
        `DELETE FROM schedule_assignment
         WHERE course_id = $1 AND department = $2 AND batch = $3 AND section = ANY($4::varchar[])
           AND day = $5 AND "time" = $6 AND session = $7`,
        [id, department, batch, await sectionsFor(id), day, time, session]
      );
    }
    for (const id of theoryIds.filter((id) => !present.includes(id))) {
      // CT has neither a room nor teachers; an elective every section
      // takes together needs a room of its own, chosen on the rooms page
      const room = id === "CT" || (await singleGroup(id)) ? null : roomOf.get(section) || null;
      for (const sec of await sectionsFor(id)) {
        const teachers =
          id === "CT"
            ? []
            : (
                await client.query(
                  `SELECT teachers FROM courses_sections
                   WHERE course_id = $1 AND session = $2 AND batch = $3 AND section = $4 AND department = $5`,
                  [id, session, batch, sec, department]
                )
              ).rows[0]?.teachers || [];
        await client.query(
          `INSERT INTO schedule_assignment (course_id, session, batch, section, day, "time", department, room_no, teachers)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (course_id, session, batch, section, day, "time", department) DO NOTHING`,
          [id, session, batch, sec, day, time, department, room, teachers]
        );
      }
    }
    // A manual edit fixes the selected theory classes for future suggestions,
    // including the copies of a shared optional class in other sections.
    if (theoryIds.length) {
      await client.query(
        `UPDATE schedule_assignment sa SET locked = true
         FROM courses c
         WHERE c.course_id = sa.course_id AND c.session = sa.session AND c.type = 0
           AND sa.session = $1 AND sa.department = $2 AND sa.batch = $3
           AND sa.day = $4 AND sa."time" = $5
           AND sa.course_id = ANY($6::varchar[])
           AND (sa.section = $7 OR (c.optional = 1 AND c.optional_section_count <= 1))`,
        [session, department, batch, day, time, theoryIds, section]
      );
    }
    await client.query("COMMIT");
    return { course_ids: theoryIds };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function getSessionalSchedule(batch, section) {
  const query = `
    SELECT sa.course_id, sa."day", sa."time", sa.department, sa."section"
    FROM schedule_assignment sa
    JOIN courses c ON c.course_id = sa.course_id AND c.session = sa.session
    WHERE sa.batch = $1 AND sa."section" = $2 AND c.type = 1
      AND sa."session" = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
    ORDER BY sa."day", sa."time", sa.course_id
  `;
  const values = [batch, section];
  const client = await connect();
  const results = await client.query(query, values);
  client.release();
  return results.rows;
}

export async function setSessionalSchedule(batch, section, department, schedule) {
  console.log(batch, section, department, schedule);
  const client = await connect();
  try {
    await client.query("BEGIN");
    const course_id_query = `
      SELECT sa.course_id
      FROM schedule_assignment sa
      JOIN courses c ON c.course_id = sa.course_id AND c.session = sa.session
      WHERE sa.batch = $1
      AND sa."section" = $2
      AND sa.department = $3
      AND sa."day" = $4
      AND sa."time" = $5
      AND c.type = 1
      AND sa.session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
    `;
    const db_courses = (await client.query(course_id_query, [batch, section, department, schedule.day, schedule.time])).rows;

    if (schedule.course_id === "None") {
      await client.query(
        `DELETE FROM schedule_assignment
         WHERE batch = $1 AND "section" = $2 AND department = $3
           AND "day" = $4 AND "time" = $5
           AND session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
           AND course_id IN (SELECT course_id FROM courses WHERE type = 1
                            AND session = (SELECT value FROM configs WHERE key='CURRENT_SESSION'))
           AND ($6::varchar IS NULL OR course_id = $6)`,
        [batch, section, department, schedule.day, schedule.time, schedule.old_course_id || null]
      );
      await client.query("COMMIT");
      return true;
    }

    // A section never has two classes at once: theory, labs from the
    // level-term routine and other sessionals are all checked. `add` (from
    // the sessional distribution grid) never replaces what is in the cell;
    // otherwise (the level-term routine) choosing a course replaces it.
    if (schedule.course_id !== "None") {
      const clashes = await findSectionClashes(client, {
        course_id: schedule.course_id,
        batch,
        section,
        department,
        day: schedule.day,
        time: schedule.time,
        replacing: !schedule.add,
      });
      if (clashes.length > 0) {
        throw new HttpError(
          409,
          `${schedule.course_id} (${section}) clashes on ${schedule.day} with ${clashes.join(", ")}`
        );
      }
    }
    if (schedule.add || db_courses.length === 0) {
      const insert_query = `
        INSERT INTO schedule_assignment (batch, "section", "session", course_id, "day", "time", department, locked)
        VALUES ($1, $2, (SELECT value FROM configs WHERE key='CURRENT_SESSION'), $3, $4, $5, $6, true)
        ON CONFLICT (department, batch, section, day, "time", course_id)
        DO UPDATE SET locked = true
      `;
      await client.query(insert_query, [batch, section, schedule.course_id, schedule.day, schedule.time, department]);
    } else {
      const update_query = `
        UPDATE schedule_assignment
        SET course_id = $1, locked = true
        WHERE batch = $2 AND "section" = $3 AND department = $4
          AND "day" = $5 AND "time" = $6
          AND session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
          AND course_id IN (SELECT course_id FROM courses WHERE type = 1
                           AND session = (SELECT value FROM configs WHERE key='CURRENT_SESSION'))
          AND ($7::varchar IS NULL OR course_id = $7)
      `;
      await client.query(update_query, [schedule.course_id, batch, section, department, schedule.day, schedule.time, schedule.old_course_id || null]);
    }
    await client.query("COMMIT");
    return true;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function getTheoryScheduleForms() {
  const query = `
    SELECT response, teachers.initial, teachers.name, teachers.email, teachers.seniority_rank
    FROM forms
    INNER JOIN teachers ON forms.initial = teachers.initial
    WHERE type = 'theory-sched'
    `;

  const client = await connect();
  const results = (await client.query(query)).rows;
  client.release();
  return results;
}

export async function getTheoryScheduleTeachers() {
  const query = `
  select DISTINCT initial, cs.batch  from teacher_assignment ta join courses_sections cs using (course_id, "session")
  `;
  const client = await connect();
  const results = (await client.query(query)).rows;
  client.release();
  return results;
}

export async function nextInSeniority() {
  const query = `
  select distinct on (batch) id, course_id, batch, t.initial, t."name", t.email, t.surname from forms f join teacher_assignment ta using (initial) 
  join courses_sections cs using (course_id) natural join teachers t 
  where f."type" = 'theory-sched' and response is null order by batch, seniority_rank`;
  const client = await connect();
  const results = (await client.query(query)).rows;
  client.release();
  return results;
}

export async function getAllScheduleDB() {
  const query = `
  select * from schedule_assignment sa
  `;
  const client = await connect();
  const results = (await client.query(query)).rows;
  client.release();
  return results;
}

export async function getDepartmentalSessionalSchedule() {
  const query = `
    SELECT sa.course_id, sa.batch, sa."section", sa."day", sa."time", sa.department, c.class_per_week,
      sa.room_no, sa.locked, c."name", s.level_term, st.teacher_count,
      ${optionalSectionLabelSQL("c", "sa.department", "sa.batch")} AS section_label
    FROM schedule_assignment sa
    JOIN courses c ON sa.course_id = c.course_id AND sa.session = c.session
    LEFT JOIN sections s
      ON s.department = sa.department AND s.batch = sa.batch AND s.section = sa.section
    -- Teachers a section takes: set by the sessional type (a lab for another
    -- department is Non-Departmental; a departmental one with none is software)
    LEFT JOIN sessional_types st ON st.code = (
      CASE WHEN c."to" = 'CSE' THEN COALESCE(c.sessional_type, 'DEPT_SW') ELSE 'NON_DEPT' END
    )
    WHERE sa.course_id LIKE 'CSE%'
    AND c.type = 1
    AND sa."session" = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
    ORDER BY sa.course_id, sa."section"
  `;
  const client = await connect();
  const results = await client.query(query);
  client.release();
  return results.rows;
}

export async function teacherContradictionDB(batch, section, course_id) {
  const teacherQuery = `
  select initial from teacher_sessional_assignment ta where batch = $1 and "section" = $2 and course_id = $3 and session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
  `;

  const contradictionQuery = `
  select ta.initial, sa.* from teacher_assignment ta join courses_sections cs using (course_id, "session") natural join schedule_assignment sa where initial = $1 and session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
  union
  select ta.initial, sa.* from teacher_sessional_assignment ta join schedule_assignment sa using (course_id, "session", batch, "section") where initial = $1 and session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
  `;

  const client = await connect();
  let teachers = (await client.query(teacherQuery, [batch, section, course_id]))
    .rows;
  const results = [];
  for (const teacher of teachers) {
    const initial = teacher.initial;
    const result = {
      initial,
      schedule: (await client.query(contradictionQuery, [initial])).rows,
    };
    results.push(result);
  }
  client.release();
  return results;
}

export async function ensureEmailTemplateExists(type) {
  const client = await connect();

  try {
    // Check if the template exists
    const checkQuery = "SELECT * FROM configs WHERE key= $1";
    const checkResult = await client.query(checkQuery);

    // If the template doesn't exist or has no value, create it
    if (checkResult.rows.length === 0) {
      if (type == "SCHEDULE_EMAIL") {
        const insertQuery = "INSERT INTO configs (key, value) VALUES ('SCHEDULE_EMAIL', 'Please fill out your theory schedule preferences. Click the link below to access the form.')";
        await client.query(insertQuery);
      } else if (type == "THEORY_EMAIL") {
        const insertQuery = "INSERT INTO configs (key, value) VALUES ('THEORY_EMAIL', 'Please fill out your theory course preferences. Click the link below to access the form.')";
        await client.query(insertQuery);
      } else if (type == "SESSIONAL_EMAIL") {
        const insertQuery = "INSERT INTO configs (key, value) VALUES ('SESSIONAL_EMAIL', 'Please fill out your sessional course preferences. Click the link below to access the form.')";
        await client.query(insertQuery);
      } else {
        return false;
      }
      return true;
    } else if (!checkResult.rows[0].value) {
      if (type == "SCHEDULE_EMAIL") {
        const updateQuery = "UPDATE configs SET value = 'Please fill out your theory schedule preferences. Click the link below to access the form.' WHERE key = 'SCHEDULE_EMAIL'";
        await client.query(updateQuery);
      } else if (type == "THEORY_EMAIL") {
        const updateQuery = "UPDATE configs SET value = 'Please fill out your theory course preferences. Click the link below to access the form.' WHERE key = 'THEORY_EMAIL'";
        await client.query(updateQuery);
      } else if (type == "SESSIONAL_EMAIL") {
        const updateQuery = "UPDATE configs SET value = 'Please fill out your sessional course preferences. Click the link below to access the form.' WHERE key = 'SESSIONAL_EMAIL'";
        await client.query(updateQuery);
      } else {
        return false;
      }
      return true;
    } else {
      return true;
    }
  } catch (error) {
    console.error("Error ensuring schedule email template exists:", error);
    throw error;
  } finally {
    client.release();
  }
}

export async function getCourseAllSchedule(initial, course_id) {
  const query = `
    SELECT course_id, "day", "time", section
    FROM schedule_assignment
    WHERE course_id = $1
    AND $2 = ANY(teachers)
    AND "session" = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
  `;
  const client = await connect();
  const results = await client.query(query, [course_id, initial]);
  client.release();
  return results.rows;
}

export async function getCourseSectionalSchedule(course_id, section) {
  const query = `
    SELECT course_id, batch, section, "day", "time"
    FROM schedule_assignment
    WHERE course_id = $1 
    AND "section" = $2
    AND "session" = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
  `;
  const client = await connect();
  const results = await client.query(query, [course_id, section]);
  client.release();
  return results.rows;
}
