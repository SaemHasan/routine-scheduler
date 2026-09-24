import { connect } from "../config/database.js";
import { HttpError } from "../config/error-handle.js";

const CURRENT_SESSION = "(SELECT value FROM configs WHERE key='CURRENT_SESSION')";

/* ------------------------------------------------------------ constraints */

export async function getConstraintsDB() {
  const client = await connect();
  try {
    const result = await client.query(
      "SELECT * FROM sessional_constraints ORDER BY kind, id"
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function addConstraintDB(c) {
  const client = await connect();
  try {
    const result = await client.query(
      `INSERT INTO sessional_constraints
         (kind, department, level_term, section, day, "time", course_id, rooms,
          same_slot, shared_room, days, other_course_id, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        c.kind,
        c.department || null,
        c.level_term || null,
        c.section || null,
        c.day || null,
        c.time === "" || c.time === undefined || c.time === null ? null : Number(c.time),
        c.course_id || null,
        c.rooms && c.rooms.length ? c.rooms : null,
        Boolean(c.same_slot),
        Boolean(c.shared_room),
        c.days && c.days.length ? c.days : null,
        c.other_course_id || null,
        c.note || null,
      ]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function deleteConstraintDB(id) {
  const client = await connect();
  try {
    const result = await client.query(
      "DELETE FROM sessional_constraints WHERE id = $1",
      [id]
    );
    if (result.rowCount === 0) throw new HttpError(404, "Constraint not found");
  } finally {
    client.release();
  }
}

/* ------------------------------------------------- learned from routines */

/**
 * Share of classes held at 11 AM and at 2 PM in the sessional routines of
 * July 2023, January 2024, January 2025, July 2025 and January 2026 (372
 * classes). Overall the two slots were used equally; Level 1 leaned to
 * 11 AM, Levels 2–4 (0.75-credit labs especially) leaned to 2 PM.
 * Labs run for other departments go at 11 AM wherever possible (69% of
 * them did in the past).
 */
const PAST_SLOT_SHARE = {
  nonDepartmental: { 11: 1, 2: 0 },
  L1: { 11: 0.62, 2: 0.38 }, // 60
  L2: { 11: 0.46, 2: 0.54 }, // 90 (1.5-credit)
  "L2-0.75": { 11: 0.33, 2: 0.67 }, // 27
  L3: { 11: 0.33, 2: 0.67 }, // 66
  L4: { 11: 0.7, 2: 0.3 }, // 20 (1.5-credit, mostly the capstone)
  "L4-0.75": { 11: 0.34, 2: 0.66 }, // 32
};

// The kind of class a row is, for the 11 AM / 2 PM split
function pastSlotKind(row) {
  if (row.department !== "CSE") return "nonDepartmental";
  const level = (/L-(\d)/.exec(row.level_term || "") || [])[1];
  if (!level) return null;
  const quarter = `L${level}${Number(row.class_per_week) === 0.75 ? "-0.75" : ""}`;
  return PAST_SLOT_SHARE[quarter] ? quarter : PAST_SLOT_SHARE[`L${level}`] ? `L${level}` : null;
}

/* ---------------------------------------------------------------- helpers */

const letterOf = (section) => (section.match(/^[A-Za-z]+/) || [section])[0];
const isMainSection = (section) => section === letterOf(section);

/**
 * Hours a lab slot covers: three consecutive periods from its start, e.g.
 * 11 → 11, 12, 1 with times [8, 9, 10, 11, 12, 1, 2, 3, 4].
 */
const labHours = (times, start) => {
  const i = times.indexOf(start);
  return i < 0 ? [start] : times.slice(i, i + 3);
};

// Does a constraint on `cSection` apply to a class of `unitSection`?
// "A" applies to A, A1, A2; "A1" applies to A1 and to A (which includes A1).
function sectionMatches(cSection, unitSection) {
  if (!cSection) return true;
  if (cSection === unitSection) return true;
  if (isMainSection(cSection)) return letterOf(unitSection) === cSection;
  return isMainSection(unitSection) && letterOf(cSection) === unitSection;
}

const describeScope = (c) => {
  const who = [c.department, c.level_term].filter(Boolean).join(" ");
  const section = c.section ? `section ${c.section}` : "all sections";
  return who ? `${who} ${section}` : section === "all sections" ? "everyone" : section;
};

/* ---------------------------------------------------------- load problem */

/**
 * Builds the scheduler's input from the database: every CSE-run sessional
 * class of the current session, the lab slots and rooms, what each section
 * and teacher is already busy with, and the saved constraints.
 */
export async function loadProblemDB() {
  const client = await connect();
  try {
    const cfg = {};
    for (const row of (
      await client.query(
        "SELECT key, value FROM configs WHERE key IN ('days', 'times', 'possibleLabTimes')"
      )
    ).rows) {
      try {
        cfg[row.key] = JSON.parse(row.value);
      } catch {
        cfg[row.key] = row.value;
      }
    }
    const days = cfg.days || ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"];
    const times = (cfg.times || [8, 9, 10, 11, 12, 1, 2, 3, 4]).map(Number);
    const labTimes = (cfg.possibleLabTimes || [8, 11, 2]).map(Number);

    // The first period of the day (8 AM) is where theory usually runs;
    // past routines never put a lab there.
    const slots = [];
    days.forEach((day, dayIndex) =>
      labTimes.forEach((time) =>
        slots.push({
          day,
          time,
          dayIndex,
          hours: labHours(times, time),
          isMorning: times.indexOf(time) === 0,
          // 11 AM: its labs take morning hours the theory routine needs
          isMidday: times.indexOf(time) > 0 && times.indexOf(time) < times.indexOf(12) + 1,
        })
      )
    );
    const slotIndex = new Map(slots.map((s, i) => [`${s.day}|${s.time}`, i]));

    const constraints = (await client.query("SELECT * FROM sessional_constraints")).rows;

    // Lab rooms; a non-lab room is usable only by a course that names it.
    const roomRows = (
      await client.query("SELECT room, type, lab_type FROM rooms WHERE active = true ORDER BY room")
    ).rows;
    const rooms = roomRows
      .filter((r) => r.type === 1 || r.type === 2)
      .map((r) => ({ room: r.room, lab_type: r.lab_type, restricted: false }));
    const named = new Set(constraints.filter((c) => c.kind === "course_rooms").flatMap((c) => c.rooms || []));
    for (const room of named) {
      if (!rooms.some((r) => r.room === room)) rooms.push({ room, lab_type: null, restricted: true });
    }
    const roomIndex = new Map(rooms.map((r, i) => [r.room, i]));

    // Subsections of every section, so a whole-section class covers them all
    const sectionRows = (
      await client.query("SELECT department, batch, section, type, level_term FROM sections")
    ).rows;
    const subsOf = new Map();
    for (const s of sectionRows) {
      if (s.type !== 1 || isMainSection(s.section)) continue;
      const k = `${s.department}|${s.batch}|${letterOf(s.section)}`;
      if (!subsOf.has(k)) subsOf.set(k, []);
      subsOf.get(k).push(s.section);
    }
    for (const list of subsOf.values()) list.sort();
    const coverKeysFor = (department, batch, section) => {
      if (!isMainSection(section)) return [`${department}|${batch}|${section}`];
      const subs = subsOf.get(`${department}|${batch}|${section}`);
      return subs && subs.length
        ? subs.map((sub) => `${department}|${batch}|${sub}`)
        : [`${department}|${batch}|${section}`];
    };

    // Every sessional class CSE runs this session
    const unitRows = (
      await client.query(
        `SELECT cs.course_id, cs.batch, cs.section, cs.department, s.level_term,
                c.name, c.class_per_week, c.sessional_type, st.lab_type
         FROM courses_sections cs
         JOIN courses c ON c.course_id = cs.course_id AND c.session = cs.session
         JOIN sections s ON s.department = cs.department AND s.batch = cs.batch AND s.section = cs.section
         LEFT JOIN sessional_types st ON st.code = COALESCE(
           c.sessional_type,
           CASE WHEN c."to" = 'CSE' THEN 'DEPT_SW' ELSE 'NON_DEPT_SW' END
         )
         WHERE cs.session = ${CURRENT_SESSION}
           AND c.type = 1
           AND cs.course_id LIKE 'CSE%'
         ORDER BY s.level_term, cs.course_id, cs.department, cs.section`
      )
    ).rows;

    const unitKey = (r) => `${r.course_id}|${r.department}|${r.batch}|${r.section}`;
    const unitKeys = new Set(unitRows.map(unitKey));

    // How many sections (A, B, …) each course has in each batch
    const sectionsOfCourse = new Map();
    for (const r of unitRows) {
      const k = `${r.course_id}|${r.department}|${r.batch}`;
      if (!sectionsOfCourse.has(k)) sectionsOfCourse.set(k, new Set());
      sectionsOfCourse.get(k).add(letterOf(r.section));
    }

    // Everything already in the routine this session
    const scheduleRows = (
      await client.query(
        `SELECT sa.course_id, sa.batch, sa.section, sa.department, sa.day, sa."time",
                sa.room_no, sa.locked, c.type
         FROM schedule_assignment sa
         LEFT JOIN courses c ON c.course_id = sa.course_id AND c.session = sa.session
         WHERE sa.session = ${CURRENT_SESSION}`
      )
    ).rows;

    // Classes kept in place (locked) and what each section is busy with
    const lockedRow = new Map();
    const sectionBusy = new Map(); // coverKey|day|hour → description
    for (const row of scheduleRows) {
      const key = unitKey(row);
      if (unitKeys.has(key)) {
        if (row.locked) lockedRow.set(key, row);
        continue; // unlocked placements are what the scheduler replaces
      }
      if (row.type === 1 && row.course_id.startsWith("CSE")) continue; // stale
      const hours = row.type === 1 ? labHours(times, Number(row.time)) : [Number(row.time)];
      const what = `${row.course_id} (${row.section})`;
      for (const k of coverKeysFor(row.department, row.batch, row.section)) {
        for (const h of hours) {
          const busyKey = `${k}|${row.day}|${h}`;
          if (!sectionBusy.has(busyKey)) sectionBusy.set(busyKey, what);
        }
      }
    }

    // Teachers of each sessional class, and their theory classes
    const unitTeachers = new Map();
    for (const row of (
      await client.query(
        `SELECT initial, course_id, batch, section
         FROM teacher_sessional_assignment
         WHERE session = ${CURRENT_SESSION}`
      )
    ).rows) {
      const matches = unitRows.filter(
        (u) => u.course_id === row.course_id && u.batch === row.batch && u.section === row.section
      );
      for (const u of matches) {
        const k = unitKey(u);
        if (!unitTeachers.has(k)) unitTeachers.set(k, []);
        unitTeachers.get(k).push(row.initial);
      }
    }
    const teacherBusy = new Map(); // initial|day|hour → description
    const theoryTeaching = (
      await client.query(
        `SELECT DISTINCT t AS initial, sa.course_id, sa.section, sa.day, sa."time"
         FROM courses_sections cs
         CROSS JOIN LATERAL unnest(cs.teachers) AS t
         JOIN courses c ON c.course_id = cs.course_id AND c.session = cs.session
         JOIN schedule_assignment sa
           ON sa.course_id = cs.course_id AND sa.session = cs.session
          AND sa.batch = cs.batch AND sa.section = cs.section AND sa.department = cs.department
         WHERE cs.session = ${CURRENT_SESSION} AND c.type = 0`
      )
    ).rows;
    for (const row of theoryTeaching) {
      teacherBusy.set(
        `${row.initial}|${row.day}|${Number(row.time)}`,
        `${row.initial} teaches ${row.course_id} (${row.section}) then`
      );
    }

    // Rooms each course may use
    const allowedByCourse = new Map();
    for (const c of constraints.filter((c) => c.kind === "course_rooms")) {
      if (!allowedByCourse.has(c.course_id)) allowedByCourse.set(c.course_id, new Set());
      for (const room of c.rooms || []) allowedByCourse.get(c.course_id).add(room);
    }
    const blockedConstraints = constraints.filter((c) => c.kind === "blocked_slot");

    // Slots a course should preferably use (union of its "preferred days" rules)
    const preferredByCourse = new Map();
    for (const c of constraints.filter((c) => c.kind === "course_days")) {
      const set = preferredByCourse.get(c.course_id) || {};
      slots.forEach((slot, i) => {
        if ((c.days || []).includes(slot.day) && (c.time === null || Number(c.time) === slot.time)) {
          set[i] = true;
        }
      });
      preferredByCourse.set(c.course_id, set);
    }
    // Pairs of courses that should not share a slot
    const apartPairs = constraints
      .filter((c) => c.kind === "courses_apart" && c.course_id && c.other_course_id)
      .map((c) => [c.course_id, c.other_course_id]);

    // Courses whose sections run together and/or whose subsections share a room
    const sameSlotCourses = new Set();
    const sharedRoomCourses = new Set();
    for (const c of constraints.filter((c) => c.kind === "course_together")) {
      if (c.same_slot) sameSlotCourses.add(c.course_id);
      if (c.shared_room) sharedRoomCourses.add(c.course_id);
    }

    const units = unitRows.map((row) => {
      const key = unitKey(row);
      const coverKeys = coverKeysFor(row.department, row.batch, row.section);
      const main = isMainSection(row.section);
      const subs = subsOf.get(`${row.department}|${row.batch}|${row.section}`);
      const displaySection = main && subs && subs.length ? subs.join("/") : row.section;
      const teachers = unitTeachers.get(key) || [];

      const blocked = {};
      const clashSlots = {};
      slots.forEach((slot, i) => {
        // The section's own classes: theory, and labs already in the
        // level-term routine (e.g. EEE164)
        let busyWith = null;
        for (const k of coverKeys) {
          for (const h of slot.hours) {
            busyWith = busyWith || sectionBusy.get(`${k}|${slot.day}|${h}`);
          }
        }
        if (busyWith) clashSlots[i] = true;

        // Saved constraints
        for (const c of blockedConstraints) {
          if (c.day !== slot.day) continue;
          if (c.time !== null && !slot.hours.includes(Number(c.time))) continue;
          if (c.department && c.department !== row.department) continue;
          if (c.level_term && c.level_term !== row.level_term) continue;
          if (!sectionMatches(c.section, row.section)) continue;
          blocked[i] = `blocked for ${describeScope(c)}${c.note ? ` (${c.note})` : ""}`;
          return;
        }
        if (busyWith) {
          blocked[i] = `the section has ${busyWith} then`;
          return;
        }
        // Its teachers' theory classes
        for (const t of teachers) {
          for (const h of slot.hours) {
            const what = teacherBusy.get(`${t}|${slot.day}|${h}`);
            if (what) {
              blocked[i] = what;
              return;
            }
          }
        }
      });

      const locked = lockedRow.get(key);
      let fixed = null;
      if (locked) {
        const s = slotIndex.get(`${locked.day}|${Number(locked.time)}`);
        fixed = {
          slot: s === undefined ? -1 : s,
          room: locked.room_no && roomIndex.has(locked.room_no) ? roomIndex.get(locked.room_no) : -1,
        };
      }

      return {
        key,
        label: `${row.course_id}(${displaySection})`,
        course_id: row.course_id,
        name: row.name,
        batch: row.batch,
        section: row.section,
        displaySection,
        department: row.department,
        level_term: row.level_term,
        class_per_week: row.class_per_week,
        lab_type: row.lab_type,
        // A 1.5-credit section's subsections share one slot, except for a
        // course run for another department with a single section: there the
        // subsections go in different slots. A course rule can put all of a
        // course's sections in one slot instead.
        groupKey: sameSlotCourses.has(row.course_id)
          ? `${row.course_id}|${row.department}|${row.batch}|all`
          : main
            ? key
            : `${row.course_id}|${row.department}|${row.batch}|${letterOf(row.section)}`,
        groupMode:
          !sameSlotCourses.has(row.course_id) &&
          row.department !== "CSE" &&
          sectionsOfCourse.get(`${row.course_id}|${row.department}|${row.batch}`).size === 1
            ? "apart"
            : "together",
        // Sections of a course are kept on nearby days, as in past routines
        spreadKey: `${row.course_id}|${row.department}|${row.batch}`,
        // A course keeps to as few rooms as possible (e.g. CSE310 all in IAC)
        roomsKey: row.course_id,
        // Sections of a level-term get similar 11 AM / 2 PM splits
        levelKey: `${row.department}|${row.batch}`,
        // Subsections that use one room together (e.g. A1 and A2)
        roomShareKey:
          sharedRoomCourses.has(row.course_id) && !main
            ? `${row.course_id}|${row.department}|${row.batch}|${letterOf(row.section)}`
            : null,
        coverKeys,
        teachers,
        allowedRooms: allowedByCourse.has(row.course_id)
          ? Array.from(allowedByCourse.get(row.course_id))
          : null,
        // This kind of class is split between 11 AM and 2 PM as in past routines
        mixKey: pastSlotKind(row),
        slotShare: PAST_SLOT_SHARE[pastSlotKind(row)] || null,
        // Labs for other departments are held firmly to 11 AM
        mixWeight: row.department !== "CSE" ? 3 : 1,
        // At most one section's subsections (two) of a course in a slot,
        // unless a course rule runs all its sections together (e.g. CSE450)
        courseKey: row.course_id,
        // Preferred slots from a "preferred days" rule, or null
        preferred: preferredByCourse.get(row.course_id) || null,
        courseSlotLimit: sameSlotCourses.has(row.course_id)
          ? null
          : Math.max(2, (subsOf.get(`${row.department}|${row.batch}|${letterOf(row.section)}`) || []).length),
        blocked,
        clashSlots,
        fixed,
        locked: Boolean(locked),
        lockedAt: locked ? { day: locked.day, time: Number(locked.time), room: locked.room_no } : null,
      };
    });

    // Past routines gave a section at most two 11 AM labs a week
    return { slots, rooms, units, middayLimit: 2, apartPairs };
  } finally {
    client.release();
  }
}

/* ---------------------------------------------------------- clash checks */

/**
 * Classes the section already has that overlap `course_id` placed at
 * day/time: theory, labs from the level-term routine and other sessionals.
 * A whole section (A) overlaps its subsections (A1, A2); A1 and A2 do not
 * overlap each other. With `replacing`, the row at the same section, day and
 * time is ignored, since placing there replaces it. Returns readable
 * descriptions.
 */
export async function findSectionClashes(
  client,
  { course_id, batch, section, department, day, time, replacing = true }
) {
  const cfg = (
    await client.query("SELECT value FROM configs WHERE key = 'times'")
  ).rows[0];
  const times = (cfg ? JSON.parse(cfg.value) : [8, 9, 10, 11, 12, 1, 2, 3, 4]).map(Number);
  const course = (
    await client.query(
      `SELECT type FROM courses WHERE course_id = $1 AND session = ${CURRENT_SESSION}`,
      [course_id]
    )
  ).rows[0];
  const hoursOf = (type, start) => (type === 1 ? labHours(times, Number(start)) : [Number(start)]);

  const subs = (
    await client.query(
      "SELECT section FROM sections WHERE department = $1 AND batch = $2 AND type = 1",
      [department, batch]
    )
  ).rows.map((r) => r.section);
  const expand = (sec) => {
    if (!isMainSection(sec)) return [sec];
    return [sec, ...subs.filter((s) => letterOf(s) === sec && !isMainSection(s))];
  };

  const mine = new Set(expand(section));
  const myHours = hoursOf(course ? course.type : 1, time);
  const rows = (
    await client.query(
      `SELECT sa.course_id, sa.section, sa."time", c.type
       FROM schedule_assignment sa
       LEFT JOIN courses c ON c.course_id = sa.course_id AND c.session = sa.session
       WHERE sa.session = ${CURRENT_SESSION}
         AND sa.department = $1 AND sa.batch = $2 AND sa.day = $3`,
      [department, batch, day]
    )
  ).rows;

  const clashes = [];
  for (const row of rows) {
    // Replacing the cell's class is fine, but never a thesis hour
    if (replacing && row.type !== 2 && row.section === section && Number(row.time) === Number(time)) continue;
    if (!expand(row.section).some((s) => mine.has(s))) continue;
    const theirs = hoursOf(row.type, row.time);
    if (!theirs.some((h) => myHours.includes(h))) continue;
    clashes.push(`${row.course_id} (${row.section}) at ${row.time}:00`);
  }
  return clashes;
}

/**
 * Section clashes a routine to be saved would create, checked against
 * everything already fixed (theory, level-term labs, locked classes) and
 * against itself. Returns readable descriptions; empty means none.
 */
export function sectionClashesIn(problem, assignments) {
  const slotIndex = new Map(problem.slots.map((s, i) => [`${s.day}|${s.time}`, i]));
  const unitByKey = new Map(problem.units.map((u) => [u.key, u]));
  const placed = [];
  const clashes = [];

  for (const u of problem.units) {
    if (u.locked && u.fixed && u.fixed.slot >= 0) placed.push({ unit: u, slot: u.fixed.slot });
  }
  for (const a of assignments) {
    if (a.locked) continue;
    const unit = unitByKey.get(`${a.course_id}|${a.department}|${a.batch}|${a.section}`);
    const slot = slotIndex.get(`${a.day}|${Number(a.time)}`);
    if (!unit || slot === undefined) continue;
    if (unit.clashSlots[slot]) {
      clashes.push(`${unit.label} on ${a.day} ${a.time}:00: ${unit.blocked[slot]}`);
    }
    placed.push({ unit, slot });
  }
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i];
      const b = placed[j];
      if (a.slot !== b.slot) continue;
      if (!a.unit.coverKeys.some((k) => b.unit.coverKeys.includes(k))) continue;
      const slot = problem.slots[a.slot];
      clashes.push(`${a.unit.label} and ${b.unit.label} are both on ${slot.day} ${slot.time}:00`);
    }
  }
  return clashes;
}

/* ---------------------------------------------------------------- saving */

/**
 * Replaces the unlocked sessional placements with `assignments`. Locked
 * placements are left alone.
 */
export async function applyAssignmentsDB(assignments) {
  const client = await connect();
  try {
    await client.query("BEGIN");

    const valid = new Set(
      (
        await client.query(
          `SELECT cs.course_id || '|' || cs.department || '|' || cs.batch || '|' || cs.section AS key
           FROM courses_sections cs
           JOIN courses c ON c.course_id = cs.course_id AND c.session = cs.session
           WHERE cs.session = ${CURRENT_SESSION} AND c.type = 1 AND cs.course_id LIKE 'CSE%'`
        )
      ).rows.map((r) => r.key)
    );

    await client.query(
      `DELETE FROM schedule_assignment sa
       USING courses c
       WHERE sa.course_id = c.course_id AND sa.session = c.session
         AND c.type = 1 AND sa.course_id LIKE 'CSE%'
         AND sa.session = ${CURRENT_SESSION}
         AND NOT sa.locked`
    );

    let saved = 0;
    for (const a of assignments) {
      if (a.locked) {
        // A locked class keeps its slot; it only gains a room if it had none
        if (a.room) {
          await client.query(
            `UPDATE schedule_assignment SET room_no = $5
             WHERE course_id = $1 AND batch = $2 AND section = $3 AND department = $4
               AND session = ${CURRENT_SESSION} AND locked AND room_no IS NULL`,
            [a.course_id, a.batch, a.section, a.department, a.room]
          );
        }
        continue;
      }
      const key = `${a.course_id}|${a.department}|${a.batch}|${a.section}`;
      if (!valid.has(key)) {
        throw new HttpError(400, `${a.course_id} (${a.section}) is not a sessional class this session`);
      }
      await client.query(
        `INSERT INTO schedule_assignment
           (course_id, session, batch, section, day, "time", department, room_no, teachers, locked)
         VALUES ($1::varchar, ${CURRENT_SESSION}, $2::int, $3::varchar, $4, $5, $6, $7,
           COALESCE((SELECT array_agg(initial ORDER BY initial) FROM teacher_sessional_assignment
                     WHERE course_id = $1::varchar AND batch = $2::int AND section = $3::varchar
                       AND session = ${CURRENT_SESSION}), '{}'),
           false)`,
        [a.course_id, a.batch, a.section, a.day, a.time, a.department, a.room || null]
      );
      saved++;
    }

    await client.query("COMMIT");
    return saved;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setLockDB({ course_id, batch, section, department, locked }) {
  const client = await connect();
  try {
    const result = await client.query(
      `UPDATE schedule_assignment SET locked = $5
       WHERE course_id = $1 AND batch = $2 AND section = $3 AND department = $4
         AND session = ${CURRENT_SESSION}`,
      [course_id, batch, section, department, Boolean(locked)]
    );
    if (result.rowCount === 0) throw new HttpError(404, "Class not found in the routine");
  } finally {
    client.release();
  }
}

export async function unlockAllDB() {
  const client = await connect();
  try {
    await client.query(
      `UPDATE schedule_assignment sa SET locked = false
       FROM courses c
       WHERE sa.course_id = c.course_id AND sa.session = c.session
         AND c.type = 1 AND sa.session = ${CURRENT_SESSION}`
    );
  } finally {
    client.release();
  }
}

// A room picked by hand is kept when the scheduler runs again.
export async function setRoomDB({ course_id, batch, section, department, room }) {
  const client = await connect();
  try {
    const result = await client.query(
      `UPDATE schedule_assignment SET room_no = $5, locked = true
       WHERE course_id = $1 AND batch = $2 AND section = $3 AND department = $4
         AND session = ${CURRENT_SESSION}`,
      [course_id, batch, section, department, room || null]
    );
    if (result.rowCount === 0) throw new HttpError(404, "Class not found in the routine");
  } finally {
    client.release();
  }
}
