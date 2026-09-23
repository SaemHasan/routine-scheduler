import { connect } from "../config/database.js";
import { HttpError } from "../config/error-handle.js";
import { getTheoryTeacherAssignmentDB } from "../assignment/repository.js";

async function getCourses(type) {
  const query = "SELECT value FROM configs WHERE key='CURRENT_SESSION'";
  const client = await connect();
  const results = await client.query(query);
  const current_session = results.rows[0].value;
  client.release();

  if (type == "theory-pref") {
    const query = `
      SELECT course_id, name
      FROM courses
      where type =0 and session = $1
      and course_id like 'CSE%'
      ORDER BY course_id
      `;
    const values = [current_session];
    const client = await connect();
    const results = await client.query(query, values);
    client.release();
    return results.rows;
  } else if (type == "sessional-pref") {
    const query = `
      SELECT course_id, name
      FROM courses
      where type =1 and session = $1
      and course_id like 'CSE%'
      ORDER BY course_id
      `;
    const values = [current_session];
    const client = await connect();
    const results = await client.query(query, values);
    client.release();
    return results.rows;
  }
}

export async function getPreferenceForm(initial, type) {
  const query = `
    SELECT type, teachers.initial, teachers.name
    FROM forms
    INNER JOIN teachers ON forms.initial = teachers.initial
    WHERE forms.initial=$1 and forms.type=$2
    `;

  const values = [initial, type];

  const client = await connect();
  const results = await client.query(query, values);
  client.release();

  if (results.rows.length <= 0) {
    throw new HttpError(404, "Form not found");
  }

  const allCourses = await getCourses(type);
  const courses = allCourses.filter((course) =>
    course.course_id.startsWith("CSE")
  );
  const data = {
    teacher: results.rows[0],
    courses: courses,
  };

  return data;
}

export async function getTheoryScheduleForm(initial) {
  const query = `
    select id, initial, course_id, "session", class_per_week,
    (select to_json(array_agg(row_to_json(tbl))) from 
        (select t.initial, t.name from teacher_assignment ta2 natural join teachers t where ta2.course_id = ta.course_id order by t.seniority_rank) tbl
    ) teachers,
    (select to_json(array_agg(row_to_json(tbl))) from 
        (select batch, "section", s.level_term,
            (select to_json(array_agg(row_to_json(tbl))) from 
                (select sa."day", sa."time", sa.course_id from schedule_assignment sa where (sa.batch, sa."session", sa."section", sa.department) = (cs.batch, cs."session", cs."section", cs.department) ) tbl
            ) schedule 
        from courses_sections cs natural join sections s where cs.course_id = ta.course_id and cs."session" = ta."session" ) tbl
    ) sections
    from forms f natural join teacher_assignment ta join courses co using (course_id, "session")
    where f.initial = $1 and f.type = 'theory-sched'
  `;

  const client = await connect();
  const results = await client.query(query, [initial]);
  client.release();

  if (results.rows.length <= 0) {
    throw new Error("Table is empty");
  } else {
    return results.rows[0];
  }
}

export async function saveTheoryScheduleForm(initial, response) {
  const query = `
    SELECT 
      ta.course_id,
      courses.to as dept,
      cs.batch
    FROM
      teacher_assignment ta
      NATURAL JOIN courses
      JOIN courses_sections cs 
        ON cs.course_id = ta.course_id 
        AND cs.session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
    WHERE 
      ta.initaial = $1
    LIMIT 1
  `;
  const client = await connect();
  let results = await client.query(query, [initial]);
  const { course_id, dept, batch } = results.rows[0];

  let schedulePref = JSON.parse(response);

  schedulePref.forEach((row) => {
    const teacherAssignments = getTheoryTeacherAssignmentDB(
      course_id,
      row.section
    );
    const query = `
      INSERT INTO schedule_assignment (course_id, session, batch, section, day, time, department, room_no, teachers) 
      VALUES ($1, (SELECT value FROM configs WHERE key='CURRENT_SESSION'), $2, $3, $4, $5, $6, (SELECT room FROM sections WHERE batch = $2 AND section = $3 AND department = $6), $7) 
      ON CONFLICT DO NOTHING
    `;
    const values = [
      course_id,
      row.batch,
      row.section,
      row.day,
      row.time,
      dept,
      teacherAssignments,
    ];
    client.query(query, values);
  });
  client.release();
  return batch;
}

export async function updateForm(initial, response, type) {
  const client = await connect();

  const query = `
    UPDATE forms
    SET response = $2
    WHERE forms.initial = $1 AND forms.type = $3
  `;
  let values = [initial, response, type];

  const results = await client.query(query, values);
  client.release();

  return results.rowCount;
}
