/**
 * SQL for the room a class is held in. A theory class with no room of its
 * own is in its section's room (CT has none; an elective every section takes
 * together needs its own). `sa`, `c` and `s` alias schedule_assignment,
 * courses and the class's sections row.
 */
export const effectiveRoomSQL = (sa = "sa", c = "c", s = "s") => `CASE
    WHEN ${sa}.room_no IS NULL AND ${c}.type = 0 AND ${sa}.course_id <> 'CT'
     AND NOT (${c}.optional = 1 AND ${c}.optional_section_count <= 1)
    THEN ${s}.room ELSE ${sa}.room_no END`;

// Room use of scheduled classes. Rows are schedule_assignment rows with
// the course's `type` and `shared` (an elective every section takes as one
// class, stored in each section).

export const hoursOf = (times, type, start) => {
  const i = times.indexOf(Number(start));
  return Number(type) === 1 && i >= 0 ? times.slice(i, i + 3) : [Number(start)];
};

// One class, whichever section's copy the row is
export const classKey = (r) =>
  [r.course_id, r.department, r.batch, r.shared ? "*" : r.section, r.day, Number(r.time)].join("|");

const labelOf = (r) =>
  `${r.course_id} (${r.department === "CSE" ? "" : `${r.department} `}${r.shared ? "all sections" : r.section})`;

/**
 * Other classes in `room` on `day` during `time`, as readable labels.
 * `self` is the class whose room is being checked; its own rows are ignored.
 */
export function roomOccupants(rows, times, { room, day, time }, self = null) {
  if (!room) return [];
  const own = self ? classKey(self) : null;
  const labels = new Set();
  for (const r of rows) {
    if (r.room_no !== room || r.day !== day) continue;
    if (own && classKey(r) === own) continue;
    if (!hoursOf(times, r.type, r.time).includes(Number(time))) continue;
    labels.add(labelOf(r));
  }
  return [...labels];
}
