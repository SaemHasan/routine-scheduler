import axios from "axios";
import { api_url } from ".";

export const getPdfForStudent = (lvlTerm, section) =>
  axios
    .get(api_url(`/pdf/showTerm/${lvlTerm}/${section}`), {
      responseType: "blob",
    })
    .then((res) => res.data);

export const getAllInitial = () =>
  axios.get(api_url(`/pdf/allInitial`)).then((res) => res.data);

export const getPdfForTeacher = (initial) =>
  axios
    .get(api_url(`/pdf/showTeacher/${initial}`), { responseType: "blob" })
    .then((res) => res.data);

export const getPdfForRoom = (initial) =>
  axios
    .get(api_url(`/pdf/showRoom/${initial}`), { responseType: "blob" })
    .then((res) => res.data);

export const getAllRooms = () =>
  axios.get(api_url(`/pdf/allRooms`)).then((res) => res.data);

export const getAllLevelTerms = () =>
  axios.get(api_url(`/pdf/allLevelTerm`)).then((res) => res.data);

export const regeneratePdfLevelTerm = (lvlTerm) =>
  axios.get(api_url(`/pdf/generate/${lvlTerm}`)).then((res) => res.data);

export const regenerateTeacher = (initial) =>
  axios.get(api_url(`/pdf/generateTeacher/${initial}`)).then((res) => res.data);

export const regenerateRoom = (room) =>
  axios.get(api_url(`/pdf/generateRoom/${room}`)).then((res) => res.data);

export const sendMail = (initial) =>
  axios.get(api_url(`/pdf/sendMail/${initial}`)).then((res) => res.data);

export const regenerateAllLevelTerms = () =>
  axios.get(api_url(`/pdf/generateAllLevelTerms`)).then((res) => res.data);

export const regenerateAllTeachers = () =>
  axios.get(api_url(`/pdf/generateAllTeachers`)).then((res) => res.data);

export const regenerateAllRooms = () =>
  axios.get(api_url(`/pdf/generateAllRooms`)).then((res) => res.data);

export const getPdfForAllLevelTerms = () =>
  axios
    .get(api_url(`/pdf/showAllLevelTerms`), { responseType: "blob" })
    .then((res) => res.data);

export const getPdfForAllTeachers = () =>
  axios
    .get(api_url(`/pdf/showAllTeachers`), { responseType: "blob" })
    .then((res) => res.data);

export const getPdfForAllRooms = () =>
  axios
    .get(api_url(`/pdf/showAllRooms`), { responseType: "blob" })
    .then((res) => res.data);

// Department API functions
export const getAllDepartments = () =>
  axios.get(api_url(`/pdf/allDepartments`)).then((res) => res.data);

export const getPdfForDepartment = (department) =>
  axios
    .get(api_url(`/pdf/showDepartment/${department}`), { responseType: "blob" })
    .then((res) => res.data);

export const regenerateDepartment = (department) =>
  axios
    .get(api_url(`/pdf/generateDepartment/${department}`))
    .then((res) => res.data);

export const regenerateAllDepartments = () =>
  axios.get(api_url(`/pdf/generateAllDepartments`)).then((res) => res.data);

export const getPdfForAllDepartments = () =>
  axios
    .get(api_url(`/pdf/showAllDepartments`), { responseType: "blob" })
    .then((res) => res.data);
