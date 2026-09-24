import { connect } from "../config/database.js";

export async function getAllTheoryRoomAssignmentDB() {
  const query = `
    SELECT course_id, section, day, time, room_no
    FROM schedule_assignment
    WHERE course_id ~ '[13579]$'
    ORDER BY course_id, section, day, time
  `;
  const client = await connect();
  const results = await client.query(query);
  client.release();
  return results.rows;
}

/**
 * Moves one theory class to another room. An elective that runs as a single
 * group sits in every section's routine, so all its copies move together.
 */
export async function updateTheoryRoomAssignmentDB(course_id, section, day, time, room_no) {
  const client = await connect();
  try {
    const result = await client.query(
      `UPDATE schedule_assignment sa
       SET room_no = $5
       FROM courses c
       WHERE c.course_id = sa.course_id AND c.session = sa.session AND c.type <> 1
         AND sa.course_id = $1 AND sa.day = $3 AND sa."time" = $4
         AND sa.session = (SELECT value FROM configs WHERE key = 'CURRENT_SESSION')
         AND (sa.section = $2
              OR (c.optional = 1 AND c.optional_section_count <= 1
                  AND (sa.department, sa.batch) IN (
                    SELECT department, batch FROM schedule_assignment
                    WHERE course_id = $1 AND section = $2 AND day = $3 AND "time" = $4)))`,
      [course_id, section, day, Number(time), room_no || null]
    );
    return result.rowCount > 0;
  } catch (error) {
    console.error("Error updating theory room assignment:", error);
    throw new Error("Failed to update theory room assignment");
  } finally {
    client.release();
  }
}

export async function getAllSectionRoomAllocationDB() {
  const query = `
    SELECT level_term, department, section, room as room_no
    FROM sections
    WHERE section LIKE '_'
    ORDER BY department, level_term, section;
  `;

  try {
    const client = await connect();
    const result = await client.query(query);
    client.release();
    return result.rows;
  } catch (error) {
    console.error("Error fetching all section room allocation:", error);
    throw new Error("Failed to fetch all section room allocation");
  }
}

export async function updateSectionRoomAllocationDB(levelTerm, department, section, roomNo) {
  const update_section_room_query = `
    UPDATE sections
    SET room = $4
    WHERE section = $3 AND department = $2 AND batch = (
      SELECT batch FROM level_term_unique WHERE level_term = $1 AND department = $2
    )
  `;

  // The section's theory classes follow it to the new room, except those
  // moved elsewhere on their own (and CT, which has no room). Labs keep theirs.
  const update_schedule_assignment_query = `
    UPDATE schedule_assignment sa
    SET room_no = $4
    FROM courses c
    WHERE c.course_id = sa.course_id AND c.session = sa.session AND c.type = 0
      AND sa.course_id <> 'CT'
      AND sa.section = $3 AND sa.department = $2 AND sa.batch = (
        SELECT batch FROM level_term_unique WHERE level_term = $1 AND department = $2
      )
      AND (sa.room_no IS NULL OR sa.room_no IS NOT DISTINCT FROM (
        SELECT room FROM sections s
        WHERE s.section = $3 AND s.department = $2 AND s.batch = sa.batch))
  `;

  const values = [levelTerm, department, section, roomNo];

  try {
    const client = await connect();
    await client.query(update_schedule_assignment_query, values);
    await client.query(update_section_room_query, values);
    client.release();
    return true;
  } catch (error) {
    console.error("Error updating section room allocation:", error);
    throw new Error("Failed to update section room allocation");
  }
}

export async function getAllNonDepartmentalLabRoomAssignmentDB() {
  const query = `
    SELECT course_id, section, room_no
    FROM schedule_assignment
    WHERE course_id ~ '[02468]$'
    AND course_id NOT LIKE 'CSE%'
    ORDER BY course_id, section, room_no
  `;

  try {
    const client = await connect();
    const result = await client.query(query);
    client.release();
    return result.rows;
  } catch (error) {
    console.error("Error fetching all non-departmental lab room assignments:", error);
    throw new Error("Failed to fetch all non-departmental lab room assignments");
  }
}

export async function updateNonDepartmentalLabRoomAssignmentDB(course_id, section, room_no) {
  const query = `
    UPDATE schedule_assignment
    SET room_no = $3
    WHERE course_id = $1 AND section = $2
  `;
  const values = [course_id, section, room_no];
  try {
    const client = await connect();
    await client.query(query, values);
    client.release();
    return true;
  } catch (error) {
    console.error("Error updating non-departmental lab room assignment:", error);
    throw new Error("Failed to update non-departmental lab room assignment");
  }
}