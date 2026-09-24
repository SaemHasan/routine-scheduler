export const shortDay = (day) => String(day).slice(0, 3);
export const slotLabel = ({ day, time }) => `${shortDay(day)} ${time}`;

// Theory never meets at 1 PM.
export const theoryTimes = (times) => times.filter((time) => Number(time) !== 1);

// Consecutive theory periods from `start` for `count` sections, e.g. 9, 10
// and 11 for A, B and C. Sections past the last period get no time.
export function staggeredTimes(times, start, count) {
  const periods = theoryTimes(times);
  const first = periods.indexOf(Number(start));
  if (first < 0) return Array(count).fill("");
  return Array.from({ length: count }, (_, i) => periods[first + i] ?? "");
}

const idsOf = (cell) => cell?.course_ids || (cell?.course_id ? [cell.course_id] : []);

/**
 * CT is held in every section of the level-term at once. When a cell edit in
 * one section adds or removes CT, returns the other sections' new course
 * lists for that cell, or the sections that are busy then (a class, or a lab
 * block per `isBlocked`), which prevents adding it. Null when CT is unchanged.
 */
export function commonCTChange({ schedules, sectionKey, sectionKeys, slotKey, nextIds, isBlocked }) {
  const had = idsOf(schedules[sectionKey]?.[slotKey]).includes("CT");
  const has = nextIds.includes("CT");
  if (had === has) return null;
  const [day, time] = slotKey.split(" ");
  const updates = {};
  const busy = [];
  for (const key of sectionKeys) {
    if (key === sectionKey) continue;
    const ids = idsOf(schedules[key]?.[slotKey]);
    if (has) {
      const others = ids.filter((id) => id !== "CT");
      if (others.length || isBlocked(key, day, Number(time))) busy.push(key);
      else if (!ids.includes("CT")) updates[key] = [...ids, "CT"];
    } else if (ids.includes("CT")) {
      updates[key] = ids.filter((id) => id !== "CT");
    }
  }
  return { adding: has, busy, updates };
}

// Meetings a course still needs the generator to place across its sections.
export function openMeetings(course) {
  const counted = course.shared ? course.sections.slice(0, 1) : course.sections;
  return counted.reduce((total, section) =>
    total + Math.max(0, course.class_per_week - section.fixed.length), 0);
}
