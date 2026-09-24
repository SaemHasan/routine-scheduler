const idsOfType = (cell, type) => (cell?.course_ids || []).filter((id) =>
  Number(cell?.course_types?.[id]) === type);

const cellAt = (cells, day, time) => cells[`${day} ${time}`];

// Thesis is stored as one CSE400 row per period, while a lab is stored only
// at its starting period. Return the visual block covering a grid cell.
export function getTheoryRoutineBlock(cells, times, day, time) {
  const index = times.indexOf(time);
  if (index < 0) return { isDisabled: false };

  const thesis = idsOfType(cellAt(cells, day, time), 2)[0];
  if (thesis) {
    let first = index;
    let last = index;
    while (first > 0 && idsOfType(cellAt(cells, day, times[first - 1]), 2).includes(thesis)) first--;
    while (last + 1 < times.length && idsOfType(cellAt(cells, day, times[last + 1]), 2).includes(thesis)) last++;
    return {
      isDisabled: true, isStart: first === index, span: last - first + 1,
      kind: "thesis", label: thesis,
    };
  }

  for (let start = Math.max(0, index - 2); start <= index; start++) {
    const cell = cellAt(cells, day, times[start]);
    const labs = idsOfType(cell, 1);
    if (labs.length && index < start + 3) {
      return {
        isDisabled: true, isStart: start === index,
        span: Math.min(3, times.length - start), kind: "lab",
        sessionalAssignment: labs.map((id) => cell.course_labels?.[id] || id),
      };
    }
  }
  return { isDisabled: false };
}
