import express from 'express'

const router = express.Router();

import { getAllLevelTerms, setLevelTerms, activateLevelTermAPI, addLevelTermAPI, deleteLevelTermAPI, getAllActiveDepartmentsAPI, getDepartmentalLevelTermBatchesAPI } from './controller.js';

router.get("/", getAllLevelTerms);
router.put("/set", setLevelTerms);
router.put("/activate", activateLevelTermAPI);
router.post("/add", addLevelTermAPI);
router.delete("/delete", deleteLevelTermAPI);
router.get("/active-departments", getAllActiveDepartmentsAPI);
router.get("/departmental_level_term_batches/:department", getDepartmentalLevelTermBatchesAPI);

export default router;

