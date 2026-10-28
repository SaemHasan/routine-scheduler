import assert from "node:assert/strict";
import test from "node:test";
import { buildClasses, courseTables, departmentTables, layoutTable, paginate } from "./routineBook.js";

const cls = (course_id, label, day, start, extra = {}) => ({
  course_id, code: course_id, courseName: `${course_id} name`, department: "CSE", batch: 23, label,
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

test("an elective not activated yet is named by its slot, without its course name", () => {
  const sections = ["A", "B", "C"].map((section) => ({ department: "CSE", batch: 21, section, type: 0 }));
  const rows = ["A", "B", "C"].map((section) => ({
    course_id: "CSE461", course_name: "Machine Learning", type: 0, optional: 1, optional_section_count: 1,
    department: "CSE", batch: 21, section, day: "Sunday", time: 9, level_term: "L-4 T-1",
    teachers: ["KRV"], room_no: "R1", from: "CSE", to: "CSE",
  }));
  const times = [8, 9, 10, 11, 12, 1, 2, 3, 4];
  const hidden = buildClasses(rows, [], sections, times, { CSE461: "Option 1X" });
  assert.deepEqual([...new Set(hidden.map((c) => `${c.code}|${c.courseName}|${c.label}`))], ["Option 1X||A/B/C"]);
  const tables = courseTables({ classes: hidden });
  assert.deepEqual(tables.map((t) => t.title), ["Option 1X (L-IV T-I)"]);
  assert.deepEqual(tables[0].items.map((it) => it.lines), [["Sec A/B/C", "R1", "[ KRV ]"]]);
  // Activated, the course is itself again
  const shown = buildClasses(rows, [], sections, times, {});
  assert.deepEqual(courseTables({ classes: shown }).map((t) => t.title), ["CSE461: Machine Learning (L-IV T-I)"]);
});

test("each department's routines start on a page of their own", () => {
  const data = {
    days: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"],
    times: [8, 9, 10, 11, 12, 1, 2, 3, 4],
    classes: [
      cls("MATH241", "A", "Sunday", 1, { from: "MATH", to: "CSE" }),
      cls("MATH243", "A", "Monday", 1, { from: "MATH", to: "CSE" }),
      cls("HUM429", "A", "Monday", 2, { from: "HUM", to: "CSE" }),
      cls("CSE281", "A", "Tuesday", 1, { from: "CSE", to: "ME", department: "ME" }),
    ],
  };
  const tables = departmentTables(data).map((t) => layoutTable(t, data));
  const groupsPerPage = (pages) => pages.map((page) => [...new Set(page.map((t) => t.group))]);
  // Short enough to share a page, they do not
  assert.ok(groupsPerPage(paginate(tables, {})).some((groups) => groups.length > 1));
  assert.deepEqual(groupsPerPage(paginate(tables, { breakOnGroup: true })), [["HUM"], ["MATH"], ["ME"]]);
});
