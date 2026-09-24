// A share changes the teaching load, not the lab's scheduled duration.
// Half-slot teachers may overlap theory; all lab shares may overlap thesis.
// Separate labs still cannot overlap for the same teacher.
export function findSessionalConflict({ targets, theory, labs, share, times }) {
  const periods = (time) => {
    const index = times.indexOf(Number(time));
    return index < 0 ? [] : times.slice(index, index + 3);
  };
  for (const target of targets) {
    const hours = periods(target.time);
    const lab = labs.find((row) => row.day === target.day &&
      periods(row.time).some((hour) => hours.includes(hour)));
    if (lab) return `Already assigned to ${lab.course_id} (${lab.section}) on ${target.day} at ${lab.time}:00`;
    if (Number(share) !== 0.5) {
      const meeting = theory.find((row) => row.day === target.day && hours.includes(Number(row.time)));
      if (meeting) return `Theory class ${meeting.course_id} overlaps on ${target.day} at ${meeting.time}:00. Choose a half slot to allow this overlap.`;
    }
  }
  return null;
}

const slotText = (n) => (n === 0.5 ? "half a slot" : `${n} slot${n === 1 ? "" : "s"}`);

// A lab section takes as many teachers as its sessional type says (e.g. 3 for
// Departmental Software); two half-slot teachers fill one slot. `filled` is
// the slots other teachers already hold.
export function sessionalCapacityError({ course_id, section, capacity, filled, share }) {
  if (!capacity || Number(filled) + Number(share) <= Number(capacity)) return null;
  const label = `${course_id} (${section})`;
  const left = Number(capacity) - Number(filled);
  if (left <= 0) {
    return `${label} takes ${capacity} teacher${capacity === 1 ? "" : "s"} and all ${capacity} slots are filled; remove a teacher first`;
  }
  return `${label} takes ${capacity} teachers and has only ${slotText(left)} left; assign a half slot`;
}
