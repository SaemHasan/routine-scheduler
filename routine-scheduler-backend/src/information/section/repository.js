import { connect } from "../../config/database.js";
import { HttpError } from "../../config/error-handle.js";

export async function getAll() {
  const query = "SELECT * FROM sections";

  const client = await connect();
  const results = await client.query(query);
  client.release();
  return results.rows;
}

export async function getSessionalSectionsByDeptLevelTerm(department, level_term) {
  const query = `
    SELECT section
    FROM sections
    WHERE department = $1
    AND level_term = $2
    AND type = 1
    ORDER BY section
  `;
  const values = [department, level_term];

  const client = await connect();
  const results = await client.query(query, values);
  client.release();
  return results.rows;
}

export async function getTheorySectionsByDeptAndLevelTerm(department, level_term) {
  const query = `
    SELECT section
    FROM sections
    WHERE department = $1
    AND level_term = $2
    AND type = 0
    ORDER BY section
  `;
  const values = [department, level_term];

  const client = await connect();
  const results = await client.query(query, values);
  client.release();
  return results.rows;
}

export async function saveSection(sections) {
  const batch = sections.batch;
  const section = sections.section;
  const type = sections.type;
  const room = sections.room;
  const session = sections.session;
  const level_term = sections.level_term;
  const department = sections.department;

  const query =
    "INSERT INTO sections (batch, section,type,room,session, level_term, department) VALUES ($1, $2, $3, $4, $5, $6, $7)";
  const values = [batch, section, type, room, session, level_term, department];

  const client = await connect();
  const results = await client.query(query, values);
  client.release();

  if (results.rowCount <= 0) {
    throw new HttpError(400, "Insert Failed");
  } else {
    return results.rows;
  }
}

export async function updateSection(sections) {
  const batch = sections.batch;
  const section = sections.section;
  const department = sections.department;
  const type = sections.type;
  const room = sections.room;
  const session = sections.session;
  const level_term = sections.level_term;

  const query = `
    UPDATE sections
    SET
      type = $3,
      room = $4,
      session = $5,
      level_term = $6
    WHERE batch = $1 AND
    section = $2 AND 
    department = $7
  `;
  const values = [batch, section, type, room, session, level_term, department];
  console.log(values);

  const client = await connect();
  const results = await client.query(query, values);
  client.release();

  if (results.rowCount <= 0) {
    throw new HttpError(400, "Update Failed");
  } else {
    return results.rows;
  }
}

export async function removeSection(batch, section, department) {
  const query = `
    DELETE FROM sections
    WHERE batch = $1 AND
    section = $2 AND 
    department = $3
  `;
  const values = [batch, section, department];

  const client = await connect();
  const results = await client.query(query, values);
  client.release();

  if (results.rowCount <= 0) {
    throw new HttpError(400, "Delete Failed");
  } else {
    return results.rows;
  }
}
