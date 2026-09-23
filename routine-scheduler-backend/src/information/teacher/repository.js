import { connect } from "../../config/database.js";
import { HttpError } from "../../config/error-handle.js";

export async function getAll() {
  const query = "SELECT * FROM teachers ORDER BY seniority_rank ASC";
  const client = await connect();
  const results = await client.query(query);
  client.release();
  return results.rows;
}

export async function findByInitial(initial) {
  const query = "SELECT * FROM teachers WHERE initial=$1";
  const values = [initial];

  const client = await connect();
  const results = await client.query(query, values);
  client.release();
  if (results.rows.length <= 0) {
    throw new HttpError(404, "Not Found");
  } else {
    return results.rows[0];
  }
}

export async function saveTeacher(teacher) {
  const initial = teacher.initial;
  const name = teacher.name;
  const surname = teacher.surname;
  const email = teacher.email;
  const seniority_rank = teacher.seniority_rank;
  const active = teacher.active;
  const theory_courses = teacher.theory_courses;
  const sessional_courses = teacher.sessional_courses;
  const designation = teacher.designation;
  const full_time_status = teacher.full_time_status;
  const offers_thesis_1 = teacher.offers_thesis_1;
  const offers_thesis_2 = teacher.offers_thesis_2;
  const offers_msc = teacher.offers_msc;
  const teacher_credits_offered = teacher.teacher_credits_offered;

  const client = await connect();
  try {
    // Check if any teacher already has this or greater seniority_rank
    const checkRes = await client.query(
      'SELECT COUNT(*) FROM teachers WHERE seniority_rank = $1',
      [seniority_rank]
    );
    const count = parseInt(checkRes.rows[0].count, 10);

    if (count > 0) {
      // Step 1: Increment seniority_rank for affected teachers
      await client.query(
        'UPDATE teachers SET seniority_rank = seniority_rank + 1 WHERE seniority_rank >= $1',
        [seniority_rank]
      );
    }

    // Step 2: Insert the new teacher
    const query =
      "INSERT INTO teachers (initial, name,surname,email,seniority_rank,active,theory_courses,sessional_courses, designation, full_time_status, offers_thesis_1, offers_thesis_2, offers_msc, teacher_credits_offered) VALUES ($1, $2, $3,$4,$5,$6,$7,$8, $9, $10, $11, $12, $13, $14 )";
    const values = [
      initial,
      name,
      surname,
      email,
      seniority_rank,
      active,
      theory_courses,
      sessional_courses,
      designation,
      full_time_status,
      offers_thesis_1,
      offers_thesis_2,
      offers_msc,
      teacher_credits_offered
    ];
    const results = await client.query(query, values);
    if (results.rowCount <= 0) {
      throw new HttpError(400, "Insert Failed");
    } else {
      return results.rowCount;
    }
  } finally {
    client.release();
  }
}

export async function updateTeacher(teacher) {
  const initial = teacher.initial;
  const name = teacher.name;
  const surname = teacher.surname;
  const email = teacher.email;
  const seniority_rank = teacher.seniority_rank;
  const active = teacher.active;
  const theory_courses = teacher.theory_courses;
  const sessional_courses = teacher.sessional_courses;
  const designation = teacher.designation;
  const full_time_status = teacher.full_time_status;
  const offers_thesis_1 = teacher.offers_thesis_1;
  const offers_thesis_2 = teacher.offers_thesis_2;
  const offers_msc = teacher.offers_msc;
  const teacher_credits_offered = teacher.teacher_credits_offered;

  const query = `
      UPDATE teachers
      SET
        name = $2,
        surname = $3,
        email = $4,
        seniority_rank = $5,
        active = $6,
        theory_courses = $7,
        sessional_courses = $8,
        designation = $9,
        full_time_status = $10,
        offers_thesis_1 = $11,
        offers_thesis_2 = $12,
        offers_msc = $13,
        teacher_credits_offered = $14
      WHERE initial = $1
    `;
  const values = [
    initial,
    name,
    surname,
    email,
    seniority_rank,
    active,
    theory_courses,
    sessional_courses,
    designation,
    full_time_status,
    offers_thesis_1,
    offers_thesis_2,
    offers_msc,
    teacher_credits_offered
  ];

  const client = await connect();
  const results = await client.query(query, values);
  client.release();

  if (results.rowCount <= 0) {
    throw new HttpError(400, "Update Failed");
  } else {
    return results.rowCount; // Return the first found admin
  }
}

export async function removeTeacher(initial) {
  // Get the seniority_rank of the teacher to be removed
  const client = await connect();
  try {
    const getRankRes = await client.query(
      'SELECT seniority_rank FROM teachers WHERE initial = $1',
      [initial]
    );
    if (getRankRes.rows.length === 0) {
      throw new HttpError(404, "Delete Failed");
    }
    const removedRank = getRankRes.rows[0].seniority_rank;

    // Delete the teacher
    const deleteRes = await client.query(
      `DELETE FROM teachers WHERE initial = $1`,
      [initial]
    );
    if (deleteRes.rowCount <= 0) {
      throw new HttpError(404, "Delete Failed");
    }

    // Decrement seniority_rank for teachers with greater seniority
    await client.query(
      'UPDATE teachers SET seniority_rank = seniority_rank - 1 WHERE seniority_rank > $1',
      [removedRank]
    );

    return deleteRes.rowCount;
  } finally {
    client.release();
  }
}
