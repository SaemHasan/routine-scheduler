import express from "express";
import {
  getAllSchedule,
  getCurrStatus,
  getScheduleConfigValues,
  getSessionalScheduleAPI,
  getTheoryScheduleAPI,
  initiate,
  setSessionalScheduleAPI,
  setTheoryScheduleAPI,
  teacherContradiction,
  getCourseAllScheduleAPI,
  getCourseSectionalScheduleAPI,
  getDepartmentalSessionalScheduleAPI
} from "./controller.js";

const router = express.Router();

router.get("/theory/:department/:batch/:section", getTheoryScheduleAPI);
router.post("/theory/:batch/:section/:course", setTheoryScheduleAPI);

router.get("/sessional/:batch/:section", getSessionalScheduleAPI);
router.get("/sessional/departmental", getDepartmentalSessionalScheduleAPI);
router.post("/sessional/:batch/:section/:department", setSessionalScheduleAPI);

router.get("/all", getAllSchedule)
router.get("/contradiction/teacher/:batch/:section/:course_id", teacherContradiction)

router.get("/theory/initiate", initiate);

// Get schedule configuration values
router.get("/configs", getScheduleConfigValues);
router.get("/theory/status", getCurrStatus);
router.get("/get/theory/:initial/:course_id", getCourseAllScheduleAPI);
router.get("/get/sessional/:course_id/:section", getCourseSectionalScheduleAPI);
// router.get("/theory/finalize", null);

export default router;
