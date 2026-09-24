// A sessional teacher either takes a full lab slot (share 1) or shares one slot
// with another teacher (share 0.5), each taking half the lab and its credit.

export const isHalf = (teacher) => Number(teacher.share) === 0.5;

export const sessionalLoad = (course, share = course.share ?? 1) => {
  const credit = Number(course.class_per_week) || 0;
  return credit * (credit === 0.75 ? 4 : 2) * Number(share);
};

export const labPeriods = (times, time) => {
  const start = times.indexOf(Number(time));
  return start < 0 ? [] : times.slice(start, start + 3);
};

/** Lab slots a section's teachers fill: two half-slot teachers make one. */
export const slotCount = (teachers) =>
  (teachers || []).reduce(
    (sum, teacher) => sum + (isHalf(teacher) ? 0.5 : 1),
    0
  );

/**
 * Groups a section's teachers into slots, pairing half-slot teachers in the
 * order given: [AKMAR½, MN½, SMH, HT] → [["AKMAR", "MN"], ["SMH"], ["HT"]].
 * An unpaired half-slot teacher is left in a slot of its own.
 */
export const groupIntoSlots = (teachers) => {
  const slots = [];
  let openHalf = null;
  (teachers || []).forEach((teacher) => {
    if (!isHalf(teacher)) {
      slots.push([teacher]);
    } else if (openHalf) {
      openHalf.push(teacher);
      openHalf = null;
    } else {
      openHalf = [teacher];
      slots.push(openHalf);
    }
  });
  return slots;
};

/** "AKMAR/MN, SMH, HT" */
export const formatSessionalTeachers = (teachers) =>
  groupIntoSlots(teachers)
    .map((slot) => slot.map((teacher) => teacher.initial).join("/"))
    .join(", ");

/**
 * Whether a lab section taking `capacity` teachers (from its sessional type,
 * e.g. 3 for Departmental Software) has room for one more with `share`.
 * Without a known capacity there is no limit here; the server still checks.
 */
export const hasRoomFor = (teachers, capacity, share = 1) =>
  !capacity || slotCount(teachers) + Number(share) <= Number(capacity);

/**
 * Lab sessions a section has each week: one per 1.5 credits (a 0.75-credit
 * lab once), so a 3-credit lab meets twice. Matches the sessional scheduler.
 */
export const labSessionsPerWeek = (credit) => Math.max(1, Math.round(Number(credit) / 1.5));
