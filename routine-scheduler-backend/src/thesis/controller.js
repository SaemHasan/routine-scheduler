import { HttpError } from "../config/error-handle.js";
import { getThesisSetupDB, setLevelTermThesisDB, setThesisSlotDB } from "./repository.js";

export async function getThesisSetup(req, res, next) {
  try {
    res.status(200).json(await getThesisSetupDB());
  } catch (err) {
    next(err);
  }
}

export async function setThesisSlot(req, res, next) {
  try {
    const thesis = Number(req.params.thesis);
    if (thesis !== 1 && thesis !== 2) throw new HttpError(400, "Thesis must be 1 or 2");
    await setThesisSlotDB(thesis, req.body);
    res.status(200).json(await getThesisSetupDB());
  } catch (err) {
    next(err);
  }
}

export async function setLevelTermThesis(req, res, next) {
  try {
    await setLevelTermThesisDB(req.body);
    res.status(200).json(await getThesisSetupDB());
  } catch (err) {
    next(err);
  }
}
