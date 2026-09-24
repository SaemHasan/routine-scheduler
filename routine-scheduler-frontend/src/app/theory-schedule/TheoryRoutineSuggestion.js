import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import Icon from "@mdi/react";
import { mdiAutoFix, mdiClose, mdiPin, mdiPlus } from "@mdi/js";
import {
  applyTheoryRoutineSuggestion,
  fixTheoryClasses,
  suggestTheoryRoutine,
  unfixTheoryClass,
} from "../api/theory-schedule";
import TheoryRoutinePreview from "./TheoryRoutinePreview";
import FixTheoryClassesModal from "./FixTheoryClassesModal";
import { openMeetings, shortDay, slotLabel } from "./theoryRoutineFixing";

const messageOf = (error) =>
  error?.response?.data?.error?.message || error?.message || "Request failed";

const purple = "rgb(124, 64, 200)";

function Step({ number, title, aside, children }) {
  return (
    <section className="mb-4">
      <div className="d-flex align-items-center justify-content-between mb-2" style={{ gap: 10 }}>
        <h5 className="mb-0 d-flex align-items-center" style={{ gap: 10, fontWeight: 700 }}>
          <span style={{
            width: 26, height: 26, borderRadius: "50%", background: purple, color: "white",
            display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem",
          }}>{number}</span>
          {title}
        </h5>
        {aside}
      </div>
      {children}
    </section>
  );
}

const chip = {
  display: "inline-flex", alignItems: "center", gap: 3, borderRadius: 6,
  padding: "2px 6px", margin: 2, fontSize: "0.8rem", whiteSpace: "nowrap",
};

export default function TheoryRoutineSuggestion({
  department, levelTerm, batch, allTheoryCourses, hasUnsavedChanges, overview, onChanged,
}) {
  const [suggestion, setSuggestion] = useState(null);
  const [working, setWorking] = useState(false);
  const [fixing, setFixing] = useState(null); // course id for the modal, "" for none chosen
  useEffect(() => setSuggestion(null), [department, levelTerm, batch]);

  const stale = suggestion && overview?.fingerprint && suggestion.fingerprint !== overview.fingerprint;
  const blocked = overview?.preflight?.length > 0;
  const busy = working || hasUnsavedChanges;

  const generate = async () => {
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
    if (!suggestion?.assignments.length || busy || stale) return;
    setWorking(true);
    try {
      await applyTheoryRoutineSuggestion({
        department, level_term: levelTerm,
        fingerprint: suggestion.fingerprint,
        assignments: suggestion.assignments.map(({ key, day, time }) => ({ key, day, time })),
      });
      toast.success("Suggestion applied. Its classes are replaced if you generate again, unless you fix them.");
      setSuggestion(null);
      onChanged();
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setWorking(false);
    }
  };

  const run = async (request, message) => {
    setWorking(true);
    try {
      await request();
      toast.success(message);
      onChanged();
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setWorking(false);
    }
  };
  const unpin = (courseId, section, meeting) => run(
    () => unfixTheoryClass({ department, level_term: levelTerm, course_id: courseId, section, ...meeting }),
    `${courseId} ${slotLabel(meeting)} can now be moved by the generator`);
  const pin = (courseId, section, meeting) => run(
    () => fixTheoryClasses({
      department, level_term: levelTerm, course_id: courseId,
      placements: [{ section, ...meeting }],
    }),
    `${courseId} ${slotLabel(meeting)} is now fixed`);

  const ctFree = (overview?.ctSlots || []).filter((slot) => slot.available);
  const ctShort = overview?.ctRequired > 0 && ctFree.length < overview.ctRequired;
  const sectionNames = overview?.sectionNames || [];

  return (
    <div className="card mb-4" style={{ borderRadius: 16, border: "none", boxShadow: "0 8px 32px rgba(0,0,0,0.08)" }}>
      <div className="card-body" style={{ padding: "2rem" }}>
        <h4 className="card-title d-flex align-items-center" style={{
          color: "rgb(174, 117, 228)", borderBottom: "3px solid rgb(194, 137, 248)",
          paddingBottom: 16, marginBottom: 20, fontWeight: 700, gap: 8,
        }}>
          <Icon path={mdiAutoFix} size={0.9} /> Theory routine generator
        </h4>
        <p className="text-muted mb-4">
          Fix the classes that must not move, check that the level-term is ready,
          then generate a suggestion and review it before applying.
        </p>
        {hasUnsavedChanges && (
          <div className="alert alert-warning py-2">Save the grid changes below before fixing classes or generating.</div>
        )}
        {!overview ? <p className="text-muted">Loading routine status…</p>
          : overview.error ? <div className="alert alert-danger py-2">{overview.error}</div> : <>
          <Step number={1} title="Fixed classes" aside={
            <button type="button" className="btn btn-sm btn-outline-primary d-flex align-items-center"
              style={{ gap: 4 }} disabled={busy} onClick={() => setFixing("")}>
              <Icon path={mdiPlus} size={0.7} /> Fix classes
            </button>}>
            <p className="small text-muted mb-2">
              {overview.initialized
                ? "Fixed classes (entered by hand or here) are kept. Classes from the last applied suggestion are shown dashed and are replaced when you generate again. Unpin a fixed class to let the generator move it."
                : "Before the first generation, every class already in the routine is kept. Fix the classes that need a particular period here or in the grids below; the generator places the remaining meetings."}
            </p>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0" style={{ fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ background: "#f7f2fe" }}>
                    <th>Course</th>
                    <th className="text-center">Per week</th>
                    {sectionNames.map((s) => <th key={s}>Section {s}</th>)}
                    <th className="text-center">To generate</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.courses.map((course) => {
                    const open = openMeetings(course);
                    return (
                      <tr key={course.course_id}>
                        <td>
                          <button type="button" className="btn btn-link p-0" style={{ fontWeight: 600 }}
                            disabled={busy} title="Fix classes of this course"
                            onClick={() => setFixing(course.course_id)}>
                            {course.course_id}
                          </button>
                          {course.shared && <div className="small text-muted">all sections together</div>}
                        </td>
                        <td className="text-center">{course.class_per_week}</td>
                        {sectionNames.map((name) => {
                          const section = course.sections.find((s) => s.section === name);
                          if (!section) return <td key={name} className="text-muted">—</td>;
                          return (
                            <td key={name}>
                              {section.fixed.map((m) => (
                                <span key={`f${m.day}${m.time}`} style={{ ...chip, background: "#e9d8fd", color: "#5b2a9e", fontWeight: 600 }}
                                  title="Fixed: the generator keeps it">
                                  <Icon path={mdiPin} size={0.5} />{slotLabel(m)}
                                  <button type="button" aria-label={`Unpin ${course.course_id} ${slotLabel(m)}`}
                                    title="Unpin: let the generator move it" disabled={busy}
                                    onClick={() => unpin(course.course_id, name, m)}
                                    style={{ border: "none", background: "transparent", padding: 0, lineHeight: 0, color: "#5b2a9e", cursor: "pointer" }}>
                                    <Icon path={mdiClose} size={0.5} />
                                  </button>
                                </span>
                              ))}
                              {section.generated.map((m) => (
                                <button type="button" key={`g${m.day}${m.time}`} disabled={busy}
                                  onClick={() => pin(course.course_id, name, m)}
                                  style={{ ...chip, border: "1px dashed #b9a6d6", background: "white", color: "#6c757d", cursor: "pointer" }}
                                  title="From the last suggestion: replaced when you generate again. Click to fix it here.">
                                  {slotLabel(m)}
                                </button>
                              ))}
                            </td>
                          );
                        })}
                        <td className="text-center">
                          {open
                            ? <span className="badge" style={{ background: "#fff3cd", color: "#856404" }}>{open}</span>
                            : <span className="badge" style={{ background: "#d1e7dd", color: "#0f5132" }}>all fixed</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Step>

          <Step number={2} title="Readiness">
            <div className="d-flex flex-wrap mb-2" style={{ gap: 10 }}>
              {[
                ["Weekly meetings", overview.totals.required],
                ["Fixed", overview.totals.fixed],
                ["To generate", overview.totals.toGenerate],
              ].map(([label, value]) => (
                <div key={label} style={{ background: "#f8f9fa", borderRadius: 10, padding: "8px 14px", minWidth: 120 }}>
                  <div className="small text-muted">{label}</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{value}</div>
                </div>
              ))}
            </div>
            {overview.ctRequired > 0 && (
              <p className={`small mb-2 ${ctShort ? "text-danger" : ""}`}>
                <strong>Common 8 AM CT slots:</strong> {overview.ctRequired} needed; free in every section on{" "}
                {ctFree.length ? ctFree.map((slot) => `${shortDay(slot.day)}${slot.priority === "preferred" ? "" : " (fallback)"}`).join(", ") : "no day"}.
                {" "}Adding CT in one section's grid adds it to every section.
              </p>
            )}
            {blocked ? (
              <div className="alert alert-danger py-2 mb-2">
                <strong>Resolve before generating:</strong>
                <ul className="mb-0 ps-3">{overview.preflight.map((issue) => <li key={issue}>{issue}</li>)}</ul>
              </div>
            ) : (
              <div className="small text-success mb-2">Ready to generate.</div>
            )}
            {overview.warnings?.length > 0 && (
              <details className="small">
                <summary className="text-warning">{overview.warnings.length} warning(s)</summary>
                <ul className="mb-0 ps-3 mt-1">{overview.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
              </details>
            )}
            <details className="small mt-2">
              <summary className="text-muted">What the generator guarantees and prefers</summary>
              <div className="mt-2 text-muted">
                <strong>Always:</strong> fixed classes, sessionals, CT and thesis stay where they are; no
                section or teacher clashes; no theory at 1 PM; a course meets a section at most once a day;
                the level-term keeps its common 8 AM CT slots (Sat and Wed for two CTs; Sat, Mon and Wed
                for three; other days as fallback).
                <br />
                <strong>Where possible:</strong> the same course on the same days across sections, one
                period apart; a day's gap between a course's meetings; a theory course apart from its
                paired sessional (e.g. CSE 101 / CSE 102); mornings before 8 AM, and 8 AM before 2–4 PM.
                Rooms are assigned later in the room workflow.
              </div>
            </details>
          </Step>

          <Step number={3} title="Generate and review">
            <div className="d-flex flex-wrap align-items-center" style={{ gap: 10 }}>
              <button className="btn btn-outline-primary" type="button" onClick={generate}
                disabled={busy || blocked || overview.totals.toGenerate === 0}>
                {working ? "Working..." : suggestion ? "Generate another" : "Generate suggestion"}
              </button>
              {suggestion?.assignments.length > 0 && (
                <button className="btn btn-primary" type="button" onClick={apply} disabled={busy || stale}>
                  Apply suggestion
                </button>
              )}
              {overview.totals.toGenerate === 0 && !suggestion &&
                <small className="text-muted">Every weekly meeting is fixed; nothing to generate.</small>}
            </div>
            {stale && (
              <div className="alert alert-warning py-2 mt-3 mb-0">
                The routine changed after this suggestion was generated. Generate again to apply.
              </div>
            )}
            {suggestion && (
              <div className="mt-3">
                <p className="mb-2">
                  {suggestion.assignments.length
                    ? `${suggestion.missingCount} meeting(s) suggested around ${overview.totals.fixed} fixed. Preference score ${suggestion.score} (lower is better; seed ${suggestion.seed}).`
                    : "All required theory meetings are already scheduled."}
                </p>
                {suggestion.warnings?.length > 0 && (
                  <div className="alert alert-warning py-2">
                    {suggestion.warnings.map((warning) => <div key={warning}>{warning}</div>)}
                  </div>
                )}
                <TheoryRoutinePreview suggestion={suggestion} allTheoryCourses={allTheoryCourses} />
                <small className="text-muted">
                  Preview only. Applying rechecks the current routine; fixed classes are never changed.
                </small>
              </div>
            )}
          </Step>
        </>}
      </div>
      {overview?.courses && (
        <FixTheoryClassesModal
          show={fixing !== null}
          onHide={() => setFixing(null)}
          department={department}
          levelTerm={levelTerm}
          courses={overview.courses}
          initialCourse={fixing || ""}
          onFixed={onChanged}
        />
      )}
    </div>
  );
}
