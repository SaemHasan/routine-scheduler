import { connect } from "../config/database.js";
import { HttpError } from "../config/error-handle.js";
import sma from "stablematch-common";

export async function getTemplate(key) {
  const query = "SELECT * FROM configs WHERE key=$1";
  const values = [key];
  const client = await connect();

  try {
    const results = await client.query(query, values);

    if (results.rows.length <= 0)
      throw new HttpError(404, "Template not found");

    return results.rows;
  } finally {
    client.release();
  }
}
export async function getAllTeacherMail() {
  const query = "SELECT initial, email FROM teachers WHERE active = 1";

  const client = await connect();
  try {
    const results = await client.query(query);

    if (results.rows.length <= 0) throw new HttpError(404, "Table is empty");

    return results.rows;
  } finally {
    client.release();
  }
}

export async function getTeacherMailByInitial(initial) {
  const query = "SELECT email FROM teachers WHERE initial = $1 AND active = 1";
  const values = [initial];
  const client = await connect();
  try {
    const results = await client.query(query, values);
    if (results.rows.length <= 0) throw new HttpError(404, "Teacher not found");
    return results.rows[0].email;
  } finally {
    client.release();
  }
}

export async function createForm(id, initial, type) {
  const query = "INSERT INTO forms (id, type, initial) VALUES ($1, $2, $3)";
  const values = [id, type, initial];

  const client = await connect();
  try {
    const results = await client.query(query, values);

    if (results.rowCount <= 0) throw new HttpError(400, "Insertion Failed");

    return results.rows;
  } finally {
    client.release();
  }
}

export async function getTheoryPreferencesStatus() {
  const query = `
    SELECT response, teachers.initial, teachers.name, teachers.email, teachers.seniority_rank
    FROM forms
    INNER JOIN teachers ON forms.initial = teachers.initial
    WHERE type = 'theory-pref'
    `;

  const client = await connect();
  try {
    const results = await client.query(query);
    const cleanResult = results.rows.map((row) => {
      let parsedResponse = null;
      if (row.response) {
        try {
          parsedResponse = JSON.parse(row.response);
        } catch (error) {
          // Try to handle comma-separated string format: "CSE103","CSE109","CSE101"
          try {
            // Remove quotes and split by comma, then trim each item
            const commaSeparated = row.response
              .replace(/"/g, "")
              .split(",")
              .map((item) => item.trim());
            if (commaSeparated.length > 0 && commaSeparated[0] !== "") {
              parsedResponse = commaSeparated;
            } else {
              parsedResponse = null;
            }
          } catch (fallbackError) {
            console.error(
              `Fallback parsing also failed for teacher ${row.initial}:`,
              fallbackError.message
            );
            parsedResponse = null;
          }
        }
      }
      return {
        response: parsedResponse,
        initial: row.initial,
        name: row.name,
        email: row.email,
        seniority_rank: row.seniority_rank,
      };
    });

    return cleanResult;
  } finally {
    client.release();
  }
}

export async function getTheoryAssignStatus() {
  const query = `
    SELECT value
    FROM configs
    WHERE key = 'THEORY_PREF_STATUS'
    `;

  const client = await connect();
  try {
    const results = await client.query(query);
    if (results.rows.length <= 0) throw new HttpError(404, "Status not found");
    return results.rows[0].value;
  } finally {
    client.release();
  }
}

export async function setTheoryAssignStatus(status) {
  const query = `
    INSERT INTO configs (key, value)
    VALUES ('THEORY_PREF_STATUS', $1)
    ON CONFLICT (key) DO UPDATE SET value = $1
  `;
  const values = [status];

  const client = await connect();
  try {
    const results = await client.query(query, values);
    if (results.rowCount <= 0) throw new HttpError(400, "Insertion Failed");
    return results.rows;
  } finally {
    client.release();
  }
}

export async function isFinalized() {
  const query = `SELECT COUNT(*) FROM teacher_assignment WHERE "session" = (SELECT value FROM configs WHERE key='CURRENT_SESSION')`;
  //const query2 = `SELECT COUNT(*) FROM teachers where active = 1`;
  const client = await connect();
  const results = await client.query(query);
  //const results2 = await client.query(query2);
  client.release();
  if (results.rows.length <= 0 || results.rows[0].count === "0") return false;
  else return true;
}

export async function finalize() {
  const client = await connect();
  try {
    const deleteAllQuery = `
      DELETE FROM teacher_assignment 
      WHERE session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
    `;
    await client.query(deleteAllQuery);

    // make all teachers empty from courses_sections for current session
    const deleteSectionQuery = `
      UPDATE courses_sections
      SET teachers = '{}'
      WHERE session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
    `;
    await client.query(deleteSectionQuery);

    const updateScheduleQuery = `
      UPDATE schedule_assignment
      SET teachers = '{}'
      WHERE session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
    `;
    await client.query(updateScheduleQuery);

    await client.query("BEGIN");

    const teacherResponses = `
        select f.initial, f.response, t.theory_courses 
        from forms f 
        natural join teachers t 
        where f.type = 'theory-pref' and f.response is not null and t.active = 1
        order by t.seniority_rank ASC
        `;
    const teacherResponseResults = (await client.query(teacherResponses)).rows;

    const noOfTeachers = `select course_id, "type", COUNT(*) as no_of_teachers from courses_sections cs natural join courses course where "session" = (SELECT value FROM configs WHERE key='CURRENT_SESSION') group by course_id, "session", "type" `;
    const noOfTeachersResults = (await client.query(noOfTeachers)).rows
      .filter((row) => row.type === 0)
      .reduce((acc, row) => {
        acc[row.course_id] = parseInt(row.no_of_teachers);
        return acc;
      }, {});
    console.log(teacherResponseResults, noOfTeachersResults);

    for (const row of teacherResponseResults) {
      let courses = [];
      try {
        courses = JSON.parse(row.response);
      } catch (error) {
        console.error(
          `Failed to parse JSON response for teacher ${row.initial}:`,
          error.message
        );
        console.error(`Invalid JSON content: ${row.response}`);

        // Try to handle comma-separated string format: "CSE103","CSE109","CSE101"
        try {
          // Remove quotes and split by comma, then trim each item
          const commaSeparated = row.response
            .replace(/"/g, "")
            .split(",")
            .map((item) => item.trim());
          if (commaSeparated.length > 0 && commaSeparated[0] !== "") {
            courses = commaSeparated;
            console.log(
              `Successfully parsed comma-separated format for teacher ${row.initial}:`,
              courses
            );
          } else {
            continue; // Skip this teacher's record
          }
        } catch (fallbackError) {
          console.error(
            `Fallback parsing also failed for teacher ${row.initial}:`,
            fallbackError.message
          );
          continue; // Skip this teacher's record
        }
      }
      const initial = row.initial;
      let theoryCourses = row.theory_courses;

      for (const course_id of courses) {
        if (
          noOfTeachersResults[course_id] === undefined ||
          noOfTeachersResults[course_id] > 0
        ) {
          // Check if the course exists in the courses table for current session
          const checkQuery = `
                    SELECT 1 FROM courses 
                    WHERE course_id = $1 AND session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
                    `;
          const checkResult = await client.query(checkQuery, [course_id]);

          // Skip if course doesn't exist in current session
          if (checkResult.rows.length === 0) {
            console.log(
              `Skipping course ${course_id} for teacher ${initial} - not found in courses for current session`
            );
            continue;
          }

          const query = `
                    INSERT INTO teacher_assignment (initial, course_id, session)
                    VALUES ($1, $2, (SELECT value FROM configs WHERE key='CURRENT_SESSION'))
                    `;
          const values = [initial, course_id];
          await client.query(query, values);

          const updateQuery = `
            UPDATE courses_sections
            SET teachers = teachers || $1
            WHERE course_id = $2
              AND NOT ($1 = ANY(teachers));
          `;

          const updateValues = [initial, course_id];
          await client.query(updateQuery, updateValues);

          const updateScheduleQuery = `
            UPDATE schedule_assignment
            SET teachers = teachers || $1
            WHERE course_id = $2
              AND NOT ($1 = ANY(teachers));
          `;
          await client.query(updateScheduleQuery, updateValues);

          if (noOfTeachersResults[course_id] !== undefined)
            noOfTeachersResults[course_id]--;
          console.log(
            `teacher: ${initial} course: ${course_id} no: ${noOfTeachersResults[course_id]}`
          );

          theoryCourses--;
          if (theoryCourses <= 0) {
            break;
          }
          //break;
        }
      }
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.log(e);
    return false;
  } finally {
    client.release();
  }
  return true;
}

export async function getTheoryAssignment() {
  const query = `
    SELECT 
      c.course_id, 
      c."name", 
      COUNT(cs.section) AS section_count,
      (
        SELECT to_json(array_agg(row_to_json(t))) AS teachers
        FROM (
          SELECT t.initial, t.name 
          FROM teacher_assignment ta 
          NATURAL JOIN teachers t 
          WHERE ta.course_id = c.course_id
        ) t
      )
    FROM courses c
    LEFT JOIN courses_sections cs ON c.course_id = cs.course_id
    WHERE c.course_id LIKE 'CSE%' AND c.type = 0
    GROUP BY c.course_id, c."name"
    ORDER BY c.course_id;
  `;
  const client = await connect();
  const result = (await client.query(query)).rows;
  client.release();
  return result;
}

export async function getAllTheoryTeacherAssignmentDB() {
  const query = `
    SELECT 
      course_id,
      json_agg(
        json_build_object(
          'section', section,
          'teachers', to_json(teachers)
        ) ORDER BY section
      ) AS sections
    FROM courses_sections
    WHERE course_id ~ '[13579]$'
    AND course_id LIKE 'CSE%'
    GROUP BY course_id
    ORDER BY course_id
  `;
  const client = await connect();
  const result = await client.query(query);
  client.release();
  return result.rows;
}

export async function getTheoryTeacherAssignmentDB(course_id, section) {
  const query = `
    SELECT teachers
    FROM courses_sections
    WHERE course_id = $1 AND section = $2
  `;
  const values = [course_id, section];
  const client = await connect();
  const result = await client.query(query, values);
  client.release();
  return result.rows.length > 0 ? result.rows[0].teachers : [];
}

export async function addTheoryTeacherAssignmentDB(
  course_id,
  section,
  initial
) {
  const client = await connect();
  try {
    const insertQuery = `
      UPDATE courses_sections
      SET teachers = teachers || $1
      WHERE course_id = $2 AND section = $3
        AND NOT ($1 = ANY(teachers));
    `;
    await client.query(insertQuery, [initial, course_id, section]);

    const updateScheduleQuery = `
      UPDATE schedule_assignment
      SET teachers = teachers || $1
      WHERE course_id = $2
        AND section = $3
        AND NOT ($1 = ANY(teachers));
    `;
    await client.query(updateScheduleQuery, [initial, course_id, section]);
  } finally {
    client.release();
  }
  return true;
}

export async function deleteTheoryTeacherAssignmentDB(
  course_id,
  section,
  initial
) {
  const client = await connect();
  try {
    const deleteQuery = `
      UPDATE courses_sections
      SET teachers = array_remove(teachers, $1)
      WHERE course_id = $2 AND section = $3
        AND $1 = ANY(teachers);
    `;
    await client.query(deleteQuery, [initial, course_id, section]);
    const updateScheduleQuery = `
      UPDATE schedule_assignment
      SET teachers = array_remove(teachers, $1)
      WHERE course_id = $2 AND section = $3
        AND $1 = ANY(teachers);
    `;
    await client.query(updateScheduleQuery, [initial, course_id, section]);
  } finally {
    client.release();
  }
  return true;
}

export async function getTeacherAssignmentDB() {
  const query = `SELECT course_id, initial FROM teacher_assignment WHERE "session" = (SELECT value FROM configs WHERE key='CURRENT_SESSION')`;
  const client = await connect();
  const result = (await client.query(query)).rows;
  client.release();
  return result;
}

export async function getTeacherTheoryAssigments(initial) {
  const query = `
    SELECT DISTINCT cs.course_id, 
           cs.section, 
           COALESCE(cs.batch, 0) as batch
    FROM courses_sections cs
    WHERE $1 = ANY(cs.teachers)
    AND cs.session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
    AND cs.course_id ~ '[13579]$'
    AND cs.course_id LIKE 'CSE%'
    ORDER BY cs.course_id, cs.section
  `;
  const client = await connect();
  const result = await client.query(query, [initial]);
  client.release();
  return result.rows;
}

export async function getLabRoomAssignmentDB() {
  const query = `
    SELECT course_id, "session", batch, "section", room_no AS room
    FROM schedule_assignment
    WHERE course_id ~ '[02468]$'
    AND course_id LIKE 'CSE%'
    ORDER BY course_id, "section";
  `;
  const client = await connect();
  const result = (await client.query(query)).rows;
  client.release();
  return result;
}

export async function setLabRoomAssignemntDB(assignment) {
  const query = `
    UPDATE schedule_assignment
    SET room_no = $4
    WHERE course_id = $1
      AND batch = $2
      AND section = $3
    `;

  const client = await connect();
  try {
    assignment.forEach((row) => {
      const values = [row.course_id, row.batch, row.section, row.room];
      client.query(query, values);
    });
  } finally {
    client.release();
  }
}

export async function getSessionalPreferencesStatus() {
  const query = `
    SELECT response, teachers.initial, teachers.name, teachers.email, teachers.seniority_rank
    FROM forms
    INNER JOIN teachers ON forms.initial = teachers.initial
    WHERE type = 'sessional-pref'
    `;

  const client = await connect();
  try {
    const results = await client.query(query);
    const cleanResult = results.rows.map((row) => {
      let parsedResponse = null;
      if (row.response) {
        try {
          parsedResponse = JSON.parse(row.response);
        } catch (error) {
          console.error(
            `Failed to parse JSON response for teacher ${row.initial}:`,
            error.message
          );
          console.error(`Invalid JSON content: ${row.response}`);

          // Try to handle comma-separated string format: "CSE103","CSE109","CSE101"
          try {
            // Remove quotes and split by comma, then trim each item
            const commaSeparated = row.response
              .replace(/"/g, "")
              .split(",")
              .map((item) => item.trim());
            if (commaSeparated.length > 0 && commaSeparated[0] !== "") {
              parsedResponse = commaSeparated;
              console.log(
                `Successfully parsed comma-separated format for teacher ${row.initial}:`,
                parsedResponse
              );
            } else {
              parsedResponse = null;
            }
          } catch (fallbackError) {
            console.error(
              `Fallback parsing also failed for teacher ${row.initial}:`,
              fallbackError.message
            );
            parsedResponse = null;
          }
        }
      }
      return {
        response: parsedResponse,
        initial: row.initial,
        name: row.name,
        email: row.email,
        seniority_rank: row.seniority_rank,
      };
    });

    return cleanResult;
  } finally {
    client.release();
  }
}

export async function getTeacherSessionalAssignment(initial) {
  const query = `
    SELECT tsa.course_id, tsa.batch, tsa."section", c.class_per_week
    FROM teacher_sessional_assignment tsa
    JOIN courses c ON tsa.course_id = c.course_id
    WHERE tsa.initial = $1
    AND tsa."session" = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
  `;
  const client = await connect();
  const result = await client.query(query, [initial]);
  client.release();
  return result.rows;
}

export async function getSessionalTeachers(course_id, section) {
  const query = `
    SELECT t.initial, t.name, t.email, t.full_time_status, t.seniority_rank
    FROM teacher_sessional_assignment tsa
    INNER JOIN teachers t ON tsa.initial = t.initial
    WHERE course_id = $1
    AND "section" = $2
    AND "session" = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
    ORDER BY t.seniority_rank ASC
  `;
  const values = [course_id, section];
  const client = await connect();
  const result = await client.query(query, values);
  client.release();
  return result.rows;
}

export async function getAllSessionalAssignment() {
  const query = `
    SELECT course_id, batch, "section", initial
    FROM teacher_sessional_assignment
    WHERE "session" = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
    ORDER BY course_id, "section", initial
  `;
  const client = await connect();
  const result = await client.query(query);
  client.release();
  return result.rows;
}

export async function isSessionalFinalized() {
  const query = `SELECT COUNT(*) FROM teacher_sessional_assignment WHERE "session" = (SELECT value FROM configs WHERE key='CURRENT_SESSION')`;
  const client = await connect();
  const results = await client.query(query);
  client.release();
  if (results.rows.length <= 0 || results.rows[0].count === "0") return false;
  else return true;
}

export async function finalizeSessional() {
  const client = await connect();
  try {
    await client.query("BEGIN");

    const teacherResponses = `
        select f.initial, f.response 
        from forms f 
        natural join teachers t 
        where f.type = 'sessional-pref'
        order by t.seniority_rank ASC
        `;

    const allCourses = `select course_id, "section", batch, c."to", c.sessional_type,
    (select json_agg(ta.initial) from teacher_assignment ta where substr(ta.course_id,1, length(ta.course_id)-1) = substr(c.course_id,1, length(c.course_id)-1) and ta.session = c."session" ) "teachers"
    from courses_sections cs natural join courses c  where "type" = 1 and course_id like 'CSE%' and "session" = (SELECT value FROM configs WHERE key='CURRENT_SESSION')`;

    // How many teachers each section of a sessional course gets depends on the
    // kind of sessional. A course with no kind set is treated as a software
    // sessional, departmental or not depending on who takes it.
    const sessionalTypes = (
      await client.query(`SELECT code, teacher_count FROM sessional_types`)
    ).rows.reduce((acc, row) => {
      acc[row.code] = row.teacher_count;
      return acc;
    }, {});
    const teacherCountOf = (row) => {
      const code =
        row.sessional_type || (row.to === "CSE" ? "DEPT_SW" : "NON_DEPT_SW");
      return sessionalTypes[code] || 3;
    };

    const teacherResponseResults = (await client.query(teacherResponses)).rows;
    const allCoursesResults = (await client.query(allCourses)).rows;
    const coursePerTheorySection = allCoursesResults.reduce((acc, row) => {
      if (!acc[row.course_id]) acc[row.course_id] = { sections: [] };
      acc[row.course_id].teachers = row.teachers || [];
      acc[row.course_id].batch = row.batch;
      acc[row.course_id].teacherCount = teacherCountOf(row);
      acc[row.course_id].sections = [
        ...new Set([...acc[row.course_id].sections, row.section.substr(0, 1)]),
      ];
      return acc;
    }, {});

    const teachersSet = new Set();
    const teachers = [];
    const rankSubjects = [];

    // One matching slot per teacher the course needs in a section.
    const teacherPerCourse = (course_id) =>
      Array.from(
        { length: coursePerTheorySection[course_id].teacherCount },
        (_, no) => no
      );

    teacherResponseResults.forEach((row) => {
      const initial = row.initial;
      teachersSet.add(initial);
      teachers.push(initial);
      let courses = [];
      try {
        courses = JSON.parse(row.response)
          .map((course_id) =>
            teacherPerCourse(course_id).map((no) =>
                coursePerTheorySection[course_id].sections
                  .map((section) => `${course_id} ${section} ${no}`)
                  .flat()
              )
              .flat()
          )
          .flat();
      } catch (error) {
        console.error(
          `Failed to parse JSON response for teacher ${row.initial}:`,
          error.message
        );
        console.error(`Invalid JSON content: ${row.response}`);

        // Try to handle comma-separated string format: "CSE103","CSE109","CSE101"
        try {
          // Remove quotes and split by comma, then trim each item
          const commaSeparated = row.response
            .replace(/"/g, "")
            .split(",")
            .map((item) => item.trim());
          if (commaSeparated.length > 0 && commaSeparated[0] !== "") {
            courses = commaSeparated
              .map((course_id) =>
                teacherPerCourse(course_id).map((no) =>
                    coursePerTheorySection[course_id].sections
                      .map((section) => `${course_id} ${section} ${no}`)
                      .flat()
                  )
                  .flat()
              )
              .flat();
            console.log(
              `Successfully parsed comma-separated format for teacher ${row.initial}:`,
              commaSeparated
            );
          } else {
            courses = []; // Set empty array on parse error
          }
        } catch (fallbackError) {
          console.error(
            `Fallback parsing also failed for teacher ${row.initial}:`,
            fallbackError.message
          );
          courses = []; // Set empty array on parse error
        }
      }
      rankSubjects.push(courses);
    });

    const courses = Object.keys(coursePerTheorySection);
    const rankTeachers = courses.map((subject) => {
      const courseTeachers = coursePerTheorySection[subject].teachers;
      const nonCourseTeachers = teachers.filter(
        (teacher) => !courseTeachers.includes(teacher)
      );
      return [...courseTeachers, ...nonCourseTeachers];
    });

    const stableMatchingCourses = courses
      .map((course_id) =>
        coursePerTheorySection[course_id].sections
          .map((section) =>
            teacherPerCourse(course_id).map((no) => `${course_id} ${section} ${no}`).flat()
          )
          .flat()
      )
      .flat();
    const stableMatchingRankOfCourses = (course) => {
      const course_id = course.split(" ")[0];
      const index = courses.indexOf(course_id);
      if (index === -1) throw new Error("Invalid course: " + course);
      return rankTeachers[index];
    };

    const stableMatchingTeachers = teachers;
    const stableMatchingRankOfTeachers = (teacher) => {
      const index = stableMatchingTeachers.indexOf(teacher);
      if (index === -1) throw new Error("Invalid teacher: " + teacher);
      return rankSubjects[index];
    };

    const match = sma.match(
      stableMatchingTeachers,
      stableMatchingCourses,
      stableMatchingRankOfTeachers,
      stableMatchingRankOfCourses
    );

    const records = [];

    match.forEach((match) => {
      const [course_id, sectionTheory, rank] = match[1].split(" ");
      const initial = match[0];
      // coursePerTheorySection[course_id].sections.forEach((section) => {
      //   if (section.startsWith(sectionTheory))
      //     records.push({ initial, course_id, batch, section });
      // });
      allCoursesResults
        .filter((row) => row.course_id === course_id)
        .forEach((row) => {
          if (row.section.startsWith(sectionTheory))
            records.push({
              initial,
              course_id,
              batch: row.batch,
              section: row.section,
            });
        });
    });

    const insertQuery = `INSERT INTO teacher_sessional_assignment (initial, course_id, "session", batch, "section") VALUES ($1, $2, (SELECT value FROM configs WHERE key='CURRENT_SESSION'), $3, $4)`;

    records.forEach((row) => {
      const values = [row.initial, row.course_id, row.batch, row.section];
      client.query(insertQuery, values);
    });

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.log(e);
    return false;
  } finally {
    client.release();
  }
  return true;
}

export async function getSessionalAssignment() {
  const query = `select c.course_id, c."name", (select to_json(array_agg(row_to_json(t))) "teachers" from (select t.initial, t.name, ta."section" from teacher_sessional_assignment ta natural join teachers t where ta.course_id = c.course_id and ta.session = c."session") t ) from courses c where c.course_id like 'CSE%' and c.type = 1`;

  const client = await connect();
  const result = (await client.query(query)).rows;
  client.release();
  return result;
}

export async function saveReorderedTeacherPreferenceDB(initial, response) {
  const client = await connect();
  try {
    const query = `
      UPDATE forms 
      SET response = $1 
      WHERE initial = $2 AND type = 'theory-pref'
    `;

    const result = await client.query(query, [
      JSON.stringify(response),
      initial,
    ]);
    return result.rowCount > 0;
  } finally {
    client.release();
  }
}

export async function setTeacherAssignmentDB(assignment) {
  const client = await connect();
  try {
    if (
      (assignment.initial === "None" || assignment.initial === null) &&
      (assignment.old_initial === "None" || assignment.old_initial === null)
    ) {
      return;
    }
    if (
      assignment.initial === "None" ||
      assignment.initial === undefined ||
      assignment.initial === null
    ) {
      const deleteQuery = `
        DELETE FROM teacher_assignment
        WHERE course_id = $1 AND initial = $2 AND session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
      `;
      const deleteValues = [assignment.course_id, assignment.old_initial];
      await client.query(deleteQuery, deleteValues);

      const sectionUpdateQuery = `
        UPDATE courses_sections
        SET teachers = array_remove(teachers, $1)
        WHERE course_id = $2 AND session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
          AND $1 = ANY(teachers);
      `;
      const sectionUpdateValues = [
        assignment.old_initial,
        assignment.course_id,
      ];
      await client.query(sectionUpdateQuery, sectionUpdateValues);

      const scheduleUpdateQuery = `
        UPDATE schedule_assignment
        SET teachers = array_remove(teachers, $1)
        WHERE course_id = $2 AND session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
          AND $1 = ANY(teachers);
      `;
      await client.query(scheduleUpdateQuery, sectionUpdateValues);
    } else if (
      assignment.old_initial === "None" ||
      assignment.old_initial === undefined ||
      assignment.old_initial === null
    ) {
      const insertQuery = `
        INSERT INTO teacher_assignment (course_id, initial, session)
        VALUES ($1, $2, (SELECT value FROM configs WHERE key='CURRENT_SESSION'))
      `;
      const insertValues = [assignment.course_id, assignment.initial];
      await client.query(insertQuery, insertValues);
      const sectionUpdateQuery = `
        UPDATE courses_sections
        SET teachers = teachers || $1
        WHERE course_id = $2 AND session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
          AND NOT ($1 = ANY(teachers));
      `;
      const sectionUpdateValues = [assignment.initial, assignment.course_id];
      await client.query(sectionUpdateQuery, sectionUpdateValues);

      const scheduleUpdateQuery = `
        UPDATE schedule_assignment
        SET teachers = teachers || $1
        WHERE course_id = $2 AND session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
          AND NOT ($1 = ANY(teachers));
      `;
      await client.query(scheduleUpdateQuery, sectionUpdateValues);
    } else {
      const updateQuery = `
      UPDATE teacher_assignment
      SET initial = $1
      WHERE course_id = $2 AND initial = $3 and session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
      `;
      const updateValues = [
        assignment.initial,
        assignment.course_id,
        assignment.old_initial,
      ];
      await client.query(updateQuery, updateValues);
      const sectionUpdateQuery = `
        UPDATE courses_sections
        SET teachers = array_replace(teachers, $1, $2)
        WHERE course_id = $3 AND session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
          AND $1 = ANY(teachers);
      `;
      const sectionUpdateValues = [
        assignment.old_initial,
        assignment.initial,
        assignment.course_id,
      ];
      await client.query(sectionUpdateQuery, sectionUpdateValues);

      const scheduleUpdateQuery = `
        UPDATE schedule_assignment
        SET teachers = array_replace(teachers, $1, $2)
        WHERE course_id = $3 AND session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
          AND $1 = ANY(teachers);
      `;
      await client.query(scheduleUpdateQuery, sectionUpdateValues);
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.log(error);
    throw error;
  } finally {
    client.release();
  }
}

export async function setTeacherSessionalAssignmentDB(assignment) {
  if (assignment.initial === "None") {
    return;
  }
  const query = `
    INSERT INTO teacher_sessional_assignment (initial, course_id, session, batch, section)
    VALUES ($1, $2, (SELECT value FROM configs WHERE key='CURRENT_SESSION'), $3, $4)
  `;
  const updateScheduleQuery = `
  UPDATE schedule_assignment
  SET teachers = teachers || $1
  WHERE course_id = $2 AND batch = $3 AND section = $4
  AND NOT ($1 = ANY(teachers));
  `;
  const values = [
    assignment.initial,
    assignment.course_id,
    assignment.batch,
    assignment.section,
  ];
  const client = await connect();

  try {
    const result = await client.query(query, values);
    if (result.rowCount <= 0) throw new HttpError(400, "Insertion Failed");
    await client.query(updateScheduleQuery, values);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function deleteTeacherSessionalAssignmentDB(
  initial,
  course_id,
  batch,
  section
) {
  const query = `
    DELETE FROM teacher_sessional_assignment
    WHERE initial = $1 AND course_id = $2 AND session = (SELECT value FROM configs WHERE key='CURRENT_SESSION') AND batch = $3 AND section = $4
  `;
  const updateScheduleQuery = `
    UPDATE schedule_assignment
    SET teachers = array_remove(teachers, $1)
    WHERE course_id = $2 AND batch = $3 AND section = $4
    AND $1 = ANY(teachers);
  `;
  const values = [initial, course_id, batch, section];
  const client = await connect();
  try {
    const result = await client.query(query, values);
    if (result.rowCount <= 0) throw new HttpError(400, "Deletion Failed");
    await client.query(updateScheduleQuery, values);
    return true;
  } finally {
    client.release();
  }
}

export async function getFormIdByInitialAndType(initial, type) {
  const query = "SELECT id FROM forms WHERE initial = $1 AND type = $2";
  const values = [initial, type];
  const client = await connect();
  try {
    const results = await client.query(query, values);
    if (results.rows.length <= 0)
      throw new HttpError(404, "Form not found or already submitted");
    return results.rows[0].id;
  } finally {
    client.release();
  }
}

export async function calculateTeacherTotalCredit(initial) {
  const client = await connect();
  try {
    let totalCredit = 0;

    // Get teacher information for thesis and MSC offerings
    const teacherQuery = `
      SELECT offers_thesis_1, offers_thesis_2, offers_msc 
      FROM teachers 
      WHERE initial = $1 AND active = 1
    `;
    const teacherResult = await client.query(teacherQuery, [initial]);

    if (teacherResult.rows.length === 0) {
      throw new HttpError(404, "Teacher not found or inactive");
    }

    const teacher = teacherResult.rows[0];

    // Add thesis credits
    if (teacher.offers_thesis_1) {
      totalCredit += 6;
    }
    if (teacher.offers_thesis_2) {
      totalCredit += 6;
    }

    // Add MSC credits
    if (teacher.offers_msc) {
      totalCredit += 3;
    }

    // Get all sessional assignments for the teacher
    const sessionalQuery = `
      SELECT DISTINCT tsa.course_id, c.class_per_week
      FROM teacher_sessional_assignment tsa
      JOIN courses c ON tsa.course_id = c.course_id AND tsa.session = c.session
      WHERE tsa.initial = $1 
      AND tsa.session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
      AND c.type = 1
    `;
    const sessionalResult = await client.query(sessionalQuery, [initial]);

    // Add sessional credits
    for (const sessional of sessionalResult.rows) {
      if (sessional.class_per_week === 0.75){
          totalCredit += 4 * (sessional.class_per_week || 0);
      }else{
          totalCredit += 2 * (sessional.class_per_week || 0);
      }
    }

    // Get all theory assignments for the teacher
    const theoryQuery = `
      SELECT DISTINCT cs.course_id, cs.section, ac.class_per_week
      FROM courses_sections cs
      JOIN all_courses ac ON cs.course_id = ac.course_id
      WHERE $1 = ANY(cs.teachers)
      AND cs.session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
      AND cs.course_id ~ '[13579]$'
      AND cs.course_id LIKE 'CSE%'
      AND ac.type = 0
    `;
    const theoryResult = await client.query(theoryQuery, [initial]);

    // For each theory assignment, calculate credit based on number of teachers for that specific course section
    for (const theory of theoryResult.rows) {
      // Count total teachers assigned to the same course section
      const teacherCountQuery = `
        SELECT array_length(teachers, 1) as teacher_count
        FROM courses_sections
        WHERE course_id = $1 AND section = $2
        AND session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
      `;
      const teacherCountResult = await client.query(teacherCountQuery, [
        theory.course_id,
        theory.section,
      ]);

      const teacherCount =
        parseInt(teacherCountResult.rows[0].teacher_count) || 1;
      const courseCredit = theory.class_per_week || 0;

      // Add proportional credit for this course section
      if (initial === "MMA") {
        console.log(
          "Theory Course:",
          theory.course_id,
          "Section:",
          theory.section,
          "Credit:",
          courseCredit,
          "Teacher Count:",
          teacherCount
        );
      }
      totalCredit += courseCredit / teacherCount;
    }

    return {
      initial,
      totalCredit: Math.round(totalCredit * 100) / 100, // Round to 2 decimal places
      breakdown: {
        thesis1: teacher.offers_thesis_1 ? 6 : 0,
        thesis2: teacher.offers_thesis_2 ? 6 : 0,
        msc: teacher.offers_msc ? 3 : 0,
        sessionalCourses: sessionalResult.rows.length,
        theoryCourses: theoryResult.rows.length,
      },
    };
  } finally {
    client.release();
  }
}

export async function calculateAllTeachersCredits() {
  const client = await connect();
  try {
    // Get all active teachers
    const teachersQuery = `
      SELECT initial, name, email
      FROM teachers 
      WHERE active = 1
      ORDER BY name
    `;
    const teachersResult = await client.query(teachersQuery);

    const results = [];

    // Calculate credits for each teacher
    for (const teacher of teachersResult.rows) {
      try {
        const creditInfo = await calculateTeacherTotalCredit(teacher.initial);
        results.push({
          ...teacher,
          ...creditInfo,
        });
      } catch (error) {
        console.error(
          `Error calculating credits for teacher ${teacher.initial}:`,
          error
        );
        results.push({
          ...teacher,
          initial: teacher.initial,
          totalCredit: 0,
          breakdown: {
            thesis1: 0,
            thesis2: 0,
            msc: 0,
            sessionalCourses: 0,
            theoryCourses: 0,
          },
        });
      }
    }

    return results;
  } finally {
    client.release();
  }
}

export async function getTheoryDistributionDB() {
  const client = await connect();
  try {
    const query = `
      SELECT 
        cs.course_id,
        ac.name as course_name,
        cs.section,
        cs.teachers
      FROM courses_sections cs
      LEFT JOIN all_courses ac ON cs.course_id = ac.course_id
      WHERE cs.session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
      AND cs.course_id ~ '[13579]$'
      AND cs.course_id LIKE 'CSE%'
      AND ac.type = 0
      ORDER BY cs.course_id, cs.section
    `;

    const result = await client.query(query);

    // Transform the data to include teacher details
    const teacherDetailsQuery = `
      SELECT initial, name, email, surname 
      FROM teachers 
      WHERE active = 1
    `;
    const teachersResult = await client.query(teacherDetailsQuery);
    const teachersMap = teachersResult.rows.reduce((acc, teacher) => {
      acc[teacher.initial] = teacher;
      return acc;
    }, {});

    // Enhance the result with teacher details
    const enhancedResult = result.rows.map((row) => ({
      ...row,
      teachers_details: (row.teachers || []).map((initial) => ({
        initial,
        name: teachersMap[initial]?.name || "Unknown",
        email: teachersMap[initial]?.email || "",
        surname: teachersMap[initial]?.surname || "Unknown",
      })),
    }));

    return enhancedResult;
  } finally {
    client.release();
  }
}

export async function getSessionalDistributionDB() {
  const client = await connect();
  try {
    const query = `
      SELECT 
        cs.course_id,
        ac.name as course_name,
        ac.class_per_week,
        cs.section,
        tsa.initial,
        t.name as teacher_name,
        t.surname as teacher_surname,
        sa.day,
        sa.time
      FROM courses_sections cs
      LEFT JOIN all_courses ac ON cs.course_id = ac.course_id
      LEFT JOIN teacher_sessional_assignment tsa ON cs.course_id = tsa.course_id 
        AND cs.section = tsa.section 
        AND cs.session = tsa.session
      LEFT JOIN teachers t ON tsa.initial = t.initial AND t.active = 1
      LEFT JOIN schedule_assignment sa ON cs.course_id = sa.course_id 
        AND cs.section = sa.section 
        AND cs.session = sa.session
      WHERE cs.session = (SELECT value FROM configs WHERE key='CURRENT_SESSION')
      AND cs.course_id ~ '[02468]$'
      AND cs.course_id LIKE 'CSE%'
      AND ac.type = 1
      ORDER BY cs.course_id, cs.section, tsa.initial
    `;

    const result = await client.query(query);

    // Group by course and section
    const groupedResult = result.rows.reduce((acc, row) => {
      const key = `${row.course_id}-${row.section}`;

      if (!acc[key]) {
        acc[key] = {
          course_id: row.course_id,
          course_name: row.course_name,
          class_per_week: row.class_per_week,
          section: row.section,
          day: row.day,
          time: row.time,
          teachers_details: [],
        };
      }

      if (row.initial && row.teacher_name) {
        acc[key].teachers_details.push({
          initial: row.initial,
          name: row.teacher_name,
          surname: row.teacher_surname || "Unknown",
        });
      }

      return acc;
    }, {});

    return Object.values(groupedResult);
  } finally {
    client.release();
  }
}
