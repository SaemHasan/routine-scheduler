import test from 'node:test';
import assert from 'node:assert/strict';
import { findSessionalConflict, sessionalCapacityError } from './sessionalRules.js';

const times = [8, 9, 10, 11, 12, 1, 2, 3, 4];
const targets = [{ day: 'Tuesday', time: 11 }];

test('half slots allow theory overlap; full slots reject it across noon', () => {
  for (const time of [11, 12, 1]) {
    const context = { targets, times, labs: [], theory: [{ course_id: 'CSE105', day: 'Tuesday', time }] };
    assert.equal(findSessionalConflict({ ...context, share: 0.5 }), null);
    assert.match(findSessionalConflict({ ...context, share: 1 }), /CSE105.*half slot/);
  }
});

test('sharing a slot does not allow the teacher to take another overlapping lab', () => {
  const labs = [{ course_id: 'CSE108', section: 'B1', day: 'Tuesday', time: 11 }];
  for (const share of [0.5, 1]) {
    assert.match(findSessionalConflict({ targets, times, labs, theory: [], share }), /CSE108/);
  }
  assert.equal(findSessionalConflict({ targets, times, labs: [{ ...labs[0], time: 2 }], theory: [], share: 1 }), null);
});

test('every scheduled meeting is checked before assigning a teacher', () => {
  assert.match(findSessionalConflict({ times, share: 1, labs: [],
    targets: [...targets, { day: 'Wednesday', time: 8 }],
    theory: [{ course_id: 'CSE105', day: 'Wednesday', time: 10 }],
  }), /Wednesday/);
});

test('a lab section takes no more teachers than its sessional type allows', () => {
  const base = { course_id: 'CSE102', section: 'A1', capacity: 3 };
  assert.equal(sessionalCapacityError({ ...base, filled: 2, share: 1 }), null);
  assert.equal(sessionalCapacityError({ ...base, filled: 2.5, share: 0.5 }), null);
  assert.match(sessionalCapacityError({ ...base, filled: 3, share: 0.5 }), /all 3 slots are filled/);
  assert.match(sessionalCapacityError({ ...base, filled: 2.5, share: 1 }), /only half a slot left/);
  assert.match(sessionalCapacityError({ ...base, capacity: 2, filled: 2, share: 1 }), /takes 2 teachers/);
  // A course with no known type is not limited here
  assert.equal(sessionalCapacityError({ ...base, capacity: null, filled: 9, share: 1 }), null);
});
