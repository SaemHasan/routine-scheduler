import axios from "axios";
import { api_url } from ".";

export const getAllTheoryRoomAssignment = () =>
  axios.get(api_url("/theory_room_assignment/get/all")).then((res) => res.data);

export const updateTheoryRoomAssignment = (assignment) =>
  axios.post(api_url(`/theory_room_assignment/update`), assignment).then((res) => res.data);

export const getAllSectionRoomAllocation = () =>
  axios.get(api_url("/theory_room_assignment/section/get/all")).then((res) => res.data);

export const updateSectionRoomAllocation = (allocation) =>
  axios.put(api_url(`/theory_room_assignment/section/update`), allocation).then((res) => res.data);

export const getAllNonDepartmentalLabRoomAssignment = () =>
  axios.get(api_url("/theory_room_assignment/non-departmental/get/all")).then((res) => res.data);

export const updateNonDepartmentalLabRoomAssignment = (assignment) =>
  axios.put(api_url(`/theory_room_assignment/non-departmental/update`), assignment).then((res) => res.data);