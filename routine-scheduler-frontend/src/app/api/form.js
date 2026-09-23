import axios from "axios";
import { api_url } from ".";

export const getTheoryPreferencesForm = (initial) =>
  axios.get(api_url(`/forms/theory-pref/${initial}`)).then((res) => res.data);

export const submitTheoryPreferencesForm = (initial, data) =>
  axios.put(api_url(`/forms/theory-pref/${initial}`), data).then((res) => res.data);

export const getSessionalPreferencesForm = (initial) =>
  axios.get(api_url(`/forms/sessional-pref/${initial}`)).then((res) => res.data);

export const submitSessionalPreferencesForm = (initial, data) =>
  axios.put(api_url(`/forms/sessional-pref/${initial}`), data).then((res) => res.data);

export const getTheoryScheduleForm = (initial) =>
  axios.get(api_url(`/forms/theory-sched/${initial}`)).then((res) => res.data);

export const submitTheoryScheduleForm = (initial, data) =>
  axios.put(api_url(`/forms/theory-sched/${initial}`), data).then((res) => res.data);
