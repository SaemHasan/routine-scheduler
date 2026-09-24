import {
  getAllTheoryRoomAssignmentDB,
  updateTheoryRoomAssignmentDB,
  getAllSectionRoomAllocationDB,
  updateSectionRoomAllocationDB,
  getAllNonDepartmentalLabRoomAssignmentDB,
  updateNonDepartmentalLabRoomAssignmentDB,
  moveTheoryClassDB,
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
    const { course_id, department, batch, section, day, time, room_no } = req.body;
    if (!course_id || !section || !day || !time) {
      throw new HttpError(400, "All fields are required");
    }
    const result = await updateTheoryRoomAssignmentDB({ course_id, department, batch, section, day, time, room_no });
    res.status(200).json({ success: true, ...result });
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
    res.status(200).json({ success: true, ...result });
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

// Moves a theory class to another day and time, optionally another room
export async function moveTheoryClassAPI(req, res, next) {
  try {
    const { course_id, department, batch, section, day, time, new_day, new_time } = req.body || {};
    if (!course_id || !department || !batch || !section || !day || !time || !new_day || !new_time) {
      throw new HttpError(400, "The class, its current day and time, and the new day and time are required");
    }
    // A room of undefined keeps the class's room; null clears it
    const room_no = Object.prototype.hasOwnProperty.call(req.body, "room_no") ? req.body.room_no : undefined;
    const result = await moveTheoryClassDB({ course_id, department, batch, section, day, time, new_day, new_time, room_no });
    res.status(200).json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
}
