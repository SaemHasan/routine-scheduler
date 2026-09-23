import { connect } from "../config/database.js";

export async function routineForLvl(lvlTerm) {
  const query = `
    SELECT 
        sa.course_id,
        CASE
            WHEN c.type = 0 OR c.class_per_week = 1.5 THEN sa.section
            WHEN c.class_per_week = 0.75 THEN sa.section || '1/' || sa.section || '2'
        END AS section,
        sa.day,
        sa.time,
        sa.room_no AS room,
        s.level_term,
        c.type,
        sa.teachers
    FROM schedule_assignment sa
    JOIN sections s 
        ON sa.department = s.department 
        AND sa.batch = s.batch 
        AND sa.section = s.section
    JOIN courses c 
        ON sa.course_id = c.course_id
    WHERE s.level_term = $1
    `;
  const values = [lvlTerm];
  const client = await connect();
  const results = await client.query(query, values);
  client.release();
  return results.rows;
}

export async function routineForTeacher(initial) {
  const query = `
    SELECT 
      sa.course_id,
      CASE 
        WHEN c.type = 0 OR c.class_per_week = 1.5 THEN ARRAY_TO_STRING(ARRAY_AGG(DISTINCT sa.section ORDER BY sa.section), '+')
        WHEN c.class_per_week = 0.75 THEN MIN(sa.section) || '1/' || MIN(sa.section) || '2'
      END AS section,
      sa.day,
      sa.time,
      sa.room_no as room,
      c.type,
      sa.teachers
    FROM schedule_assignment sa
    JOIN courses c ON sa.course_id = c.course_id
    WHERE $1 = ANY(sa.teachers)
    GROUP BY sa.course_id, sa.day, sa.time, sa.room_no, c.type, sa.teachers, c.class_per_week
    ORDER BY sa.day, sa.time, sa.course_id, section
    `;

  const values = [initial];
  const client = await connect();
  const results = await client.query(query, values);
  client.release();
  return results.rows;
}

export async function routineForRoom(room) {
  const query = `
    SELECT 
        sa.course_id,
        CASE 
            WHEN c.type = 0 OR c.class_per_week = 1.5 THEN ARRAY_TO_STRING(ARRAY_AGG(DISTINCT sa.section ORDER BY sa.section), '+')
            WHEN c.class_per_week = 0.75 THEN MIN(sa.section) || '1/' || MIN(sa.section) || '2'
        END AS section,
        sa.day,
        sa.time,
        c.type,
        sa.teachers
    FROM schedule_assignment sa
    JOIN courses c 
        ON sa.course_id = c.course_id
    WHERE sa.room_no = $1
    GROUP BY sa.course_id, sa.day, sa.time, c.type, sa.teachers, c.class_per_week
    ORDER BY sa.day, sa.time, sa.course_id, section;
    `;

  const values = [room];
  const client = await connect();
  const results = await client.query(query, values);
  client.release();
  return results.rows;
}

export async function getInitials() {
  const query = `
        SELECT initial, seniority_rank
        FROM teachers
        WHERE active = 1
        ORDER BY seniority_rank ASC NULLS LAST;
        `;
  const client = await connect();
  const results = await client.query(query);
  client.release();
  return results.rows;
}

export async function getRooms() {
  const query = `
        SELECT room
        FROM rooms
        WHERE active = true
        ORDER BY room;
        `;
  const client = await connect();
  const results = await client.query(query);
  client.release();
  return results.rows;
}

export async function getDepartments() {
  const query = `
        SELECT DISTINCT department
        FROM hosted_departments
        ORDER BY department
    `;
  const client = await connect();
  const results = await client.query(query);
  client.release();
  return results.rows;
}

export async function getAllDepartmentsDB() {
  const query = `
        SELECT DISTINCT department
        FROM (
            SELECT DISTINCT "from" AS department
            FROM courses
          UNION
            SELECT DISTINCT "to" AS department
            FROM courses
        ) all_departments
        WHERE department NOT LIKE 'CSE'
        ORDER BY department
    `;
  const client = await connect();
  const results = await client.query(query);
  client.release();
  return results.rows;
}

export async function getActiveLevelTermsByDeptDB(department) {
  // Here all_courses is to be replaced with courses after adding level_term in courses table
  const query = `
        SELECT DISTINCT all_courses.level_term
        FROM all_courses
        LEFT JOIN level_term_unique ON all_courses.level_term = level_term_unique.level_term
        WHERE ("from" = $1 OR "to" = $1)
        AND level_term_unique.active = TRUE
        ORDER BY all_courses.level_term
    `;
  const values = [department];
  const client = await connect();
  const results = await client.query(query, values);
  client.release();
  return results.rows;
}

export async function getCoursesByDeptLevelTermDB(department, level_term) {
  const query = `
        SELECT course_id
        FROM all_courses
        WHERE ( "from" = $1 OR "to" = $1 )
          AND level_term = $2
        ORDER BY course_id
    `;
  const values = [department, level_term];
  const client = await connect();
  const results = await client.query(query, values);
  client.release();
  return results.rows;
}

export async function routineForDeptLevelTermCourseDB(
  department,
  level_term,
  course_id
) {
  // level_term is not incorporated in the query, it is for future use
  const query = `
    SELECT 
        sa.course_id,
        CASE 
            WHEN c.type = 0 OR c.class_per_week = 1.5 THEN ARRAY_TO_STRING(ARRAY_AGG(DISTINCT sa.section ORDER BY sa.section), '+')
            WHEN c.class_per_week = 0.75 THEN MIN(sa.section) || '1/' || MIN(sa.section) || '2'
        END AS section,
        sa.day,
        sa.time,
        sa.room_no AS room,
        sa.teachers,
        c.type
    FROM schedule_assignment sa
    JOIN courses c 
        ON sa.course_id = c.course_id
    WHERE (c."from" = $1 OR c."to" = $1)
      AND sa.course_id = $2
    GROUP BY sa.course_id, sa.day, sa.time, sa.room_no, sa.teachers, c.type, c.class_per_week
    ORDER BY sa.course_id, sa.day, sa.time, section;
    `;

  const values = [department, course_id];
  const client = await connect();
  const results = await client.query(query, values);
  client.release();
  return results.rows;
}

export async function getRoutine(type, key) {
    const query = `
    select url
    from routine_pdf
    where type = $1 and key = $2
    `
    const values = [type, key];
    const client = await connect();
    const results = await client.query(query, values);
    client.release();
    return results.rows[0];
}

export async function saveRoutine(type, key, url) {
  const insertQuery = `
    insert into routine_pdf (type, key, url)
    values ($1, $2, $3)
    `;
  const values = [type, key, url];
  const client = await connect();
  const results = await client.query(insertQuery, values);
  client.release();
  return results.rowCount > 0;
}

export async function getLevelTerms() {
  const query = `
        SELECT DISTINCT level_term
        FROM level_term_unique
        WHERE active = TRUE
        ORDER BY level_term
    `;
  const client = await connect();
  const results = await client.query(query);
  client.release();
  return results.rows;
}

export async function getCurrentSession() {
  const query = `
    SELECT value
    FROM configs
    WHERE key='CURRENT_SESSION'
    `;
  const client = await connect();
  const results = await client.query(query);
  client.release();
  return results.rows.length > 0 ? results.rows[0].value : "January 2025";
}

export async function getSectionsByLevelTerm(level_term) {
  const query = `
    SELECT DISTINCT section
    FROM sections
    WHERE level_term = $1
    ORDER BY section
    `;
  const values = [level_term];

  const client = await connect();
  const results = await client.query(query, values);
  client.release();

  // Filter to only include main sections (A, B, C, etc.) and not subsections (A1, A2, etc.)
  const mainSections = results.rows.filter((row) => {
    // Keep only sections that are single letters or have no digits
    const section = row.section;
    return section && (section.length === 1 || !/\d/.test(section));
  });

  return mainSections;
}
