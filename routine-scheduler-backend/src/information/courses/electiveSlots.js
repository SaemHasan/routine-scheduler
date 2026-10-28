import { connect } from "../../config/database.js";
import { HttpError } from "../../config/error-handle.js";

/*
 * The parallel classes of an option are its slots, named by letter: Option
 * 1X, 1Y and 1Z for the three courses of option 1. The routine is bound to
 * the slots, so giving 1X to another course of the option moves 1X's classes
 * to it. Until a level-term's electives are activated, the routine shows the
 * slots instead of the courses.
 *
 * Per level-term, configs ELECTIVE_SLOTS:<session>:<department>:<level-term>
 * holds { shown, slots: { CSE461: "1X", … } }.
 */

export const SLOT_LETTERS = ["X", "Y", "Z", "W", "V", "U", "T", "S", "R", "Q"];

const optionOf = (course) => `${Number(course.type)}|${Number(course.option_group)}`;

// Theory and sessional options are lettered apart, but both read "Option 1X":
// a lab block of 1X is then read as theory 1X's sessional
export const slotLabel = (course, letter) => `Option ${course.option_group}${letter}`;

/**
 * Each course's letter in its option, from the stored slots ({ CSE461: "1X" }):
 * a course keeps its slot while it stays in the option and no other course
 * has it; a course joining an option takes the first free letter, e.g.
 * CSE465 joining CSE461 (1X) and CSE463 (1Y) takes 1Z.
 */
export function assignSlotLetters(courses, stored = {}) {
  const sorted = [...courses].sort((a, b) =>
    a.course_id.localeCompare(b.course_id, undefined, { numeric: true }));
  const used = new Map(sorted.map((c) => [optionOf(c), new Set()]));
  const letters = {};
  for (const c of sorted) {
    const [, option, letter] = String(stored[c.course_id] || "").match(/^(\d+)(.+)$/) || [];
    if (Number(option) === Number(c.option_group) && !used.get(optionOf(c)).has(letter)) {
      letters[c.course_id] = letter;
      used.get(optionOf(c)).add(letter);
    }
  }
  for (const c of sorted.filter((course) => !letters[course.course_id])) {
    const taken = used.get(optionOf(c));
    const letter = SLOT_LETTERS.find((l) => !taken.has(l)) || String(taken.size + 1);
    letters[c.course_id] = letter;
    taken.add(letter);
  }
  return letters;
}

/**
 * The courses whose classes change hands when an option's letters do, as
 * [from, to] pairs: each slot's classes go to the course now holding it, so
 * CSE461 (1X) and CSE463 (1Y) trading letters trade their classes.
 */
export function slotMoves(before, after) {
  const holderOf = new Map(Object.entries(after).map(([course, letter]) => [letter, course]));
  return Object.entries(before)
    .map(([course, letter]) => [course, holderOf.get(letter)])
    .filter(([from, to]) => to && to !== from);
}

const configKey = (session, department, levelTerm) =>
  `ELECTIVE_SLOTS:${session}:${department}:${levelTerm}`;

async function currentSession(client) {
  const session = (await client.query("SELECT value FROM configs WHERE key = 'CURRENT_SESSION'")).rows[0]?.value;
  if (!session) throw new HttpError(400, "Current session is not configured");
  return session;
}

/**
 * The level-term's running electives that belong to an option, each with its
 * slot letter and label, and whether the routine shows the courses yet.
 */
export async function electiveSlotsOf(client, session, department, levelTerm) {
  const courses = (await client.query(
    `SELECT course_id, name, type, option_group, class_per_week
     FROM courses
     WHERE session = $1 AND "to" = $2 AND level_term = $3
       AND optional = 1 AND option_group IS NOT NULL AND type IN (0, 1)
     ORDER BY type, option_group, course_id`,
    [session, department, levelTerm]
  )).rows;
  const value = (await client.query(
    "SELECT value FROM configs WHERE key = $1", [configKey(session, department, levelTerm)]
  )).rows[0]?.value;
  let state = {};
  try {
    state = JSON.parse(value) || {};
  } catch {
    state = {};
  }
  const letters = assignSlotLetters(courses, state.slots || {});
  return {
    shown: state.shown === true,
    courses: courses.map((c) => ({
      ...c, slot: letters[c.course_id], label: slotLabel(c, letters[c.course_id]),
    })),
  };
}

async function saveState(client, session, department, levelTerm, { shown, courses }) {
  const slots = Object.fromEntries(courses.map((c) => [c.course_id, `${c.option_group}${c.slot}`]));
  await client.query(
    `INSERT INTO configs (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [configKey(session, department, levelTerm), JSON.stringify({ shown, slots })]
  );
}

/** Stores the letters as they are now, after the level-term's electives changed. */
export async function syncElectiveSlotsDB(department, levelTerm) {
  const client = await connect();
  try {
    const session = await currentSession(client);
    await saveState(client, session, department, levelTerm,
      await electiveSlotsOf(client, session, department, levelTerm));
  } finally {
    client.release();
  }
}

/**
 * Per running level-term: { department, level_term, shown, courses } with
 * each elective's slot.
 */
export async function allElectiveSlotsDB(existingClient = null) {
  const client = existingClient || await connect();
  try {
    const session = await currentSession(client);
    const levelTerms = (await client.query(
      "SELECT department, level_term FROM level_term_unique WHERE active ORDER BY department, level_term"
    )).rows;
    const result = [];
    for (const lt of levelTerms) {
      result.push({ ...lt, ...await electiveSlotsOf(client, session, lt.department, lt.level_term) });
    }
    return result;
  } finally {
    if (!existingClient) client.release();
  }
}

/**
 * What the routine shows for the electives not activated yet, e.g.
 * { CSE461: "Option 1X", CSE463: "Option 1Y" }.
 */
export async function electiveLabelsDB(existingClient = null) {
  const labels = {};
  for (const lt of await allElectiveSlotsDB(existingClient)) {
    if (lt.shown) continue;
    for (const c of lt.courses) labels[c.course_id] = c.label;
  }
  return labels;
}

/** Shows the level-term's electives in the routine by course, or by slot again. */
export async function setElectivesShownDB({ department, levelTerm, shown }) {
  const client = await connect();
  try {
    await client.query("BEGIN");
    const session = await currentSession(client);
    const state = await electiveSlotsOf(client, session, department, levelTerm);
    await saveState(client, session, department, levelTerm, { ...state, shown });
    await client.query("COMMIT");
    return { shown };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Gives an option's slots to its courses anew, e.g. `slots` { CSE461: "Y",
 * CSE463: "X" } for a theory option where CSE461 was 1X and CSE463 1Y. The
 * classes of each slot, with their rooms, go to the course now holding it
 * and take that course's teachers.
 */
export async function setElectiveSlotsDB({ department, levelTerm, type, optionGroup, slots }) {
  const client = await connect();
  try {
    await client.query("BEGIN");
    const session = await currentSession(client);
    const state = await electiveSlotsOf(client, session, department, levelTerm);
    const option = state.courses.filter((c) =>
      Number(c.type) === type && Number(c.option_group) === optionGroup);
    const kind = type === 1 ? "sessional" : "theory";
    if (!option.length) {
      throw new HttpError(404, `${department} ${levelTerm} has no ${kind} course in option ${optionGroup}`);
    }
    const before = Object.fromEntries(option.map((c) => [c.course_id, c.slot]));
    const letters = Object.values(before).sort((a, b) => SLOT_LETTERS.indexOf(a) - SLOT_LETTERS.indexOf(b));
    const given = option.map((c) => slots[c.course_id]);
    if (Object.keys(slots).length !== option.length || given.some((l) => !letters.includes(l)) ||
        new Set(given).size !== given.length) {
      throw new HttpError(400, `Give each ${kind} course of option ${optionGroup} one of the slots ${letters.map((l) => `${optionGroup}${l}`).join(", ")}`);
    }
    const after = Object.fromEntries(option.map((c) => [c.course_id, slots[c.course_id]]));
    const moves = slotMoves(before, after);
    const course = (id) => option.find((c) => c.course_id === id);
    for (const [from, to] of moves) {
      if (Number(course(from).class_per_week) !== Number(course(to).class_per_week)) {
        throw new HttpError(409, `${to} has ${course(to).class_per_week} classes a week and ${from} has ${course(from).class_per_week}; only courses with as many can trade slots`);
      }
    }

    let moved = 0;
    const batch = (await client.query(
      "SELECT batch FROM level_term_unique WHERE department = $1 AND level_term = $2 AND active",
      [department, levelTerm]
    )).rows[0]?.batch;
    if (moves.length && batch != null) {
      const [from, to] = [moves.map((m) => m[0]), moves.map((m) => m[1])];
      const scope = [session, department, batch];
      // Courses trade their classes in a cycle, so the classes first take
      // names no class has, then their new courses
      await client.query(
        `UPDATE schedule_assignment SET course_id = '~' || course_id
         WHERE session = $1 AND department = $2 AND batch = $3 AND course_id = ANY($4::varchar[])`,
        [...scope, from]
      );
      moved = (await client.query(
        `UPDATE schedule_assignment sa SET course_id = m.course_to
         FROM unnest($4::varchar[], $5::varchar[]) AS m(course_from, course_to)
         WHERE sa.session = $1 AND sa.department = $2 AND sa.batch = $3
           AND sa.course_id = '~' || m.course_from`,
        [...scope, from, to]
      )).rowCount;
      // A theory class's teachers are its section's; a lab's are assigned per group
      await client.query(
        type === 1
          ? `UPDATE schedule_assignment sa SET teachers = COALESCE((
               SELECT array_agg(initial ORDER BY initial) FROM teacher_sessional_assignment t
               WHERE t.course_id = sa.course_id AND t.batch = sa.batch
                 AND t.section = sa.section AND t.session = sa.session), '{}')
             WHERE sa.session = $1 AND sa.department = $2 AND sa.batch = $3
               AND sa.course_id = ANY($4::varchar[])`
          : `UPDATE schedule_assignment sa SET teachers = COALESCE((
               SELECT cs.teachers FROM courses_sections cs
               WHERE cs.course_id = sa.course_id AND cs.session = sa.session
                 AND cs.department = sa.department AND cs.batch = sa.batch
                 AND cs.section = sa.section), '{}')
             WHERE sa.session = $1 AND sa.department = $2 AND sa.batch = $3
               AND sa.course_id = ANY($4::varchar[])`,
        [...scope, to]
      );
    }
    await saveState(client, session, department, levelTerm, {
      shown: state.shown,
      courses: state.courses.map((c) => (after[c.course_id] ? { ...c, slot: after[c.course_id] } : c)),
    });
    await client.query("COMMIT");
    return { moved, slots: after };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
