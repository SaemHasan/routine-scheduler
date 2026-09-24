/*
 * An optional lab that runs as a single group is taken by students of every
 * section, so it is written CSE414(A/B/C) rather than CSE414(A1/A2).
 */

/**
 * SQL for the label of such a class, NULL for every other class. `course`
 * is the alias of the courses row; `department` and `batch` are the
 * class's columns.
 */
export const optionalSectionLabelSQL = (course, department, batch) => `
  CASE WHEN ${course}.optional = 1 AND ${course}.type = 1 AND ${course}.optional_section_count <= 1 THEN (
    SELECT string_agg(DISTINCT regexp_replace(ls.section, '[0-9]+$', ''), '/'
                      ORDER BY regexp_replace(ls.section, '[0-9]+$', ''))
    FROM sections ls
    WHERE ls.department = ${department} AND ls.batch = ${batch}
  ) END`;

/**
 * SQL that is true for the classes an optional lab actually runs: its
 * first optional_section_count groups (A, B, …; A1/A2 for a 1.5-credit
 * lab). Every other course's classes all run. `cs` is the courses_sections
 * alias.
 */
export const runsAsGroupSQL = (course, cs) => `
  (${course}.optional = 0 OR (
    SELECT count(DISTINCT regexp_replace(o.section, '[0-9]+$', ''))
    FROM courses_sections o
    WHERE o.course_id = ${cs}.course_id AND o.session = ${cs}.session
      AND o.department = ${cs}.department AND o.batch = ${cs}.batch
      AND regexp_replace(o.section, '[0-9]+$', '') < regexp_replace(${cs}.section, '[0-9]+$', '')
  ) < GREATEST(1, ${course}.optional_section_count))`;
