import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TeacherDetails from './TeacherDetails';
import TeacherCommitmentTable from './TeacherCommitmentTable';
import { formatSessionalTeachers, slotCount, sessionalLoad } from '../shared/sessionalTeachers';
import { getTeacher } from '../api/db-crud';
import { getTeacherTheoryAssigments, getTeacherSessionalAssignment,
  getSessionalTeachers, getTeacherTotalCredit, setTeacherSessionalAssignment } from '../api/theory-assign';
import { getCourseAllSchedule, getCourseSectionalSchedule } from '../api/theory-schedule';
import { getDepartmentalSessionalSchedule } from '../api/sessional-schedule';
import { getThesisSetup } from '../api/thesis';

jest.mock('../api/db-crud', () => ({ getTeacher: jest.fn() }));
jest.mock('../api/theory-assign', () => ({
  getTeacherTheoryAssigments: jest.fn(), getTeacherSessionalAssignment: jest.fn(),
  setTeacherSessionalAssignment: jest.fn(), deleteTeacherSessionalAssignment: jest.fn(),
  getSessionalTeachers: jest.fn(), getTeacherTotalCredit: jest.fn(),
}));
jest.mock('../api/theory-schedule', () => ({ getCourseAllSchedule: jest.fn(), getCourseSectionalSchedule: jest.fn() }));
jest.mock('../api/sessional-schedule', () => ({ getDepartmentalSessionalSchedule: jest.fn() }));
jest.mock('../api/thesis', () => ({ getThesisSetup: jest.fn() }));
jest.mock('../shared/ConfigContext', () => ({ useConfig: () => ({
  days: ['Tuesday'], times: [8, 9, 10, 11, 12, 1, 2, 3, 4], possibleLabTimes: [8, 11, 2],
}) }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: Object.assign(jest.fn(), {
  success: jest.fn(), error: jest.fn(), loading: jest.fn(), dismiss: jest.fn(), custom: jest.fn(),
}) }));

const lab = { course_id: 'CSE106', section: 'A1', batch: 25, day: 'Tuesday', time: 11, class_per_week: 1.5 };
const theory = { course_id: 'CSE105', section: 'B', day: 'Tuesday', time: 12 };

test('four half teachers and one full teacher fill three teaching slots with 1.5/3 loads', () => {
  const teachers = ['AKMAR', 'MN', 'SMH', 'MHE', 'KRV'].map((initial, i) => ({ initial, share: i < 4 ? 0.5 : 1 }));
  expect(formatSessionalTeachers(teachers)).toBe('AKMAR/MN, SMH/MHE, KRV');
  expect(slotCount(teachers)).toBe(3);
  expect(teachers.map(teacher => sessionalLoad({ ...lab, ...teacher }))).toEqual([1.5, 1.5, 1.5, 1.5, 3]);
});

test('overlapping half lab, theory and thesis all remain visible', () => {
  render(<TeacherCommitmentTable days={['Tuesday']} times={[11, 12, 1, 2, 3, 4]}
    theory={[theory]} labs={[{ ...lab, share: 0.5 }]}
    theses={[{ course_id: 'CSE400', thesis: 1, day: 'Tuesday', hours: [11, 12, 1, 2, 3, 4] }]}
    onEdit={jest.fn()} />);
  const theoryCell = screen.getByText('CSE105').closest('td');
  expect(theoryCell.textContent).toContain('CSE106');
  expect(theoryCell.textContent).toContain('Half slot · 1.5 load');
  expect(theoryCell.textContent).toContain('CSE400');
  expect(theoryCell.textContent).toContain('Thesis 1 · 6 hours');
});

test('lab-assign saves a half slot despite an overlapping theory class', async () => {
  getTeacher.mockResolvedValue({ initial: 'AKMAR', name: 'Teacher', offers_thesis_1: true });
  getTeacherTheoryAssigments.mockResolvedValue([{ course_id: 'CSE105' }]);
  getTeacherSessionalAssignment.mockResolvedValue([]);
  getSessionalTeachers.mockResolvedValue([]);
  getTeacherTotalCredit.mockResolvedValue({ totalCredit: 6 });
  getCourseAllSchedule.mockResolvedValue([theory]);
  getCourseSectionalSchedule.mockResolvedValue([lab]);
  getDepartmentalSessionalSchedule.mockResolvedValue([lab]);
  getThesisSetup.mockResolvedValue({ slots: [{ thesis: 1, day: 'Tuesday', start_time: 11, end_time: 4 }],
    levelTerms: [{ active: true, thesis: 1 }] });
  setTeacherSessionalAssignment.mockResolvedValue({ message: 'Assignment Successful' });
  render(<TeacherDetails teacherId="AKMAR" onAssignmentChange={jest.fn()} />);

  await screen.findByText('CSE105');
  await screen.findByText('CSE106 (A1)');
  expect((await screen.findAllByText('Thesis 1 · 6 hours')).length).toBeGreaterThan(0);
  await act(async () => fireEvent.click(screen.getByText('CSE106 (A1)')));
  expect(screen.queryByRole('button', { name: /Assign 1 Sessional Course/ })).toBeNull();
  await act(async () => fireEvent.change(screen.getByLabelText('New assignment:'), { target: { value: '0.5' } }));
  await act(async () => fireEvent.click(screen.getByText('CSE106 (A1)')));
  expect(screen.getByText('Half slot · 1.5 load')).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Assign 1 Sessional Course/ })));
  await waitFor(() => expect(setTeacherSessionalAssignment).toHaveBeenCalledWith({
    initial: 'AKMAR', course_id: 'CSE106', batch: 25, section: 'A1', share: 0.5,
  }));
});
