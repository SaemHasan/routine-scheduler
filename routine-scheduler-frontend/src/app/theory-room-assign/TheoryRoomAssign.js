import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Modal } from "react-bootstrap";
import { toast } from "react-hot-toast";
import {
  getAllTheoryRoomAssignment,
  updateTheoryRoomAssignment,
  getAllSectionRoomAllocation,
  updateSectionRoomAllocation,
  moveTheoryClass,
} from "../api/theory-room-assign";
import { getRooms } from "../api/db-crud";
import { useConfig } from "../shared/ConfigContext";
import RoomSelect, { byRoom } from "./RoomSelect";

const messageOf = (error, fallback) => error?.response?.data?.error?.message || fallback;

const EMPTY_FILTER = {
  department: "", level_term: "", section: "", course: "", day: "", time: "", room: "", status: "",
};

// A class is "moved" when it is away from its section's room; electives every
// section takes together have no section room of their own.
const isMoved = (c) => !c.elective && Boolean(c.room_no) && c.room_no !== c.section_room;

const clashWarning = (clashes) => clashes?.length &&
  toast(`Room also used then by ${clashes.join(", ")}`, { icon: "⚠️", duration: 6000 });

/** Moves a class to another day and time, keeping the generator's rules. */
function MoveClassModal({ cls, rooms, onHide, onMoved }) {
  const { days, times } = useConfig();
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!cls) return;
    setDay(cls.day);
    setTime(String(cls.time));
    setRoom(cls.room_from_section ? null : cls.room_no);
    setError("");
  }, [cls]);

  if (!cls) return null;
  const unchanged = day === cls.day && Number(time) === Number(cls.time);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await moveTheoryClass({
        course_id: cls.course_id, department: cls.department, batch: cls.batch, section: cls.section,
        day: cls.day, time: cls.time, new_day: day, new_time: Number(time), room_no: room,
      });
      toast.success(`${cls.course_id} (${cls.label}) moved to ${day} ${time}:00${result.room ? ` in ${result.room}` : ""}`);
      clashWarning(result.clashes);
      onMoved();
      onHide();
    } catch (e) {
      setError(messageOf(e, "Failed to move the class"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title style={{ fontWeight: 700 }}>
          Move {cls.course_id} ({cls.label})
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted small">
          Now on {cls.day} at {cls.time}:00{cls.room_no ? ` in ${cls.room_no}` : ""}. The move is checked for
          section and teacher clashes, a second class of the course that day, 1 PM and the common CT slots.
          A moved class is kept in place by the theory generator.
        </p>
        <div className="row g-2">
          <div className="col-5">
            <Form.Label className="small" style={{ fontWeight: 600 }}>Day</Form.Label>
            <Form.Select value={day} onChange={(e) => setDay(e.target.value)}>
              {days.map((d) => <option key={d} value={d}>{d}</option>)}
            </Form.Select>
          </div>
          <div className="col-3">
            <Form.Label className="small" style={{ fontWeight: 600 }}>Time</Form.Label>
            <Form.Select value={time} onChange={(e) => setTime(e.target.value)}>
              {times.filter((t) => Number(t) !== 1).map((t) => <option key={t} value={t}>{t}:00</option>)}
            </Form.Select>
          </div>
          <div className="col-4">
            <Form.Label className="small" style={{ fontWeight: 600 }}>Room</Form.Label>
            <RoomSelect value={room} rooms={rooms} onChange={setRoom} style={{ minWidth: 0 }}
              placeholder={!cls.elective && cls.section_room ? `Section room (${cls.section_room})` : "No room"} />
          </div>
        </div>
        {error && <Alert variant="danger" className="mt-3 mb-0 small">{error}</Alert>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="light" onClick={onHide}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={saving || unchanged}>
          {saving ? "Moving..." : "Move class"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

/**
 * Theory rooms: each section gets its usual room, which its classes take;
 * then any class can be moved to another room, or another day and time.
 */
export default function TheoryRoomAssign() {
  const { days, times } = useConfig();
  const [sections, setSections] = useState([]);
  const [classes, setClasses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [saving, setSaving] = useState("");
  const [moving, setMoving] = useState(null);
  const [filter, setFilter] = useState(EMPTY_FILTER);

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
      const result = await updateSectionRoomAllocation({ ...section, room_no });
      toast.success(
        `${section.department} ${section.level_term} (${section.section}) now in ${room_no || "no room"}` +
          (result.classes ? `; ${result.classes} class${result.classes === 1 ? "" : "es"} moved with it` : "")
      );
      await load();
    } catch (e) {
      toast.error(messageOf(e, "Failed to update the section's room"));
    } finally {
      setSaving("");
    }
  };

  const saveClassRoom = async (c, room_no) => {
    const key = `class|${c.course_id}|${c.department}|${c.section}|${c.day}|${c.time}`;
    setSaving(key);
    try {
      const result = await updateTheoryRoomAssignment({
        course_id: c.course_id, department: c.department, batch: c.batch,
        section: c.section, day: c.day, time: c.time, room_no,
      });
      const held = room_no || (!c.elective && c.section_room) || null;
      toast.success(`${c.course_id} (${c.label}) on ${c.day} ${c.time}:00 now in ${held ? `${held}${room_no ? "" : " (section room)"}` : "no room"}`);
      clashWarning(result.clashes);
      await load();
    } catch (e) {
      toast.error(messageOf(e, "Failed to update the room"));
    } finally {
      setSaving("");
    }
  };

  const options = useMemo(() => {
    const inDept = (s) => !filter.department || s.department === filter.department;
    return {
      departments: [...new Set(sections.map((s) => s.department))],
      levelTerms: [...new Set(sections.filter(inDept).map((s) => s.level_term))].sort(),
      sections: [...new Set(sections.filter((s) => inDept(s) &&
        (!filter.level_term || s.level_term === filter.level_term)).map((s) => s.section))].sort(),
      rooms: [...new Set(classes.map((c) => c.room_no).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    };
  }, [sections, classes, filter.department, filter.level_term]);

  const counts = useMemo(() => ({
    moved: classes.filter(isMoved).length,
    noRoom: classes.filter((c) => !c.room_no).length,
    clash: classes.filter((c) => c.clash?.length).length,
  }), [classes]);

  const visibleClasses = useMemo(() => {
    const dayIndex = (d) => days.indexOf(d);
    const timeIndex = (t) => times.indexOf(Number(t));
    const course = filter.course.trim().toUpperCase().replace(/\s+/g, "");
    const status = {
      moved: isMoved,
      "no-room": (c) => !c.room_no,
      clash: (c) => c.clash?.length > 0,
    }[filter.status];
    return classes
      .filter(
        (c) =>
          (!filter.department || c.department === filter.department) &&
          (!filter.level_term || c.level_term === filter.level_term) &&
          (!filter.section || c.section === filter.section || c.label.split("/").includes(filter.section)) &&
          (!course || c.course_id.toUpperCase().includes(course)) &&
          (!filter.day || c.day === filter.day) &&
          (!filter.time || Number(c.time) === Number(filter.time)) &&
          (!filter.room || c.room_no === filter.room) &&
          (!status || status(c))
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
  const filtered = Object.values(filter).some(Boolean);

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
                {options.departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </Form.Select>
            </div>
            <div className="card-toolbar-field">
              <label className="card-toolbar-label">Level-Term</label>
              <Form.Select className="form-select" value={filter.level_term} onChange={(e) => setF({ level_term: e.target.value, section: "" })}>
                <option value="">All</option>
                {options.levelTerms.map((lt) => <option key={lt} value={lt}>{lt}</option>)}
              </Form.Select>
            </div>
            <div className="card-toolbar-field">
              <label className="card-toolbar-label">Section</label>
              <Form.Select className="form-select" value={filter.section} onChange={(e) => setF({ section: e.target.value })}>
                <option value="">All</option>
                {options.sections.map((s) => <option key={s} value={s}>{s}</option>)}
              </Form.Select>
            </div>
            <div className="card-toolbar-field grow">
              <label className="card-toolbar-label">Course</label>
              <div className="card-search-box">
                <i className="mdi mdi-magnify"></i>
                <input type="text" placeholder="e.g. CSE401" value={filter.course} onChange={(e) => setF({ course: e.target.value })} />
              </div>
            </div>
          </div>
          <div className="card-toolbar">
            <div className="card-toolbar-field">
              <label className="card-toolbar-label">Day</label>
              <Form.Select className="form-select" value={filter.day} onChange={(e) => setF({ day: e.target.value })}>
                <option value="">All</option>
                {days.map((d) => <option key={d} value={d}>{d}</option>)}
              </Form.Select>
            </div>
            <div className="card-toolbar-field">
              <label className="card-toolbar-label">Time</label>
              <Form.Select className="form-select" value={filter.time} onChange={(e) => setF({ time: e.target.value })}>
                <option value="">All</option>
                {times.filter((t) => Number(t) !== 1).map((t) => <option key={t} value={t}>{t}:00</option>)}
              </Form.Select>
            </div>
            <div className="card-toolbar-field">
              <label className="card-toolbar-label">Room</label>
              <Form.Select className="form-select" value={filter.room} onChange={(e) => setF({ room: e.target.value })}>
                <option value="">All</option>
                {options.rooms.map((r) => <option key={r} value={r}>{r}</option>)}
              </Form.Select>
            </div>
            <div className="card-toolbar-field">
              <label className="card-toolbar-label">Status</label>
              <Form.Select className="form-select" value={filter.status} onChange={(e) => setF({ status: e.target.value })}>
                <option value="">All classes</option>
                <option value="moved">Away from section room ({counts.moved})</option>
                <option value="no-room">Without a room ({counts.noRoom})</option>
                <option value="clash">Room clashes ({counts.clash})</option>
              </Form.Select>
            </div>
            <div className="card-toolbar-field">
              <label className="card-toolbar-label">&nbsp;</label>
              <Button variant="light" disabled={!filtered} onClick={() => setFilter(EMPTY_FILTER)}>
                <i className="mdi mdi-filter-remove-outline me-1"></i>Clear filters
              </Button>
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
            A section's room is the default room of all its theory classes, every day. Changing it moves every
            class held there; classes moved elsewhere on their own keep their rooms. Electives every section takes
            together (A/B/C) get their rooms below.
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
                    const own = classes.filter((c) => c.department === s.department && c.batch === s.batch && c.section === s.section && !c.elective);
                    const away = own.filter((c) => c.room_no && c.room_no !== s.room_no).length;
                    const none = own.filter((c) => !c.room_no).length;
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
                          {away > 0 && <span className="pill purple ms-2">{away} elsewhere</span>}
                          {none > 0 && <span className="pill optional ms-2">{none} without room</span>}
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
            <span className="text-muted small">
              Showing {visibleClasses.length} of {classes.length}
              {counts.clash > 0 && (
                <button type="button" className="pill optional ms-2" style={{ border: "none", cursor: "pointer" }}
                  onClick={() => setF({ status: "clash" })}>
                  {counts.clash} room clash{counts.clash > 1 ? "es" : ""}
                </button>
              )}
            </span>
          </div>
          <div className="field-hint mb-3">
            Each theory class, day by day. Pick another room for a class held away from its section's room (e.g.
            Tuesday 8:00 in 203 instead of 103), or move it to another day and time. An elective every section takes
            (A/B/C) changes for all of them. Rooms can also be changed from the theory schedule.
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
                    <th></th>
                  </tr>
                </thead>
                <tbody className="card-table-body">
                  {visibleClasses.map((c) => {
                    const key = `class|${c.course_id}|${c.department}|${c.section}|${c.day}|${c.time}`;
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
                        <td style={{ maxWidth: "280px" }}>
                          <div className="d-flex align-items-center" style={{ gap: "8px" }}>
                            <RoomSelect value={c.room_from_section ? null : c.room_no} rooms={rooms} disabled={saving === key}
                              placeholder={!c.elective && c.section_room ? `Section room (${c.section_room})` : "No room"}
                              onChange={(room) => saveClassRoom(c, room)} />
                            {isMoved(c) && (
                              <span className="pill purple" title={`Section room: ${c.section_room || "none"}`}>moved</span>
                            )}
                            {c.clash?.length > 0 && (
                              <span className="pill optional" title={`Also here: ${c.clash.join(", ")}`}>clash</span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <Button variant="outline-primary" size="sm" title="Move to another day and time" onClick={() => setMoving(c)}>
                            <i className="mdi mdi-calendar-arrow-right"></i> Move
                          </Button>
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
      <MoveClassModal cls={moving} rooms={rooms} onHide={() => setMoving(null)} onMoved={load} />
    </div>
  );
}
