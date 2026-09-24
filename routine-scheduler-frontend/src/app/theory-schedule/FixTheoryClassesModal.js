import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Modal } from "react-bootstrap";
import { toast } from "react-hot-toast";
import { fixTheoryClasses } from "../api/theory-schedule";
import { useConfig } from "../shared/ConfigContext";
import { slotLabel, staggeredTimes, theoryTimes } from "./theoryRoutineFixing";

const messageOf = (error) =>
  error?.response?.data?.error?.message || error?.message || "Request failed";

// Fixes meetings of one course before generation, e.g. IPE493 on Wednesday
// at 9 for A, 10 for B and 11 for C. The generator then works around them.
export default function FixTheoryClassesModal({
  show, onHide, department, levelTerm, courses, initialCourse, onFixed,
}) {
  const { days, times } = useConfig();
  const [courseId, setCourseId] = useState("");
  const [rows, setRows] = useState([]);
  const [fillDay, setFillDay] = useState("");
  const [fillTime, setFillTime] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const course = courses.find((c) => c.course_id === courseId);
  // A shared elective is one class for all sections: one row
  const targets = useMemo(() => !course ? [] : course.shared
    ? [{ ...course.sections[0], label: "All sections" }]
    : course.sections.map((s) => ({ ...s, label: `Section ${s.section}` })), [course]);

  useEffect(() => {
    if (!show) return;
    setCourseId(initialCourse || "");
    setFillDay("");
    setFillTime("");
    setError("");
  }, [show, initialCourse]);

  useEffect(() => {
    setRows(targets.map((t) => ({ section: t.section, day: "", time: "" })));
    setError("");
  }, [targets]);

  const setRow = (i, field, value) =>
    setRows((prev) => prev.map((row, j) => (j === i ? { ...row, [field]: value } : row)));

  const fill = () => {
    const staggered = staggeredTimes(times, fillTime, rows.length);
    setRows((prev) => prev.map((row, i) => {
      const open = targets[i].fixed.length < course.class_per_week;
      return open ? { ...row, day: fillDay, time: staggered[i] } : row;
    }));
  };

  const complete = rows.filter((row) => row.day && row.time !== "");
  const partial = rows.some((row) => Boolean(row.day) !== (row.time !== ""));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await fixTheoryClasses({
        department, level_term: levelTerm, course_id: courseId,
        placements: complete.map((row) => ({ ...row, time: Number(row.time) })),
      });
      toast.success(`Fixed ${result.fixed} ${courseId} class${result.fixed === 1 ? "" : "es"}`);
      if (result.released?.length) {
        toast(`Released for the next generation: ${result.released.join(", ")}`,
          { icon: "↻", duration: 6000 });
      }
      onFixed();
      onHide();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setSaving(false);
    }
  };

  const selectStyle = { borderRadius: 8, height: 38 };
  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title style={{ fontWeight: 700, color: "rgb(124, 64, 200)" }}>
          Fix theory classes
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted small mb-3">
          Fixed classes are never moved by the generator; it fills in each
          section's remaining weekly meetings around them. Leave a section
          blank to let the generator place it.
        </p>
        <Form.Group className="mb-3">
          <Form.Label style={{ fontWeight: 600 }}>Course</Form.Label>
          <Form.Select value={courseId} onChange={(e) => setCourseId(e.target.value)} style={selectStyle}>
            <option value="">Select a course</option>
            {courses.map((c) => (
              <option key={c.course_id} value={c.course_id}>
                {c.course_id}{c.name ? ` — ${c.name}` : ""} ({c.class_per_week}/week{c.shared ? ", all sections together" : ""})
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        {course && (
          <>
            {!course.shared && targets.length > 1 && (
              <div className="d-flex flex-wrap align-items-end mb-3 p-2"
                style={{ gap: 8, background: "#f7f2fe", borderRadius: 10 }}>
                <div>
                  <Form.Label className="small mb-1" style={{ fontWeight: 600 }}>Same day</Form.Label>
                  <Form.Select size="sm" value={fillDay} onChange={(e) => setFillDay(e.target.value)}>
                    <option value="">Day</option>
                    {days.map((d) => <option key={d} value={d}>{d}</option>)}
                  </Form.Select>
                </div>
                <div>
                  <Form.Label className="small mb-1" style={{ fontWeight: 600 }}>First section at</Form.Label>
                  <Form.Select size="sm" value={fillTime} onChange={(e) => setFillTime(e.target.value)}>
                    <option value="">Time</option>
                    {theoryTimes(times).map((t) => <option key={t} value={t}>{t}:00</option>)}
                  </Form.Select>
                </div>
                <Button size="sm" variant="outline-primary" disabled={!fillDay || fillTime === ""} onClick={fill}>
                  Fill one period apart
                </Button>
                <small className="text-muted" style={{ flexBasis: "100%" }}>
                  E.g. Wednesday from 9 gives A 9, B 10, C 11 (1 PM is skipped).
                </small>
              </div>
            )}

            <table className="table table-sm align-middle mb-2">
              <thead>
                <tr>
                  <th style={{ width: "22%" }}>Section</th>
                  <th>Day</th>
                  <th>Time</th>
                  <th style={{ width: "30%" }}>Already fixed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const target = targets[i];
                  const full = target.fixed.length >= course.class_per_week;
                  return (
                    <tr key={row.section}>
                      <td style={{ fontWeight: 600 }}>{target.label}</td>
                      <td>
                        <Form.Select size="sm" value={row.day} disabled={full}
                          onChange={(e) => setRow(i, "day", e.target.value)}>
                          <option value="">—</option>
                          {days.map((d) => <option key={d} value={d}>{d}</option>)}
                        </Form.Select>
                      </td>
                      <td>
                        <Form.Select size="sm" value={row.time} disabled={full}
                          onChange={(e) => setRow(i, "time", e.target.value)}>
                          <option value="">—</option>
                          {theoryTimes(times).map((t) => <option key={t} value={t}>{t}:00</option>)}
                        </Form.Select>
                      </td>
                      <td className="small text-muted">
                        {full
                          ? `All ${course.class_per_week} fixed`
                          : `${target.fixed.length}/${course.class_per_week}` +
                            (target.fixed.length ? ` · ${target.fixed.map(slotLabel).join(", ")}` : "")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
        {partial && <div className="small text-warning">Choose both a day and a time, or leave both blank.</div>}
        {error && <Alert variant="danger" className="mt-2 mb-0 small">{error}</Alert>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="light" onClick={onHide}>Cancel</Button>
        <Button variant="primary" onClick={save}
          disabled={!course || !complete.length || partial || saving}>
          {saving ? "Fixing..." : `Fix ${complete.length || ""} class${complete.length === 1 ? "" : "es"}`}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
