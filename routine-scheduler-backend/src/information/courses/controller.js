import { HttpError } from "../../config/error-handle.js";
import {
  getAll,
  getActiveCourseIds,
  saveCourse,
  updateCourse,
  removeCourse,
  setCourseActive,
  getAllLab,
  getNonDeptLabs,
  getNonDeptTheories,
  getSessionalCoursesByDeptLevelTerm,
  getTheoryCoursesByDeptLevelTerm
} from "./repository.js";

export async function getAllCourse(req, res, next) {
  try {
    const Courses = await getAll();
    res.status(200).json(Courses);
  } catch (err) {
    next(err);
  }
}

export async function getActiveCourseIdsAPI(req, res, next) {
  try {
    const activeCourseIds = await getActiveCourseIds();
    res.status(200).json(activeCourseIds);
  } catch (err) {
    next(err);
  }
}

export async function addCourse(req, res, next) {
  const course_id = req.body.course_id;
  const name = req.body.name;
  const type = parseInt(req.body.type); // Convert to number
  const session = req.body.session;
  const class_per_week = req.body.class_per_week;
  const batch = req.body.batch;
  const sections = req.body.sections;
  const teacher_credit = req.body.teacher_credit;
  const from = req.body.from;
  const to = req.body.to;
  const level_term = req.body.level_term;
  const optional = req.body.optional ? 1 : 0;
  const optional_section_count = req.body.optional_section_count;
  const sessional_type = req.body.sessional_type;
  const option_group = req.body.option_group;

  console.log('DEBUG addCourse: Received data:', {
    course_id, name, type: req.body.type, typeConverted: type
  });

  const Course = {
    course_id: course_id,
    name: name,
    type: type,
    session: session,
    class_per_week: class_per_week,
    batch: batch,
    sections: sections,
    teacher_credit: teacher_credit,
    from: from,
    to: to,
    level_term: level_term,
    optional: optional,
    optional_section_count: optional_section_count,
    sessional_type: sessional_type,
    option_group: option_group,
  };

  try {
    const rowCount = await saveCourse(Course);
    if (rowCount <= 0) {
      return res.status(400).json({ message: "Save Failed" });
    }
    res.status(200).json({ message: "Successfully Saved" });
  } catch (err) {
    next(err);
  }
}

export async function editCourse(req, res, next) {
  const course_id_old = req.params["course_id"];

  const course_id = req.body.course_id;
  const name = req.body.name;
  const type = parseInt(req.body.type); // Convert to number
  const session = req.body.session;
  const class_per_week = req.body.class_per_week;
  const batch = req.body.batch;
  const sections = req.body.sections;
  const teacher_credit = req.body.teacher_credit;
  const from = req.body.from;
  const to = req.body.to;
  const level_term = req.body.level_term;
  const level_term_old = req.body.level_term_old || level_term;
  const optional = req.body.optional ? 1 : 0;
  const optional_section_count = req.body.optional_section_count;
  const sessional_type = req.body.sessional_type;
  const option_group = req.body.option_group;

  console.log('DEBUG editCourse: Received data:', {
    course_id_old, course_id, name, type: req.body.type, typeConverted: type
  });

  const Course = {
    course_id_old: course_id_old,
    course_id: course_id,
    name: name,
    type: type,
    session: session,
    class_per_week: class_per_week,
    batch: batch,
    sections: sections,
    teacher_credit: teacher_credit,
    from: from,
    to: to,
    level_term: level_term,
    level_term_old: level_term_old,
    optional: optional,
    optional_section_count: optional_section_count,
    sessional_type: sessional_type,
    option_group: option_group,
  };

  try {
    const rowCount = await updateCourse(Course);
    if (rowCount <= 0) {
      return res.status(400).json({ message: "Update Failed" });
    }
    res.status(200).json({ message: "Successfully Updated" });
  } catch (err) {
    next(err);
  }
}

export async function setCourseActiveAPI(req, res, next) {
  const course_id = req.params["course_id"];
  const { level_term, active } = req.body;

  try {
    if (!level_term) {
      throw new HttpError(400, "level_term is required to identify the course");
    }
    if (typeof active !== "boolean") {
      throw new HttpError(400, "active must be true or false");
    }
    await setCourseActive(course_id, level_term, active);
    res.status(200).json({
      message: active ? "Successfully Activated" : "Successfully Deactivated",
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteCourse(req, res, next) {
  const course_id = req.params["course_id"];
  const level_term = req.query["level_term"];
  try {
    const rowCount = await removeCourse(course_id, level_term);
    if (rowCount <= 0) {
      return res.status(400).json({ message: "Delete Failed" });
    }
    res.status(200).json({ message: "Successfully Deleted" });
  } catch (err) {
    next(err);
  }
}

export async function getLabCourses(req, res, next) {
  try {
    const Courses = await getAllLab();
    res.status(200).json(Courses);
  } catch (err) {
    next(err);
  }
}

export async function getNonDeptLabCourses(req, res, next) {
  try {
    const Courses = await getNonDeptLabs();
    res.status(200).json(Courses);
  } catch (err) {
    next(err);
  }
}

export async function getNonDeptTheoryCourses(req, res, next) {
  try {
    const Courses = await getNonDeptTheories();
    res.status(200).json(Courses);
  } catch (err) {
    next(err);
  }
}

export async function getSessionalCoursesByDeptLevelTermAPI(req, res, next) {
  const department = req.params["department"];
  const level_term = req.params["level_term"];

  try {
    const Courses = await getSessionalCoursesByDeptLevelTerm(department, level_term);
    res.status(200).json({ message: "Sessional courses successfully Fetched", data: Courses });
  } catch (err) {
    next(err);
  }
}

export async function getTheoryCoursesByDeptLevelTermAPI(req, res, next) {
  const department = req.params["department"];
  const level_term = req.params["level_term"];

  try {
    const Courses = await getTheoryCoursesByDeptLevelTerm(department, level_term);
    res.status(200).json({ message: "Theory courses successfully Fetched", data: Courses });
  } catch (err) {
    next(err);
  }
} 