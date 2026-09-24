import { useMemo, useState } from "react";

const VIEWS = [
  { value: "rooms", label: "Rooms" },
  { value: "roomCourses", label: "Courses in rooms" },
  { value: "classes", label: "Classes" },
  { value: "levelTerms", label: "Level-terms" },
];

const sectionLabel = (s) =>
  s.section_label ||
  (Number(s.class_per_week) === 0.75 ? `${s.section}1/${s.section}2` : s.section);
const classLabel = (s) => `${s.course_id}(${sectionLabel(s)})`;
const byCourse = (a, b) =>
  a.course_id.localeCompare(b.course_id) || a.section.localeCompare(b.section);

/**
 * How the lab rooms are used in the current sessional distribution: classes
 * per lab, which classes each lab holds, each class's room, and the labs each
 * level-term uses. Rooms are set on the grid or by the scheduler.
 */
export default function LabRoomStats({ schedules, labRooms }) {
  const [view, setView] = useState("rooms");

  const { perRoom, perLevel, unassigned } = useMemo(() => {
    const perRoom = new Map(labRooms.map((r) => [r, []]));
    const perLevel = new Map();
    let unassigned = 0;
    for (const s of schedules) {
      if (!s.room_no) {
        unassigned++;
      } else {
        if (!perRoom.has(s.room_no)) perRoom.set(s.room_no, []);
        perRoom.get(s.room_no).push(s);
      }
      const lt = s.level_term || "Unknown";
      if (!perLevel.has(lt)) perLevel.set(lt, new Set());
      if (s.room_no) perLevel.get(lt).add(s.room_no);
    }
    return { perRoom, perLevel, unassigned };
  }, [schedules, labRooms]);

  const roomsInUse = [...perRoom.values()].filter((list) => list.length > 0).length;

  return (
    <div className="card mb-4">
      <div className="card-view">
        <div className="card-control-container">
          <h4 className="card-name">
            <div className="card-icon mdi mdi-door"></div>
            Lab Room Statistics
          </h4>
          <div className="segmented-toggle">
            {VIEWS.map((v) => (
              <button
                key={v.value}
                className={view === v.value ? "active" : ""}
                onClick={() => setView(v.value)}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field-hint mb-3">
          {roomsInUse} of {labRooms.length} labs in use · {schedules.length} classes
          {unassigned > 0 ? ` · ${unassigned} without a room` : ""}
        </div>

        <div className="card-table-container table-responsive">
          {view === "rooms" && (
            <table className="card-table table">
              <thead className="card-table-header">
                <tr>
                  <th><i className="mdi mdi-door"></i>Lab Room</th>
                  <th><i className="mdi mdi-counter"></i>Classes</th>
                </tr>
              </thead>
              <tbody className="card-table-body">
                {[...perRoom].map(([room, list]) => (
                  <tr key={room}>
                    <td style={{ textAlign: "center", fontWeight: 600 }}>{room}</td>
                    <td style={{ textAlign: "center" }}>
                      <span className={`pill ${list.length ? "purple" : "muted"}`}>
                        {list.length} {list.length === 1 ? "class" : "classes"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {view === "roomCourses" && (
            <table className="card-table table">
              <thead className="card-table-header">
                <tr>
                  <th><i className="mdi mdi-door"></i>Lab Room</th>
                  <th><i className="mdi mdi-book-open-variant"></i>Classes</th>
                </tr>
              </thead>
              <tbody className="card-table-body">
                {[...perRoom].map(([room, list]) => (
                  <tr key={room}>
                    <td style={{ textAlign: "center", fontWeight: 600 }}>{room}</td>
                    <td>
                      {list.length === 0 ? (
                        <span className="field-hint">No classes</span>
                      ) : (
                        <div className="chip-row" style={{ gap: "6px" }}>
                          {[...list].sort(byCourse).map((s) => (
                            <span
                              key={`${s.course_id}-${s.department}-${s.batch}-${s.section}`}
                              className="pill purple"
                              title={`${s.day} ${s.time}:00`}
                            >
                              {classLabel(s)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {view === "classes" && (
            <table className="card-table table">
              <thead className="card-table-header">
                <tr>
                  <th><i className="mdi mdi-notebook"></i>Course</th>
                  <th><i className="mdi mdi-book-open-page-variant"></i>Name</th>
                  <th><i className="mdi mdi-school"></i>Level-Term</th>
                  <th><i className="mdi mdi-account-group"></i>Section</th>
                  <th><i className="mdi mdi-clock-outline"></i>When</th>
                  <th><i className="mdi mdi-door"></i>Room</th>
                </tr>
              </thead>
              <tbody className="card-table-body">
                {[...schedules].sort(byCourse).map((s) => (
                  <tr key={`${s.course_id}-${s.department}-${s.batch}-${s.section}`}>
                    <td style={{ textAlign: "center", fontWeight: 600 }}>{s.course_id}</td>
                    <td>{s.name}</td>
                    <td style={{ textAlign: "center" }}>
                      {s.level_term}
                      {s.department !== "CSE" ? ` (${s.department})` : ""}
                    </td>
                    <td style={{ textAlign: "center" }}>{sectionLabel(s)}</td>
                    <td style={{ textAlign: "center" }}>
                      {s.day} {s.time}:00
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {s.room_no ? (
                        <span className="pill purple">{s.room_no}</span>
                      ) : (
                        <span className="pill optional">No room</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {view === "levelTerms" && (
            <table className="card-table table">
              <thead className="card-table-header">
                <tr>
                  <th><i className="mdi mdi-school"></i>Level-Term</th>
                  <th><i className="mdi mdi-door"></i>Labs Used</th>
                </tr>
              </thead>
              <tbody className="card-table-body">
                {[...perLevel]
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([lt, rooms]) => (
                    <tr key={lt}>
                      <td style={{ textAlign: "center", fontWeight: 600 }}>{lt}</td>
                      <td>
                        {rooms.size === 0 ? (
                          <span className="field-hint">No rooms assigned</span>
                        ) : (
                          <div className="chip-row" style={{ gap: "6px" }}>
                            {[...rooms].sort().map((r) => (
                              <span key={r} className="pill purple">{r}</span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
