import express from 'express'
const sessionalTypeRouter = express.Router();

import { getAllSessionalTypes, editSessionalType } from "./controller.js"
import validate from "../../config/validation.js";
import { body } from 'express-validator'

sessionalTypeRouter.get("/", getAllSessionalTypes)

sessionalTypeRouter.put("/:code", validate([
    body('name').notEmpty(),
    body('teacher_count').isInt({ min: 1 }),
    body('lab_type').optional({ nullable: true }).isIn(['SW', 'HW', '']),
]), editSessionalType)

export default sessionalTypeRouter;
