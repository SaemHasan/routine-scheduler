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
  generateAllRoomPDFs,
  generateAllDepartmentPDFs,
  serveLvlTermPDF,
  serveTeacherPDF,
  serveRoomPDF,
  serveDepartmentPDF,
  serveAllLevelTermsPDF,
  serveAllTeachersPDF,
  serveAllRoomsPDF,
  serveAllDepartmentsPDF,
} from "./controller.js";

const router = express.Router();

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
router.get("/generateAllRooms", generateAllRoomPDFs);
router.get("/generateAllDepartments", generateAllDepartmentPDFs);

router.get("/showTerm/:lvlTerm/:section", serveLvlTermPDF);
router.get("/showTeacher/:initial", serveTeacherPDF);
router.get("/showRoom/:room", serveRoomPDF);
router.get("/showDepartment/:department", serveDepartmentPDF);

router.get("/showAllLevelTerms", serveAllLevelTermsPDF);
router.get("/showAllTeachers", serveAllTeachersPDF);
router.get("/showAllRooms", serveAllRoomsPDF);
router.get("/showAllDepartments", serveAllDepartmentsPDF);

export default router;
