import express from "express";
import { body } from "express-validator";
import validate from "../config/validation.js";
import {
  addConstraint,
  apply,
  deleteConstraint,
  generate,
  getConstraints,
  setLock,
  setRoom,
  unlockAll,
} from "./controller.js";

const router = express.Router();

router.get("/constraints", getConstraints);
router.post(
  "/constraints",
  validate([
    body("kind").isIn(["blocked_slot", "course_rooms", "course_together", "course_days", "courses_apart"]),
  ]),
  addConstraint
);
router.delete("/constraints/:id", deleteConstraint);

router.post("/generate", generate);
router.post("/apply", apply);

router.put("/lock", setLock);
router.put("/unlock-all", unlockAll);
router.put("/room", setRoom);

export default router;
