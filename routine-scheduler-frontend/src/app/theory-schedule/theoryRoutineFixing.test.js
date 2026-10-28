import { commonCTChange, openMeetings, staggeredTimes, togetherLabel } from "./theoryRoutineFixing";

const times = [8, 9, 10, 11, 12, 1, 2, 3, 4];
const keys = ["CSE 21 A", "CSE 21 B", "CSE 21 C"];

test("staggered times skip 1 PM and run out at the last period", () => {
  expect(staggeredTimes(times, 9, 3)).toEqual([9, 10, 11]);
  expect(staggeredTimes(times, 12, 3)).toEqual([12, 2, 3]);
  expect(staggeredTimes(times, 4, 2)).toEqual([4, ""]);
});

test("adding CT in one section adds it to the others' cell", () => {
  const schedules = {
    "CSE 21 A": { "Saturday 8": { course_ids: [] } },
    "CSE 21 B": { "Saturday 8": { course_ids: [] } },
  };
  const change = commonCTChange({
    schedules, sectionKey: keys[0], sectionKeys: keys, slotKey: "Saturday 8",
    nextIds: ["CT"], isBlocked: () => false,
  });
  expect(change).toEqual({
    adding: true, busy: [], updates: { "CSE 21 B": ["CT"], "CSE 21 C": ["CT"] },
  });
});

test("CT cannot be added while another section has a class or lab then", () => {
  const schedules = { "CSE 21 B": { "Saturday 8": { course_ids: ["CSE301"] } } };
  const change = commonCTChange({
    schedules, sectionKey: keys[0], sectionKeys: keys, slotKey: "Saturday 8",
    nextIds: ["CT"], isBlocked: (key) => key === "CSE 21 C",
  });
  expect(change.busy).toEqual(["CSE 21 B", "CSE 21 C"]);
});

test("removing CT removes it everywhere; other edits leave CT alone", () => {
  const schedules = Object.fromEntries(keys.map((k) => [k, { "Monday 8": { course_ids: ["CT"] } }]));
  expect(commonCTChange({
    schedules, sectionKey: keys[1], sectionKeys: keys, slotKey: "Monday 8",
    nextIds: [], isBlocked: () => false,
  }).updates).toEqual({ "CSE 21 A": [], "CSE 21 C": [] });
  expect(commonCTChange({
    schedules, sectionKey: keys[1], sectionKeys: keys, slotKey: "Monday 8",
    nextIds: ["CT"], isBlocked: () => false,
  })).toBeNull();
});

test("open meetings count a shared elective once", () => {
  const sections = ["A", "B", "C"].map((section) => ({ section, fixed: [{}], generated: [] }));
  expect(openMeetings({ class_per_week: 3, shared: false, sections })).toBe(6);
  expect(openMeetings({ class_per_week: 3, shared: true, sections })).toBe(2);
});

test("a course in two sections at once reads as one warning", () => {
  const entry = { course_id: "HUM429", day: "Monday", time: 11, sections: ["B", "C"] };
  expect(togetherLabel(entry)).toBe("HUM429: sections B and C together on Mon 11");
  expect(togetherLabel({ ...entry, sections: ["A", "B", "C"] }, "Option 1X"))
    .toBe("Option 1X: sections A, B and C together on Mon 11");
});
