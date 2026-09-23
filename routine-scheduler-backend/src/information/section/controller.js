import {
  getAll,
  saveSection,
  updateSection,
  removeSection,
  getSessionalSectionsByDeptLevelTerm,
  getTheorySectionsByDeptAndLevelTerm
} from "./repository.js";

export async function getAllSection(req, res, next) {
  try {
    const sections = await getAll();
    res.status(200).json(sections);
  } catch (err) {
    next(err);
  }
}

export async function getSessionalSectionsByDeptLevelTermAPI(req, res, next) {
  const department = req.params["department"];
  const level_term = req.params["level_term"];
  try {
    const sections = await getSessionalSectionsByDeptLevelTerm(department, level_term);
    res.status(200).json({message: "Sessional sections retrieved successfully", data: sections});
  } catch (err) {
    next(err);
  }
}

export async function getTheorySectionsByDeptLevelTermAPI(req, res, next) {
  const department = req.params["department"];
  const level_term = req.params["level_term"];
  try {
    const sections = await getTheorySectionsByDeptAndLevelTerm(department, level_term);
    res.status(200).json({message: "Theory sections retrieved successfully", data: sections});
  } catch (err) {
    next(err);
  }
}

export async function addSection(req, res, next) {
  const section = {
    batch: req.body.batch,
    section: req.body.section,
    type: req.body.type,
    room: req.body.room === "000" ? null : req.body.room,
    session: req.body.session,
    level_term: req.body.level_term || "",
    department: req.body.department,
  };

  try {
    const rows = await saveSection(section);

    res.status(200).json({ msg: "successful" });
  } catch (err) {
    next(err);
  }
}

export async function editSection(req, res, next) {
  const batch = req.params["batch"];
  const section = req.params["section"];
  const department = req.params["department"];

  const sections = {
    batch: batch,
    section: section,
    type: req.body.type,
    room: req.body.room === "000" ? null : req.body.room,
    session: req.body.session,
    level_term: req.body.level_term || "",
    department: department
  };

  try {
    const row = await updateSection(sections);
    res.status(200).json({ msg: "successful" });
  } catch (err) {
    next(err);
  }
}

export async function deleteSection(req, res, next) {
  const batch = req.params["batch"];
  const section = req.params["section"];
  const department = req.params["department"];

  try {
    const row = await removeSection(batch, section, department);
    res.status(200).json({ msg: "successful" });
  } catch (err) {
    next(err);
  }
}
