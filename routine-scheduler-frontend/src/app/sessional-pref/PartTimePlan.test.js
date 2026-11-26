import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import PartTimePlan from './PartTimePlan';
import { getPartTimePlan } from '../api/theory-assign';
import { setConfiguration } from '../api/config';

jest.mock('../api/theory-assign', () => ({ getPartTimePlan: jest.fn() }));
jest.mock('../api/config', () => ({ setConfiguration: jest.fn() }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: Object.assign(jest.fn(), {
  success: jest.fn(), error: jest.fn(),
}) }));

const plan = (extra) => ({
  mode: 'part-time', initial: null, partTimeCredit: 21, labsPerTeacher: 7, emptySlots: 39, labsShort: 34,
  teachersLeft: 0, teachersLabsLeft: 0, shortfall: 39, more: 8, needed: 0, slots: [], others: [], atRisk: [],
  busiest: [{ day: 'Saturday', time: 2, empty: 8 }, { day: 'Sunday', time: 11, empty: 6 }], ...extra,
});
const shown = async (extra) => {
  getPartTimePlan.mockResolvedValue(plan(extra));
  const { container } = render(<PartTimePlan refreshKey={0} />);
  await screen.findByText(/teaching slot|Every lab has all its teachers/);
  return container.textContent;
};

test('says how many part-time teachers it takes before any are added', async () => {
  const text = await shown({});
  expect(text).toContain('39 teaching slots are still empty in 34 labs, with the labs assigned so far. ' +
    'Most at once: Saturday 2:00 (8), Sunday 11:00 (6).');
  expect(text).toContain('No part-time teachers yet. 8 part-time teachers at 21 credits each would fill every slot.');
  expect(text).toContain('(7 labs)');
});

test('says whether the part-time teachers in the list are enough', async () => {
  expect(await shown({ teachersLeft: 5, shortfall: 8, more: 3 })).toContain(
    'The 5 part-time teachers in the list can fill 31 of them; 8 would stay empty. ' +
    '3 more part-time teachers at 21 credits each would fill every slot.');
});

test('says when the part-time teachers can fill every slot', async () => {
  expect(await shown({ teachersLeft: 8, shortfall: 0, more: 0 })).toContain(
    'The 8 part-time teachers in the list can fill every empty slot.');
});

test('says when every lab has all its teachers', async () => {
  expect(await shown({ emptySlots: 0, labsShort: 0, shortfall: 0, more: 0, busiest: [] }))
    .toContain('Every lab has all its teachers.');
});

test('saves the credit load part-time teachers take and checks again', async () => {
  await shown({});
  setConfiguration.mockResolvedValue({ success: true });
  expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Each part-time teacher takes'), { target: { value: '18' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
  expect(setConfiguration).toHaveBeenCalledWith('PART_TIME_CREDIT', 18);
  await waitFor(() => expect(getPartTimePlan).toHaveBeenCalledTimes(2));
});
