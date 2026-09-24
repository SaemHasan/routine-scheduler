import axios from "axios";
import { api_url } from ".";

// Thesis times, which level-term takes which thesis, and any clashes
export const getThesisSetup = () =>
  axios.get(api_url("/thesis")).then((res) => res.data);

export const setThesisSlot = (thesis, slot) =>
  axios.put(api_url(`/thesis/slots/${thesis}`), slot).then((res) => res.data);

export const setLevelTermThesis = (assignment) =>
  axios.put(api_url("/thesis/level-term"), assignment).then((res) => res.data);
