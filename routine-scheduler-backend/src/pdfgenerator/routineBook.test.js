import assert from "node:assert/strict";
import test from "node:test";
import { courseTables } from "./routineBook.js";

const cls = (course_id, label, day, start, extra = {}) => ({
  course_id, courseName: `${course_id} name`, department: "CSE", batch: 23, label,
  levelTerm: "L-2 T-2", day, start, span: 1, type: 0, room: "203", teachers: "[ KRV ]", ...extra,
});

test("a course routine has one table per course, CSE's own level-terms before other departments'", () => {
  const data = {
    classes: [
      cls("CSE272", "A1", "Sunday", 0, { department: "URP", type: 1, span: 3 }),
      cls("CSE210", "B", "Monday", 2),
      cls("CSE106", "A1", "Sunday", 3, { levelTerm: "L-1 T-2", type: 1, span: 3 }),
      cls("CSE210", "A", "Sunday", 1),
      cls("CT", "A", "Tuesday", 0),
      cls("CSE400", "A", "Tuesday", 4, { type: 2 }),
    ],
  };
  const tables = courseTables(data);
  assert.deepEqual(tables.map((t) => t.title), [
    "CSE106: CSE106 name (L-I T-II)",
    "CSE210: CSE210 name (L-II T-II)",
    "CSE272: CSE272 name (URP L-II T-II)",
  ]);
  assert.deepEqual(tables[1].items, [
    { day: "Monday", start: 2, span: 1, lines: ["Sec B", "203", "[ KRV ]"] },
    { day: "Sunday", start: 1, span: 1, lines: ["Sec A", "203", "[ KRV ]"] },
  ]);
  assert.deepEqual(courseTables(data, { course: "CSE210" }).map((t) => t.title), ["CSE210: CSE210 name (L-II T-II)"]);
});

test("an elective every section takes is one class in its course routine", () => {
  const data = { classes: ["A", "B", "C"].map(() => cls("CSE405", "A/B/C", "Sunday", 1)) };
  assert.deepEqual(courseTables(data)[0].items.map((it) => it.lines[0]), ["Sec A/B/C"]);
});
