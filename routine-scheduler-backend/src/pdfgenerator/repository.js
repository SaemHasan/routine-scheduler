import { connect } from "../config/database.js";
import { compareRooms } from "./format.js";

// The lists the PDF page offers; the routines themselves are read in
// routineBook.js and reportBook.js.

async function rows(query, values = []) {
  const client = await connect();
  try {
    return (await client.query(query, values)).rows;
  } finally {
    client.release();
  }
}

export async function getInitials() {
  return rows(`
    SELECT initial, seniority_rank
    FROM teachers
    WHERE active = 1
    ORDER BY seniority_rank ASC NULLS LAST`);
}

export async function getRooms() {
  const rooms = await rows(`SELECT room, type FROM rooms WHERE active = true`);
  return rooms.sort(compareRooms).map(({ room }) => ({ room }));
}

// Departments other than CSE that CSE takes courses from or gives courses to
export async function getAllDepartmentsDB() {
  return rows(`
    SELECT DISTINCT department
    FROM (
        SELECT "from" AS department FROM courses
      UNION
        SELECT "to" AS department FROM courses
    ) all_departments
    WHERE department <> 'CSE'
    ORDER BY department`);
}

export async function getLevelTerms() {
  return rows(`
    SELECT DISTINCT level_term
    FROM level_term_unique
    WHERE active = TRUE
    ORDER BY level_term`);
}

export async function getCurrentSession() {
  const result = await rows(`SELECT value FROM configs WHERE key = 'CURRENT_SESSION'`);
  return result.length > 0 ? result[0].value : "January 2025";
}
