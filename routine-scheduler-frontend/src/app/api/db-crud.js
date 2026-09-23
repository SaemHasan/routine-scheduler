import axios from "axios";
import { api_url } from ".";

export const getTeachers = () =>
  axios.get(api_url("/teacher")).then((res) => res.data);
export const getTeacher = (initial) =>
  axios.get(api_url(`/teacher/${initial}`)).then((res) => res.data);
export const createTeacher = (teacher) =>
  axios.post(api_url("/teacher"), teacher).then((res) => res.data);
export const updateTeacher = (initial, teacher) =>
  axios.put(api_url(`/teacher/${initial}`), teacher).then((res) => res.data);
export const deleteTeacher = (initial) =>
  axios.delete(api_url(`/teacher/${initial}`)).then((res) => res.data);

export const getCourses = () =>
    axios.get(api_url("/course")).then((res) => res.data);

export const getActiveCourseIds = () =>
    axios.get(api_url("/course/active")).then((res) => res.data);


export const addCourse = (course) =>
  axios.post(api_url("/course"), course).then((res) => res.data);

export const editCourse = (course_id, course) =>
  axios.put(api_url(`/course/${course_id}`), course).then((res) => res.data);

// Optional courses only join a session when explicitly activated.
export const setCourseActive = (course_id, data) =>
  axios
    .put(api_url(`/course/${course_id}/active`), data)
    .then((res) => res.data);

export const deleteCourse = (course_id, level_term) =>
  axios
    .delete(api_url(`/course/${course_id}`), {
      params: level_term ? { level_term } : undefined,
    })
    .then((res) => res.data);

export const getRooms = () =>
  axios.get(api_url("/room")).then((res) => res.data);
export const getRoom = (room) =>
  axios.get(api_url(`/room/${room}`)).then((res) => res.data);
export const createRoom = (room) =>
  axios.post(api_url("/room"), room).then((res) => res.data);
export const updateRoom = (room, newRoom) =>
  axios.put(api_url(`/room/${room}`), newRoom).then((res) => res.data);
export const deleteRoom = (room) =>
  axios.delete(api_url(`/room/${room}`)).then((res) => res.data);

export const getSections = () =>
  axios.get(api_url("/section")).then((res) => res.data);
export const getSection = (batch,section) =>
  axios.get(api_url(`/section/${batch}/${section}`)).then((res) => res.data);
export const createSection = (section) =>
  axios.post(api_url("/section"), section).then((res) => res.data);
export const updateSection = (batch,section,department, newSection) =>
  axios.put(api_url(`/section/${batch}/${section}/${department}`), newSection).then((res) => res.data);
export const deleteSection = (batch,section, department) =>
  axios.delete(api_url(`/section/${batch}/${section}/${department}`)).then((res) => res.data);
export const getSessionalSectionsByDeptAndLevelTerm = (department, level_term) =>
  axios.get(api_url(`/section/${department}/${level_term}`)).then((res) => res.data);
export const getTheorySectionsByDeptAndLevelTerm = (department, level_term) =>
  axios.get(api_url(`/section/theory/${department}/${level_term}`)).then((res) => res.data);



export const getSessionalTypes = () =>
  axios.get(api_url("/sessional_type")).then((res) => res.data);
export const updateSessionalType = (code, sessionalType) =>
  axios.put(api_url(`/sessional_type/${code}`), sessionalType).then((res) => res.data);

export const getLabRooms = () =>
  axios.get(api_url("/room/labs")).then((res) => res.data);
export const getLabCourses = () =>
  axios.get(api_url("/course/labs")).then((res) => res.data);
export const getSessionalCoursesByDeptLevelTerm = (department, level_term) =>
    axios.get(api_url(`/course/labs/${department}/${level_term}`)).then((res) => res.data);
export const getNonDeptLabRooms = () =>
  axios.get(api_url("/room/labs/non_dept")).then((res) => res.data);
export const getNonDeptLabCourses = () =>
  axios.get(api_url("/course/labs/non_dept")).then((res) => res.data);
export const getTheoryCoursesByDeptLevelTerm = (department, level_term) =>
    axios.get(api_url(`/course/theory/${department}/${level_term}`)).then((res) => res.data);



export const getLevelTerms = () =>
  axios.get(api_url("/level_terms")).then((res) => res.data);
export const setLevelTermsDB = (levelTerms) =>
  axios.put(api_url("/level_terms/set"), levelTerms).then((res) => res.data);
export const addLevelTerm = (data) =>
  axios.post(api_url("/level_terms/add"), data).then((res) => res.data);
export const deleteLevelTerm = (data) =>
  axios.delete(api_url("/level_terms/delete"), { data }).then((res) => res.data);
export const getActiveDepartments = () =>
  axios.get(api_url("/level_terms/active-departments")).then((res) => res.data);
export const getDepartmentalLevelTermBatches = (department) =>
  axios.get(api_url(`/level_terms/departmental_level_term_batches/${department}`)).then((res) => res.data);

