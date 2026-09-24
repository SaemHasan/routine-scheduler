
import express from 'express'

const router = express.Router();

import {  getAllCourse , getOptionalOfferingsAPI, saveOptionalOfferingsAPI, getActiveCourseIdsAPI, addCourse , editCourse, deleteCourse, setCourseActiveAPI, getLabCourses, getNonDeptLabCourses, getSessionalCoursesByDeptLevelTermAPI,getTheoryCoursesByDeptLevelTermAPI,getNonDeptTheoryCourses } from './controller.js';
import validate from "../../config/validation.js";
import {body} from 'express-validator'

router.get("/", getAllCourse)
router.get("/active", getActiveCourseIdsAPI)
// Electives offered this session and their options
router.get("/optional", getOptionalOfferingsAPI)
router.put("/optional", saveOptionalOfferingsAPI)
// router.get("/:initial", getCourse)

// Debug test endpoint
router.post("/test-debug", (req, res) => {
  console.log('DEBUG TEST ENDPOINT: Raw request body:', JSON.stringify(req.body, null, 2));
  res.json({ message: "Debug test completed", receivedData: req.body });
});

router.post("/",addCourse)
router.put("/:course_id",editCourse)
router.put("/:course_id/active", setCourseActiveAPI)
router.delete("/:course_id",deleteCourse)

router.get("/labs",getLabCourses)
router.get("/labs/non_dept", getNonDeptLabCourses)
router.get("/labs/:department/:level_term", getSessionalCoursesByDeptLevelTermAPI)

router.get("/theory/:department/:level_term", getTheoryCoursesByDeptLevelTermAPI)
router.get("/theory/non_dept", getNonDeptTheoryCourses)

export default router;