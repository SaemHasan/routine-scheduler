import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getInitials, getRooms, getLevelTerms, getAllDepartmentsDB, getCurrentSession } from "./repository.js";
import { levelTermBook, teacherBook, roomBook, departmentBook } from "./routineBook.js";
import { courseTeacherBook, courseLoadBook } from "./reportBook.js";
import { sessionalDistributionBook, termTitle } from "./sessionalDistribution.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/*
 * The routine books. Each can be generated to a file (then served by the
 * show* endpoints, as the PDF page does) or downloaded at once from
 * /pdf/book/:kind.
 */
const BOOKS = {
  levelTerm: { name: "Level_Term_Routine", file: "All_Level_Terms", build: () => levelTermBook() },
  teacher: { name: "Teacher_Routine", file: "All_Teachers", build: () => teacherBook() },
  partTimeTeacher: {
    name: "PT_Teacher_Routine",
    file: "All_PT_Teachers",
    build: () => teacherBook({ partTimeOnly: true }),
  },
  room: { name: "Room_Routine", file: "All_Rooms", build: () => roomBook() },
  department: { name: "Departmental_Routine", file: "All_Departments", build: () => departmentBook() },
  courseTeacher: { name: "Course_Teacher", file: "Course_Teacher", build: () => courseTeacherBook() },
  courseLoad: { name: "Course_Load", file: "Course_Load", build: () => courseLoadBook() },
  sessionalDistribution: {
    name: "Sessional_Distribution_Routine",
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

function sendFile(res, next, file, downloadName) {
  const filePath = fileFor(file);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ message: "PDF not found. Please generate it first." });
    return;
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${downloadName || path.basename(filePath)}"`);
  fs.createReadStream(filePath).on("error", next).pipe(res);
}

/* ------------------------------------------------------------- one book */

// GET /pdf/book/:kind — builds a book and sends it for download
export async function downloadBook(req, res, next) {
  try {
    const book = BOOKS[req.params.kind];
    if (!book) {
      res.status(404).json({ message: `Unknown routine: ${req.params.kind}` });
      return;
    }
    const buffer = await book.build();
    const term = termTitle(await getCurrentSession()).replace(/\s+/g, "_");
    res
      .status(200)
      .set("Content-Type", "application/pdf")
      .set("Content-Disposition", `attachment; filename="${book.name}_${term}.pdf"`)
      .send(buffer);
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
const serveAll = (kind) => (req, res, next) => sendFile(res, next, BOOKS[kind].file);

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

export const serveLvlTermPDF = (req, res, next) => sendFile(res, next, req.params.lvlTerm);
export const serveTeacherPDF = (req, res, next) => sendFile(res, next, req.params.initial);
export const serveRoomPDF = (req, res, next) => sendFile(res, next, `room_${req.params.room}`);
export const serveDepartmentPDF = (req, res, next) => sendFile(res, next, `department_${req.params.department}`);

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

export async function getAllDepartments(req, res, next) {
  try {
    res.status(200).json({ departments: await getAllDepartmentsDB() });
  } catch (err) {
    next(err);
  }
}
