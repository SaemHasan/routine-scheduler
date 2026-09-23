import express from "express";

const router = express.Router();

import {
    getSectionCountAPI,
    getAllSectionCountAPI,
    setSectionCountAPI,
    deleteSectionCountAPI,
    getDefaultSectionCountAPI,
    getDefaultAllSectionCountAPI,
    setDefaultSectionCountAPI,
    deleteDefaultSectionCountAPI,
    getBatchesAPI,
    addBatchAPI,
    deleteBatchAPI,
    getDepartmentsAPI,
    getLevelTermsAPI,
    getHostedDepartmentsAPI,
    addHostedDepartmentAPI,
    deleteHostedDepartmentAPI
} from './controller.js';

router.get("/get/section_count", getSectionCountAPI);
router.get("/get/section_count/all", getAllSectionCountAPI);
router.post("/set/section_count", setSectionCountAPI);
router.delete("/delete/section_count", deleteSectionCountAPI);

router.get("/default/get/section_count", getDefaultSectionCountAPI);
router.get("/default/get/section_count/all", getDefaultAllSectionCountAPI);
router.post("/default/set/section_count", setDefaultSectionCountAPI);
router.delete("/default/delete/section_count", deleteDefaultSectionCountAPI);

router.get("/get/batches", getBatchesAPI);
router.post("/add/batch", addBatchAPI);
router.delete("/delete/batch", deleteBatchAPI);

router.get("/get/departments", getDepartmentsAPI);
router.get("/get/level_terms", getLevelTermsAPI);
    
router.get("/get/hosted_departments", getHostedDepartmentsAPI);
router.post("/add/hosted_department", addHostedDepartmentAPI);
router.delete("/delete/hosted_department", deleteHostedDepartmentAPI);

export default router;