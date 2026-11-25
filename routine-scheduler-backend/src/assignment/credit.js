// A teacher's load, counted as on the department's load sheet. Both the
// credit totals and the sessional look-ahead use these, so they agree.

/** Thesis 1 and Thesis 2 carry 6 credits each, MSc 3. */
export const thesisCredit = (teacher) =>
  (teacher.offers_thesis_1 ? 6 : 0) +
  (teacher.offers_thesis_2 ? 6 : 0) +
  (teacher.offers_msc ? 3 : 0);

/**
 * A lab section: twice its credit (four times for a 0.75-credit lab), halved
 * for a teacher sharing the slot with another (share 0.5).
 */
export const labCredit = ({ class_per_week, share }) => {
  const credit = Number(class_per_week) || 0;
  return (credit === 0.75 ? 4 : 2) * credit * (Number(share) || 1);
};

/**
 * A theory course: credit x sections, shared equally by all of its teachers
 * however the sections are split between them.
 */
export const theoryCredit = ({ class_per_week, section_count, teacher_count }) =>
  ((Number(class_per_week) || 0) * (parseInt(section_count) || 0)) /
  (parseInt(teacher_count) || 1);
