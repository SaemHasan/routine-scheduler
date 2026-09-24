import express from "express";
import { getThesisSetup, setLevelTermThesis, setThesisSlot } from "./controller.js";

const router = express.Router();

router.get("/", getThesisSetup);
router.put("/slots/:thesis", setThesisSlot);
router.put("/level-term", setLevelTermThesis);

export default router;
