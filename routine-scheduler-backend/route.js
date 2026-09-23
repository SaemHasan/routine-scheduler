import express from "express";
import authRouter from "./src/auth/route.js";
import teacherRouter from "./src/information/teacher/route.js";
import sectionRouter from "./src/information/section/route.js";
import roomRouter from "./src/information/room/route.js";
import sessionalTypeRouter from "./src/information/sessional_type/route.js";
import courseRouter from "./src/information/courses/route.js";
import configRouter from "./src/information/config/route.js";
import formsRouter from "./src/forms/route.js";
import assignRouter from "./src/assignment/route.js";
import scheduleRouter from "./src/schedule/route.js";
import dashboardRouter from "./src/dashboard/route.js";
import pdfRouter from "./src/pdfgenerator/route.js";
import levelTermRouter from './src/information/level_terms/route.js';
import theoryRoomRouter from './src/theory_room_assignment/route.js';
import AcademicConfig from './src/academic_config/route.js';
import versionControlRouter from './src/version-control/route.js';

import { authorize } from "./src/config/authorize.js";

const router = express.Router();

router.use("/auth", authRouter);
router.use("/teacher", authorize(), teacherRouter);
router.use("/section", authorize(), sectionRouter);
router.use("/room", authorize(), roomRouter);
router.use("/sessional_type", authorize(), sessionalTypeRouter);
router.use("/assign", authorize(), assignRouter);
router.use("/course", authorize(), courseRouter);
router.use("/config", authorize(), configRouter);
router.use("/schedule", authorize(), scheduleRouter);
router.use("/level_terms", authorize(), levelTermRouter);
router.use("/theory_room_assignment", authorize(), theoryRoomRouter);
router.use("/academic_config", authorize(), AcademicConfig);
router.use("/versions", authorize(), versionControlRouter);


router.use("/forms", formsRouter);

router.use("/dashboard", dashboardRouter)

router.use("/pdf", pdfRouter)

export default router;
