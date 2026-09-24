import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import {
  applySessionalRoutine,
  generateSessionalRoutine,
  getSchedulerConstraints,
  unlockAllSessionals,
} from "../api/sessional-scheduler";
import ConstraintsModal from "./ConstraintsModal";
import { formatHour } from "./format";

const levelOf = (levelTerm) => {
  const m = /L-(\d)/.exec(levelTerm || "");
  return m ? Number(m[1]) : 0;
};

const EFFORTS = [
  { value: "quick", label: "Quick" },
  { value: "normal", label: "Normal" },
  { value: "thorough", label: "Thorough" },
];

/**
 * Suggests a lab slot and room for every sessional class, following the
 * saved constraints. A suggestion is only a preview until it is applied;
 * locked classes are never moved.
 */
export default function AutoScheduler({ onApplied }) {
  const [constraints, setConstraints] = useState([]);
  const [showConstraints, setShowConstraints] = useState(false);
  const [effort, setEffort] = useState("normal");
  const [result, setResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showAllIssues, setShowAllIssues] = useState(false);

  const loadConstraints = useCallback(
    () =>
      getSchedulerConstraints()
        .then((res) => setConstraints(res || []))
        .catch(() => toast.error("Failed to load scheduling constraints")),
    []
  );

  useEffect(() => {
    loadConstraints();
  }, [loadConstraints]);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await generateSessionalRoutine({ effort });
      setResult(res);
      setShowAllIssues(false);
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || "Failed to generate a routine");
    } finally {
      setGenerating(false);
    }
  };

  const sectionClashes = result ? result.report.stats.sectionClashes : 0;

  const apply = async () => {
    const conflicts = result.report.stats.conflicts;
    if (
      conflicts > 0 &&
      !window.confirm(
        `This routine still has ${conflicts} conflict${conflicts === 1 ? "" : "s"}. Save it anyway?`
      )
    ) {
      return;
    }
    setApplying(true);
    try {
      const res = await applySessionalRoutine(result.assignments);
      toast.success(res.message || "Routine saved");
      setResult(null);
      await onApplied();
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || "Failed to save the routine");
    } finally {
      setApplying(false);
    }
  };

  const unlockAll = async () => {
    if (!window.confirm("Unlock every sessional class so the scheduler may move it?")) return;
    try {
      await unlockAllSessionals();
      toast.success("All sessional classes unlocked");
      await onApplied();
    } catch {
      toast.error("Failed to unlock");
    }
  };

  const blockedCount = constraints.filter((c) => c.kind === "blocked_slot").length;
  const roomRuleCount = constraints.filter((c) => c.kind === "course_rooms").length;
  const courseRuleCount = constraints.filter((c) => c.kind === "course_together").length;

  return (
    <div className="card mb-4">
      <div className="card-view">
        <div className="card-control-container">
          <h4 className="card-name">
            <div className="card-icon mdi mdi-auto-fix"></div>
            Automatic Scheduler
          </h4>
          <div className="card-control-button-container">
            <button
              className="card-control-button mdi mdi-lock-open-variant-outline"
              onClick={unlockAll}
              title="Let the scheduler move every class"
            >
              Unlock all
            </button>
            <button
              className="card-control-button mdi mdi-tune-variant"
              onClick={() => setShowConstraints(true)}
            >
              Constraints
            </button>
          </div>
        </div>

        <div className="auto-scheduler-intro">
          Suggests a lab slot and room for every sessional class, around the theory
          classes and labs already in the level-term routines (e.g. EEE164). Labs run
          for other departments go at 11 AM wherever possible; departmental labs are
          split between 11 AM and 2 PM the way past routines were (Level 1 leans to
          11 AM, Levels 2–4 to 2 PM), leaving a lab free in every slot where possible.
          Each section gets at most two 11 AM labs (the mornings are needed for
          theory) and a mix of 11 AM and 2 PM labs rather than all at one time.
          The sections of a course are kept on nearby days and in as few rooms as
          possible (e.g. every CSE310 section in the same lab). Subsections of a
          1.5-credit section are kept in the same slot, except for a course run for
          another department with only one section, whose subsections go in different
          slots. Course rules can put all of a course's sections in one slot (e.g. the
          capstone project) with each section's subsections in one room. Classes you
          placed or changed by hand
          (<i className="mdi mdi-lock"></i> locked) stay where they are.
          <div className="auto-scheduler-rules">
            <span className="pill muted">
              <i className="mdi mdi-calendar-remove-outline"></i>
              {blockedCount} blocked slot{blockedCount === 1 ? "" : "s"}
            </span>
            <span className="pill muted">
              <i className="mdi mdi-door"></i>
              {roomRuleCount} room rule{roomRuleCount === 1 ? "" : "s"}
            </span>
            <span className="pill muted">
              <i className="mdi mdi-link-variant"></i>
              {courseRuleCount} course rule{courseRuleCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="auto-scheduler-actions">
          <div className="segmented-toggle" title="Longer runs search more">
            {EFFORTS.map((e) => (
              <button
                key={e.value}
                className={effort === e.value ? "active" : ""}
                onClick={() => setEffort(e.value)}
              >
                {e.label}
              </button>
            ))}
          </div>
          <button
            className="card-control-button mdi mdi-play-circle-outline"
            disabled={generating}
            onClick={generate}
          >
            {generating ? "Generating…" : result ? "Run again" : "Generate"}
          </button>
          {result && (
            <>
              <button
                className="card-control-button mdi mdi-content-save-outline"
                disabled={applying || sectionClashes > 0}
                title={
                  sectionClashes > 0
                    ? "A section would have two classes at once. Run again, or free up slots first."
                    : undefined
                }
                onClick={apply}
              >
                {applying ? "Saving…" : "Apply to routine"}
              </button>
              <button
                className="card-control-button mdi mdi-close"
                onClick={() => setResult(null)}
              >
                Discard
              </button>
            </>
          )}
        </div>

        {sectionClashes > 0 && (
          <div className="field-error mt-2">
            <i className="mdi mdi-alert-circle-outline"></i> This suggestion gives a section two
            classes at once, so it can't be applied. Run again, or unlock or move classes
            to free up slots.
          </div>
        )}

        {result && (
          <Suggestion
            result={result}
            showAllIssues={showAllIssues}
            onToggleIssues={() => setShowAllIssues((v) => !v)}
          />
        )}
      </div>

      {showConstraints && (
        <ConstraintsModal
          constraints={constraints}
          onClose={() => setShowConstraints(false)}
          onChanged={loadConstraints}
        />
      )}
    </div>
  );
}

function Suggestion({ result, showAllIssues, onToggleIssues }) {
  const { stats, conflicts, warnings, roomUsage } = result.report;
  const days = useMemo(() => Array.from(new Set(result.slots.map((s) => s.day))), [result]);
  const times = useMemo(() => Array.from(new Set(result.slots.map((s) => s.time))), [result]);
  const cell = (day, time) =>
    result.assignments
      .filter((a) => a.day === day && a.time === time)
      .sort(
        (a, b) =>
          levelOf(a.level_term) - levelOf(b.level_term) ||
          a.course_id.localeCompare(b.course_id) ||
          a.section.localeCompare(b.section)
      );
  const usage = (day, time) => roomUsage.find((u) => u.day === day && u.time === time);
  const issues = [...conflicts.map((text) => ({ text, bad: true })), ...warnings.map((text) => ({ text }))];
  const shown = showAllIssues ? issues : issues.slice(0, 6);

  return (
    <div className="auto-scheduler-result">
      <div className="stat-tile-grid">
        <div className="stat-tile">
          <div className="stat-tile-icon mdi mdi-flask-outline"></div>
          <div>
            <div className="stat-tile-value">{stats.classes}</div>
            <div className="stat-tile-label">
              Classes{stats.locked ? ` · ${stats.locked} locked` : ""}
            </div>
          </div>
        </div>
        <div className="stat-tile">
          <div
            className={`stat-tile-icon mdi ${
              stats.conflicts ? "amber mdi-alert-outline" : "teal mdi-check-decagram"
            }`}
          ></div>
          <div>
            <div className="stat-tile-value">{stats.conflicts}</div>
            <div className="stat-tile-label">Conflicts</div>
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-icon blue mdi mdi-link-variant"></div>
          <div
            title="Subsections together or apart as required, course rules kept, shared rooms shared"
          >
            <div className="stat-tile-value">
              {stats.subsectionGroupsOk}/{stats.subsectionGroups}
            </div>
            <div className="stat-tile-label">Subsections placed as intended</div>
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-icon mdi mdi-scale-balance"></div>
          <div
            title={
              stats.fullSlots
                ? `${stats.fullSlots} slot${stats.fullSlots === 1 ? " has" : "s have"} no lab left free`
                : "Every slot has at least one lab free"
            }
          >
            <div className="stat-tile-value">
              {stats.byTime[11] || 0} / {stats.byTime[2] || 0}
            </div>
            <div className="stat-tile-label">
              At 11 AM / 2 PM{stats.fullSlots ? ` · ${stats.fullSlots} full` : ""}
            </div>
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-icon blue mdi mdi-calendar-range"></div>
          <div title="Average number of days between the first and last section of a course">
            <div className="stat-tile-value">{stats.averageDaySpread}</div>
            <div className="stat-tile-label">Days between a course's sections</div>
          </div>
        </div>
        <div className="stat-tile">
          <div
            className={`stat-tile-icon mdi mdi-account-clock-outline ${
              stats.sectionsOverMidday + stats.lopsidedSections ? "amber" : "teal"
            }`}
          ></div>
          <div title="Sections with more than two 11 AM labs, or with every lab at the same time">
            <div className="stat-tile-value">
              {stats.sectionsOverMidday + stats.lopsidedSections}
            </div>
            <div className="stat-tile-label">Section timing issues</div>
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-icon teal mdi mdi-door"></div>
          <div title="Courses using no more rooms than they need at once (one lab, or two for paired subsections)">
            <div className="stat-tile-value">
              {stats.roomCoursesFewest}/{stats.roomCourses}
            </div>
            <div className="stat-tile-label">Courses in the fewest rooms</div>
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-icon amber mdi mdi-desktop-classic"></div>
          <div>
            <div className="stat-tile-value">{stats.labTypeMismatches}</div>
            <div className="stat-tile-label">In a lab of the wrong type</div>
          </div>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="auto-scheduler-issues">
          {shown.map((issue, i) => (
            <div key={i} className={issue.bad ? "issue bad" : "issue"}>
              <i className={`mdi ${issue.bad ? "mdi-alert-circle-outline" : "mdi-information-outline"}`}></i>
              {issue.text}
            </div>
          ))}
          {issues.length > 6 && (
            <button className="btn btn-link btn-sm p-0" onClick={onToggleIssues}>
              {showAllIssues ? "Show fewer" : `Show all ${issues.length}`}
            </button>
          )}
        </div>
      )}

      <div className="auto-scheduler-legend">
        {[1, 2, 3, 4].map((l) => (
          <span key={l} className={`suggest-item level-${l}`}>Level {l}</span>
        ))}
        <span className="field-hint">Preview — nothing is saved until you apply it.</span>
      </div>

      <div className="table-responsive">
        <table className="suggest-grid">
          <thead>
            <tr>
              <th>Day</th>
              {times.map((t) => (
                <th key={t}>{formatHour(t)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day}>
                <td className="suggest-day">{day}</td>
                {times.map((time) => {
                  const items = cell(day, time);
                  const u = usage(day, time);
                  return (
                    <td key={time}>
                      {u && (
                        <div
                          className="suggest-usage"
                          title={u.freeRooms.length ? `Free: ${u.freeRooms.join(", ")}` : "All labs in use"}
                        >
                          {u.roomsUsed}/{stats.labRooms} labs
                        </div>
                      )}
                      {items.map((a) => (
                        <div
                          key={`${a.course_id}-${a.department}-${a.batch}-${a.section}`}
                          className={`suggest-item level-${levelOf(a.level_term)}`}
                          title={`${a.name} · ${a.department} ${a.level_term}${
                            a.teachers.length ? ` · ${a.teachers.join(", ")}` : ""
                          }`}
                        >
                          {a.locked && <i className="mdi mdi-lock"></i>}
                          {a.course_id}({a.displaySection})
                          {a.department !== "CSE" && <span className="suggest-dept">{a.department}</span>}
                          <span className="suggest-room">{a.room || "no room"}</span>
                        </div>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
