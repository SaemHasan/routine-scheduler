import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
  applyTheoryRoutineSuggestion,
  suggestTheoryRoutine,
} from "../api/theory-schedule";
import TheoryRoutinePreview from "./TheoryRoutinePreview";

const messageOf = (error) =>
  error?.response?.data?.error?.message || error?.message || "Request failed";

export default function TheoryRoutineSuggestion({
  department, levelTerm, batch, allTheoryCourses, hasUnsavedChanges, onApplied,
}) {
  const [suggestion, setSuggestion] = useState(null);
  const [working, setWorking] = useState(false);
  useEffect(() => setSuggestion(null), [department, levelTerm, batch]);

  const generate = async () => {
    if (hasUnsavedChanges) {
      toast.error("Save your manual changes before generating a suggestion");
      return;
    }
    setWorking(true);
    try {
      setSuggestion(await suggestTheoryRoutine({ department, level_term: levelTerm }));
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setWorking(false);
    }
  };

  const apply = async () => {
    if (!suggestion?.assignments.length || hasUnsavedChanges) return;
    setWorking(true);
    try {
      await applyTheoryRoutineSuggestion({
        department, level_term: levelTerm,
        fingerprint: suggestion.fingerprint,
        assignments: suggestion.assignments.map(({ key, day, time }) => ({ key, day, time })),
      });
      toast.success("Theory suggestion saved. You can still edit the routine manually.");
      setSuggestion(null);
      onApplied();
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="card mb-4" style={{ borderRadius: 12 }}>
      <div className="card-body">
        <h4 className="card-title">Theory routine suggestion</h4>
        <p className="text-muted mb-3">
          Existing manual classes, sessionals, CT and thesis stay fixed. New
          theory meetings avoid 1 PM and same-course repeats on one day; 2–4 PM
          is used only when needed. The generator also tries to separate a theory
          course from its paired sessional (such as CSE 101/CSE 102), including
          across sections. The same course is kept on the same teaching days
          across A, B and C where possible. Required common 8 AM CT slots are kept
          free across all sections: Saturday, Monday and Wednesday for three
          CTs, or Saturday and Wednesday for two CTs, with other days as fallback.
          Other 8 AM theory is discouraged, but less than 2–4 PM theory.
          Rooms are assigned in the existing room workflow.
        </p>
        <div className="d-flex flex-wrap align-items-center" style={{ gap: 10 }}>
          <button className="btn btn-outline-primary" type="button"
            onClick={generate} disabled={working || hasUnsavedChanges}>
            {working ? "Working..." : suggestion ? "Generate another" : "Generate suggestion"}
          </button>
          {suggestion?.assignments.length > 0 && (
            <button className="btn btn-primary" type="button"
              onClick={apply} disabled={working || hasUnsavedChanges}>
              Apply suggestion
            </button>
          )}
          {hasUnsavedChanges && <small className="text-warning">Save manual changes first.</small>}
        </div>
        {suggestion && (
          <div className="mt-3">
            <p className="mb-2">
              {suggestion.assignments.length
                ? `${suggestion.missingCount} missing meeting(s) suggested; seed ${suggestion.seed}; preference score ${suggestion.score} (lower is better). Generate again for another version.`
                : "All required theory meetings are already scheduled."}
            </p>
            <TheoryRoutinePreview suggestion={suggestion} allTheoryCourses={allTheoryCourses} />
            <small className="text-muted">
              Preview only. Applying rechecks the current routine and will ask you to
              regenerate if anything changed.
            </small>
            {suggestion.warnings?.length > 0 && (
              <div className="alert alert-warning mt-2 mb-0">
                {suggestion.warnings.map((warning) => <div key={warning}>{warning}</div>)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
