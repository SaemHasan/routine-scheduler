import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Modal } from "react-bootstrap";
import { toast } from "react-hot-toast";
import { swapTheoryCourses } from "../api/theory-schedule";
import { useConfig } from "../shared/ConfigContext";
import { slotLabel } from "./theoryRoutineFixing";

const messageOf = (error) =>
  error?.response?.data?.error?.message || error?.message || "Request failed";

// Two courses trade their periods in the chosen sections, e.g. CSE401 on
// Sat/Mon 9 and CSE403 on Sun/Tue 10 the other way round.
export default function SwapTheoryCoursesModal({ show, onHide, department, levelTerm, courses, onSwapped }) {
  const { days, times } = useConfig();
  const [firstId, setFirstId] = useState("");
  const [secondId, setSecondId] = useState("");
  const [chosen, setChosen] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Electives share periods across sections, so they do not swap
  const swappable = courses.filter((c) => !c.optional);
  const first = swappable.find((c) => c.course_id === firstId);
  const second = swappable.find((c) => c.course_id === secondId);

  // Per section: each course's classes, and whether they can trade
  const rows = useMemo(() => {
    if (!first || !second) return [];
    const order = (m) => days.indexOf(m.day) * 100 + times.indexOf(Number(m.time));
    const classesOf = (course, name) => {
      const section = course.sections.find((s) => s.section === name);
      return section && {
        teachers: section.teachers || [],
        meetings: [...section.fixed, ...section.generated].sort((x, y) => order(x) - order(y)),
      };
    };
    return first.sections.map((s) => s.section)
      .filter((name) => second.sections.some((s) => s.section === name))
      .map((name) => {
        const a = classesOf(first, name);
        const b = classesOf(second, name);
        const problem = a.meetings.length !== b.meetings.length
          ? `${a.meetings.length} vs ${b.meetings.length} classes`
          : !a.meetings.length ? "Neither is in the routine" : "";
        return { section: name, a, b, problem };
      });
  }, [first, second, days, times]);

  useEffect(() => {
    if (!show) return;
    setFirstId("");
    setSecondId("");
    setError("");
  }, [show]);

  useEffect(() => {
    setChosen(rows.filter((r) => !r.problem).map((r) => r.section));
    setError("");
  }, [rows]);

  const toggle = (section) => setChosen((prev) =>
    prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]);

  const swap = async () => {
    setSaving(true);
    setError("");
    try {
      await swapTheoryCourses({
        department, level_term: levelTerm, course_ids: [firstId, secondId], sections: chosen,
      });
      toast.success(`Swapped ${firstId} and ${secondId} in section ${chosen.join(", ")}`);
      onSwapped();
      onHide();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setSaving(false);
    }
  };

  const labels = (meetings) => meetings.map(slotLabel).join(", ");
  const courseCell = (side, after, picked) => (
    <td>
      <div>{labels(side.meetings) || "—"}</div>
      {picked && <div style={{ color: "rgb(124, 64, 200)", fontWeight: 600 }}>→ {labels(after.meetings)}</div>}
      {side.teachers.length > 0 && <div className="small text-muted">{side.teachers.join(", ")}</div>}
    </td>
  );
  const selectStyle = { borderRadius: 8, height: 38 };
  const courseOptions = (exclude) => swappable
    .filter((c) => c.course_id !== exclude)
    .map((c) => (
      <option key={c.course_id} value={c.course_id}>
        {c.course_id}{c.name ? ` — ${c.name}` : ""} ({c.class_per_week}/week)
      </option>
    ));

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title style={{ fontWeight: 700, color: "rgb(124, 64, 200)" }}>
          Swap two courses
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted small mb-3">
          In each chosen section the two courses trade periods, each keeping its
          own teachers. Rooms stay with the period. The swapped classes become
          fixed, so the generator keeps them. Electives cannot be swapped.
        </p>
        <div className="row">
          <Form.Group className="col-md-6 mb-3">
            <Form.Label style={{ fontWeight: 600 }}>Course</Form.Label>
            <Form.Select value={firstId} onChange={(e) => setFirstId(e.target.value)} style={selectStyle}>
              <option value="">Select a course</option>
              {courseOptions(secondId)}
            </Form.Select>
          </Form.Group>
          <Form.Group className="col-md-6 mb-3">
            <Form.Label style={{ fontWeight: 600 }}>Swap with</Form.Label>
            <Form.Select value={secondId} onChange={(e) => setSecondId(e.target.value)} style={selectStyle}>
              <option value="">Select a course</option>
              {courseOptions(firstId)}
            </Form.Select>
          </Form.Group>
        </div>

        {first && second && (rows.length ? (
          <table className="table table-sm align-middle mb-2">
            <thead>
              <tr>
                <th style={{ width: "16%" }}>Section</th>
                <th>{firstId}</th>
                <th>{secondId}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const picked = chosen.includes(row.section);
                return (
                  <tr key={row.section}>
                    <td>
                      <Form.Check
                        type="checkbox"
                        id={`swap-${row.section}`}
                        label={<span style={{ fontWeight: 600 }}>{row.section}</span>}
                        checked={picked}
                        disabled={Boolean(row.problem)}
                        onChange={() => toggle(row.section)}
                      />
                      {row.problem && <div className="small text-muted">{row.problem}</div>}
                    </td>
                    {courseCell(row.a, row.b, picked)}
                    {courseCell(row.b, row.a, picked)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="small text-muted">These courses have no section in common.</div>
        ))}
        {error && <Alert variant="danger" className="mt-2 mb-0 small">{error}</Alert>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="light" onClick={onHide}>Cancel</Button>
        <Button variant="primary" onClick={swap} disabled={!chosen.length || saving}>
          {saving
            ? "Swapping..."
            : `Swap in ${chosen.length || ""} section${chosen.length === 1 ? "" : "s"}`}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
