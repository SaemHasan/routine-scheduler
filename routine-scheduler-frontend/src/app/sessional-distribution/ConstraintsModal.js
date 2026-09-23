import { useEffect, useMemo, useState } from "react";
import { Modal, Form, Row, Col } from "react-bootstrap";
import Select from "react-select";
import { toast } from "react-hot-toast";
import { useConfig } from "../shared/ConfigContext";
import { getSections, getRooms, getLabCourses } from "../api/db-crud";
import {
  addSchedulerConstraint,
  deleteSchedulerConstraint,
} from "../api/sessional-scheduler";
import { formatHour } from "./format";

const letterOf = (section) => (section.match(/^[A-Za-z]+/) || [section])[0];

const emptyBlock = {
  department: "",
  level_term: "",
  section: "",
  day: "",
  time: "",
  note: "",
};

/** Adds and removes the rules the sessional scheduler follows. */
export default function ConstraintsModal({ constraints, onClose, onChanged }) {
  const { days, times } = useConfig();
  const [tab, setTab] = useState("blocked_slot");
  const [sections, setSections] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [courses, setCourses] = useState([]);
  const [block, setBlock] = useState(emptyBlock);
  const [courseRule, setCourseRule] = useState({ course_id: "", rooms: [] });
  const [together, setTogether] = useState({ course_id: "", same_slot: true, shared_room: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSections().then((res) => setSections(res || [])).catch(() => {});
    getRooms()
      .then((res) =>
        setRooms(
          (res || [])
            .filter((r) => r.active)
            .sort((a, b) => (a.type === 0) - (b.type === 0) || a.room.localeCompare(b.room))
        )
      )
      .catch(() => {});
    getLabCourses()
      .then((res) => {
        const unique = new Map();
        (res || []).forEach((c) => unique.set(c.course_id, c.name));
        setCourses(
          Array.from(unique, ([course_id, name]) => ({ course_id, name })).sort((a, b) =>
            a.course_id.localeCompare(b.course_id)
          )
        );
      })
      .catch(() => {});
  }, []);

  const departments = useMemo(
    () => Array.from(new Set(sections.map((s) => s.department))).sort(),
    [sections]
  );
  const levelTerms = useMemo(
    () =>
      Array.from(
        new Set(
          sections
            .filter((s) => !block.department || s.department === block.department)
            .map((s) => s.level_term)
        )
      ).sort(),
    [sections, block.department]
  );
  // Whole sections first (A, B), then their subsections (A1, A2)
  const sectionOptions = useMemo(() => {
    if (!block.department || !block.level_term) return [];
    const list = Array.from(
      new Set(
        sections
          .filter((s) => s.department === block.department && s.level_term === block.level_term)
          .map((s) => s.section)
      )
    );
    return list.sort(
      (a, b) => letterOf(a).localeCompare(letterOf(b)) || a.length - b.length || a.localeCompare(b)
    );
  }, [sections, block.department, block.level_term]);

  const blocked = constraints.filter((c) => c.kind === "blocked_slot");
  const roomRules = constraints.filter((c) => c.kind === "course_rooms");
  const courseRules = constraints.filter((c) => c.kind === "course_together");

  const save = async (payload, reset) => {
    setSaving(true);
    try {
      await addSchedulerConstraint(payload);
      reset();
      await onChanged();
      toast.success("Constraint added");
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || "Failed to add constraint");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await deleteSchedulerConstraint(id);
      await onChanged();
    } catch {
      toast.error("Failed to remove constraint");
    }
  };

  const describeWho = (c) => {
    if (!c.department && !c.level_term && !c.section) return "All sections";
    const parts = [c.department || "All departments", c.level_term].filter(Boolean);
    return `${parts.join(" ")} · ${c.section ? `section ${c.section}` : "all sections"}`;
  };

  return (
    <Modal show onHide={onClose} size="lg" centered contentClassName="modal-content">
      <Modal.Header className="modal-header">
        <Modal.Title className="modal-header-content">
          <div className="modal-header-icon">
            <i className="mdi mdi-tune-variant"></i>
          </div>
          <h4 className="modal-title">Scheduling Constraints</h4>
        </Modal.Title>
        <button className="modal-header-close-button mdi mdi-close" onClick={onClose}></button>
      </Modal.Header>

      <Modal.Body className="modal-body">
        <div className="segmented-toggle mb-3">
          <button
            className={tab === "blocked_slot" ? "active" : ""}
            onClick={() => setTab("blocked_slot")}
          >
            Blocked slots ({blocked.length})
          </button>
          <button
            className={tab === "course_rooms" ? "active" : ""}
            onClick={() => setTab("course_rooms")}
          >
            Lab rooms ({roomRules.length})
          </button>
          <button
            className={tab === "course_together" ? "active" : ""}
            onClick={() => setTab("course_together")}
          >
            Course rules ({courseRules.length})
          </button>
        </div>

        {tab === "course_together" ? (
          <>
            <div className="field-hint mb-2">
              For a course like the capstone project: run every section in the same
              slot, and let a section's subsections (A1 and A2) share one room.
            </div>
            <div className="constraint-form">
              <Row>
                <Col md={4} className="px-2 py-1">
                  <Form.Label className="form-label">Course</Form.Label>
                  <Form.Select
                    className="form-select"
                    value={together.course_id}
                    onChange={(e) => setTogether({ ...together, course_id: e.target.value })}
                  >
                    <option value="">Choose…</option>
                    {courses.map((c) => (
                      <option key={c.course_id} value={c.course_id}>
                        {c.course_id} – {c.name}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={6} className="px-2 py-1 d-flex flex-column justify-content-end">
                  <Form.Check
                    type="checkbox"
                    id="rule-same-slot"
                    label="All sections in one slot"
                    checked={together.same_slot}
                    onChange={(e) => setTogether({ ...together, same_slot: e.target.checked })}
                  />
                  <Form.Check
                    type="checkbox"
                    id="rule-shared-room"
                    label="Subsections share a room (A1 and A2 together)"
                    checked={together.shared_room}
                    onChange={(e) => setTogether({ ...together, shared_room: e.target.checked })}
                  />
                </Col>
                <Col md={2} className="px-2 py-1 d-flex align-items-end">
                  <button
                    className="card-control-button mdi mdi-plus w-100"
                    disabled={
                      !together.course_id || !(together.same_slot || together.shared_room) || saving
                    }
                    onClick={() =>
                      save({ kind: "course_together", ...together }, () =>
                        setTogether({ course_id: "", same_slot: true, shared_room: true })
                      )
                    }
                  >
                    Add
                  </button>
                </Col>
              </Row>
            </div>

            <div className="constraint-list">
              {courseRules.length === 0 ? (
                <div className="empty-state">
                  <i className="mdi mdi-link-variant"></i>
                  <div className="empty-state-title">No course rules</div>
                </div>
              ) : (
                courseRules.map((c) => (
                  <div key={c.id} className="constraint-row">
                    <i className="mdi mdi-link-variant"></i>
                    <div className="flex-grow-1">
                      <strong>{c.course_id}</strong>
                      <span className="constraint-who">
                        {courses.find((x) => x.course_id === c.course_id)?.name}
                      </span>
                      <div className="chip-row mt-1" style={{ gap: "6px" }}>
                        {c.same_slot && <span className="pill purple">All sections in one slot</span>}
                        {c.shared_room && <span className="pill purple">Subsections share a room</span>}
                      </div>
                      {c.note && <span className="field-hint d-block">{c.note}</span>}
                    </div>
                    <button
                      className="chip-remove mdi mdi-delete-outline"
                      title="Remove"
                      onClick={() => remove(c.id)}
                    ></button>
                  </div>
                ))
              )}
            </div>
          </>
        ) : tab === "blocked_slot" ? (
          <>
            <div className="field-hint mb-2">
              No sessional is placed for the chosen sections at that time. Leave a field
              on “All” to widen the rule, e.g. Tuesday 2 PM for everyone.
            </div>
            <div className="constraint-form">
              <Row>
                <Col md={4} className="px-2 py-1">
                  <Form.Label className="form-label">Department</Form.Label>
                  <Form.Select
                    className="form-select"
                    value={block.department}
                    onChange={(e) =>
                      setBlock({ ...block, department: e.target.value, level_term: "", section: "" })
                    }
                  >
                    <option value="">All</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={4} className="px-2 py-1">
                  <Form.Label className="form-label">Level-Term</Form.Label>
                  <Form.Select
                    className="form-select"
                    value={block.level_term}
                    onChange={(e) => setBlock({ ...block, level_term: e.target.value, section: "" })}
                  >
                    <option value="">All</option>
                    {levelTerms.map((lt) => (
                      <option key={lt} value={lt}>{lt}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={4} className="px-2 py-1">
                  <Form.Label className="form-label">Section</Form.Label>
                  <Form.Select
                    className="form-select"
                    value={block.section}
                    disabled={sectionOptions.length === 0}
                    onChange={(e) => setBlock({ ...block, section: e.target.value })}
                  >
                    <option value="">All</option>
                    {sectionOptions.map((s) => (
                      <option key={s} value={s}>
                        {s === letterOf(s) ? `${s} (whole section)` : s}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
              </Row>
              <Row>
                <Col md={3} className="px-2 py-1">
                  <Form.Label className="form-label">Day</Form.Label>
                  <Form.Select
                    className="form-select"
                    value={block.day}
                    onChange={(e) => setBlock({ ...block, day: e.target.value })}
                  >
                    <option value="">Choose…</option>
                    {days.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={3} className="px-2 py-1">
                  <Form.Label className="form-label">Time</Form.Label>
                  <Form.Select
                    className="form-select"
                    value={block.time}
                    onChange={(e) => setBlock({ ...block, time: e.target.value })}
                  >
                    <option value="">Whole day</option>
                    {times.map((t) => (
                      <option key={t} value={t}>{formatHour(t)}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={4} className="px-2 py-1">
                  <Form.Label className="form-label">Note (optional)</Form.Label>
                  <Form.Control
                    className="form-control"
                    placeholder="e.g. theory class"
                    value={block.note}
                    onChange={(e) => setBlock({ ...block, note: e.target.value })}
                  />
                </Col>
                <Col md={2} className="px-2 py-1 d-flex align-items-end">
                  <button
                    className="card-control-button mdi mdi-plus w-100"
                    disabled={!block.day || saving}
                    onClick={() =>
                      save({ kind: "blocked_slot", ...block }, () => setBlock(emptyBlock))
                    }
                  >
                    Add
                  </button>
                </Col>
              </Row>
            </div>

            <div className="constraint-list">
              {blocked.length === 0 ? (
                <div className="empty-state">
                  <i className="mdi mdi-calendar-remove-outline"></i>
                  <div className="empty-state-title">No blocked slots</div>
                </div>
              ) : (
                blocked.map((c) => (
                  <div key={c.id} className="constraint-row">
                    <i className="mdi mdi-calendar-remove-outline"></i>
                    <div className="flex-grow-1">
                      <strong>{c.day}{c.time !== null ? `, ${formatHour(c.time)}` : ", whole day"}</strong>
                      <span className="constraint-who">{describeWho(c)}</span>
                      {c.note && <span className="field-hint d-block">{c.note}</span>}
                    </div>
                    <button
                      className="chip-remove mdi mdi-delete-outline"
                      title="Remove"
                      onClick={() => remove(c.id)}
                    ></button>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <div className="field-hint mb-2">
              A course listed here only uses these rooms. Other courses use any lab of
              their type (software or hardware).
            </div>
            <div className="constraint-form">
              <Row>
                <Col md={4} className="px-2 py-1">
                  <Form.Label className="form-label">Course</Form.Label>
                  <Form.Select
                    className="form-select"
                    value={courseRule.course_id}
                    onChange={(e) => setCourseRule({ ...courseRule, course_id: e.target.value })}
                  >
                    <option value="">Choose…</option>
                    {courses.map((c) => (
                      <option key={c.course_id} value={c.course_id}>
                        {c.course_id} – {c.name}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={6} className="px-2 py-1">
                  <Form.Label className="form-label">Rooms</Form.Label>
                  <Select
                    isMulti
                    classNamePrefix="rs"
                    placeholder="Choose rooms…"
                    value={courseRule.rooms.map((r) => ({ value: r, label: r }))}
                    options={rooms.map((r) => ({
                      value: r.room,
                      label: r.lab_type ? `${r.room} (${r.lab_type === "HW" ? "hardware" : "software"})` : r.room,
                    }))}
                    onChange={(opts) =>
                      setCourseRule({ ...courseRule, rooms: (opts || []).map((o) => o.value) })
                    }
                  />
                </Col>
                <Col md={2} className="px-2 py-1 d-flex align-items-end">
                  <button
                    className="card-control-button mdi mdi-plus w-100"
                    disabled={!courseRule.course_id || courseRule.rooms.length === 0 || saving}
                    onClick={() =>
                      save({ kind: "course_rooms", ...courseRule }, () =>
                        setCourseRule({ course_id: "", rooms: [] })
                      )
                    }
                  >
                    Add
                  </button>
                </Col>
              </Row>
            </div>

            <div className="constraint-list">
              {roomRules.length === 0 ? (
                <div className="empty-state">
                  <i className="mdi mdi-door-closed"></i>
                  <div className="empty-state-title">No room rules</div>
                </div>
              ) : (
                roomRules.map((c) => (
                  <div key={c.id} className="constraint-row">
                    <i className="mdi mdi-door"></i>
                    <div className="flex-grow-1">
                      <strong>{c.course_id}</strong>
                      <span className="constraint-who">
                        {courses.find((x) => x.course_id === c.course_id)?.name}
                      </span>
                      <div className="chip-row mt-1" style={{ gap: "6px" }}>
                        {(c.rooms || []).map((r) => (
                          <span key={r} className="pill purple">{r}</span>
                        ))}
                      </div>
                    </div>
                    <button
                      className="chip-remove mdi mdi-delete-outline"
                      title="Remove"
                      onClick={() => remove(c.id)}
                    ></button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </Modal.Body>

      <Modal.Footer className="modal-footer">
        <button className="card-control-button mdi mdi-check" onClick={onClose}>
          Done
        </button>
      </Modal.Footer>
    </Modal>
  );
}
