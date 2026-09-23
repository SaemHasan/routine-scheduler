import express from 'express'
const sectionRouter = express.Router();
import {getAllSection,addSection,editSection,deleteSection,getSessionalSectionsByDeptLevelTermAPI,getTheorySectionsByDeptLevelTermAPI} from "./controller.js"
import validate from "../../config/validation.js";
import {body} from 'express-validator'


sectionRouter.get("/",getAllSection)
sectionRouter.get("/:department/:level_term",getSessionalSectionsByDeptLevelTermAPI)
sectionRouter.get("/theory/:department/:level_term",getTheorySectionsByDeptLevelTermAPI)

sectionRouter.post("/",validate([
    body('batch').isNumeric().notEmpty(),
    body('section').notEmpty(),
    body('type').isNumeric().notEmpty(),
    body('room').optional().notEmpty(),
    body('session').notEmpty(),
]),addSection)
sectionRouter.put("/:batch/:section/:department",validate([
    body('type').isNumeric().notEmpty(),
    body('room').optional().notEmpty(),
    body('session').notEmpty(),
]),editSection)


sectionRouter.delete("/:batch/:section/:department",deleteSection)


export default sectionRouter;