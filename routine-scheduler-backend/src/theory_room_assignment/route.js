import express from 'express'

const router = express.Router();

import {
    getAllTheoryRoomAssignmentAPI,
    updateTheoryRoomAssignmentAPI,
    getAllSectionRoomAllocationAPI,
    updateSectionRoomAllocationAPI,
    getAllNonDepartmentalLabRoomAssignmentAPI,
    updateNonDepartmentalLabRoomAssignmentAPI
} from './controller.js';

router.get("/get/all", getAllTheoryRoomAssignmentAPI);
router.post("/update", updateTheoryRoomAssignmentAPI);

router.get("/section/get/all", getAllSectionRoomAllocationAPI);
router.put("/section/update", updateSectionRoomAllocationAPI);

router.get("/non-departmental/get/all", getAllNonDepartmentalLabRoomAssignmentAPI);
router.put("/non-departmental/update", updateNonDepartmentalLabRoomAssignmentAPI);

export default router;