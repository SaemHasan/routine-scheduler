import assert from "node:assert/strict";
import test from "node:test";
import { solve } from "./algorithm.js";

const slots = ["Saturday", "Sunday"].flatMap((day, dayIndex) =>
  [11, 2].map((time) => ({ day, time, dayIndex, isMorning: false, isMidday: time === 11 })));

// WNL is reserved for CSE322; CL, CSL and PL are open to every course
const rooms = [
  { room: "WNL", lab_type: "SW", restricted: false, reservedFor: ["CSE322"] },
  { room: "CL", lab_type: "SW", restricted: false, reservedFor: null },
  { room: "CSL", lab_type: "SW", restricted: false, reservedFor: null },
  { room: "PL", lab_type: "SW", restricted: false, reservedFor: null },
];

function unit(course_id, section, extra = {}) {
  return {
    key: `${course_id}|CSE|21|${section}`,
    label: `${course_id} (${section})`,
    course_id,
    batch: 21,
    section,
    department: "CSE",
    coverKeys: [`CSE|21|${course_id}|${section}`],
    teachers: [],
    lab_type: "SW",
    allowedRooms: null,
    courseKey: course_id,
    roomsKey: course_id,
    blocked: {},
    clashSlots: {},
    ...extra,
  };
}

const units = [
  ...["A1", "A2", "B1", "B2", "C1", "C2"].map((s) => unit("CSE300", s)),
  ...["A", "B", "C"].map((s) => unit("CSE322", s)),
];
const roomOf = (result, i) => result.assignments[i].room;

test("no other course is placed in a reserved lab", () => {
  for (const seed of [1, 2, 3]) {
    const result = solve({ slots, rooms, units }, { effort: "quick", seed });
    units.forEach((u, i) => {
      if (u.course_id !== "CSE322") assert.notEqual(roomOf(result, i), 0, `${u.label} in WNL (seed ${seed})`);
    });
    assert.deepEqual(result.report.conflicts, []);
  }
});

test("a course uses its reserved lab when it can", () => {
  const result = solve({ slots, rooms, units }, { effort: "quick", seed: 7 });
  units.forEach((u, i) => {
    if (u.course_id === "CSE322") assert.equal(roomOf(result, i), 0, `${u.label} not in WNL`);
  });
});

test("a reserved lab is left out of the free-lab count and the room balance", () => {
  const { report } = solve({ slots, rooms, units }, { effort: "quick", seed: 3 });
  assert.equal(report.stats.labRooms, 3);
  assert.deepEqual(Object.keys(report.stats.classesPerRoom).sort(), ["CL", "CSL", "PL"]);
  for (const u of report.roomUsage) assert.ok(!u.freeRooms.includes("WNL"));
});

test("a class locked in another course's reserved lab is reported", () => {
  const locked = units.map((u, i) => (i === 0 ? { ...u, fixed: { slot: 0, room: 0 } } : u));
  const { report } = solve({ slots, rooms, units: locked }, { effort: "quick", seed: 5 });
  assert.ok(report.conflicts.includes("CSE300 (A1) is in WNL, which is reserved for CSE322"));
});

test("the running score matches the recomputed score", () => {
  for (const seed of [11, 12]) {
    const result = solve({ slots, rooms, units }, { effort: "quick", seed });
    assert.equal(result.trackedScore, result.score);
  }
});
