import { getAll, updateSessionalType } from "./repository.js";

export async function getAllSessionalTypes(req, res, next) {
  try {
    const sessionalTypes = await getAll();
    res.status(200).json(sessionalTypes);
  } catch (err) {
    next(err);
  }
}

export async function editSessionalType(req, res, next) {
  const sessionalType = {
    code: req.params["code"],
    name: req.body.name,
    teacher_count: parseInt(req.body.teacher_count, 10),
    lab_type: req.body.lab_type || null,
  };

  try {
    const updated = await updateSessionalType(sessionalType);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}
