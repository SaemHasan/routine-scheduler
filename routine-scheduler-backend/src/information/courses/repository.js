import { connect } from "../../config/database.js";
import { getCurrentSession } from "../../pdfgenerator/repository.js";
import { HttpError } from "../../config/error-handle.js";
import { optionalSectionLabelSQL, runsAsGroupSQL } from "../../sessional_scheduler/sectionLabel.js";

export async function getAll() {
  const client = await connect();
  try {
    const query = `
      SELECT * 
      FROM all_courses
      WHERE course_id != 'CT'
      ORDER BY course_id
    `;
    const courses = await client.query(query);

    // all_courses has no session column, so the section assignments are read for
    // the current session and matched on course_id alone.
    const currentSession = await getCurrentSession();
    const query2 = `
      SELECT * 
      FROM courses_sections
      WHERE session = $1
    `;

    const courses_section = await client.query(query2, [currentSession]);

    const course_list = courses.rows;
    const courses_section_list = courses_section.rows;

    for (const sectionInfo of courses_section_list) {
      const matchingCourse = course_list.find(
        (course) => course.course_id === sectionInfo.course_id
      );

      if (matchingCourse) {
        if (!matchingCourse.sections) {
          matchingCourse.sections = [];
        }
        matchingCourse.sections.push(sectionInfo.section);
        matchingCourse.batch = sectionInfo.batch;
      }
    }
    return course_list;
  } finally {
    client.release();
  }
}

export async function getActiveCourseIds() {
  try {
    const query = `
      SELECT DISTINCT course_id
      FROM courses
      WHERE course_id != 'CT'
      ORDER BY course_id
    `;
    const client = await connect();
    const results = await client.query(query);
    client.release();
    console.log('getActiveCourseIds result:', results.rows);
    return results.rows;
  } catch (err) {
    console.error('Error in getActiveCourseIds:', err);
    throw err;
  }
}

/**
 * Where a course actually runs.
 *
 * Every running course covers all sections of its level-term, optional ones
 * included: an elective is open to students from every section, so it occupies
 * a slot in each of their routines. What varies for an optional course is how
 * many section-sized groups it needs, and that is carried separately by
 * optional_section_count.
 *
 * Mirrors initializeCoursesSectionsTable(): sections are matched on
 * (level_term, type, department), and 0.75-credit courses sit in the main
 * sections (A, B) rather than in the subsections (A1, A2).
 */
async function resolveCourseSections(client, Course) {
  const { type, to, level_term, class_per_week } = Course;

  const usesMainSections = parseFloat(class_per_week) === 0.75;
  const query = usesMainSections
    ? `SELECT DISTINCT batch, LEFT(section, 1) AS section, department
         FROM sections
        WHERE level_term = $1 AND department = $2 AND type = $3`
    : `SELECT batch, section, department
         FROM sections
        WHERE level_term = $1 AND department = $2 AND type = $3`;

  const result = await client.query(query, [level_term, to, type]);
  return result.rows;
}

async function isCourseActive(client, course_id, session) {
  const result = await client.query(
    `SELECT 1 FROM courses WHERE course_id = $1 AND session = $2`,
    [course_id, session]
  );
  return result.rowCount > 0;
}

/**
 * The `courses` table holds what is actually running this session. A mandatory
 * course belongs there as soon as it exists. An optional one is only ever put
 * there by an explicit activation, so editing it must leave that state alone.
 */
async function shouldBeActive(client, optional, course_id, session) {
  if (!optional) return true;
  return isCourseActive(client, course_id, session);
}

/**
 * Replaces a course's section assignments with `desired`, touching only the rows
 * that actually change. A blanket delete-and-reinsert would trip the
 * teacher_sessional_assignment foreign key for sections that are staying put.
 */
async function syncCourseSections(client, course_id, session, desired) {
  const keyOf = (row) => `${row.batch}-${row.section}`;

  const existing = await client.query(
    `SELECT batch, section FROM courses_sections WHERE course_id = $1 AND session = $2`,
    [course_id, session]
  );

  const desiredKeys = new Set(desired.map(keyOf));
  for (const row of existing.rows) {
    if (desiredKeys.has(keyOf(row))) continue;
    await client.query(
      `DELETE FROM courses_sections
        WHERE course_id = $1 AND session = $2 AND batch = $3 AND section = $4`,
      [course_id, session, row.batch, row.section]
    );
  }

  const existingKeys = new Set(existing.rows.map(keyOf));
  for (const row of desired) {
    if (existingKeys.has(keyOf(row))) continue;
    await client.query(
      `INSERT INTO courses_sections (course_id, session, batch, section, department)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (course_id, session, batch, section) DO NOTHING`,
      [course_id, session, row.batch, row.section, row.department]
    );
  }
}

/**
 * Takes a course out of the current session. Dropping the `courses` row cascades
 * into courses_sections, so refuse while teachers are still assigned to those
 * sections rather than silently discarding their assignments.
 */
async function deactivateCourse(client, course_id, session) {
  const assigned = await client.query(
    `SELECT 1 FROM teacher_sessional_assignment WHERE course_id = $1 AND session = $2 LIMIT 1`,
    [course_id, session]
  );
  if (assigned.rowCount > 0) {
    throw new HttpError(
      400,
      `${course_id} still has teachers assigned to its sections. Remove those assignments before leaving it unoffered.`
    );
  }
  await client.query(`DELETE FROM courses WHERE course_id = $1 AND session = $2`, [
    course_id,
    session,
  ]);
}

export async function saveCourse(Course) {
  const course_id = Course.course_id;
  const name = Course.name;
  const type = Course.type;
  const class_per_week = Course.class_per_week;
  const from = Course.from;
  const to = Course.to;
  const level_term = Course.level_term;
  const optional = Course.optional ? 1 : 0;
  const optional_section_count = optional
    ? parseInt(Course.optional_section_count, 10) || 0
    : 0;
  // Only sessional courses have a sessional type.
  const sessional_type =
    Number(type) === 1 ? Course.sessional_type || null : null;
  // Only optional courses belong to an option
  const option_group = optional ? parseInt(Course.option_group, 10) || null : null;

  const client = await connect();
  try {
    // Get current session
    const currentSession = await getCurrentSession();

    // Start transaction
    await client.query('BEGIN');

    // 1. Insert into all_courses table (existing logic)
    const allCoursesQuery = `
      INSERT INTO all_courses (course_id, name, type, class_per_week, \"from\", \"to\", level_term, optional, optional_section_count, sessional_type, option_group)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (course_id, level_term) DO UPDATE
      SET name = EXCLUDED.name,
          type = EXCLUDED.type,
          class_per_week = EXCLUDED.class_per_week,
          "from" = EXCLUDED."from",
          "to" = EXCLUDED."to",
          level_term = EXCLUDED.level_term,
          optional = EXCLUDED.optional,
          optional_section_count = EXCLUDED.optional_section_count,
          sessional_type = EXCLUDED.sessional_type,
          option_group = EXCLUDED.option_group
    `;
    const allCoursesValues = [course_id, name, type, class_per_week, from, to, level_term, optional, optional_section_count, sessional_type, option_group];
    const allCoursesResult = await client.query(allCoursesQuery, allCoursesValues);

    // 2. A new optional course is catalogue-only until somebody activates it;
    //    a mandatory one joins the session straight away.
    if (await shouldBeActive(client, optional, course_id, currentSession)) {
      const sections = await resolveCourseSections(client, {
        type,
        to,
        level_term,
        class_per_week,
      });
      console.log('DEBUG saveCourse: optional =', optional, 'sections =', sections.length);

      // 3. Insert into courses table
      const coursesQuery = `
        INSERT INTO courses (course_id, name, type, session, class_per_week, \"from\", \"to\", level_term, optional, optional_section_count, sessional_type, option_group)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (course_id, session) DO UPDATE
        SET name = EXCLUDED.name,
            type = EXCLUDED.type,
            class_per_week = EXCLUDED.class_per_week,
            "from" = EXCLUDED."from",
            "to" = EXCLUDED."to",
            level_term = EXCLUDED.level_term,
            optional = EXCLUDED.optional,
            optional_section_count = EXCLUDED.optional_section_count,
            sessional_type = EXCLUDED.sessional_type,
            option_group = EXCLUDED.option_group
      `;
      const coursesValues = [course_id, name, type, currentSession, class_per_week, from, to, level_term, optional, optional_section_count, sessional_type, option_group];
      await client.query(coursesQuery, coursesValues);

      // 4. Line the course up with its sections
      await syncCourseSections(client, course_id, currentSession, sections);
    } else {
      console.log('DEBUG saveCourse: optional course', course_id, 'stays inactive');
    }

    // Commit transaction
    await client.query('COMMIT');

    return allCoursesResult.rowCount;
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateCourse(Course) {
  const course_id_old = Course.course_id_old;
  const course_id = Course.course_id;
  const name = Course.name;
  const type = Course.type;
  const class_per_week = Course.class_per_week;
  const from = Course.from;
  const to = Course.to;
  const teacher_credit = Course.teacher_credit;
  const level_term = Course.level_term;
  // all_courses is keyed by (course_id, level_term), so the row being edited is
  // identified by the pair the client started from, not by course_id alone.
  const level_term_old = Course.level_term_old || Course.level_term;
  const optional = Course.optional ? 1 : 0;
  const optional_section_count = optional
    ? parseInt(Course.optional_section_count, 10) || 0
    : 0;
  // Only sessional courses have a sessional type.
  const sessional_type =
    Number(type) === 1 ? Course.sessional_type || null : null;
  // Only optional courses belong to an option
  const option_group = optional ? parseInt(Course.option_group, 10) || null : null;

  // Get current session
  const currentSession = await getCurrentSession();

  const client = await connect();
  try {
    // Start transaction
    await client.query('BEGIN');

    // 1. Update all_courses table
    const allCoursesQuery = `
      UPDATE all_courses
      SET course_id=$1, name=$2, type=$3, class_per_week=$4, \"from\" = $5, \"to\" = $6, level_term = $7, optional = $8, optional_section_count = $9, sessional_type = $12, option_group = $13
      WHERE course_id=$10 AND level_term=$11
    `;
    const allCoursesValues = [
      course_id,
      name,
      type,
      class_per_week,
      from,
      to,
      level_term,
      optional,
      optional_section_count,
      course_id_old,
      level_term_old,
      sessional_type,
      option_group,
    ];
    const allCoursesResult = await client.query(allCoursesQuery, allCoursesValues);

    if (allCoursesResult.rowCount <= 0) {
      await client.query('ROLLBACK');
      throw new HttpError(400, "Update Failed - Course not found in all_courses");
    }

    // 2. Editing never changes whether an optional course is running — that is
    //    only done by an explicit activation.
    if (await shouldBeActive(client, optional, course_id_old, currentSession)) {
      const sections = await resolveCourseSections(client, {
        type,
        to,
        level_term,
        class_per_week,
      });
      console.log('DEBUG updateCourse: optional =', optional, 'sections =', sections.length);

      // 3. Update courses table. Renaming the course cascades into
      //    courses_sections through the foreign key, so the sections follow.
      const coursesUpdateQuery = `
        UPDATE courses
        SET course_id=$1, name=$2, type=$3, class_per_week=$4, \"from\" = $5, \"to\" = $6, level_term = $7, optional = $8, optional_section_count = $9, sessional_type = $12, option_group = $13
        WHERE course_id=$10 AND session = $11
      `;
      const coursesUpdateValues = [
        course_id,
        name,
        type,
        class_per_week,
        from,
        to,
        level_term,
        optional,
        optional_section_count,
        course_id_old,
        currentSession,
        sessional_type,
        option_group,
      ];
      const coursesUpdateResult = await client.query(coursesUpdateQuery, coursesUpdateValues);

      // If course doesn't exist in courses table, insert it
      if (coursesUpdateResult.rowCount === 0) {
        const coursesInsertQuery = `
          INSERT INTO courses (course_id, name, type, session, class_per_week, \"from\", \"to\", level_term, optional, optional_section_count, sessional_type, option_group)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (course_id, session) DO UPDATE
          SET name = EXCLUDED.name,
              type = EXCLUDED.type,
              class_per_week = EXCLUDED.class_per_week,
              "from" = EXCLUDED."from",
              "to" = EXCLUDED."to",
              level_term = EXCLUDED.level_term,
              optional = EXCLUDED.optional,
              optional_section_count = EXCLUDED.optional_section_count,
              sessional_type = EXCLUDED.sessional_type,
              option_group = EXCLUDED.option_group
        `;
        const coursesInsertValues = [course_id, name, type, currentSession, class_per_week, from, to, level_term, optional, optional_section_count, sessional_type, option_group];
        await client.query(coursesInsertQuery, coursesInsertValues);
      }

      // 4. Line the course up with its sections
      await syncCourseSections(client, course_id, currentSession, sections);
    } else {
      console.log('DEBUG updateCourse: optional course', course_id, 'remains inactive');
    }

    // Commit transaction
    await client.query('COMMIT');
    return allCoursesResult.rowCount;

  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Puts an optional course into the current session, or takes it back out.
 *
 * Mandatory courses are always running and are not activated by hand, so this
 * only accepts optional ones. Activating copies the catalogue entry into
 * `courses` and gives it a slot in every section of its level-term, because an
 * elective is open to students from all of them.
 */
export async function setCourseActive(course_id, level_term, active) {
  const currentSession = await getCurrentSession();
  const client = await connect();

  try {
    await client.query('BEGIN');

    const catalogue = await client.query(
      `SELECT * FROM all_courses WHERE course_id = $1 AND level_term = $2`,
      [course_id, level_term]
    );
    if (catalogue.rowCount === 0) {
      throw new HttpError(404, `${course_id} (${level_term}) is not in the course catalogue`);
    }

    const course = catalogue.rows[0];
    if (!course.optional) {
      throw new HttpError(
        400,
        `${course_id} is a mandatory course — it runs in every session and cannot be switched off here.`
      );
    }

    if (active) {
      await client.query(
        `INSERT INTO courses (course_id, name, type, session, class_per_week, "from", "to", level_term, optional, optional_section_count, sessional_type, option_group)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (course_id, session) DO UPDATE
         SET name = EXCLUDED.name,
             type = EXCLUDED.type,
             class_per_week = EXCLUDED.class_per_week,
             "from" = EXCLUDED."from",
             "to" = EXCLUDED."to",
             level_term = EXCLUDED.level_term,
             optional = EXCLUDED.optional,
             optional_section_count = EXCLUDED.optional_section_count,
             sessional_type = EXCLUDED.sessional_type,
             option_group = EXCLUDED.option_group`,
        [
          course.course_id,
          course.name,
          course.type,
          currentSession,
          course.class_per_week,
          course.from,
          course.to,
          course.level_term,
          course.optional,
          course.optional_section_count,
          course.sessional_type,
          course.option_group,
        ]
      );

      const sections = await resolveCourseSections(client, {
        type: course.type,
        to: course.to,
        level_term: course.level_term,
        class_per_week: course.class_per_week,
      });
      await syncCourseSections(client, course_id, currentSession, sections);
    } else {
      await deactivateCourse(client, course_id, currentSession);
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function removeCourse(course_id, level_term) {
  const client = await connect();
  try {
    // Start transaction
    await client.query('BEGIN');

    console.log('DEBUG removeCourse: Deleting course_id =', course_id, 'level_term =', level_term);

    // Get current session for proper deletion
    const currentSession = await getCurrentSession();

    // 1. Delete from all_courses table. The table is keyed by (course_id, level_term),
    //    so when a level_term is supplied only that offering is removed.
    const deleteAllCourses = level_term
      ? `DELETE FROM all_courses WHERE course_id = $1 AND level_term = $2`
      : `DELETE FROM all_courses WHERE course_id = $1`;
    const allCoursesResult = await client.query(
      deleteAllCourses,
      level_term ? [course_id, level_term] : [course_id]
    );
    console.log('DEBUG removeCourse: Deleted from all_courses, rowCount =', allCoursesResult.rowCount);

    if (allCoursesResult.rowCount <= 0) {
      await client.query('ROLLBACK');
      throw new HttpError(404, "Course not found");
    }

    // 2. Only tear down the dependent rows once no offering of this course is left,
    //    otherwise the remaining level-terms would lose their schedule data.
    const remaining = await client.query(
      `SELECT 1 FROM all_courses WHERE course_id = $1 LIMIT 1`,
      [course_id]
    );

    if (remaining.rowCount === 0) {
      // Delete from courses_sections table first (foreign key constraint)
      const deleteCoursesSection = `DELETE FROM courses_sections WHERE course_id = $1`;
      const courseSectionResult = await client.query(deleteCoursesSection, [course_id]);
      console.log('DEBUG removeCourse: Deleted from courses_sections, rowCount =', courseSectionResult.rowCount);

      // Delete from schedule_assignment table (foreign key constraint to courses table)
      const deleteScheduleAssignment = `DELETE FROM schedule_assignment WHERE course_id = $1 AND session = $2`;
      const scheduleAssignmentResult = await client.query(deleteScheduleAssignment, [course_id, currentSession]);
      console.log('DEBUG removeCourse: Deleted from schedule_assignment, rowCount =', scheduleAssignmentResult.rowCount);

      // Delete from courses table
      const deleteCourses = `DELETE FROM courses WHERE course_id = $1`;
      const coursesResult = await client.query(deleteCourses, [course_id]);
      console.log('DEBUG removeCourse: Deleted from courses, rowCount =', coursesResult.rowCount);
    }

    // Commit transaction
    await client.query('COMMIT');
    return allCoursesResult.rowCount;

  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getAllLab() {
  const query =`
    SELECT cs.course_id, cs.section, cs.batch , c.name, s.level_term, s.department,c.class_per_week,
      c.sessional_type, st.teacher_count, st.lab_type,
      ${optionalSectionLabelSQL("c", "cs.department", "cs.batch")} AS section_label
    FROM courses_sections cs
    JOIN courses c ON cs.course_id = c.course_id AND cs.session = c.session
    join sections s using (batch, section, department)
    -- A course with no sessional type set counts as a software sessional.
    LEFT JOIN sessional_types st ON st.code = COALESCE(
      c.sessional_type,
      CASE WHEN c."to" = 'CSE' THEN 'DEPT_SW' ELSE 'NON_DEPT_SW' END
    )
    WHERE cs.course_id LIKE 'CSE%' and c.type=1
      -- An optional lab runs only as its groups, not in every section
      AND ${runsAsGroupSQL("c", "cs")}
    ORDER BY cs.course_id, cs.section`;
  const client = await connect();
  const results = await client.query(query);
  client.release();
  return results.rows;
}

export async function getNonDeptLabs() {
  const query =
    "SELECT cs.course_id, cs.section, cs.batch , c.name, s.level_term, s.department, c.class_per_week \
    FROM courses_sections cs\
    JOIN courses c ON cs.course_id = c.course_id\
    join sections s using (batch, section, department)\
    WHERE cs.course_id NOT LIKE 'CSE%' and c.type=1";
  const client = await connect();
  const results = await client.query(query);
  client.release();
  return results.rows;
}

export async function getNonDeptTheories() {
  const query =
    "SELECT cs.course_id, cs.section, cs.batch , c.name, s.level_term, s.department \
    FROM courses_sections cs\
    JOIN courses c ON cs.course_id = c.course_id\
    join sections s using (batch, section, department)\
    WHERE cs.course_id NOT LIKE 'CSE%' and c.type=0";
  const client = await connect();
  const results = await client.query(query);
  client.release();
  return results.rows;
}

export async function getSessionalCoursesByDeptLevelTerm(
  department,
  level_term
) {
  const query = `
    SELECT course_id, name, class_per_week
    FROM courses
    WHERE type = 1
    AND courses.to = $1
    AND level_term = $2
    ORDER BY course_id
    `;
  const values = [department, level_term];
  const client = await connect();
  const results = await client.query(query, values);
  client.release();
  return results.rows;
}

export async function getTheoryCoursesByDeptLevelTerm(department, level_term) {
  // CT (class test) periods go in every CSE level-term's routine
  const query = `
    SELECT course_id, name, class_per_week, "to", level_term, optional,
           optional_section_count, option_group
    FROM courses
    WHERE type = 0
    AND session = (SELECT value FROM configs WHERE key = 'CURRENT_SESSION')
    AND (("to" = $1 AND level_term = $2) OR (course_id = 'CT' AND $1 = 'CSE'))
    ORDER BY course_id = 'CT', course_id
    `;
  const client = await connect();
  try {
    return (await client.query(query, [department, level_term])).rows;
  } finally {
    client.release();
  }
}
