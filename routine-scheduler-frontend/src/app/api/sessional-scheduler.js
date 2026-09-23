import axios from "axios";
import { api_url } from ".";

export const getSchedulerConstraints = () =>
  axios.get(api_url("/sessional-scheduler/constraints")).then((res) => res.data);

export const addSchedulerConstraint = (constraint) =>
  axios.post(api_url("/sessional-scheduler/constraints"), constraint).then((res) => res.data);

export const deleteSchedulerConstraint = (id) =>
  axios.delete(api_url(`/sessional-scheduler/constraints/${id}`)).then((res) => res.data);

// Suggests a routine without saving it
export const generateSessionalRoutine = (options) =>
  axios.post(api_url("/sessional-scheduler/generate"), options).then((res) => res.data);

// Saves a suggestion; locked classes are left alone
export const applySessionalRoutine = (assignments) =>
  axios.post(api_url("/sessional-scheduler/apply"), { assignments }).then((res) => res.data);

export const setSessionalLock = (placement) =>
  axios.put(api_url("/sessional-scheduler/lock"), placement).then((res) => res.data);

export const unlockAllSessionals = () =>
  axios.put(api_url("/sessional-scheduler/unlock-all")).then((res) => res.data);

// Choosing a room by hand also locks the class
export const setSessionalRoom = (placement) =>
  axios.put(api_url("/sessional-scheduler/room"), placement).then((res) => res.data);
