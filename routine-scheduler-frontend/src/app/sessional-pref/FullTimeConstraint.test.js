import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FullTimeConstraint from './FullTimeConstraint';

const lab = (course_id, section, day, time, extra = {}) => ({ course_id, batch: 25, section, day, time, ...extra });
const forecast = (extra) => ({
  initial: 'MLD', fullTime: true, labsLeft: 5, uncovered: 0, teachersLeft: 7, shortfall: 0,
  needed: 0, slots: [], others: [], atRisk: [], ...extra,
});
const show = (extra, initial = 'MLD') =>
  render(<FullTimeConstraint initial={initial} forecast={forecast(extra)} status="ready" />).container.textContent;

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
  expect(show({ fullTime: false })).toContain('MLD is a part-time teacher');
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

test('a long list shows the first labs and the rest on request', () => {
  const labs = Array.from({ length: 11 }, (_, i) => lab(`CSE${300 + i}`, 'A', 'Sunday', 2));
  show({ uncovered: 11, needed: 1, others: labs });
  expect(screen.queryByText('CSE310 (A)')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '+3 more' }));
  expect(screen.getByText('CSE310 (A)')).toBeTruthy();
});

test('shows while checking and if the check fails', () => {
  const { rerender, container } = render(<FullTimeConstraint initial="MLD" forecast={null} status="loading" />);
  expect(container.textContent).toContain('Checking which labs still need a full-time teacher');
  rerender(<FullTimeConstraint initial="MLD" forecast={null} status="failed" />);
  expect(container.textContent).toContain('Could not check');
});
