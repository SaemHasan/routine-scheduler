import { getTheoryRoutineBlock } from "./theoryRoutineBlocks";

const times = [8, 9, 10, 11, 12, 1, 2, 3, 4];

test("CSE400's six scheduled periods render as one thesis block", () => {
  const cells = {};
  [11, 12, 1, 2, 3, 4].forEach((time) => {
    cells[`Tuesday ${time}`] = {
      course_ids: ["CSE400"], course_types: { CSE400: 2 },
    };
  });

  expect(getTheoryRoutineBlock(cells, times, "Tuesday", 11)).toMatchObject({
    kind: "thesis", label: "CSE400", isStart: true, span: 6,
  });
  expect(getTheoryRoutineBlock(cells, times, "Tuesday", 4)).toMatchObject({
    kind: "thesis", isStart: false, span: 6,
  });
});

test("parallel optional labs remain visible in one three-hour block", () => {
  const cells = {
    "Sunday 11": {
      course_ids: ["CSE402", "CSE404"],
      course_types: { CSE402: 1, CSE404: 1 },
      course_labels: { CSE402: "CSE402 (all sections)" },
    },
  };

  expect(getTheoryRoutineBlock(cells, times, "Sunday", 11)).toMatchObject({
    kind: "lab", isStart: true, span: 3,
    sessionalAssignment: ["CSE402 (all sections)", "CSE404"],
  });
  expect(getTheoryRoutineBlock(cells, times, "Sunday", 1)).toMatchObject({
    kind: "lab", isStart: false, span: 3,
  });
});
