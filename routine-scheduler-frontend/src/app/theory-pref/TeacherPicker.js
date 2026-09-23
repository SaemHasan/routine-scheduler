import { useEffect, useMemo, useState } from "react";
import { Modal } from "react-bootstrap";

// A theory course carries credit x sections of load, shared equally by all of
// its teachers: 3 credits x 3 sections with 2 teachers is 4.5 each.
export const courseLoad = (course) =>
  (Number(course.class_per_week) || 0) * (parseInt(course.section_count, 10) || 0);

export const formatLoad = (load) =>
  Number.isInteger(load) ? String(load) : load.toFixed(2).replace(/0$/, "");

const DESIGNATION_ORDER = [
  "Professor",
  "Associate Professor",
  "Assistant Professor",
  "Lecturer",
];

/**
 * Picks teachers for one theory course. Teachers are grouped by designation in
 * seniority order, and each row shows what the teacher already teaches so the
 * load is visible before assigning.
 */
export default function TeacherPicker({
  course,
  teachers,
  assignment,
  onClose,
  onAssign,
}) {
  const [search, setSearch] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSearch("");
    setSelected([]);
    setSaving(false);
  }, [course]);

  const assignedHere = useMemo(
    () => new Set((course?.teachers || []).map((t) => t.initial)),
    [course]
  );

  // Other theory courses each teacher already has
  const coursesByTeacher = useMemo(() => {
    const map = {};
    (assignment || []).forEach((c) => {
      if (!course || c.course_id === course.course_id) return;
      (c.teachers || []).forEach((t) => {
        (map[t.initial] = map[t.initial] || []).push(c.course_id);
      });
    });
    return map;
  }, [assignment, course]);

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const visible = teachers.filter((t) => {
      if (assignedHere.has(t.initial)) return false;
      if (availableOnly && coursesByTeacher[t.initial]) return false;
      if (!term) return true;
      return (
        t.initial.toLowerCase().includes(term) ||
        (t.name || "").toLowerCase().includes(term) ||
        (t.surname || "").toLowerCase().includes(term)
      );
    });
    const byDesignation = {};
    visible.forEach((t) => {
      const key = t.designation || "Other";
      (byDesignation[key] = byDesignation[key] || []).push(t);
    });
    const rank = (d) => {
      const i = DESIGNATION_ORDER.indexOf(d);
      return i === -1 ? DESIGNATION_ORDER.length : i;
    };
    return Object.keys(byDesignation)
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
      .map((designation) => ({
        designation,
        teachers: byDesignation[designation].sort(
          (a, b) => a.seniority_rank - b.seniority_rank
        ),
      }));
  }, [teachers, search, availableOnly, assignedHere, coursesByTeacher]);

  if (!course) return null;

  const sectionCount = parseInt(course.section_count, 10) || 0;
  const staffed = assignedHere.size;
  const afterAssign = staffed + selected.length;
  const overBy = afterAssign - sectionCount;
  const totalLoad = courseLoad(course);
  const visibleCount = groups.reduce((n, g) => n + g.teachers.length, 0);

  const toggle = (initial) =>
    setSelected((prev) =>
      prev.includes(initial)
        ? prev.filter((x) => x !== initial)
        : [...prev, initial]
    );

  const handleAssign = async () => {
    setSaving(true);
    try {
      await onAssign(selected);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      show
      onHide={onClose}
      size="lg"
      centered
      contentClassName="modal-content"
      backdrop="static"
    >
      <Modal.Header className="modal-header">
        <Modal.Title className="modal-header-content">
          <div className="modal-header-icon">
            <i className="mdi mdi-account-plus-outline"></i>
          </div>
          <div>
            <h4 className="modal-title">Assign Teachers</h4>
            <div className="teacher-picker-subtitle">
              {course.course_id} · {course.name}
            </div>
          </div>
        </Modal.Title>
        <button
          className="modal-header-close-button mdi mdi-close"
          onClick={onClose}
        ></button>
      </Modal.Header>

      <Modal.Body className="modal-body">
        <div className="teacher-picker-load">
          <div>
            <span className="teacher-picker-load-label">Course load</span>
            <strong>
              {course.class_per_week} credit × {sectionCount} section
              {sectionCount === 1 ? "" : "s"} = {formatLoad(totalLoad)}
            </strong>
          </div>
          <div>
            <span className="teacher-picker-load-label">Now</span>
            <strong>
              {staffed === 0
                ? "No teachers"
                : `${staffed} teacher${staffed === 1 ? "" : "s"} · ${formatLoad(
                    totalLoad / staffed
                  )} each`}
            </strong>
          </div>
          {selected.length > 0 && (
            <div className="teacher-picker-load-after">
              <span className="teacher-picker-load-label">After assigning</span>
              <strong>
                {afterAssign} teachers · {formatLoad(totalLoad / afterAssign)}{" "}
                each
              </strong>
            </div>
          )}
        </div>

        <div className="teacher-picker-toolbar">
          <div className="card-search-box flex-grow-1">
            <i className="mdi mdi-magnify"></i>
            <input
              type="text"
              placeholder="Search by initial or name…"
              value={search}
              autoFocus
              onChange={(e) => setSearch(e.target.value)}
            />
            {search !== "" && (
              <button
                className="card-search-clear mdi mdi-close-circle"
                title="Clear search"
                onClick={() => setSearch("")}
              ></button>
            )}
          </div>
          <div className="segmented-toggle">
            <button
              className={availableOnly ? "" : "active"}
              onClick={() => setAvailableOnly(false)}
            >
              All
            </button>
            <button
              className={availableOnly ? "active" : ""}
              onClick={() => setAvailableOnly(true)}
            >
              Unassigned only
            </button>
          </div>
        </div>

        <div className="teacher-picker-list">
          {visibleCount === 0 ? (
            <div className="empty-state">
              <i className="mdi mdi-account-search-outline"></i>
              <div className="empty-state-title">No teachers found</div>
              <div className="empty-state-hint">
                Try a different search or show all teachers.
              </div>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.designation}>
                <div className="teacher-picker-group">
                  {group.designation}
                  <span>{group.teachers.length}</span>
                </div>
                {group.teachers.map((t) => {
                  const isSelected = selected.includes(t.initial);
                  const others = coursesByTeacher[t.initial] || [];
                  return (
                    <div
                      key={t.initial}
                      className={`teacher-picker-row${isSelected ? " selected" : ""}`}
                      onClick={() => toggle(t.initial)}
                    >
                      <div
                        className={`custom-checkbox ${
                          isSelected ? "checked mdi mdi-check" : "unchecked"
                        }`}
                      ></div>
                      <span className="teacher-picker-initial">{t.initial}</span>
                      <span className="teacher-picker-name">{t.name}</span>
                      <span className="teacher-picker-tags">
                        {others.length > 0 ? (
                          <span
                            className="pill optional"
                            title="Already teaching these theory courses"
                          >
                            <i className="mdi mdi-book-clock-outline"></i>
                            {others.join(", ")}
                          </span>
                        ) : (
                          <span className="pill muted">No theory course</span>
                        )}
                        {t.full_time_status === false && (
                          <span className="pill muted">Part-time</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </Modal.Body>

      <Modal.Footer className="modal-footer teacher-picker-footer">
        <div className="teacher-picker-footer-note">
          {overBy > 0 ? (
            <span className="field-error">
              <i className="mdi mdi-alert-outline"></i> This gives{" "}
              {course.course_id} {afterAssign} teachers for {sectionCount}{" "}
              section{sectionCount === 1 ? "" : "s"}.
            </span>
          ) : selected.length > 0 ? (
            <span className="field-hint">
              {selected.join(", ")}
            </span>
          ) : null}
        </div>
        <button
          className="card-control-button mdi mdi-close"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="card-control-button mdi mdi-check"
          disabled={selected.length === 0 || saving}
          onClick={handleAssign}
        >
          {saving
            ? "Assigning…"
            : `Assign${selected.length > 0 ? ` ${selected.length}` : ""} teacher${
                selected.length === 1 ? "" : "s"
              }`}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
