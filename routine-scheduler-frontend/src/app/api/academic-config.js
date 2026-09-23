import axios from "axios";
import { api_url } from ".";

export const getSectionCount = (params) =>
    axios
        .get(api_url(`/academic_config/get/section_count`), { params })
        .then((res) => res.data);

export const getAllSectionCount = () =>
    axios
        .get(api_url(`/academic_config/get/section_count/all`))
        .then((res) => res.data);

export const setSectionCount = (data) =>
    axios
        .post(api_url(`/academic_config/set/section_count`), data)
        .then((res) => res.data);

export const deleteSectionCount = (data) =>
    axios
        .delete(api_url(`/academic_config/delete/section_count`), { data })
        .then((res) => res.data);

export const getDefaultSectionCount = (params) =>
    axios
        .get(api_url(`/academic_config/default/get/section_count`), { params })
        .then((res) => res.data);

export const getDefaultAllSectionCount = () =>
    axios
        .get(api_url(`/academic_config/default/get/section_count/all`))
        .then((res) => res.data);

export const setDefaultSectionCount = (data) =>
    axios
        .post(api_url(`/academic_config/default/set/section_count`), data)
        .then((res) => res.data);

export const deleteDefaultSectionCount = (data) =>
    axios
        .delete(api_url(`/academic_config/default/delete/section_count`), { data })
        .then((res) => res.data);

export const getBatches = () =>
    axios
        .get(api_url(`/academic_config/get/batches`))
        .then((res) => res.data);

export const addBatch = (data) =>
    axios
        .post(api_url(`/academic_config/add/batch`), data)
        .then((res) => res.data);

export const deleteBatch = (data) =>
    axios
        .delete(api_url(`/academic_config/delete/batch`), { data })
        .then((res) => res.data);

export const getDepartments = () =>
    axios
        .get(api_url(`/academic_config/get/departments`))
        .then((res) => res.data);

export const getAllLevelTermsName = () =>
    axios
        .get(api_url(`/academic_config/get/level_terms`))
        .then((res) => res.data);

export const getHostedDepartments = () =>
    axios
        .get(api_url(`/academic_config/get/hosted_departments`))
        .then((res) => res.data);

export const addHostedDepartment = (data) =>
    axios
        .post(api_url(`/academic_config/add/hosted_department`), data)
        .then((res) => res.data);

export const deleteHostedDepartment = (data) =>
    axios
        .delete(api_url(`/academic_config/delete/hosted_department`), { data })
        .then((res) => res.data);
