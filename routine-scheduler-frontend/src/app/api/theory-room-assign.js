import axios from "axios";
import { api_url } from ".";

export const getAllTheoryRoomAssignment = () =>
  axios.get(api_url("/theory_room_assignment/get/all")).then((res) => res.data);

export const updateTheoryRoomAssignment = (assignment) =>
  axios.post(api_url(`/theory_room_assignment/update`), assignment).then((res) => res.data);

// { course_id, department, batch, section, day, time, new_day, new_time,
// room_no? } — without room_no the class keeps its room
export const moveTheoryClass = (move) =>
  axios.post(api_url("/theory_room_assignment/move"), move).then((res) => res.data);

export const getAllSectionRoomAllocation = () =>
  axios.get(api_url("/theory_room_assignment/section/get/all")).then((res) => res.data);

export const updateSectionRoomAllocation = (allocation) =>
  axios.put(api_url(`/theory_room_assignment/section/update`), allocation).then((res) => res.data);

export const getAllNonDepartmentalLabRoomAssignment = () =>
  axios.get(api_url("/theory_room_assignment/non-departmental/get/all")).then((res) => res.data);

export const updateNonDepartmentalLabRoomAssignment = (assignment) =>
  axios.put(api_url(`/theory_room_assignment/non-departmental/update`), assignment).then((res) => res.data);