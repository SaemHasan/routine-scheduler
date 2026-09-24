import { connect } from "../config/database.js";
import { HttpError } from "../config/error-handle.js";

const CURRENT_SESSION = "(SELECT value FROM configs WHERE key='CURRENT_SESSION')";

async function getTimes(client) {
  const rows = (
    await client.query("SELECT key, value FROM configs WHERE key IN ('times', 'days')")
  ).rows;
  const cfg = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]));
  return {
    times: (cfg.times || [8, 9, 10, 11, 12, 1, 2, 3, 4]).map(Number),
    days: cfg.days || ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"],
  };
}

// Periods a thesis slot covers, e.g. 11 to 4 → 11, 12, 1, 2, 3, 4
const periodsOf = (times, slot) => {
  const from = times.indexOf(Number(slot.start_time));
  const to = times.indexOf(Number(slot.end_time));
  return from < 0 || to < from ? [] : times.slice(from, to + 1);
};

/**
 * The thesis setup: when each thesis runs, which level-term takes which,
 * and any other classes a section has during its thesis.
 */
export async function getThesisSetupDB() {
  const client = await connect();
  try {
    const { times } = await getTimes(client);
    const slots = (await client.query("SELECT * FROM thesis_slots ORDER BY thesis")).rows;
    const levelTerms = (
      await client.query(
        `SELECT level_term, department, batch, active, thesis
         FROM level_term_unique
         WHERE department = 'CSE'
         ORDER BY level_term`
      )
    ).rows;
    const conflicts = await findThesisConflicts(client, times, slots, levelTerms);
    return { slots, levelTerms, conflicts };
  } finally {
    client.release();
  }
}

// Classes that fall in a level-term's thesis time
async function findThesisConflicts(client, times, slots, levelTerms) {
  const conflicts = [];
  const labHours = (start) => {
    const i = times.indexOf(Number(start));
    return i < 0 ? [Number(start)] : times.slice(i, i + 3);
  };
  for (const lt of levelTerms.filter((x) => x.active && x.thesis)) {
    const slot = slots.find((s) => s.thesis === lt.thesis);
    if (!slot) continue;
    const periods = periodsOf(times, slot);
    const rows = (
      await client.query(
        `SELECT sa.course_id, sa.section, sa."time", c.type
         FROM schedule_assignment sa
         JOIN sections s ON s.department = sa.department AND s.batch = sa.batch AND s.section = sa.section
         LEFT JOIN courses c ON c.course_id = sa.course_id AND c.session = sa.session
         WHERE sa.session = ${CURRENT_SESSION} AND sa.department = $1
           AND s.level_term = $2 AND sa.day = $3 AND COALESCE(c.type, 0) <> 2`,
        [lt.department, lt.level_term, slot.day]
      )
    ).rows;
    for (const row of rows) {
      const hours = row.type === 1 ? labHours(row.time) : [Number(row.time)];
      if (hours.some((h) => periods.includes(h))) {
        conflicts.push(
          `${lt.level_term} section ${row.section} has ${row.course_id} on ${slot.day} at ${row.time}:00, during Thesis ${lt.thesis}`
        );
      }
    }
  }
  return conflicts;
}

/**
 * Puts the thesis into the routine: for every active level-term with a
 * thesis, each of its sections gets the thesis course in every period of
 * that thesis's slot. Earlier thesis entries are replaced. Thesis needs no
 * room.
 */
export async function syncThesisScheduleDB(client = null) {
  const own = !client;
  if (own) client = await connect();
  try {
    if (own) await client.query("BEGIN");
    const { times } = await getTimes(client);
    const slots = (await client.query("SELECT * FROM thesis_slots")).rows;
    const thesisCourses = (
      await client.query(
        `SELECT course_id, level_term FROM courses
         WHERE type = 2 AND session = ${CURRENT_SESSION} ORDER BY course_id`
      )
    ).rows;

    await client.query(
      `DELETE FROM schedule_assignment
       WHERE session = ${CURRENT_SESSION}
         AND course_id IN (SELECT course_id FROM courses WHERE type = 2 AND session = ${CURRENT_SESSION})`
    );

    const levelTerms = (
      await client.query(
        `SELECT level_term, department, thesis FROM level_term_unique
         WHERE active AND thesis IS NOT NULL`
      )
    ).rows;
    for (const lt of levelTerms) {
      const slot = slots.find((s) => s.thesis === lt.thesis);
      const course =
        thesisCourses.find((c) => c.level_term === lt.level_term) || thesisCourses[0];
      if (!slot || !course) continue;
      const sections = (
        await client.query(
          `SELECT batch, section FROM sections
           WHERE department = $1 AND level_term = $2 AND type = 0`,
          [lt.department, lt.level_term]
        )
      ).rows;
      for (const s of sections) {
        for (const period of periodsOf(times, slot)) {
          await client.query(
            `INSERT INTO schedule_assignment
               (course_id, session, batch, section, day, "time", department, teachers, locked)
             VALUES ($1, ${CURRENT_SESSION}, $2, $3, $4, $5, $6, '{}', true)
             ON CONFLICT DO NOTHING`,
            [course.course_id, s.batch, s.section, slot.day, period, lt.department]
          );
        }
      }
    }
    if (own) await client.query("COMMIT");
  } catch (error) {
    if (own) await client.query("ROLLBACK");
    throw error;
  } finally {
    if (own) client.release();
  }
}

export async function setThesisSlotDB(thesis, { day, start_time, end_time }) {
  const client = await connect();
  try {
    const { times, days } = await getTimes(client);
    if (!days.includes(day)) throw new HttpError(400, `${day} is not a working day`);
    const from = times.indexOf(Number(start_time));
    const to = times.indexOf(Number(end_time));
    if (from < 0 || to < 0 || to < from) {
      throw new HttpError(400, "Choose a start time before the end time");
    }
    const result = await client.query(
      `UPDATE thesis_slots SET day = $2, start_time = $3, end_time = $4 WHERE thesis = $1`,
      [thesis, day, Number(start_time), Number(end_time)]
    );
    if (result.rowCount === 0) throw new HttpError(404, `Thesis ${thesis} not found`);
  } finally {
    client.release();
  }
  await syncThesisScheduleDB();
}

export async function setLevelTermThesisDB({ level_term, department, thesis }) {
  const value = thesis === 1 || thesis === 2 || thesis === "1" || thesis === "2" ? Number(thesis) : null;
  const client = await connect();
  try {
    const result = await client.query(
      `UPDATE level_term_unique SET thesis = $3 WHERE level_term = $1 AND department = $2`,
      [level_term, department, value]
    );
    if (result.rowCount === 0) throw new HttpError(404, "Level-term not found");
  } finally {
    client.release();
  }
  await syncThesisScheduleDB();
}

/**
 * Default thesis for the active level-terms: with one Level 4 batch it takes
 * Thesis 1; with two, L-4 T-2 takes Thesis 1 and L-4 T-1 takes Thesis 2.
 */
export async function applyDefaultThesisDB() {
  const client = await connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE level_term_unique SET thesis = NULL WHERE department = 'CSE'");
    const level4 = (
      await client.query(
        `SELECT level_term FROM level_term_unique
         WHERE department = 'CSE' AND active AND level_term LIKE 'L-4%'
         ORDER BY level_term`
      )
    ).rows.map((r) => r.level_term);
    const assign = async (level_term, thesis) =>
      client.query(
        "UPDATE level_term_unique SET thesis = $2 WHERE department = 'CSE' AND level_term = $1",
        [level_term, thesis]
      );
    if (level4.length === 1) {
      await assign(level4[0], 1);
    } else if (level4.length >= 2) {
      for (const lt of level4) await assign(lt, /T-2/.test(lt) ? 1 : 2);
    }
    await syncThesisScheduleDB(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
