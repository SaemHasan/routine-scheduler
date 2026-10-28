import { useEffect, useState } from "react";
import { Alert, Button, Form, Modal } from "react-bootstrap";
import { toast } from "react-hot-toast";
import { removeTheoryClasses } from "../api/theory-schedule";
import { slotLabel } from "./theoryRoutineFixing";

const messageOf = (error) =>
  error?.response?.data?.error?.message || error?.message || "Request failed";

// Classes per section in the routine, fixed or not
const classesOf = (course) => course.sections.map((s) => ({
  section: s.section, count: s.fixed.length + s.generated.length,
}));
const total = (course) => classesOf(course).reduce((sum, s) => sum + s.count, 0);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "es"}`;

// Unassigns the classes of chosen courses, or every theory class of the
// level-term to start it fresh. The generator places them again.
export default function RemoveTheoryClassesModal({
  show, onHide, department, levelTerm, courses, sectionNames, ctPeriods, onRemoved,
}) {
  const [all, setAll] = useState(false);
  const [chosen, setChosen] = useState([]);
  const [withCT, setWithCT] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!show) return;
    setAll(false);
    setChosen([]);
    setWithCT(false);
    setError("");
  }, [show]);

  const scheduled = courses.filter((c) => total(c) > 0);
  const toggle = (courseId) => setChosen((prev) =>
    prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]);
  const allChosen = scheduled.length > 0 && chosen.length === scheduled.length;
  const chosenCount = courses.filter((c) => chosen.includes(c.course_id))
    .reduce((sum, c) => sum + total(c), 0);
  const theoryCount = courses.reduce((sum, c) => sum + total(c), 0);

  const remove = async () => {
    setSaving(true);
    setError("");
    try {
      const { removed } = await removeTheoryClasses(all
        ? { department, level_term: levelTerm, all: true, with_ct: withCT }
        : { department, level_term: levelTerm, course_ids: chosen });
      toast.success(all
        ? `Removed ${plural(removed, "class")} of ${levelTerm}; it starts fresh`
        : `Removed ${plural(removed, "class")} of ${courses.filter((c) => chosen.includes(c.course_id)).map((c) => c.code || c.course_id).join(", ")}`);
      onRemoved();
      onHide();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setSaving(false);
    }
  };

  const ready = all ? theoryCount > 0 || (withCT && ctPeriods.length > 0) : chosen.length > 0;

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title style={{ fontWeight: 700, color: "rgb(124, 64, 200)" }}>
          Remove classes
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted small mb-3">
          Removed classes are unassigned, fixed ones too: the generator places
          them again, or you add them in the grids below. Their rooms are
          cleared. Sessionals and thesis are not touched.
        </p>
        <Form.Check type="radio" id="remove-courses" name="remove-scope" className="mb-1"
          label={<span style={{ fontWeight: 600 }}>Classes of chosen courses</span>}
          checked={!all} onChange={() => setAll(false)} />
        <Form.Check type="radio" id="remove-all" name="remove-scope" className="mb-3"
          label={<span style={{ fontWeight: 600 }}>Every theory class of {levelTerm} — start fresh</span>}
          checked={all} onChange={() => setAll(true)} />

        {!all ? (
          <table className="table table-sm align-middle mb-2">
            <thead>
              <tr>
                <th style={{ width: "45%" }}>
                  <Form.Check type="checkbox" id="remove-every-course" label="Course"
                    checked={allChosen} disabled={!scheduled.length}
                    onChange={() => setChosen(allChosen ? [] : scheduled.map((c) => c.course_id))} />
                </th>
                <th>Classes in the routine</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => {
                const count = total(course);
                return (
                  <tr key={course.course_id} className={count ? "" : "text-muted"}>
                    <td>
                      <Form.Check
                        type="checkbox"
                        id={`remove-${course.course_id}`}
                        label={<>
                          <span style={{ fontWeight: 600 }}>{course.code || course.course_id}</span>
                          {course.name && <span className="small text-muted"> {course.name}</span>}
                        </>}
                        checked={chosen.includes(course.course_id)}
                        disabled={!count}
                        onChange={() => toggle(course.course_id)}
                      />
                    </td>
                    <td className="small">
                      {count
                        ? classesOf(course).map((s) => `${s.section} ${s.count}`).join(" · ")
                        : "None"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ background: "#fff5f5", borderRadius: 10, padding: "12px 16px" }}>
            <div className="mb-2">
              Removes all {plural(theoryCount, "class")} of {courses.length} theory
              course{courses.length === 1 ? "" : "s"} from
              section{sectionNames.length === 1 ? "" : "s"} {sectionNames.join(", ")}, fixed or not.
            </div>
            {ctPeriods.length > 0 ? (
              <Form.Check type="checkbox" id="remove-ct"
                label={`Remove the CT periods too (${ctPeriods.map(slotLabel).join(", ")})`}
                checked={withCT} onChange={(e) => setWithCT(e.target.checked)} />
            ) : (
              <div className="small text-muted">No CT periods are set.</div>
            )}
          </div>
        )}
        {error && <Alert variant="danger" className="mt-2 mb-0 small">{error}</Alert>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="light" onClick={onHide}>Cancel</Button>
        <Button variant="danger" onClick={remove} disabled={!ready || saving}>
          {saving
            ? "Removing..."
            : all ? `Remove all classes of ${levelTerm}` : `Remove ${plural(chosenCount, "class")}`}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
