import express from "express";
import {
  getAllLevelTerm,
  getAllInitial,
  getAllIRooms,
  getAllDepartments,
  generatePDF,
  teacherPDF,
  roomPDF,
  DepartmentPDF,
  generateAllLevelTermPDFs,
  generateAllTeacherPDFs,
  generateAllPartTimeTeacherPDFs,
  generateAllRoomPDFs,
  generateAllDepartmentPDFs,
  generateCourseTeacherPDF,
  generateCourseLoadPDF,
  serveLvlTermPDF,
  serveTeacherPDF,
  serveRoomPDF,
  serveDepartmentPDF,
  serveAllLevelTermsPDF,
  serveAllTeachersPDF,
  serveAllPartTimeTeachersPDF,
  serveAllRoomsPDF,
  serveAllDepartmentsPDF,
  serveCourseTeacherPDF,
  serveCourseLoadPDF,
  downloadBook,
  downloadCourseLoadPlan,
  courseLoadPlanSummary,
} from "./controller.js";

import { sessionalDistributionPDF } from "./sessionalDistribution.js";

const router = express.Router();

// The sessional distribution, laid out like the printed routines
router.get("/sessionalDistribution", sessionalDistributionPDF);

// Any routine book at once: levelTerm, teacher, partTimeTeacher, room,
// department, courseTeacher, courseLoad, sessionalDistribution
router.get("/book/:kind", downloadBook);
router.get("/book/:kind/:value", downloadBook);

// The course load plan: the Course Load workbook, and its numbers
router.get("/courseLoadPlan", downloadCourseLoadPlan);
router.get("/courseLoadPlan/summary", courseLoadPlanSummary);

router.get("/allInitial", getAllInitial);
router.get("/allRooms", getAllIRooms);
router.get("/allLevelTerm", getAllLevelTerm);
router.get("/allDepartments", getAllDepartments);

router.get("/generate/:lvlTerm", generatePDF);
router.get("/generateTeacher/:initial", teacherPDF);
router.get("/generateRoom/:room", roomPDF);
router.get("/generateDepartment/:department", DepartmentPDF);

router.get("/generateAllLevelTerms", generateAllLevelTermPDFs);
router.get("/generateAllTeachers", generateAllTeacherPDFs);
router.get("/generateAllPartTimeTeachers", generateAllPartTimeTeacherPDFs);
router.get("/generateAllRooms", generateAllRoomPDFs);
router.get("/generateAllDepartments", generateAllDepartmentPDFs);
router.get("/generateCourseTeacher", generateCourseTeacherPDF);
router.get("/generateCourseLoad", generateCourseLoadPDF);

router.get("/showTerm/:lvlTerm/:section", serveLvlTermPDF);
router.get("/showTeacher/:initial", serveTeacherPDF);
router.get("/showRoom/:room", serveRoomPDF);
router.get("/showDepartment/:department", serveDepartmentPDF);

router.get("/showAllLevelTerms", serveAllLevelTermsPDF);
router.get("/showAllTeachers", serveAllTeachersPDF);
router.get("/showAllPartTimeTeachers", serveAllPartTimeTeachersPDF);
router.get("/showAllRooms", serveAllRoomsPDF);
router.get("/showAllDepartments", serveAllDepartmentsPDF);
router.get("/showCourseTeacher", serveCourseTeacherPDF);
router.get("/showCourseLoad", serveCourseLoadPDF);

export default router;
