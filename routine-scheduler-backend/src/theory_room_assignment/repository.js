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

export async function updateTheoryRoomAssignmentDB(course_id, section, day, time, room_no) {
  const query = `
    UPDATE schedule_assignment
    SET room_no = $5
    WHERE course_id = $1 AND section = $2 AND day = $3 AND time = $4
    AND EXISTS (
      SELECT 1 FROM courses c 
      WHERE c.course_id = schedule_assignment.course_id 
      AND c.session = schedule_assignment.session 
      AND c.type != 1
    )
  `;
  const values = [course_id, section, day, time, room_no];
  try {
    const client = await connect();
    client.release();
    return true;
  } catch (error) {
    console.error("Error updating theory room assignment:", error);
    throw new Error("Failed to update theory room assignment");
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

  const update_schedule_assignment_query = `
    UPDATE schedule_assignment
    SET room_no = $4
    WHERE section = $3 AND department = $2 AND batch = (
      SELECT batch FROM level_term_unique WHERE level_term = $1 AND department = $2
    )
  `;

  const values = [levelTerm, department, section, roomNo];

  try {
    const client = await connect();
    await client.query(update_section_room_query, values);
    await client.query(update_schedule_assignment_query, values);
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