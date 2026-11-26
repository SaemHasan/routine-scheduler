import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SessionalConstraint from './SessionalConstraint';

const lab = (course_id, section, day, time, extra = {}) => ({ course_id, batch: 25, section, day, time, ...extra });
const forecast = (extra) => ({
  mode: 'full-time', initial: 'MLD', fullTime: true, labsLeft: 5, uncovered: 0, teachersLeft: 7, shortfall: 0,
  needed: 0, slots: [], others: [], atRisk: [], ...extra,
});
const show = (extra, initial = 'MLD') =>
  render(<SessionalConstraint initial={initial} forecast={forecast(extra)} status="ready" />).container.textContent;

test('names the slot and the labs the teacher must choose from', () => {
  const text = show({ uncovered: 6, needed: 1, slots: [{ day: 'Wednesday', time: 2, labs: [
    lab('CSE106', 'A1', 'Wednesday', 2), lab('CSE450', 'C1', 'Wednesday', 2, { half: true }),
  ] }] });
  expect(text).toContain('MLD must take one lab that has no full-time teacher yet');
  expect(text).toContain('Wednesday 2:00: one of CSE106 (A1), CSE450 (C1) (half slot)');
  expect(text).toContain('outlined in orange');
});

test('labs in no particular slot are listed with their times', () => {
  const text = show({ uncovered: 3, needed: 2, slots: [{ day: 'Monday', time: 11, labs: [lab('CSE274', 'A1', 'Monday', 11)] }],
    others: [lab('CSE206', 'A1', 'Sunday', 2), lab('CSE170', 'A1', 'Monday', 11,
      { classes: [{ day: 'Monday', time: 11 }, { day: 'Wednesday', time: 2 }] })] });
  expect(text).toContain('MLD must take 2 labs that have no full-time teacher yet');
  expect(text).toContain('Monday 11:00: CSE274 (A1)');
  expect(text).toContain('One more of: CSE206 (A1) Sunday 2:00, CSE170 (A1) (Monday 11:00 and Wednesday 2:00)');
});

test('says there is no constraint, and why', () => {
  expect(show({ uncovered: 30 })).toContain(
    'No constraint. 30 labs still have no full-time teacher, and the full-time teachers after MLD can cover them.');
  expect(show({ labsLeft: 0, uncovered: 4 })).toContain("MLD's credit load is full.");
  expect(show({})).toContain('Every lab has a full-time teacher.');
});

test('warns when some labs can no longer get a full-time teacher', () => {
  const text = show({ uncovered: 2, shortfall: 1, needed: 1,
    slots: [{ day: 'Wednesday', time: 2, labs: [lab('CSE106', 'A1', 'Wednesday', 2), lab('CSE106', 'A2', 'Wednesday', 2)] }],
    atRisk: [lab('CSE106', 'A1', 'Wednesday', 2), lab('CSE106', 'A2', 'Wednesday', 2)] });
  expect(text).toContain('1 lab will be left without a full-time teacher even if MLD and the full-time teachers after take the right labs.');
  expect(text).toContain('Any 1 of these could be the one left out: CSE106 (A1) Wednesday 2:00, CSE106 (A2) Wednesday 2:00');
});

const partTime = (extra) => show({ mode: 'part-time', initial: 'PT1', partTimeCredit: 21, labsPerTeacher: 7, labsLeft: 7,
  emptySlots: 12, more: 0, busiest: [], ...extra }, 'PT1');

test('a part-time teacher sees what the part-time teachers must fill', () => {
  const text = partTime({ needed: 1, slots: [{ day: 'Saturday', time: 2, labs: [lab('CSE106', 'A1', 'Saturday', 2)] }] });
  expect(text).toContain('Constraint (part-time)');
  expect(text).toContain('PT1 must take one lab with an empty teaching slot');
  expect(text).toContain('Saturday 2:00: CSE106 (A1)');
  expect(text).toContain('the part-time teachers after PT1 in seniority, at 21 credits (7 labs) each, cannot fill every empty teaching slot');
  expect(text).not.toContain('full-time');
  expect(partTime({})).toContain(
    'No constraint. 12 teaching slots are still empty, and the part-time teachers after PT1 can fill them.');
  expect(partTime({ emptySlots: 0 })).toContain('Every lab has all its teachers.');
});

test('a part-time teacher is told how many more part-time teachers it takes', () => {
  const text = partTime({ shortfall: 3, more: 2, atRisk: [lab('CSE106', 'A1', 'Saturday', 2)] });
  expect(text).toContain('3 teaching slots will stay empty even if PT1 and the part-time teachers after take the right labs; ' +
    '2 more part-time teachers at 21 credits (7 labs) would fill them.');
});

test('a long list shows the first labs and the rest on request', () => {
  const labs = Array.from({ length: 11 }, (_, i) => lab(`CSE${300 + i}`, 'A', 'Sunday', 2));
  show({ uncovered: 11, needed: 1, others: labs });
  expect(screen.queryByText('CSE310 (A)')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '+3 more' }));
  expect(screen.getByText('CSE310 (A)')).toBeTruthy();
});

test('shows while checking and if the check fails', () => {
  const { rerender, container } = render(<SessionalConstraint initial="MLD" forecast={null} status="loading" />);
  expect(container.textContent).toContain('Checking which labs this teacher must take');
  rerender(<SessionalConstraint initial="MLD" forecast={null} status="failed" />);
  expect(container.textContent).toContain('Could not check');
});
