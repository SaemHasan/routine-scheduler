import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getInitials, getRooms, getLevelTerms, getCourses, getAllDepartmentsDB, getCurrentSession } from "./repository.js";
import { levelTermBook, teacherBook, roomBook, courseBook, departmentBook } from "./routineBook.js";
import { courseTeacherBook, courseLoadBook } from "./reportBook.js";
import { sessionalDistributionBook } from "./sessionalDistribution.js";
import { downloadName } from "./format.js";
import { courseLoadPlan, courseLoadWorkbook } from "./courseLoadPlan.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/*
 * The routine books. Each can be generated to a file (then served by the
 * show* endpoints, as the PDF page does) or downloaded at once from
 * /pdf/book/:kind. `type` begins the downloaded file's name.
 */
const BOOKS = {
  levelTerm: {
    type: "Level_Term", file: "All_Level_Terms",
    build: () => levelTermBook(), buildSelected: (value) => levelTermBook({ levelTerm: value }),
  },
  teacher: {
    type: "Teacher", file: "All_Teachers",
    build: () => teacherBook(), buildSelected: (value) => teacherBook({ initial: value }),
  },
  partTimeTeacher: {
    type: "Part_Time_Teacher",
    file: "All_PT_Teachers",
    build: () => teacherBook({ partTimeOnly: true }),
  },
  room: {
    type: "Room", file: "All_Rooms",
    build: () => roomBook(), buildSelected: (value) => roomBook({ room: value }),
  },
  course: {
    type: "Course", file: "All_Courses",
    build: () => courseBook(), buildSelected: (value) => courseBook({ course: value }),
  },
  department: {
    type: "Departmental", file: "All_Departments",
    build: () => departmentBook(), buildSelected: (value) => departmentBook({ department: value }),
  },
  courseTeacher: { type: "Course_Teacher", file: "Course_Teacher", build: () => courseTeacherBook() },
  courseLoad: { type: "Load_Calculation", file: "Load_Calculation", build: () => courseLoadBook() },
  sessionalDistribution: {
    type: "Sessional_Distribution",
    file: "Sessional_Distribution",
    build: () => sessionalDistributionBook(),
  },
};

// A file name that is safe on every system: "(EEE) R921" -> "(EEE)_R921"
const fileFor = (key) => path.resolve(__dirname, `${String(key).replace(/[\\/:*?"<>|\s]+/g, "_")}.pdf`);

async function writeBook(file, build) {
  const buffer = await build();
  await fs.promises.writeFile(fileFor(file), buffer);
  return path.basename(fileFor(file));
}

// A generated file, named for download as `type`, e.g. "Teacher KRV"
async function sendFile(res, next, file, type) {
  try {
    const filePath = fileFor(file);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ message: "PDF not found. Please generate it first." });
      return;
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${downloadName(type, await getCurrentSession())}"`);
    fs.createReadStream(filePath).on("error", next).pipe(res);
  } catch (err) {
    next(err);
  }
}

/* ------------------------------------------------------------- one book */

// GET /pdf/book/:kind[/:value] — build the same layout for a whole book or
// one selected routine. The format selector previews this fresh response.
export async function downloadBook(req, res, next) {
  try {
    const book = BOOKS[req.params.kind];
    if (!book) {
      res.status(404).json({ message: `Unknown routine: ${req.params.kind}` });
      return;
    }
    const selected = req.params.value;
    if (selected && !book.buildSelected) {
      res.status(404).json({ message: `Selection is not available for ${req.params.kind}` });
      return;
    }
    const buffer = await (selected ? book.buildSelected(selected) : book.build());
    // One routine names its selection too: Teacher_KRV_July_2026_29_October_2026.pdf
    const name = downloadName(selected ? `${book.type} ${selected}` : book.type, await getCurrentSession());
    res
      .status(200)
      .set("Content-Type", "application/pdf")
      .set("Content-Disposition", `${selected ? "inline" : "attachment"}; filename="${name}"`)
      .send(buffer);
  } catch (err) {
    next(err);
  }
}

// GET /pdf/courseLoadPlan — the Course Load workbook (xlsx)
export async function downloadCourseLoadPlan(req, res, next) {
  try {
    const { buffer, plan } = await courseLoadWorkbook();
    res
      .status(200)
      .set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .set("Content-Disposition", `attachment; filename="${downloadName("Course_Load", plan.term, "xlsx")}"`)
      .send(buffer);
  } catch (err) {
    next(err);
  }
}

// GET /pdf/courseLoadPlan/summary — the plan's numbers, part-time lecturers needed included
export async function courseLoadPlanSummary(req, res, next) {
  try {
    const plan = await courseLoadPlan();
    res.status(200).json({
      term: plan.term,
      ...plan.summary,
      designationLoads: plan.designationLoads,
      labTypes: plan.labTypes,
      loads: plan.loads,
      theory: plan.theory,
      sessional: plan.sessional,
    });
  } catch (err) {
    next(err);
  }
}

const generateAll = (kind) => async (req, res, next) => {
  try {
    const filename = await writeBook(BOOKS[kind].file, BOOKS[kind].build);
    res.status(200).json({ message: "PDF generated", filename });
  } catch (err) {
    next(err);
  }
};
const serveAll = (kind) => (req, res, next) => sendFile(res, next, BOOKS[kind].file, BOOKS[kind].type);

export const generateAllLevelTermPDFs = generateAll("levelTerm");
export const generateAllTeacherPDFs = generateAll("teacher");
export const generateAllPartTimeTeacherPDFs = generateAll("partTimeTeacher");
export const generateAllRoomPDFs = generateAll("room");
export const generateAllDepartmentPDFs = generateAll("department");
export const generateCourseTeacherPDF = generateAll("courseTeacher");
export const generateCourseLoadPDF = generateAll("courseLoad");

export const serveAllLevelTermsPDF = serveAll("levelTerm");
export const serveAllTeachersPDF = serveAll("teacher");
export const serveAllPartTimeTeachersPDF = serveAll("partTimeTeacher");
export const serveAllRoomsPDF = serveAll("room");
export const serveAllDepartmentsPDF = serveAll("department");
export const serveCourseTeacherPDF = serveAll("courseTeacher");
export const serveCourseLoadPDF = serveAll("courseLoad");

/* -------------------------------------------------- one routine at a time */

export async function generatePDF(req, res, next) {
  try {
    const { lvlTerm } = req.params;
    const filename = await writeBook(lvlTerm, () => levelTermBook({ levelTerm: lvlTerm }));
    res.status(200).json({ message: "PDF generated", filename });
  } catch (err) {
    next(err);
  }
}

export async function teacherPDF(req, res, next) {
  try {
    const { initial } = req.params;
    const filename = await writeBook(initial, () => teacherBook({ initial }));
    res.status(200).json({ message: "PDF generated", filename });
  } catch (err) {
    next(err);
  }
}

export async function roomPDF(req, res, next) {
  try {
    const { room } = req.params;
    const filename = await writeBook(`room_${room}`, () => roomBook({ room }));
    res.status(200).json({ message: "PDF generated", filename });
  } catch (err) {
    next(err);
  }
}

export async function DepartmentPDF(req, res, next) {
  try {
    const { department } = req.params;
    const filename = await writeBook(`department_${department}`, () => departmentBook({ department }));
    res.status(200).json({ message: "PDF generated", filename });
  } catch (err) {
    next(err);
  }
}

export const serveLvlTermPDF = (req, res, next) =>
  sendFile(res, next, req.params.lvlTerm, `${BOOKS.levelTerm.type} ${req.params.lvlTerm}`);
export const serveTeacherPDF = (req, res, next) =>
  sendFile(res, next, req.params.initial, `${BOOKS.teacher.type} ${req.params.initial}`);
export const serveRoomPDF = (req, res, next) =>
  sendFile(res, next, `room_${req.params.room}`, `${BOOKS.room.type} ${req.params.room}`);
export const serveDepartmentPDF = (req, res, next) =>
  sendFile(res, next, `department_${req.params.department}`, `${BOOKS.department.type} ${req.params.department}`);

/* ------------------------------------------------------------ the lists */

export async function getAllInitial(req, res, next) {
  try {
    res.status(200).json({ initials: await getInitials() });
  } catch (err) {
    next(err);
  }
}

export async function getAllIRooms(req, res, next) {
  try {
    res.status(200).json({ rooms: await getRooms() });
  } catch (err) {
    next(err);
  }
}

export async function getAllLevelTerm(req, res, next) {
  try {
    const result = await getLevelTerms();
    res.status(200).json(result.map((row) => row.level_term).sort());
  } catch (err) {
    next(err);
  }
}

export async function getAllCourses(req, res, next) {
  try {
    res.status(200).json({ courses: await getCourses() });
  } catch (err) {
    next(err);
  }
}

export async function getAllDepartments(req, res, next) {
  try {
    res.status(200).json({ departments: await getAllDepartmentsDB() });
  } catch (err) {
    next(err);
  }
}
