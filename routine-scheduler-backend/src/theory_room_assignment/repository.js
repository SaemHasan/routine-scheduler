import { connect } from "../config/database.js";

/**
 * Every theory class of the session with its room and its section's usual
 * room. An elective every section takes appears once, for "A/B/C". CT has
 * no room and is left out.
 */
export async function getAllTheoryRoomAssignmentDB() {
  const query = `
    SELECT sa.course_id, sa.section, sa.department, sa.batch, s.level_term, sa.day, sa."time",
           sa.room_no, s.room AS section_room, c.optional, c.optional_section_count,
           (c.optional = 1 AND c.optional_section_count <= 1) AS elective
    FROM schedule_assignment sa
    JOIN courses c ON c.course_id = sa.course_id AND c.session = sa.session
    JOIN sections s ON s.department = sa.department AND s.batch = sa.batch AND s.section = sa.section
    WHERE sa.session = (SELECT value FROM configs WHERE key = 'CURRENT_SESSION')
      AND c.type = 0 AND sa.course_id <> 'CT'
    ORDER BY sa.department, s.level_term, sa.section, sa.course_id`;
  const client = await connect();
  try {
    const rows = (await client.query(query)).rows;
    const mains = new Map();
    for (const r of rows) {
      const k = `${r.department}|${r.batch}`;
      if (!mains.has(k)) mains.set(k, new Set());
      mains.get(k).add(r.section);
    }
    const seen = new Set();
    return rows
      .filter((r) => {
        if (!r.elective) return true;
        const k = `${r.course_id}|${r.department}|${r.batch}|${r.day}|${r.time}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((r) => ({
        ...r,
        label: r.elective ? [...mains.get(`${r.department}|${r.batch}`)].sort().join("/") : r.section,
      }));
  } finally {
    client.release();
  }
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
  // Sections of the running level-terms
  const query = `
    SELECT s.level_term, s.department, s.batch, s.section, s.room AS room_no
    FROM sections s
    JOIN level_term_unique ltu
      ON ltu.level_term = s.level_term AND ltu.department = s.department AND ltu.active
    WHERE s.type = 0
    ORDER BY s.department = 'CSE' DESC, s.department, s.level_term, s.section;
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