import test from 'node:test';
import assert from 'node:assert/strict';
import { forecastFullTimeCover, forecastPartTimeFill, labsLeft } from './sessionalForecast.js';

const times = [8, 9, 10, 11, 12, 1, 2, 3, 4];
const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday'];
// A lecturer offered 21 credits; with 0 so far they can take 7 more labs
const teacher = (initial, seniority_rank, { credit = 0, fullTime = true } = {}) =>
  ({ initial, seniority_rank, full_time_status: fullTime, teacher_credits_offered: 21, credit });
const lab = (course_id, section, day, time, teacher_count = 3) =>
  ({ course_id, batch: 25, section, day, time, teacher_count });
const forecast = (input) => forecastFullTimeCover({ times, days, assignments: [], theory: [], ...input });
const partTime = (input) => forecastPartTimeFill({ times, days, assignments: [], theory: [], ...input });
const partTimer = (initial, rank, options = {}) => teacher(initial, rank, { ...options, fullTime: false });
const has = (initial, course_id, section, share = 1) => ({ initial, course_id, batch: 25, section, share });
const names = (labs) => labs.map((row) => `${row.course_id} ${row.section}`);

test('a teacher can take as many more labs as 3 credits each fit in their load', () => {
  assert.equal(labsLeft(21, 4.5), 5);
  assert.equal(labsLeft(15, 12), 1);
  assert.equal(labsLeft(15, 13.5), 0);
  assert.equal(labsLeft(15, 16.5), 0);
});

test('five open labs in one slot and five teachers left: each must take one there', () => {
  const labs = ['A1', 'A2', 'B1', 'B2', 'C1'].map((section) => lab('CSE106', section, 'Wednesday', 2));
  const teachers = [teacher('SENIOR', 1), ...['X', 'P', 'Q', 'R', 'S'].map((initial, i) => teacher(initial, i + 2))];
  const result = forecast({ initial: 'X', teachers, labs });
  assert.equal(result.needed, 1);
  assert.equal(result.shortfall, 0);
  assert.deepEqual(result.slots.map((slot) => [slot.day, slot.time, slot.labs.length]), [['Wednesday', 2, 5]]);
  assert.deepEqual(result.others, []);
  // With a sixth teacher still to come, the most senior one is free to choose
  assert.equal(forecast({ initial: 'SENIOR', teachers, labs }).needed, 0);
});

test('when the others are one lab short, the teacher must take one of the labs in any slot', () => {
  const labs = [lab('CSE106', 'A1', 'Saturday', 2), lab('CSE206', 'A1', 'Sunday', 2), lab('CSE306', 'A1', 'Monday', 2)];
  // 18 of 21 credits: one more lab each
  const teachers = ['X', 'P', 'Q'].map((initial, i) => teacher(initial, i + 1, { credit: 18 }));
  const result = forecast({ initial: 'X', teachers, labs });
  assert.equal(result.needed, 1);
  assert.deepEqual(result.slots, []);
  assert.deepEqual(names(result.others), ['CSE106 A1', 'CSE206 A1', 'CSE306 A1']);
});

test('a lab a later teacher already has keeps them busy in that slot', () => {
  const labs = [lab('CSE106', 'A1', 'Wednesday', 2), lab('CSE106', 'A2', 'Wednesday', 2),
    lab('CSE284', 'A1', 'Wednesday', 2)];
  // P teaches CSE283, so already has its lab; that lab stays with P
  const assignments = [{ initial: 'P', course_id: 'CSE284', batch: 25, section: 'A1', share: 1 }];
  const teachers = [teacher('X', 1), teacher('P', 2)];
  const result = forecast({ initial: 'X', teachers, labs, assignments });
  assert.equal(result.uncovered, 2);
  assert.equal(result.shortfall, 1);
  assert.deepEqual(names(result.atRisk), ['CSE106 A1', 'CSE106 A2']);
  assert.deepEqual(result.slots.map((slot) => names(slot.labs)), [['CSE106 A1', 'CSE106 A2']]);
});

test('a theory class then still allows a half slot, which counts', () => {
  const labs = [lab('CSE106', 'A1', 'Tuesday', 11)];
  const theory = [{ initial: 'X', day: 'Tuesday', time: 12 }];
  const result = forecast({ initial: 'X', teachers: [teacher('X', 1)], labs, theory });
  assert.equal(result.needed, 1);
  assert.equal(result.slots[0].labs[0].half, true);
  // A full-time teacher on a half slot already covers a lab
  const covered = forecast({ initial: 'X', teachers: [teacher('X', 1), teacher('P', 2)], labs,
    assignments: [{ initial: 'P', course_id: 'CSE106', batch: 25, section: 'A1', share: 0.5 }] });
  assert.equal(covered.uncovered, 0);
  assert.equal(covered.needed, 0);
});

test('a lab filled by part-time teachers can no longer get a full-time one', () => {
  const labs = [lab('CSE106', 'A1', 'Saturday', 2, 2), lab('CSE106', 'A2', 'Saturday', 2, 2)];
  const teachers = [teacher('X', 1), teacher('PT1', 60, { fullTime: false }), teacher('PT2', 61, { fullTime: false })];
  const assignments = ['PT1', 'PT2'].map((initial) =>
    ({ initial, course_id: 'CSE106', batch: 25, section: 'A1', share: 1, full_time_status: false }));
  const result = forecast({ initial: 'X', teachers, labs, assignments });
  assert.equal(result.shortfall, 1);
  assert.deepEqual(names(result.atRisk), ['CSE106 A1']);
  // X can still take A2, and nobody else can
  assert.deepEqual(result.slots.map((slot) => names(slot.labs)), [['CSE106 A2']]);
  // A part-time teacher is never the one a lab is waiting for
  const partTime = forecast({ initial: 'PT1', teachers, labs, assignments });
  assert.equal(partTime.fullTime, false);
  assert.equal(partTime.needed, 0);
});

test('a teacher whose load is full is not counted on', () => {
  const labs = [lab('CSE106', 'A1', 'Saturday', 2), lab('CSE206', 'A1', 'Sunday', 2)];
  const teachers = [teacher('X', 1), teacher('P', 2, { credit: 21 })];
  const result = forecast({ initial: 'X', teachers, labs });
  assert.equal(result.needed, 2);
  assert.deepEqual(result.slots.map((slot) => [slot.day, names(slot.labs)]),
    [['Saturday', ['CSE106 A1']], ['Sunday', ['CSE206 A1']]]);
  assert.equal(forecast({ initial: 'P', teachers, labs }).needed, 0);
});

test('a lab meeting twice a week takes up both of its teacher\'s slots', () => {
  // CSE170 meets Monday 11:00 and Wednesday 2:00. If X took it, X could take
  // nothing else in those slots and P could cover only one of the other two.
  const labs = [lab('CSE170', 'A1', 'Monday', 11), lab('CSE170', 'A1', 'Wednesday', 2),
    lab('CSE274', 'A1', 'Monday', 11), lab('CSE450', 'C1', 'Wednesday', 2)];
  const teachers = [teacher('X', 1, { credit: 15 }), teacher('P', 2, { credit: 18 })];
  const result = forecast({ initial: 'X', teachers, labs });
  assert.equal(result.shortfall, 0);
  assert.equal(result.needed, 2);
  assert.deepEqual(result.slots.map((slot) => [slot.day, names(slot.labs)]),
    [['Monday', ['CSE274 A1']], ['Wednesday', ['CSE450 C1']]]);
  // P alone can cover any one of the three, the twice-a-week lab included
  const later = forecast({ initial: 'P', teachers, labs });
  assert.equal(later.shortfall, 2);
  assert.deepEqual(names(later.others), ['CSE170 A1', 'CSE274 A1', 'CSE450 C1']);
  assert.deepEqual(later.others[0].classes.map((meet) => meet.day), ['Monday', 'Wednesday']);
});

test('taking the wrong lab would leave another uncovered, so only the right one is offered', () => {
  // Q can cover only the Saturday lab; X must leave it to Q and take Sunday's
  const labs = [lab('CSE106', 'A1', 'Saturday', 2), lab('CSE206', 'A1', 'Sunday', 2)];
  const teachers = [teacher('X', 1, { credit: 18 }), teacher('Q', 2, { credit: 18 })];
  const assignments = [{ initial: 'Q', course_id: 'CSE300', batch: 25, section: 'A1', share: 1 }];
  const busy = [...labs, lab('CSE300', 'A1', 'Sunday', 2)];
  const result = forecast({ initial: 'X', teachers, labs: busy, assignments });
  assert.equal(result.needed, 1);
  assert.deepEqual(result.slots.map((slot) => [slot.day, names(slot.labs)]), [['Sunday', ['CSE206 A1']]]);
});

// Two software labs on Wednesday 2:00, each with one full-time teacher, so
// four teaching slots are still empty then
const wednesday = [lab('CSE106', 'A1', 'Wednesday', 2), lab('CSE106', 'A2', 'Wednesday', 2)];
const fullTimers = [teacher('F1', 1), teacher('F2', 2), has('F1', 'CSE106', 'A1'), has('F2', 'CSE106', 'A2')];
const staff = fullTimers.filter((row) => row.seniority_rank);
const taken = fullTimers.filter((row) => row.course_id);

test('part-time teachers fill the slots the full-time ones leave; a busy slot needs each of them', () => {
  const teachers = [...staff, teacher('SPARE', 3), ...['P1', 'P2', 'P3', 'P4'].map((initial, i) => partTimer(initial, 51 + i))];
  const result = partTime({ initial: 'P1', teachers, labs: wednesday, assignments: taken });
  assert.equal(result.mode, 'part-time');
  assert.equal(result.emptySlots, 4);
  assert.equal(result.teachersLeft, 4); // part-time teachers only: SPARE does not count
  assert.equal(result.shortfall, 0);
  assert.equal(result.needed, 1);
  assert.deepEqual(result.slots.map((slot) => [slot.day, slot.time, names(slot.labs)]),
    [['Wednesday', 2, ['CSE106 A1', 'CSE106 A2']]]);
});

test('with too few part-time teachers, says how many more at the same load would fill every slot', () => {
  const teachers = [...staff, partTimer('P1', 51), partTimer('P2', 52)];
  const result = partTime({ initial: 'P1', teachers, labs: wednesday, assignments: taken });
  assert.equal(result.shortfall, 2);
  assert.equal(result.more, 2);
  assert.deepEqual(names(result.atRisk), ['CSE106 A1', 'CSE106 A2']);
  // The whole plan counts every part-time teacher, whatever their place
  const plan = partTime({ teachers, labs: wednesday, assignments: taken });
  assert.equal(plan.teachersLeft, 2);
  assert.equal(plan.needed, 0);
  assert.deepEqual(plan.busiest, [{ day: 'Wednesday', time: 2, empty: 4 }]);
  assert.equal(partTime({ initial: 'P2', teachers, labs: wednesday, assignments: taken }).teachersLeft, 1);
});

test('the part-time credit load sets how many labs each part-time teacher can take', () => {
  const labs = ['Saturday', 'Sunday', 'Monday', 'Tuesday'].map((day, i) => lab(`CSE10${i}`, 'A1', day, 2, 2));
  const assignments = labs.map((row) => has('F1', row.course_id, row.section));
  const teachers = [teacher('F1', 1), partTimer('P1', 51), partTimer('P2', 52)];
  const roomy = partTime({ teachers, labs, assignments, partTimeCredit: 6 });
  assert.deepEqual([roomy.labsPerTeacher, roomy.emptySlots, roomy.shortfall], [2, 4, 0]);
  const tight = partTime({ teachers, labs, assignments, partTimeCredit: 3 });
  assert.deepEqual([tight.labsPerTeacher, tight.shortfall, tight.more], [1, 2, 2]);
});

test('a part-time teacher with a theory class then fills only a lab missing half a slot', () => {
  const labs = [lab('CSE106', 'A1', 'Tuesday', 11, 2), lab('CSE106', 'B1', 'Tuesday', 11, 2)];
  const assignments = [has('F1', 'CSE106', 'A1'), has('F2', 'CSE106', 'B1'), has('F3', 'CSE106', 'B1', 0.5)];
  const teachers = [teacher('F1', 1), teacher('F2', 2), teacher('F3', 3), partTimer('P1', 51)];
  const theory = [{ initial: 'P1', day: 'Tuesday', time: 12 }];
  const result = partTime({ initial: 'P1', teachers, labs, assignments, theory });
  assert.equal(result.emptySlots, 2);
  assert.equal(result.shortfall, 1);
  assert.deepEqual(result.slots.map((slot) => slot.labs.map((row) => `${row.section}${row.half ? ' half' : ''}`)), [['B1 half']]);
});

test('a twice-a-week lab takes two labs of a part-time teacher\'s load and both of their slots', () => {
  // CSE170 meets Monday 11:00 and Wednesday 2:00 and still needs two teachers;
  // CSE450 on Wednesday 2:00 needs one. P3 has load for one lab only.
  const labs = [{ ...lab('CSE170', 'A1', 'Monday', 11), class_per_week: 3 },
    { ...lab('CSE170', 'A1', 'Wednesday', 2), class_per_week: 3 }, lab('CSE450', 'C1', 'Wednesday', 2, 2)];
  const assignments = [has('F1', 'CSE170', 'A1'), has('F2', 'CSE450', 'C1')];
  const teachers = [teacher('F1', 1), teacher('F2', 2), partTimer('P1', 51), partTimer('P2', 52),
    partTimer('P3', 53, { credit: 18 })];
  const first = partTime({ initial: 'P1', teachers, labs, assignments });
  assert.deepEqual([first.emptySlots, first.shortfall, first.needed], [3, 0, 1]);
  // Taking CSE450 would leave P3 nothing to take, so P1 must take CSE170
  assert.deepEqual(first.slots.map((slot) => [slot.day, names(slot.labs)]), [['Monday', ['CSE170 A1']]]);
  assert.equal(first.slots[0].labs[0].classes.length, 2);
  const last = partTime({ initial: 'P3', teachers, labs, assignments });
  assert.deepEqual([last.shortfall, last.more], [2, 2]);
});

test('counting the part-time teachers needed stays quick when a twice-a-week lab meets in a full slot',
  { timeout: 5000 }, () => {
    // 30 labs on Wednesday 2:00 lack one teacher each, and CSE170, meeting
    // Monday 11:00 and Wednesday 2:00 too, lacks three: 33 at once on Wednesday
    const labs = [lab('CSE170', 'A1', 'Monday', 11), lab('CSE170', 'A1', 'Wednesday', 2),
      ...Array.from({ length: 30 }, (_, i) => lab(`CSE${300 + i}`, 'A1', 'Wednesday', 2, 2))];
    const assignments = labs.slice(2).map((row, i) => has(`F${i}`, row.course_id, row.section));
    const teachers = assignments.map((row, i) => teacher(row.initial, i + 1));
    const started = Date.now();
    const plan = partTime({ teachers, labs, assignments });
    assert.deepEqual([plan.emptySlots, plan.teachersLeft, plan.more], [33, 0, 33]);
    assert.ok(Date.now() - started < 2000, `took ${Date.now() - started} ms`);
  });
