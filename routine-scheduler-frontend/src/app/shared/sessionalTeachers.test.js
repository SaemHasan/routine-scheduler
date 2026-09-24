import { hasRoomFor, labSessionsPerWeek, slotCount } from "./sessionalTeachers";

const full = (initial) => ({ initial, share: 1 });
const half = (initial) => ({ initial, share: 0.5 });

test("a software lab section takes three teacher slots", () => {
  expect(hasRoomFor([full("A"), full("B")], 3)).toBe(true);
  expect(hasRoomFor([full("A"), full("B"), full("C")], 3)).toBe(false);
  expect(hasRoomFor([full("A"), full("B"), full("C")], 3, 0.5)).toBe(false);
});

test("two half-slot teachers fill one slot", () => {
  const teachers = [full("A"), full("B"), half("C")];
  expect(slotCount(teachers)).toBe(2.5);
  expect(hasRoomFor(teachers, 3, 0.5)).toBe(true);
  expect(hasRoomFor(teachers, 3, 1)).toBe(false);
});

test("an unknown capacity is not limited here", () => {
  expect(hasRoomFor([full("A"), full("B"), full("C"), full("D")], undefined)).toBe(true);
});

test("a lab meets once per 1.5 credits, at least once", () => {
  expect(labSessionsPerWeek(0.75)).toBe(1);
  expect(labSessionsPerWeek(1.5)).toBe(1);
  expect(labSessionsPerWeek(3)).toBe(2);
});
