import assert from "node:assert/strict";
import test from "node:test";
import { roomOccupants } from "./roomUse.js";

const times = [8, 9, 10, 11, 12, 1, 2, 3, 4];
const row = (course_id, section, day, time, room_no, type = 0, extra = {}) => ({
  course_id, department: "CSE", batch: 23, section, day, time, room_no, type, shared: false, ...extra,
});

test("a room is busy with other theory classes and with labs over their three periods", () => {
  const rows = [
    row("CSE101", "A", "Tuesday", 8, "203"),
    row("CSE102", "B1", "Tuesday", 11, "203", 1),
    row("EEE163", "B", "Tuesday", 8, "203", 0, { department: "EEE", batch: 23 }),
  ];
  assert.deepEqual(roomOccupants(rows, times, { room: "203", day: "Tuesday", time: 8 }, rows[0]),
    ["EEE163 (EEE B)"]);
  assert.deepEqual(roomOccupants(rows, times, { room: "203", day: "Tuesday", time: 12 }), ["CSE102 (B1)"]);
  assert.deepEqual(roomOccupants(rows, times, { room: "203", day: "Tuesday", time: 2 }), []);
  assert.deepEqual(roomOccupants(rows, times, { room: null, day: "Tuesday", time: 8 }), []);
});

test("the copies of an elective every section takes are one class", () => {
  const rows = ["A", "B", "C"].map((s) => row("CSE405", s, "Sunday", 9, "301", 0, { shared: true }));
  assert.deepEqual(roomOccupants(rows, times, { room: "301", day: "Sunday", time: 9 }, rows[1]), []);
  assert.deepEqual(roomOccupants(rows, times, { room: "301", day: "Sunday", time: 9 }),
    ["CSE405 (all sections)"]);
});
