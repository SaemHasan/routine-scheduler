import axios from "axios";
import { api_url } from ".";

/**
 * Get schedule configuration values (times, days, possibleLabTimes)
 */
export const getScheduleConfigs = () =>
    axios.get(api_url("/schedule/configs")).then((res) => res.data.data);

export const getSchedules = (department, batch, section) => 
    axios.get(api_url(`/schedule/theory/${department}/${batch}/${section}`)).then((res) => res.data);

export const setSchedules = (batch, section, course, schedules) => 
    axios.post(api_url(`/schedule/theory/${batch}/${section}/${course}`), schedules).then((res) => res.data);

export const initiateTheorySchedule = () =>
    axios.get(api_url("/schedule/theory/initiate")).then((res) => res.data);

export const getTheoryScheduleStatus = () =>
    axios.get(api_url("/schedule/theory/status")).then((res) => res.data);

export const finalizeTheorySchedule = () =>
    axios.get(api_url("/schedule/theory/finalize")).then((res) => res.data);

export const getAllSchedule = () =>
    axios.get(api_url("/schedule/all")).then((res) => res.data);

export const getCourseAllSchedule = (initial, course_id) =>
    axios.get(api_url(`/schedule/get/theory/${initial}/${course_id}`)).then((res) => res.data);

export const getCourseSectionalSchedule = (course_id, section) =>
    axios.get(api_url(`/schedule/get/sessional/${course_id}/${section}`)).then((res) => res.data);
