import { HttpError } from '../config/error-handle.js';
import {
  getSectionCountDB,
  getAllSectionCountDB,
  setSectionCountDB,
  deleteSectionCountDB,
  getDefaultSectionCountDB,
  getDefaultAllSectionCountDB,
  setDefaultSectionCountDB,
  deleteDefaultSectionCountDB,
  getBatchesDB,
  addBatchDB,
  deleteBatchDB,
  getDepartmentsDB,
  getLevelTermsDB,
  getHostedDepartmentsDB,
  addHostedDepartmentDB,
  deleteHostedDepartmentDB
} from './repository.js';

export async function getSectionCountAPI(req, res, next) {
  try {
    const { batch, department } = req.query;
    if (!batch || !department) {
      throw new HttpError(400, "Batch and Department are required");
    }
    const result = await getSectionCountDB(batch, department);
    if (!result) throw new HttpError(404, "Section count not found");
    res.status(200).json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}

export async function getAllSectionCountAPI(req, res, next) {
    try {
        const result = await getAllSectionCountDB();
        if (!result) throw new HttpError(404, "No section counts found");
        res.status(200).json(result);
    } catch (e) {
        next(e);
    }
}

export async function setSectionCountAPI(req, res, next) {
  try {
    const { batch, department, section_count, subsection_count_per_section } = req.body;
    if (!batch || !department || section_count === undefined || subsection_count_per_section === undefined) {
      throw new HttpError(400, "All fields are required");
    }
    const result = await setSectionCountDB(batch, department, section_count, subsection_count_per_section);
    if (!result) throw new HttpError(400, "Insert Failed");
    res.status(200).json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function deleteSectionCountAPI(req, res, next) {
  try {
    const { batch, department } = req.body;
    if (!batch || !department) {
      throw new HttpError(400, "Batch and Department are required");
    }
    const result = await deleteSectionCountDB(batch, department);
    if (!result) throw new HttpError(400, "Delete Failed");
    res.status(200).json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function getDefaultSectionCountAPI(req, res, next) {
  try {
    const { department } = req.query;
    if (!department) {
      throw new HttpError(400, "Department is required");
    }
    const result = await getDefaultSectionCountDB(department);
    if (!result) throw new HttpError(404, "Default section count not found");
    res.status(200).json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}

export async function getDefaultAllSectionCountAPI(req, res, next) {
  try {
    const result = await getDefaultAllSectionCountDB();
    res.status(200).json(result);
  } catch (e) {
    next(e);
  }
}

export async function setDefaultSectionCountAPI(req, res, next) {
  try {
    const { department, section_count, subsection_count_per_section } = req.body;
    console.log(department, section_count, subsection_count_per_section);
    if (!department || section_count === undefined || subsection_count_per_section === undefined) {
      throw new HttpError(400, "All fields are required");
    }
    const result = await setDefaultSectionCountDB(department, section_count, subsection_count_per_section);
    if (!result) throw new HttpError(400, "Insert Failed");
    res.status(200).json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function deleteDefaultSectionCountAPI(req, res, next) {
  try {
    const { department } = req.body;
    if (!department) {
      throw new HttpError(400, "Department is required");
    }
    const result = await deleteDefaultSectionCountDB(department);
    if (!result) throw new HttpError(400, "Delete Failed");
    res.status(200).json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function getBatchesAPI(req, res, next) {
  try {
    const result = await getBatchesDB();
    res.status(200).json(result);
  } catch (e) {
    next(e);
  }
}

export async function addBatchAPI(req, res, next) {
  try {
    const { batch } = req.body;
    if (!batch) {
      throw new HttpError(400, "Batch is required");
    }
    const result = await addBatchDB(batch);
    if (!result) throw new HttpError(400, "Insert Failed");
    res.status(200).json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function deleteBatchAPI(req, res, next) {
  try {
    const { batch } = req.body;
    if (!batch) {
      throw new HttpError(400, "Batch is required");
    }
    const result = await deleteBatchDB(batch);
    if (!result) throw new HttpError(400, "Delete Failed");
    res.status(200).json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function getDepartmentsAPI(req, res, next) {
  try {
    const result = await getDepartmentsDB();
    if (!result) throw new HttpError(404, "No departments found");
    res.status(200).json(result);
  } catch (e) {
    next(e);
  }
}

export async function getLevelTermsAPI(req, res, next) {
  try {
    const result = await getLevelTermsDB();
    if (!result) throw new HttpError(404, "No level terms found");
    res.status(200).json(result);
  } catch (e) {
    next(e);
  }
}

export async function getHostedDepartmentsAPI(req, res, next) {
  try {
    const result = await getHostedDepartmentsDB();
    if (!result) throw new HttpError(404, "No hosted departments found");
    res.status(200).json(result);
  } catch (e) {
    next(e);
  }
}

export async function addHostedDepartmentAPI(req, res, next) {
  console.log(req.body);
  try {
    const { department } = req.body;
    if (!department) {
      throw new HttpError(400, "Department is required");
    }
    const result = await addHostedDepartmentDB(department);
    if (!result) throw new HttpError(400, "Insert Failed");
    res.status(200).json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function deleteHostedDepartmentAPI(req, res, next) {
  try {
    const { department } = req.body;
    if (!department) {
      throw new HttpError(400, "Department is required");
    }
    const result = await deleteHostedDepartmentDB(department);
    if (!result) throw new HttpError(400, "Delete Failed");
    res.status(200).json({ success: true });
  } catch (e) {
    next(e);
  }
}
