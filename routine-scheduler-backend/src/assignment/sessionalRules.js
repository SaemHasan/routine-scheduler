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
