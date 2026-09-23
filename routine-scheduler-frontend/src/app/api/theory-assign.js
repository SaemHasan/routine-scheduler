import axios from "axios";
import { api_url } from ".";

export const getStatus = () =>
  axios.get(api_url("/assign/theory/status")).then((res) => res.data);

export const setTheoryAssignStatus = (status) =>
  axios.put(api_url("/assign/theory/status"), { status }).then((res) => res.data);

export const initiate = () =>
  axios.get(api_url("/assign/theory/initiate")).then((res) => res.data);

export const finalize = () =>
  axios.get(api_url("/assign/theory/finalize")).then((res) => res.data);

export const getTheoryAssignement = () =>
  axios.get(api_url("/assign/theory/all")).then((res) => res.data);

export const getTeacherTheoryAssigments = (initial) =>
  axios.get(api_url(`/assign/theory/${initial}`)).then((res) => res.data);

export const getRoomAssign = () =>
  axios.get(api_url("/assign/room/status")).then((res) => res.data);

export const setRoomAssign = (data) =>
  axios.post(api_url("/assign/room/assign"), data).then((res) => res.data);

export const getSessionalStatus = () =>
  axios.get(api_url("/assign/sessional/status")).then((res) => res.data);

export const getTeacherSessionalAssignment = (initial) =>
  axios.get(api_url(`/assign/sessional/${initial}`)).then((res) => res.data);

export const getSessionalTeachers = (course_id, section) =>
  axios.get(api_url(`/assign/sessional/teachers/${course_id}/${section}`)).then((res) => res.data);

export const getAllSessionalAssignment = () =>
  axios.get(api_url("/assign/sessional/all")).then((res) => res.data);

export const initiateSessional = () =>
  axios.get(api_url("/assign/sessional/initiate")).then((res) => res.data);

export const finalizeSessional = () =>
  axios.get(api_url("/assign/sessional/finalize")).then((res) => res.data);

export const setTeacherAssignment = (assignment) =>
  axios.put(api_url("/assign/theory/set"), assignment).then((res) => res.data);

export const setTeacherSessionalAssignment = (assignment) =>
  axios.put(api_url("/assign/sessional/set"), assignment).then((res) => res.data);

export const deleteTeacherSessionalAssignment = (unassignData) =>
  axios.delete(api_url("/assign/sessional/delete"), {data: unassignData}).then((res) => res.data);

export const resendTheoryPrefMail = (initial) =>
  axios.get(api_url(`/assign/theory/resend/${initial}`)).then((res) => res.data);

export const addTheoryPreference = (initial, response) =>
  axios.post(api_url(`/assign/theory/add-pref/${initial}`), { response }).then((res) => res.data);

export const saveReorderedTeacherPreference = (initial, response) =>
  axios.post(api_url("/assign/theory/save-preference"), {initial, response,}).then((res) => res.data);

export const getAllTheoryTeacherAssignment = () =>
  axios.get(api_url("/assign/theory-teacher/get/all")).then((res) => res.data);

export const getTheoryTeacherAssignment = (course_id, section) =>
  axios.get(api_url(`/assign/theory-teacher/get/${course_id}/${section}`)).then((res) => res.data);

export const addTheoryTeacherAssignment = (course_id, section, initial) =>
  axios.post(api_url("/assign/theory-teacher/add"), { course_id, section, initial }).then((res) => res.data);

export const deleteTheoryTeacherAssignment = (course_id, section, initial) =>
  axios.delete(api_url(`/assign/theory-teacher/delete/${course_id}/${section}/${initial}`)).then((res) => res.data);

// Credit calculation API functions
export const getTeacherTotalCredit = (initial) =>
  axios.get(api_url(`/assign/credit/teacher/${initial}`)).then((res) => res.data);

export const getAllTeachersCredit = () =>
  axios.get(api_url("/assign/credit/all")).then((res) => res.data);

// Theory distribution API function
export const getTheoryDistribution = () =>
  axios.get(api_url("/assign/theory-distribution")).then((res) => res.data);

// Sessional distribution API function
export const getSessionalDistribution = () =>
  axios.get(api_url("/assign/sessional-distribution")).then((res) => res.data);