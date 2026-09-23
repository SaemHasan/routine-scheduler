import { HttpError } from '../../config/error-handle.js';
import {
    getAll,
    updateLevelTerms,
    addLevelTermDB,
    deleteLevelTermDB,
    initiateDB,
    getAllActiveDepartments,
    getDepartmentalLevelTermBatches
} from "./repository.js"

export async function getAllLevelTerms(req, res, next){
    const level_terms = await getAll();
    res.json({message: "Level Terms retrieved successfully", data: level_terms});
}

export async function setLevelTerms(req, res, next) {
    try {
        const levelTerms = req.body;
        await updateLevelTerms(levelTerms);
        await initiateDB(levelTerms);
        res.json({ message: "Initiated successfully" });
    } catch (error) {
        next(error);
    }
}

export async function addLevelTermAPI(req, res, next) {
    const { level_term, department } = req.body;
    try {
        if (!level_term || !department) {
            throw new HttpError(400, "Level term and department are required");
        }
        const result = await addLevelTermDB(level_term, department);
        if (!result) throw new HttpError(400, "Insert Failed");
        res.status(200).json({ success: true });
    } catch (error) {
        next(error);
    }
}

export async function deleteLevelTermAPI(req, res, next) {
    const { level_term, department } = req.body;
    try{
        const result = await deleteLevelTermDB(level_term, department);
        if(!result) throw new HttpError(404, "Delete Failed");
        res.status(200).json({success: true});        
    } catch (error) {
        next(error);
    }
}

export async function getAllActiveDepartmentsAPI(req, res, next) {
    try {
        const departments = await getAllActiveDepartments();
        res.json({ message: "Active departments retrieved successfully", data: departments });
    } catch (error) {
        next(error);
    }
}

export async function getDepartmentalLevelTermBatchesAPI(req, res, next) {
    try {
        const department = req.params["department"];
        if (!department) {
            return res.status(400).json({ message: "Department is required" });
        }
        const levelTerms = await getDepartmentalLevelTermBatches(department);
        res.json({ message: "Departmental level term batches retrieved successfully", data: levelTerms });
    } catch (error) {
        next(error);
    }
}