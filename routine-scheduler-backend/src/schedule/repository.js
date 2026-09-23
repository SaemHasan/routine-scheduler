import { connect } from "../config/database.js";
import { getTheoryTeacherAssignmentDB } from "../assignment/repository.js";

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
  // This query gets schedules for both the main section and any subsections
  const query = `
    SELECT course_id, c.type, "day", "time", department, "section", c.class_per_week
    FROM schedule_assignment sa
    NATURAL JOIN courses c
    WHERE department = $1 AND batch = $2 AND ("section" = $3 OR "section" LIKE $4)
    AND "session" = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
    ORDER BY "section"
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
      AND "session" = (SELECT value FROM configs WHERE key='CURRENT_SESSION')`;
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
          INSERT INTO schedule_assignment (batch, "section", "session", course_id, "day", "time", department, room_no, teachers)
          VALUES ($1, $2::varchar, (SELECT value FROM configs WHERE key='CURRENT_SESSION'), $3, $4, $5, $6::varchar, (SELECT room FROM sections WHERE batch = $1 AND section = $2::varchar AND department = $6::varchar), $7)
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

export async function getSessionalSchedule(batch, section) {
  const query = `
    SELECT course_id, "day", "time", department, "section"
    FROM schedule_assignment sa
    NATURAL JOIN courses c
    WHERE batch = $1 AND "section" = $2 AND type = 1
    AND "session" = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
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
      SELECT course_id
      FROM schedule_assignment
      WHERE batch = $1
      AND "section" = $2 
      AND department = $3
      AND "day" = $4
      AND "time" = $5
    `;
    const db_courses = (await client.query(course_id_query, [batch, section, department, schedule.day, schedule.time])).rows;
    if(db_courses.length === 0) {
      const insert_query = `
        INSERT INTO schedule_assignment (batch, "section", "session", course_id, "day", "time", department)
        VALUES ($1, $2, (SELECT value FROM configs WHERE key='CURRENT_SESSION'), $3, $4, $5, $6)
      `;
      await client.query(insert_query, [batch, section, schedule.course_id, schedule.day, schedule.time, department]);
    } else {
      if(schedule.course_id === "None") {
        const delete_query = `
          DELETE FROM schedule_assignment
          WHERE batch = $1
          AND "section" = $2
          AND department = $3
          AND "day" = $4
          AND "time" = $5
        `;
        await client.query(delete_query, [batch, section, department, schedule.day, schedule.time]);
      } else {
        const update_query = `
          UPDATE schedule_assignment
          SET course_id = $1
          WHERE batch = $2
          AND "section" = $3
          AND department = $4
          AND "day" = $5
          AND "time" = $6
        `;
        await client.query(update_query, [schedule.course_id, batch, section, department, schedule.day, schedule.time]);
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
    SELECT sa.course_id, sa.batch, sa."section", sa."day", sa."time", sa.department, c.class_per_week
    FROM schedule_assignment sa
    JOIN courses c ON sa.course_id = c.course_id
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
    SELECT course_id, section, "day", "time"
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