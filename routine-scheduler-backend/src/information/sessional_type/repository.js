import { connect } from "../../config/database.js";
import { HttpError } from "../../config/error-handle.js";

export async function getAll() {
  const query = "SELECT * FROM sessional_types ORDER BY sort_order, code";

  const client = await connect();
  const results = await client.query(query);
  client.release();

  return results.rows;
}

export async function updateSessionalType(sessionalType) {
  const query = `
    UPDATE sessional_types
    SET
      name = $2,
      teacher_count = $3,
      lab_type = $4
    WHERE code = $1
    RETURNING *
  `;
  const values = [
    sessionalType.code,
    sessionalType.name,
    sessionalType.teacher_count,
    sessionalType.lab_type,
  ];

  const client = await connect();
  const results = await client.query(query, values);
  client.release();

  if (results.rowCount <= 0) {
    throw new HttpError(400, "Update Failed");
  } else {
    return results.rows[0];
  }
}
