import {
  getAllTheoryRoomAssignmentDB,
  updateTheoryRoomAssignmentDB,
  getAllSectionRoomAllocationDB,
  updateSectionRoomAllocationDB,
  getAllNonDepartmentalLabRoomAssignmentDB,
  updateNonDepartmentalLabRoomAssignmentDB
} from "./repository.js";
import { HttpError } from "../config/error-handle.js";

export async function getAllTheoryRoomAssignmentAPI(req, res, next) {
  try {
    const result = await getAllTheoryRoomAssignmentDB();
    if (!result) throw new HttpError(400, "Fetch Failed");
    res.status(200).json(result);
  } catch (e) {
    next(e);
  }
}

export async function updateTheoryRoomAssignmentAPI(req, res, next) {
  try {
    const { course_id, section, day, time, room_no } = req.body;
    if (!course_id || !section || !day || !time) {
      throw new HttpError(400, "All fields are required");
    }
    const result = await updateTheoryRoomAssignmentDB(course_id, section, day, time, room_no);
    if (!result) throw new HttpError(400, "Insert Failed");
    res.status(200).json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function getAllSectionRoomAllocationAPI(req, res, next) {
  try {
    const result = await getAllSectionRoomAllocationDB();
    if (!result) throw new HttpError(400, "Fetch Failed");
    res.status(200).json(result);
  } catch (e) {
    next(e);
  }
}

export async function updateSectionRoomAllocationAPI(req, res, next) {
  try {
    const { level_term, department, section, room_no } = req.body;
    if (!level_term || !department || !section) {
      throw new HttpError(400, "All fields are required");
    }
    const result = await updateSectionRoomAllocationDB(level_term, department, section, room_no);
    if (!result) throw new HttpError(400, "Insert Failed");
    res.status(200).json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function getAllNonDepartmentalLabRoomAssignmentAPI(req, res, next) {
  try {
    const result = await getAllNonDepartmentalLabRoomAssignmentDB();
    if (!result) throw new HttpError(400, "Fetch Failed");
    res.status(200).json(result);
  } catch (e) {
    next(e);
  }
}

export async function updateNonDepartmentalLabRoomAssignmentAPI(req, res, next) {
  try {
    const { course_id, section, room_no } = req.body;
    if (!course_id || !section) {
      throw new HttpError(400, "All fields are required");
    }
    const result = await updateNonDepartmentalLabRoomAssignmentDB(course_id, section, room_no);
    if (!result) throw new HttpError(400, "Update Failed");
    res.status(200).json({ success: true });
  } catch (e) {
    next(e);
  }
}