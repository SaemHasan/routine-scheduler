import {
  getAll,
  removeRoom,
  saveRoom,
  updateRoom,
  getLabs,
  getNonDeptLabs,
} from "./repository.js";

export async function getAllRoom(req, res, next) {
  try {
    const rooms = await getAll();
    res.status(200).json(rooms);
  } catch (err) {
    next(err);
  }
}

export async function addRoom(req, res, next) {
  const room = req.body.room;
  const type = req.body.type;
  const active = req.body.active;
  const lab_type = req.body.lab_type || null;
  const room_number = req.body.room_number || null;
  const full_name = req.body.full_name || null;
  // Position in room lists and the room routine; blank for no position
  const sort_order =
    req.body.sort_order === undefined
      ? undefined
      : Number.isInteger(parseInt(req.body.sort_order, 10))
      ? parseInt(req.body.sort_order, 10)
      : null;

  const rooms = {
    room: room,
    type: type,
    active: active,
    lab_type: lab_type,
    room_number: room_number,
    full_name: full_name,
    sort_order: sort_order,
  };

  try {
    const room = await saveRoom(rooms);
    res.status(200).json(room);
  } catch (err) {
    next(err);
  }
}

export async function editRoom(req, res, next) {
  const room = req.params["room"];

  const type = req.body.type;
  const active = req.body.active;
  const lab_type = req.body.lab_type || null;
  const room_number = req.body.room_number || null;
  const full_name = req.body.full_name || null;
  // Position in room lists and the room routine; blank for no position
  const sort_order =
    req.body.sort_order === undefined
      ? undefined
      : Number.isInteger(parseInt(req.body.sort_order, 10))
      ? parseInt(req.body.sort_order, 10)
      : null;

  const rooms = {
    room: room,
    type: type,
    active: active,
    lab_type: lab_type,
    room_number: room_number,
    full_name: full_name,
    sort_order: sort_order,
  };

  try {
    const room = await updateRoom(rooms);
    res.status(200).json(room);
  } catch (err) {
    next(err);
  }
}

export async function deleteRoom(req, res, next) {
  const room = req.params["room"];

  try {
    const rooms = await removeRoom(room);
    res.status(200).json(rooms);
  } catch (err) {
    next(err);
  }
}

export async function getLabRooms(req, res, next) {
  try {
    const rooms = await getLabs();
    res.status(200).json(rooms);
  } catch (err) {
    next(err);
  }
}

export async function getNonDeptLabRooms(req, res, next) {
  try {
    const rooms = await getNonDeptLabs();
    res.status(200).json(rooms);
  } catch (err) {
    next(err);
  }
}
