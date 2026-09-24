import { connect } from "../config/database.js";
import { HttpError } from "../config/error-handle.js";
import { loadTheoryProblemDB } from "../theory_scheduler/repository.js";
import { validateTheoryMove } from "../theory_scheduler/algorithm.js";
import { effectiveRoomSQL, roomOccupants } from "./roomUse.js";

const SESSION = "(SELECT value FROM configs WHERE key = 'CURRENT_SESSION')";
const SHARED = "(c.optional = 1 AND c.optional_section_count <= 1)";

async function timesOf(client) {
  const row = (await client.query("SELECT value FROM configs WHERE key = 'times'")).rows[0];
  return (row ? JSON.parse(row.value) : [8, 9, 10, 11, 12, 1, 2, 3, 4]).map(Number);
}

// Every class of the session held in a room: theory and labs
async function roomedRows(client) {
  return (await client.query(
    `SELECT * FROM (
       SELECT sa.course_id, sa.department, sa.batch, sa.section, sa.day, sa."time",
              ${effectiveRoomSQL()} AS room_no,
              c.type, COALESCE(c.type = 0 AND ${SHARED}, false) AS shared
       FROM schedule_assignment sa
       LEFT JOIN courses c ON c.course_id = sa.course_id AND c.session = sa.session
       LEFT JOIN sections s ON s.department = sa.department AND s.batch = sa.batch AND s.section = sa.section
       WHERE sa.session = ${SESSION}) held
     WHERE room_no IS NOT NULL
     ORDER BY department, batch, section, day, "time", course_id`
  )).rows;
}

/**
 * Every theory class of the session with its room, its section's usual room
 * and whatever else is in that room at the time (labs included). An
 * elective every section takes appears once, for "A/B/C". CT has no room
 * and is left out.
 */
export async function getAllTheoryRoomAssignmentDB() {
  const query = `
    SELECT sa.course_id, sa.section, sa.department, sa.batch, s.level_term, sa.day, sa."time",
           ${effectiveRoomSQL()} AS room_no, sa.room_no IS NULL AS room_from_section,
           s.room AS section_room, c.optional, c.optional_section_count,
           ${SHARED} AS elective
    FROM schedule_assignment sa
    JOIN courses c ON c.course_id = sa.course_id AND c.session = sa.session
    JOIN sections s ON s.department = sa.department AND s.batch = sa.batch AND s.section = sa.section
    WHERE sa.session = ${SESSION}
      AND c.type = 0 AND sa.course_id <> 'CT'
    ORDER BY sa.department, s.level_term, sa.section, sa.course_id`;
  const client = await connect();
  try {
    const rows = (await client.query(query)).rows;
    const times = await timesOf(client);
    const occupied = await roomedRows(client);
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
        clash: roomOccupants(occupied, times, { room: r.room_no, day: r.day, time: r.time },
          { ...r, shared: r.elective }),
      }));
  } finally {
    client.release();
  }
}

/**
 * Moves one theory class to another room for its day and time. An elective
 * that runs as a single group sits in every section's routine, so all its
 * copies move together. Returns what else is in the new room then.
 */
export async function updateTheoryRoomAssignmentDB({ course_id, department, batch, section, day, time, room_no }) {
  const client = await connect();
  try {
    const updated = (await client.query(
      `UPDATE schedule_assignment sa
       SET room_no = $5
       FROM courses c
       WHERE c.course_id = sa.course_id AND c.session = sa.session AND c.type = 0
         AND sa.course_id = $1 AND sa.day = $3 AND sa."time" = $4
         AND sa.session = ${SESSION}
         AND ($6::varchar IS NULL OR sa.department = $6)
         AND ($7::int IS NULL OR sa.batch = $7)
         AND (sa.section = $2
              OR (${SHARED}
                  AND (sa.department, sa.batch) IN (
                    SELECT department, batch FROM schedule_assignment
                    WHERE course_id = $1 AND section = $2 AND day = $3 AND "time" = $4
                      AND session = ${SESSION})))
       RETURNING sa.department, sa.batch, ${SHARED} AS shared`,
      [course_id, section, day, Number(time), room_no || null, department || null,
        batch == null || batch === "" ? null : Number(batch)]
    )).rows;
    if (!updated.length) throw new HttpError(404, `${course_id} (${section}) has no class on ${day} at ${time}:00`);
    const clashes = roomOccupants(await roomedRows(client), await timesOf(client),
      { room: room_no, day, time: Number(time) },
      { course_id, department: updated[0].department, batch: updated[0].batch,
        section, shared: updated[0].shared, day, time: Number(time) });
    return { updated: updated.length, clashes };
  } finally {
    client.release();
  }
}

/**
 * Moves one theory class to another day and time (and optionally room).
 * The generator's hard rules still apply: no section or teacher clash, no
 * 1 PM, a course at most once a day per section, and the common CT slots.
 * The moved class counts as fixed from then on.
 */
export async function moveTheoryClassDB({ course_id, department, batch, section, day, time, new_day, new_time, room_no }) {
  const client = await connect();
  try {
    await client.query("BEGIN");
    const levelTerm = (await client.query(
      "SELECT level_term FROM sections WHERE department = $1 AND batch = $2 AND section = $3",
      [department, Number(batch), section]
    )).rows[0]?.level_term;
    if (!levelTerm) throw new HttpError(404, `Section ${section} of ${department} batch ${batch} does not exist`);
    const problem = await loadTheoryProblemDB(department, levelTerm, client);
    const key = `${department}|${batch}|${String(section).replace(/[0-9]+$/, "")}`;
    const events = [...problem.fixed, ...problem.generated];
    const moving = events.find((e) => e.course_id === course_id && Number(e.type) === 0 &&
      e.day === day && e.time === Number(time) && e.sections.includes(key));
    if (!moving || course_id === "CT") {
      throw new HttpError(404, `${course_id} (${section}) has no theory class on ${day} at ${time}:00`);
    }
    const issues = validateTheoryMove(problem, events, moving, new_day, Number(new_time));
    if (issues.length) throw new HttpError(409, issues.join("; "));

    const sections = moving.sections.map((k) => k.split("|")[2]);
    const keepRoom = room_no === undefined;
    const moved = (await client.query(
      `UPDATE schedule_assignment
       SET day = $7, "time" = $8, locked = true,
           room_no = CASE WHEN $9 THEN room_no ELSE $10 END
       WHERE session = ${SESSION} AND course_id = $1 AND department = $2 AND batch = $3
         AND section = ANY($4::varchar[]) AND day = $5 AND "time" = $6
       RETURNING room_no, (SELECT room FROM sections s WHERE s.department = $2
                           AND s.batch = $3 AND s.section = schedule_assignment.section) AS section_room`,
      [course_id, department, Number(batch), sections, day, Number(time),
        new_day, Number(new_time), keepRoom, keepRoom ? null : room_no || null]
    )).rows;
    const room = moved[0]?.room_no || (moving.sections.length > 1 ? null : moved[0]?.section_room) || null;
    const clashes = roomOccupants(await roomedRows(client), await timesOf(client),
      { room, day: new_day, time: Number(new_time) },
      { course_id, department, batch: Number(batch), section,
        shared: moving.sections.length > 1, day: new_day, time: Number(new_time) });
    await client.query("COMMIT");
    return { moved: moved.length, room, clashes };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
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
  const client = await connect();
  try {
    return (await client.query(query)).rows;
  } finally {
    client.release();
  }
}

/**
 * Gives a section its usual room. Its theory classes follow: those in the
 * old room or in none. Classes moved elsewhere on their own keep their room,
 * as do CT (no room), labs, and electives every section takes together
 * (they need rooms of their own). Returns how many classes moved.
 */
export async function updateSectionRoomAllocationDB(levelTerm, department, section, roomNo) {
  const batchOf = "(SELECT batch FROM level_term_unique WHERE level_term = $1 AND department = $2)";
  const client = await connect();
  try {
    await client.query("BEGIN");
    const moved = await client.query(
      `UPDATE schedule_assignment sa
       SET room_no = $4
       FROM courses c
       WHERE c.course_id = sa.course_id AND c.session = sa.session AND c.type = 0
         AND NOT ${SHARED} AND sa.course_id <> 'CT'
         AND sa.session = ${SESSION}
         AND sa.section = $3 AND sa.department = $2 AND sa.batch = ${batchOf}
         AND (sa.room_no IS NULL OR sa.room_no IS NOT DISTINCT FROM (
           SELECT room FROM sections s
           WHERE s.section = $3 AND s.department = $2 AND s.batch = sa.batch))`,
      [levelTerm, department, section, roomNo || null]
    );
    const updated = await client.query(
      `UPDATE sections SET room = $4
       WHERE section = $3 AND department = $2 AND batch = ${batchOf}`,
      [levelTerm, department, section, roomNo || null]
    );
    if (!updated.rowCount) throw new HttpError(404, `${department} ${levelTerm} has no section ${section}`);
    await client.query("COMMIT");
    return { classes: moved.rowCount };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
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