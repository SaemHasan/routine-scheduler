import assert from "node:assert/strict";
import test from "node:test";
import {
  solveTheory, theoryCTSlotRequirement, theoryCTSlots,
  theoryPreferenceWarnings, validateTheoryAssignments,
} from "./algorithm.js";

const days = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"];
const times = [8, 9, 10, 11, 12, 1, 2, 3, 4];
const slots = days.flatMap((day) =>
  times.filter((time) => time !== 1).map((time) => ({ day, time })));
const sections = ["CSE|25|A", "CSE|25|B", "CSE|25|C"];

function problem(units, fixed = []) {
  const courseIds = [...new Set(units.map((u) => u.course_id))];
  return {
    days, times, slots, sections, fixed, units, courseIds,
    sectionsForCourse: Object.fromEntries(courseIds.map((course) => [
      course, [...new Set(units.filter((u) => u.course_id === course)
        .flatMap((u) => u.sections))],
    ])),
  };
}

const unit = (key, course, section, teacher) => ({
  key, course_id: course, sections: [section], teachers: [teacher],
  optional: false, option_group: null,
});

test("hard rules reject 1 PM, same-course same-day and a three-period lab overlap", () => {
  const lab = {
    course_id: "CSE102", sections: [sections[0]], teachers: ["T2"],
    day: "Saturday", time: 11, hours: [11, 12, 1],
    optional: false, option_group: null,
  };
  const p = problem([
    unit("one", "CSE101", sections[0], "T1"),
    unit("two", "CSE101", sections[0], "T1"),
  ], [lab]);
  assert.ok(validateTheoryAssignments(p, [
    { key: "one", day: "Saturday", time: 1 },
    { key: "two", day: "Sunday", time: 9 },
  ]).some((x) => x.includes("not an available")));
  assert.ok(validateTheoryAssignments(p, [
    { key: "one", day: "Saturday", time: 11 },
    { key: "two", day: "Sunday", time: 9 },
  ]).some((x) => x.includes("CSE102")));
  assert.ok(validateTheoryAssignments(p, [
    { key: "one", day: "Sunday", time: 9 },
    { key: "two", day: "Sunday", time: 10 },
  ]).some((x) => x.includes("CSE101")));
});

test("parallel sections can use consecutive one-hour periods but a teacher cannot overlap", () => {
  const p = problem([
    unit("a", "CSE103", sections[0], "T1"),
    unit("b", "CSE103", sections[1], "T1"),
    unit("c", "CSE103", sections[2], "T1"),
  ]);
  assert.deepEqual(validateTheoryAssignments(p, [
    { key: "a", day: "Saturday", time: 9 },
    { key: "b", day: "Saturday", time: 10 },
    { key: "c", day: "Saturday", time: 12 },
  ]), []);
  assert.ok(validateTheoryAssignments(p, [
    { key: "a", day: "Saturday", time: 9 },
    { key: "b", day: "Saturday", time: 9 },
    { key: "c", day: "Saturday", time: 12 },
  ]).length);
});

test("a course offered to A, B and C is suggested on the same day", () => {
  const p = problem(sections.map((section, index) =>
    unit(`hum-${index}`, "HUM429", section, "HUM Teacher")));
  const result = solveTheory(p, { seed: 31, timeLimitMs: 1200 });
  assert.deepEqual(validateTheoryAssignments(p, result.assignments), []);
  assert.equal(new Set(result.assignments.map((a) => a.day)).size, 1);
  assert.equal(new Set(result.assignments.map((a) => a.time)).size, 3);
  assert.ok(!theoryPreferenceWarnings(p, result.assignments)
    .some((warning) => warning.includes("days still differ")));
  assert.ok(theoryPreferenceWarnings(p, [
    { key: "hum-0", day: "Saturday", time: 9 },
    { key: "hum-1", day: "Sunday", time: 9 },
    { key: "hum-2", day: "Saturday", time: 10 },
  ]).some((warning) => warning.includes("HUM429")));
});

test("solver keeps fixed classes and favors day gaps and mornings", () => {
  const p = problem([
    unit("one", "CSE101", sections[0], "T1"),
    unit("two", "CSE101", sections[0], "T1"),
  ], [{
    course_id: "CSE101", sections: [sections[0]], teachers: ["T1"],
    day: "Saturday", time: 9, hours: [9], optional: false, option_group: null,
  }]);
  const result = solveTheory(p, { seed: 42, timeLimitMs: 1200 });
  assert.equal(result.assignments.length, 2);
  assert.deepEqual(validateTheoryAssignments(p, result.assignments), []);
  assert.ok(result.assignments.every((a) => ![1, 2, 3, 4].includes(a.time)));
  const scheduledDays = new Set(["Saturday", ...result.assignments.map((a) => a.day)]);
  assert.deepEqual(scheduledDays, new Set(["Saturday", "Monday", "Wednesday"]));
});

test("same option alternatives may share a period; unrelated options may not", () => {
  const elective = (key, course, group) => ({
    key, course_id: course, sections, teachers: [course],
    optional: true, option_group: group,
  });
  const p = problem([
    elective("one", "CSE411", 3),
    elective("two", "CSE413", 3),
    elective("three", "CSE415", 4),
  ]);
  assert.deepEqual(validateTheoryAssignments(p, [
    { key: "one", day: "Sunday", time: 9 },
    { key: "two", day: "Sunday", time: 9 },
    { key: "three", day: "Sunday", time: 10 },
  ]), []);
  assert.ok(validateTheoryAssignments(p, [
    { key: "one", day: "Sunday", time: 9 },
    { key: "two", day: "Sunday", time: 9 },
    { key: "three", day: "Sunday", time: 9 },
  ]).length);
});

test("paired sessionals are avoided on the same section's day when possible", () => {
  const p = problem([unit("a", "CSE101", sections[0], "Theory Teacher")], [{
    course_id: "CSE 102", type: 1, sections: [sections[0]],
    teachers: ["Lab Teacher"], day: "Saturday", time: 9,
    hours: [9, 10, 11], optional: false, option_group: null,
  }]);
  const result = solveTheory(p, { seed: 4, timeLimitMs: 1200 });
  assert.deepEqual(validateTheoryAssignments(p, result.assignments), []);
  assert.notEqual(result.assignments[0].day, "Saturday");
  assert.deepEqual(theoryPreferenceWarnings(p, result.assignments), []);
});

test("paired sessional overlap in another section is discouraged, not forbidden", () => {
  const p = problem([unit("b", "CSE219", sections[1], "Theory Teacher")], [{
    course_id: "CSE220", type: 1, sections: [sections[0]],
    teachers: ["Lab Teacher"], day: "Saturday", time: 9,
    hours: [9, 10, 11], optional: false, option_group: null,
  }]);
  p.days = ["Saturday"];
  p.slots = [9, 10, 11, 12].map((time) => ({ day: "Saturday", time }));
  const result = solveTheory(p, { seed: 7, timeLimitMs: 1200 });
  assert.equal(result.assignments[0].time, 12);
  assert.deepEqual(validateTheoryAssignments(p, result.assignments), []);
  assert.ok(theoryPreferenceWarnings(p, [{ key: "b", day: "Saturday", time: 9 }])
    .some((warning) => warning.includes("another section")));
});

test("8 AM theory concentrates on fallback days to preserve a common preferred CT slot", () => {
  const p = problem([
    unit("a", "CSE101", sections[0], "T1"),
    unit("b", "CSE103", sections[1], "T2"),
  ]);
  p.days = ["Saturday", "Sunday"];
  p.slots = p.days.map((day) => ({ day, time: 8 }));
  const result = solveTheory(p, { seed: 11, timeLimitMs: 1200 });
  assert.deepEqual(validateTheoryAssignments(p, result.assignments), []);
  assert.ok(result.assignments.every((a) => a.day === "Sunday"));
  assert.deepEqual(theoryCTSlots(p, result.assignments), [
    { day: "Saturday", priority: "preferred", available: true, ctScheduled: false },
    { day: "Sunday", priority: "fallback", available: false, ctScheduled: false },
  ]);
});

test("9 AM is preferred to 8 AM, and 8 AM to afternoon theory", () => {
  const p = problem([unit("a", "CSE101", sections[0], "T1")]);
  p.days = ["Saturday"];
  p.slots = [8, 9, 2].map((time) => ({ day: "Saturday", time }));
  const morning = solveTheory(p, { seed: 18, timeLimitMs: 1200 });
  assert.equal(morning.assignments[0].time, 9);

  p.slots = [8, 2].map((time) => ({ day: "Saturday", time }));
  const fallback = solveTheory(p, { seed: 18, timeLimitMs: 1200 });
  assert.equal(fallback.assignments[0].time, 8);
  assert.ok(theoryPreferenceWarnings(p, fallback.assignments)
    .some((warning) => warning.includes("discouraged 8 AM")));
});

test("CT requirements are two slots for Level 1 and L-4 T-2, three for the others", () => {
  assert.equal(theoryCTSlotRequirement("L-1 T-2"), 2);
  assert.equal(theoryCTSlotRequirement("L-2 T-2"), 3);
  assert.equal(theoryCTSlotRequirement("L-3 T-1"), 3);
  assert.equal(theoryCTSlotRequirement("L-4 T-1"), 3);
  assert.equal(theoryCTSlotRequirement("L-4 T-2"), 2);
  const p = problem([]);
  p.levelTerm = "L-4 T-2";
  assert.deepEqual(theoryCTSlots(p, []).filter((slot) => slot.priority === "preferred")
    .map((slot) => slot.day), ["Saturday", "Wednesday"]);
  p.levelTerm = "L-4 T-1";
  assert.deepEqual(theoryCTSlots(p, []).filter((slot) => slot.priority === "preferred")
    .map((slot) => slot.day), ["Saturday", "Monday", "Wednesday"]);
});

test("8 AM fallback use preserves the requested CT days when possible", () => {
  for (const [levelTerm, preferredDays, extraUnits] of [
    ["L-4 T-2", ["Saturday", "Wednesday"], 1],
    ["L-2 T-2", ["Saturday", "Monday", "Wednesday"], 2],
  ]) {
    const p = problem(Array.from({ length: extraUnits }, (_, i) =>
      unit(`ct-${i}`, `CSE${101 + 2 * i}`, sections[i], `T${i}`)));
    p.levelTerm = levelTerm;
    p.slots = p.days.map((day) => ({ day, time: 8 }));
    const result = solveTheory(p, { seed: 25, timeLimitMs: 1200 });
    assert.deepEqual(validateTheoryAssignments(p, result.assignments), []);
    assert.deepEqual(theoryCTSlots(p, result.assignments)
      .filter((slot) => slot.priority === "preferred" && slot.available)
      .map((slot) => slot.day), preferredDays);
  }
});

test("a suggestion cannot use too many shared 8 AM CT slots", () => {
  const p = problem([
    unit("a", "CSE201", sections[0], "T1"),
    unit("b", "CSE203", sections[1], "T2"),
    unit("c", "CSE205", sections[2], "T3"),
  ]);
  p.levelTerm = "L-2 T-2";
  const invalid = [
    { key: "a", day: "Saturday", time: 8 },
    { key: "b", day: "Sunday", time: 8 },
    { key: "c", day: "Monday", time: 8 },
  ];
  assert.ok(validateTheoryAssignments(p, invalid).some((issue) =>
    issue.includes("needs 3 common 8 AM CT slots")));
  const result = solveTheory(p, { seed: 9, timeLimitMs: 1200 });
  assert.deepEqual(validateTheoryAssignments(p, result.assignments), []);
  assert.ok(theoryCTSlots(p, result.assignments).filter((slot) => slot.available).length >= 3);
});

test("fixed 8 AM classes that leave too few common CT slots block generation", () => {
  const fixed = ["Saturday", "Sunday", "Monday"].map((day) => ({
    course_id: "CSE202", type: 1, sections: [sections[0]],
    teachers: ["Lab Teacher"], day, time: 8,
    hours: [8, 9, 10], optional: false, option_group: null,
  }));
  const p = problem([], fixed);
  p.levelTerm = "L-3 T-1";
  assert.ok(validateTheoryAssignments(p, []).some((issue) =>
    issue.includes("only 2 remain free")));
  assert.ok(solveTheory(p).issues.some((issue) =>
    issue.includes("fixed classes leave only 2")));
});
