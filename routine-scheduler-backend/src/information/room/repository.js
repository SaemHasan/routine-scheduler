import { connect } from "../../config/database.js";
import { HttpError } from "../../config/error-handle.js";

export async function getAll() {
  const query = "SELECT * FROM rooms ORDER BY room";

  const client = await connect();
  const results = await client.query(query);
  client.release();

  return results.rows;
}

export async function saveRoom(rooms) {
  const room = rooms.room;
  const type = rooms.type;
  const active = rooms.active;
  // Only lab rooms are software or hardware labs.
  const lab_type = type === 0 ? null : rooms.lab_type;

  const query =
    "INSERT INTO rooms (room, type, active, lab_type) VALUES ($1, $2, $3, $4)";
  const values = [room, type, active, lab_type];

  const client = await connect();
  const results = await client.query(query, values);
  client.release();

  if (results.rowCount <= 0) {
    throw new HttpError(400, "Insert Failed");
  } else {
    return results.rows;
  }
}

export async function updateRoom(rooms) {
  const type = rooms.type;
  const room = rooms.room;
  const active = rooms.active;
  const lab_type = type === 0 ? null : rooms.lab_type;

  const query = `
    UPDATE rooms
  SET
    type = $2,
    active = $3,
    lab_type = $4
  WHERE room = $1
  `;
  const values = [room, type, active, lab_type];

  const client = await connect();
  const results = await client.query(query, values);
  client.release();

  if (results.rowCount <= 0) {
    throw new HttpError(400, "Update Failed");
  } else {
    return results.rows;
  }
}

export async function removeRoom(room) {
  const query = `
    DELETE FROM rooms
    WHERE room = $1
  `;
  const values = [room];

  const client = await connect();
  const results = await client.query(query, values);
  client.release();

  if (results.rowCount <= 0) {
    throw new HttpError(400, "Delete Failed");
  } else {
    return results.rows;
  }
}

export async function getLabs() {
  const query =
    "SELECT * FROM rooms WHERE type IN (1, 2) AND room NOT LIKE '%(%)%' AND active = TRUE ";

  const client = await connect();
  const results = await client.query(query);
  client.release();

  return results.rows;
}

export async function getNonDeptLabs() {
  const query =
    "SELECT * FROM rooms  WHERE type IN (1, 2) AND room LIKE '%(%)%' AND active = TRUE ";

  const client = await connect();
  const results = await client.query(query);
  client.release();

  return results.rows;
}
