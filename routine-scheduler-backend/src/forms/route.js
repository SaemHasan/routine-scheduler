import express from "express";
import {
  getTheoryPreferenceFormAPI,
  updateTheoryPreferenceFormAPI,
  getTheoryScheduleFormAPI,
  updateTheoryScheduleFormAPI,
  updateSessionalPreferenceFormAPI,
  getSessionalPreferenceFormAPI,
} from "./controller.js";

const router = express.Router();

router.get("/theory-pref/:initial", getTheoryPreferenceFormAPI);
router.put("/theory-pref/:initial", updateTheoryPreferenceFormAPI);

router.get("/theory-sched/:initial", getTheoryScheduleFormAPI);
router.put("/theory-sched/:initial", updateTheoryScheduleFormAPI);

router.get("/sessional-pref/:initial", getSessionalPreferenceFormAPI);
router.put("/sessional-pref/:initial", updateSessionalPreferenceFormAPI);

export default router;
