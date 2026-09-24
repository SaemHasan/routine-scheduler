import { HttpError } from "../config/error-handle.js";
import { solveTheory, theoryCTSlotRequirement, theoryCTSlots, theoryPreferenceWarnings } from "./algorithm.js";
import {
  applyTheorySuggestionDB, fixTheoryClassesDB, loadTheoryProblemDB, unfixTheoryClassDB,
} from "./repository.js";

function selection(body) {
  const department = String(body?.department || "").trim();
  const levelTerm = String(body?.level_term || "").trim();
  if (!department || !levelTerm) {
    throw new HttpError(400, "Select a department and level-term");
  }
  return { department, levelTerm };
}

// Everything shown before generating: what is fixed, what the generator
// will place, the common CT slots and anything that blocks generation.
export async function theoryOverview(req, res, next) {
  try {
    const { department, levelTerm } = selection(req.body);
    const problem = await loadTheoryProblemDB(department, levelTerm);
    const required = problem.courseStatus.reduce((total, course) =>
      total + course.class_per_week * (course.shared ? 1 : course.sections.length), 0);
    res.status(200).json({
      department, level_term: levelTerm, batch: problem.batch,
      fingerprint: problem.fingerprint, initialized: problem.initialized,
      sectionNames: problem.sectionNames,
      courses: problem.courseStatus,
      totals: { required, toGenerate: problem.units.length, fixed: required - problem.units.length },
      ctRequired: theoryCTSlotRequirement(levelTerm),
      ctSlots: theoryCTSlots(problem, []),
      preflight: problem.preflight,
      warnings: problem.warnings,
    });
  } catch (error) {
    next(error);
  }
}

export async function fixTheoryClasses(req, res, next) {
  try {
    const { department, levelTerm } = selection(req.body);
    const courseId = String(req.body?.course_id || "").trim();
    const placements = (Array.isArray(req.body?.placements) ? req.body.placements : [])
      .filter((p) => p && p.section && p.day && p.time !== undefined && p.time !== "")
      .map((p) => ({ section: String(p.section), day: String(p.day), time: Number(p.time) }));
    if (!courseId || !placements.length || placements.some((p) => !Number.isInteger(p.time))) {
      throw new HttpError(400, "Choose a course and at least one section's day and time");
    }
    res.status(200).json(await fixTheoryClassesDB({ department, levelTerm, courseId, placements }));
  } catch (error) {
    next(error);
  }
}

export async function unfixTheoryClass(req, res, next) {
  try {
    const { department, levelTerm } = selection(req.body);
    const { course_id: courseId, section, day } = req.body || {};
    const time = Number(req.body?.time);
    if (!courseId || !section || !day || !Number.isInteger(time)) {
      throw new HttpError(400, "course_id, section, day and time are required");
    }
    res.status(200).json(await unfixTheoryClassDB({ department, levelTerm, courseId, section, day, time }));
  } catch (error) {
    next(error);
  }
}

export async function suggestTheory(req, res, next) {
  try {
    const { department, levelTerm } = selection(req.body);
    const problem = await loadTheoryProblemDB(department, levelTerm);
    if (problem.preflight.length) throw new HttpError(409, problem.preflight.join("; "));
    const seed = Number.isInteger(req.body?.seed) ? req.body.seed : undefined;
    const result = solveTheory(problem, { seed });
    if (result.issues.length) throw new HttpError(409, result.issues.join("; "));
    const unitOf = new Map(problem.units.map((u) => [u.key, u]));
    res.status(200).json({
      department, level_term: levelTerm, batch: problem.batch,
      fingerprint: problem.fingerprint, seed: result.seed, score: result.score,
      fixedCount: problem.fixed.length, missingCount: problem.units.length,
      sectionNames: problem.sectionNames, fixedRows: problem.previewRows,
      ctRequired: theoryCTSlotRequirement(levelTerm),
      ctSlots: theoryCTSlots(problem, result.assignments),
      warnings: [...problem.warnings,
        ...theoryPreferenceWarnings(problem, result.assignments)],
      assignments: result.assignments.map((a) => ({
        ...a,
        course_id: unitOf.get(a.key).course_id,
        sections: unitOf.get(a.key).sectionNames,
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function applyTheory(req, res, next) {
  try {
    const { department, levelTerm } = selection(req.body);
    if (!req.body?.fingerprint || !Array.isArray(req.body?.assignments)) {
      throw new HttpError(400, "A generated suggestion is required");
    }
    const result = await applyTheorySuggestionDB({
      department, levelTerm,
      fingerprint: req.body.fingerprint,
      assignments: req.body.assignments,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
