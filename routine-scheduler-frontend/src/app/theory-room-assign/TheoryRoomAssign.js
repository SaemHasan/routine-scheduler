import { useEffect, useMemo, useState } from "react";
import { Form } from "react-bootstrap";
import { toast } from "react-hot-toast";
import {
  getAllTheoryRoomAssignment,
  updateTheoryRoomAssignment,
  getAllSectionRoomAllocation,
  updateSectionRoomAllocation,
} from "../api/theory-room-assign";
import { getRooms } from "../api/db-crud";
import { useConfig } from "../shared/ConfigContext";

const TYPE_RANK = { 0: 0, 2: 1, 1: 2 };
const byRoom = (a, b) =>
  (TYPE_RANK[a.type] ?? 3) - (TYPE_RANK[b.type] ?? 3) ||
  Number(/^\(/.test(a.room)) - Number(/^\(/.test(b.room)) ||
  a.room.localeCompare(b.room, undefined, { numeric: true });

/** A room picker: theory rooms first, then rooms for theory and labs, then labs. */
function RoomSelect({ value, rooms, onChange, disabled, placeholder = "No room" }) {
  const groups = [
    { label: "Theory rooms", list: rooms.filter((r) => r.type === 0) },
    { label: "Theory & lab rooms", list: rooms.filter((r) => r.type === 2) },
    { label: "Lab rooms", list: rooms.filter((r) => r.type === 1) },
  ];
  const known = rooms.some((r) => r.room === value);
  return (
    <Form.Select
      className="form-select"
      style={{ minWidth: "140px" }}
      value={value || ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">{placeholder}</option>
      {value && !known && <option value={value}>{value}</option>}
      {groups
        .filter((g) => g.list.length)
        .map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.list.map((r) => (
              <option key={r.room} value={r.room}>
                {r.room}
              </option>
            ))}
          </optgroup>
        ))}
    </Form.Select>
  );
}

/**
 * Theory rooms: each section gets its usual room, which its classes take;
 * then any class can be moved to another room for that day and time.
 */
export default function TheoryRoomAssign() {
  const { days, times } = useConfig();
  const [sections, setSections] = useState([]);
  const [classes, setClasses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [saving, setSaving] = useState("");
  const [filter, setFilter] = useState({ department: "", level_term: "", section: "", course: "", moved: false });

  const load = () =>
    Promise.all([getAllSectionRoomAllocation(), getAllTheoryRoomAssignment()])
      .then(([sectionRows, classRows]) => {
        setSections(Array.isArray(sectionRows) ? sectionRows : []);
        setClasses(Array.isArray(classRows) ? classRows : []);
      })
      .catch(() => toast.error("Failed to load theory rooms"));

  useEffect(() => {
    load();
    getRooms()
      .then((list) => setRooms((list || []).filter((r) => r.active !== false).sort(byRoom)))
      .catch(() => toast.error("Failed to load rooms"));
  }, []);

  const saveSectionRoom = async (section, room_no) => {
    const key = `section|${section.department}|${section.level_term}|${section.section}`;
    setSaving(key);
    try {
      await updateSectionRoomAllocation({ ...section, room_no });
      toast.success(`${section.department} ${section.level_term} (${section.section}) now in ${room_no || "no room"}`);
      await load();
    } catch {
      toast.error("Failed to update the section's room");
    } finally {
      setSaving("");
    }
  };

  const saveClassRoom = async (c, room_no) => {
    const key = `class|${c.course_id}|${c.department}|${c.section}|${c.day}|${c.time}`;
    setSaving(key);
    try {
      await updateTheoryRoomAssignment({ course_id: c.course_id, section: c.section, day: c.day, time: c.time, room_no });
      toast.success(`${c.course_id} (${c.label}) on ${c.day} ${c.time}:00 now in ${room_no || "no room"}`);
      await load();
    } catch {
      toast.error("Failed to update the room");
    } finally {
      setSaving("");
    }
  };

  // Two different classes in one room at once
  const clashes = useMemo(() => {
    const at = new Map();
    for (const c of classes) {
      if (!c.room_no) continue;
      const k = `${c.room_no}|${c.day}|${c.time}`;
      if (!at.has(k)) at.set(k, []);
      at.get(k).push(c);
    }
    const out = new Map();
    for (const [k, list] of at) {
      const distinct = new Set(list.map((c) => `${c.course_id}|${c.department}|${c.batch}|${c.label}`));
      if (distinct.size > 1) out.set(k, list.map((c) => `${c.course_id} (${c.label})`));
    }
    return out;
  }, [classes]);

  const options = useMemo(
    () => ({
      departments: [...new Set(sections.map((s) => s.department))],
      levelTerms: [...new Set(sections.filter((s) => !filter.department || s.department === filter.department).map((s) => s.level_term))].sort(),
      sections: [...new Set(sections.filter((s) => (!filter.department || s.department === filter.department) && (!filter.level_term || s.level_term === filter.level_term)).map((s) => s.section))].sort(),
    }),
    [sections, filter.department, filter.level_term]
  );

  const visibleClasses = useMemo(() => {
    const dayIndex = (d) => days.indexOf(d);
    const timeIndex = (t) => times.indexOf(Number(t));
    const course = filter.course.trim().toUpperCase().replace(/\s+/g, "");
    return classes
      .filter(
        (c) =>
          (!filter.department || c.department === filter.department) &&
          (!filter.level_term || c.level_term === filter.level_term) &&
          (!filter.section || c.section === filter.section || c.label.split("/").includes(filter.section)) &&
          (!course || c.course_id.toUpperCase().includes(course)) &&
          (!filter.moved || c.room_no !== c.section_room)
      )
      .sort(
        (a, b) =>
          (a.department === "CSE" ? 0 : 1) - (b.department === "CSE" ? 0 : 1) ||
          a.department.localeCompare(b.department) ||
          a.level_term.localeCompare(b.level_term) ||
          a.label.localeCompare(b.label) ||
          dayIndex(a.day) - dayIndex(b.day) ||
          timeIndex(a.time) - timeIndex(b.time) ||
          a.course_id.localeCompare(b.course_id)
      );
  }, [classes, filter, days, times]);

  const visibleSections = sections.filter(
    (s) =>
      (!filter.department || s.department === filter.department) &&
      (!filter.level_term || s.level_term === filter.level_term) &&
      (!filter.section || s.section === filter.section)
  );
  const setF = (patch) => setFilter((f) => ({ ...f, ...patch }));
  const moved = classes.filter((c) => c.room_no !== c.section_room).length;

  return (
    <div>
      <div className="page-header">
        <h3 className="page-title">
          <div className="page-title-icon-container mdi mdi-door"></div>
          Theory Room Assignment
        </h3>
      </div>

      <div className="card mb-4">
        <div className="card-view">
          <div className="card-toolbar">
            <div className="card-toolbar-field">
              <label className="card-toolbar-label">Department</label>
              <Form.Select className="form-select" value={filter.department} onChange={(e) => setF({ department: e.target.value, level_term: "", section: "" })}>
                <option value="">All</option>
                {options.departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </Form.Select>
            </div>
            <div className="card-toolbar-field">
              <label className="card-toolbar-label">Level-Term</label>
              <Form.Select className="form-select" value={filter.level_term} onChange={(e) => setF({ level_term: e.target.value, section: "" })}>
                <option value="">All</option>
                {options.levelTerms.map((lt) => (
                  <option key={lt} value={lt}>{lt}</option>
                ))}
              </Form.Select>
            </div>
            <div className="card-toolbar-field">
              <label className="card-toolbar-label">Section</label>
              <Form.Select className="form-select" value={filter.section} onChange={(e) => setF({ section: e.target.value })}>
                <option value="">All</option>
                {options.sections.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Form.Select>
            </div>
            <div className="card-toolbar-field grow">
              <label className="card-toolbar-label">Course</label>
              <div className="card-search-box">
                <i className="mdi mdi-magnify"></i>
                <input type="text" placeholder="e.g. CSE401" value={filter.course} onChange={(e) => setF({ course: e.target.value })} />
              </div>
            </div>
            <div className="card-toolbar-field">
              <label className="card-toolbar-label">&nbsp;</label>
              <Form.Check
                type="switch"
                id="moved-only"
                label={`Moved classes only (${moved})`}
                checked={filter.moved}
                onChange={(e) => setF({ moved: e.target.checked })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-view">
          <div className="card-control-container">
            <h4 className="card-name">
              <div className="card-icon mdi mdi-door"></div>
              Section Rooms
            </h4>
          </div>
          <div className="field-hint mb-3">
            A section's classes take its room. Changing it moves every class that was in the old room; classes moved
            elsewhere on their own keep their rooms.
          </div>
          <div className="card-table-container table-responsive">
            {sections.length === 0 ? (
              <div className="empty-state">
                <i className="mdi mdi-book-off-outline"></i>
                <div className="empty-state-title">Routine not initialized</div>
                <div className="empty-state-hint">Initialize the level-terms to assign rooms to sections.</div>
              </div>
            ) : (
              <table className="card-table table">
                <thead className="card-table-header">
                  <tr>
                    <th><i className="mdi mdi-domain"></i>Department</th>
                    <th><i className="mdi mdi-school"></i>Level-Term</th>
                    <th><i className="mdi mdi-account-group"></i>Section</th>
                    <th><i className="mdi mdi-door"></i>Room</th>
                    <th><i className="mdi mdi-counter"></i>Classes</th>
                  </tr>
                </thead>
                <tbody className="card-table-body">
                  {visibleSections.map((s) => {
                    const key = `section|${s.department}|${s.level_term}|${s.section}`;
                    const own = classes.filter((c) => c.department === s.department && c.batch === s.batch && c.section === s.section);
                    const away = own.filter((c) => c.room_no !== s.room_no).length;
                    return (
                      <tr key={key}>
                        <td style={{ textAlign: "center" }}>{s.department}</td>
                        <td style={{ textAlign: "center" }}>{s.level_term}</td>
                        <td style={{ textAlign: "center", fontWeight: 600 }}>{s.section}</td>
                        <td style={{ maxWidth: "220px" }}>
                          <RoomSelect value={s.room_no} rooms={rooms} disabled={saving === key} onChange={(room) => saveSectionRoom(s, room)} />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {own.length}
                          {away > 0 && <span className="pill optional ms-2">{away} elsewhere</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-view">
          <div className="card-control-container">
            <h4 className="card-name">
              <div className="card-icon mdi mdi-book-open-page-variant"></div>
              Class Rooms
            </h4>
            {clashes.size > 0 && <span className="pill optional">{clashes.size} room clash{clashes.size > 1 ? "es" : ""}</span>}
          </div>
          <div className="field-hint mb-3">
            Each theory class, day by day. Pick another room for a class held away from its section's room; an elective
            every section takes (A/B/C) moves for all of them.
          </div>
          <div className="card-table-container table-responsive">
            {visibleClasses.length === 0 ? (
              <div className="empty-state">
                <i className="mdi mdi-book-search-outline"></i>
                <div className="empty-state-title">{classes.length === 0 ? "No theory classes scheduled yet" : "No classes match the filters"}</div>
              </div>
            ) : (
              <table className="card-table table">
                <thead className="card-table-header">
                  <tr>
                    <th><i className="mdi mdi-book-open-page-variant"></i>Course</th>
                    <th><i className="mdi mdi-school"></i>Level-Term</th>
                    <th><i className="mdi mdi-account-group"></i>Section</th>
                    <th><i className="mdi mdi-calendar"></i>Day</th>
                    <th><i className="mdi mdi-clock-outline"></i>Time</th>
                    <th><i className="mdi mdi-door"></i>Room</th>
                  </tr>
                </thead>
                <tbody className="card-table-body">
                  {visibleClasses.map((c) => {
                    const key = `class|${c.course_id}|${c.department}|${c.section}|${c.day}|${c.time}`;
                    const clash = c.room_no ? clashes.get(`${c.room_no}|${c.day}|${c.time}`) : null;
                    return (
                      <tr key={key}>
                        <td style={{ textAlign: "center", fontWeight: 600 }}>{c.course_id}</td>
                        <td style={{ textAlign: "center" }}>
                          {c.level_term}
                          {c.department !== "CSE" ? ` (${c.department})` : ""}
                        </td>
                        <td style={{ textAlign: "center" }}>{c.label}</td>
                        <td style={{ textAlign: "center" }}>{c.day}</td>
                        <td style={{ textAlign: "center" }}>{c.time}:00</td>
                        <td style={{ maxWidth: "260px" }}>
                          <div className="d-flex align-items-center" style={{ gap: "8px" }}>
                            <RoomSelect value={c.room_no} rooms={rooms} disabled={saving === key} onChange={(room) => saveClassRoom(c, room)} />
                            {c.room_no !== c.section_room && (
                              <span className="pill purple" title={`Section room: ${c.section_room || "none"}`}>moved</span>
                            )}
                            {clash && (
                              <span className="pill optional" title={`Also here: ${clash.join(", ")}`}>clash</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
