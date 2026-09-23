import { sendTheorySchedNextMail } from "../schedule/controller.js";
import {
  getPreferenceForm,
  updateForm,
  getTheoryScheduleForm,
  saveTheoryScheduleForm,
} from "./repository.js";

export async function getTheoryPreferenceFormAPI(req, res, next) {
  const initial = req.params["initial"];
  try {
    const form = await getPreferenceForm(initial, "theory-pref");
    res.status(200).json(form);
  } catch (err) {
    next(err);
  }
}

export async function updateTheoryPreferenceFormAPI(req, res, next) {
  const initial = req.params["initial"];
  const response = JSON.stringify(req.body.preferences);

  try {
    await updateForm(initial, response, "theory-pref");
    res.status(200).json({ msg: "Successfully Updated" });
  } catch (err) {
    next(err);
  }
}

export async function getTheoryScheduleFormAPI(req, res, next) {
  const initial = req.params["initial"];
  try {
    const form = await getTheoryScheduleForm(initial);
    res.status(200).json(form);
  } catch (err) {
    next(err);
  }
}

export async function updateTheoryScheduleFormAPI(req, res, next) {
  const initial = req.params["initial"];
  const response = JSON.stringify(req.body);
  try {
    const rowsAffected = await updateForm(initial, response, "theory-sched");
    if (rowsAffected === 0) {
      return res.status(404).json({ msg: "Form not found or no changes made" });
    }
    const batch = await saveTheoryScheduleForm(initial, req.body);
    await sendTheorySchedNextMail(batch);
    res.status(200).json({ msg: "Successfully Updated" });
  } catch (err) {
    next(err);
  }
}

export async function getSessionalPreferenceFormAPI(req, res, next) {
  const initial = req.params["initial"];

  try {
    const form = await getPreferenceForm(initial, "sessional-pref");
    res.status(200).json(form);
  } catch (err) {
    next(err);
  }
}

export async function updateSessionalPreferenceFormAPI(req, res, next) {
  const initial = req.params["initial"];
  const response = JSON.stringify(req.body);
  try {
    await updateForm(initial, response, "sessional-pref");
    res.status(200).json({ msg: "Successfully Updated" });
  } catch (err) {
    next(err);
  }
}