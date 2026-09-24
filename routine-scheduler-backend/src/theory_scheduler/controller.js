import { HttpError } from "../config/error-handle.js";
import { solveTheory, theoryCTSlotRequirement, theoryCTSlots, theoryPreferenceWarnings } from "./algorithm.js";
import { applyTheorySuggestionDB, loadTheoryProblemDB } from "./repository.js";

function selection(body) {
  const department = String(body?.department || "").trim();
  const levelTerm = String(body?.level_term || "").trim();
  if (!department || !levelTerm) {
    throw new HttpError(400, "Select a department and level-term");
  }
  return { department, levelTerm };
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
