import { HttpError } from "../config/error-handle.js";
import { solve } from "./algorithm.js";
import {
  addConstraintDB,
  applyAssignmentsDB,
  deleteConstraintDB,
  getConstraintsDB,
  loadProblemDB,
  sectionClashesIn,
  setLockDB,
  setRoomDB,
  unlockAllDB,
} from "./repository.js";

export async function getConstraints(req, res, next) {
  try {
    res.status(200).json(await getConstraintsDB());
  } catch (err) {
    next(err);
  }
}

export async function addConstraint(req, res, next) {
  try {
    const c = req.body;
    if (c.kind === "blocked_slot" && !c.day) {
      throw new HttpError(400, "Choose the day to block");
    }
    if (c.kind === "course_rooms" && (!c.course_id || !Array.isArray(c.rooms) || c.rooms.length === 0)) {
      throw new HttpError(400, "Choose a course and at least one room");
    }
    if (c.kind === "course_together" && (!c.course_id || !(c.same_slot || c.shared_room))) {
      throw new HttpError(400, "Choose a course and at least one option");
    }
    if (c.kind === "course_days" && (!c.course_id || !Array.isArray(c.days) || c.days.length === 0)) {
      throw new HttpError(400, "Choose a course and at least one day");
    }
    if (c.kind === "courses_apart" && (!c.course_id || !c.other_course_id || c.course_id === c.other_course_id)) {
      throw new HttpError(400, "Choose two different courses");
    }
    res.status(200).json(await addConstraintDB(c));
  } catch (err) {
    next(err);
  }
}

export async function deleteConstraint(req, res, next) {
  try {
    await deleteConstraintDB(Number(req.params.id));
    res.status(200).json({ message: "Deleted" });
  } catch (err) {
    next(err);
  }
}

/**
 * Suggests a routine without saving it. Every run starts from a different
 * random point, so running again gives another suggestion.
 */
export async function generate(req, res, next) {
  try {
    const problem = await loadProblemDB();
    if (problem.units.length === 0) {
      throw new HttpError(400, "There are no sessional classes this session. Initialize the level-terms first.");
    }
    const result = solve(problem, {
      effort: req.body?.effort,
      seed: Number.isInteger(req.body?.seed) ? req.body.seed : undefined,
    });
    res.status(200).json({
      seed: result.seed,
      effort: result.effort,
      score: result.score,
      slots: problem.slots.map(({ day, time, isMorning }) => ({ day, time, isMorning })),
      rooms: problem.rooms.map(({ room, lab_type, restricted }) => ({ room, lab_type, restricted })),
      assignments: result.assignments.map(({ unit, slot, room }) => ({
        course_id: unit.course_id,
        name: unit.name,
        batch: unit.batch,
        section: unit.section,
        displaySection: unit.displaySection,
        department: unit.department,
        level_term: unit.level_term,
        class_per_week: unit.class_per_week,
        lab_type: unit.lab_type,
        teachers: unit.teachers,
        locked: unit.locked,
        day: slot >= 0 ? problem.slots[slot].day : unit.lockedAt?.day ?? null,
        time: slot >= 0 ? problem.slots[slot].time : unit.lockedAt?.time ?? null,
        room: room >= 0 ? problem.rooms[room].room : unit.lockedAt?.room ?? null,
      })),
      report: result.report,
    });
  } catch (err) {
    next(err);
  }
}

export async function apply(req, res, next) {
  try {
    const assignments = req.body?.assignments;
    if (!Array.isArray(assignments) || assignments.length === 0) {
      throw new HttpError(400, "Nothing to save");
    }
    // A section must never have two classes at once
    const clashes = sectionClashesIn(await loadProblemDB(), assignments);
    if (clashes.length > 0) {
      throw new HttpError(
        409,
        `Not saved: ${clashes.length} section clash${clashes.length === 1 ? "" : "es"}, e.g. ${clashes
          .slice(0, 3)
          .join("; ")}`
      );
    }
    const saved = await applyAssignmentsDB(assignments);
    res.status(200).json({ message: `Saved ${saved} classes`, saved });
  } catch (err) {
    next(err);
  }
}

export async function setLock(req, res, next) {
  try {
    await setLockDB(req.body);
    res.status(200).json({ message: "Updated" });
  } catch (err) {
    next(err);
  }
}

export async function unlockAll(req, res, next) {
  try {
    await unlockAllDB();
    res.status(200).json({ message: "Unlocked" });
  } catch (err) {
    next(err);
  }
}

export async function setRoom(req, res, next) {
  try {
    await setRoomDB(req.body);
    res.status(200).json({ message: "Updated" });
  } catch (err) {
    next(err);
  }
}
