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
  // The teacher's current initial; differs from `initial` when it is renamed.
  const old_initial = teacher.old_initial || initial;
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
        initial = $1,
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
      WHERE initial = $15
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
    teacher_credits_offered,
    old_initial
  ];

  const client = await connect();
  try {
    await client.query("BEGIN");

    const renamed = initial !== old_initial;
    if (renamed) {
      const taken = await client.query(
        "SELECT 1 FROM teachers WHERE initial = $1",
        [initial]
      );
      if (taken.rowCount > 0) {
        throw new HttpError(409, `Initial ${initial} is already used by another teacher`);
      }
    }

    // teacher_assignment and teacher_sessional_assignment follow the rename
    // through their foreign keys.
    const results = await client.query(query, values);
    if (results.rowCount <= 0) {
      throw new HttpError(400, "Update Failed");
    }

    if (renamed) {
      // These hold initials without a foreign key, so they are renamed by hand.
      await client.query("UPDATE forms SET initial = $1 WHERE initial = $2", [
        initial,
        old_initial,
      ]);
      await client.query(
        `UPDATE courses_sections SET teachers = array_replace(teachers, $2, $1)
         WHERE $2 = ANY(teachers)`,
        [initial, old_initial]
      );
      await client.query(
        `UPDATE schedule_assignment SET teachers = array_replace(teachers, $2, $1)
         WHERE $2 = ANY(teachers)`,
        [initial, old_initial]
      );
    }

    await client.query("COMMIT");
    return results.rowCount;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Sets the seniority of every teacher from `initials`, most senior first.
 * The list must name each teacher exactly once.
 */
export async function reorderSeniority(initials) {
  const client = await connect();
  try {
    await client.query("BEGIN");

    const all = await client.query("SELECT initial FROM teachers");
    const known = new Set(all.rows.map((row) => row.initial));
    const given = new Set(initials);
    if (
      given.size !== initials.length ||
      given.size !== known.size ||
      initials.some((initial) => !known.has(initial))
    ) {
      throw new HttpError(
        400,
        "The seniority order must list every teacher exactly once. Reload the page and try again."
      );
    }

    await client.query(
      `UPDATE teachers t
       SET seniority_rank = o.rank
       FROM unnest($1::varchar[]) WITH ORDINALITY AS o(initial, rank)
       WHERE t.initial = o.initial`,
      [initials]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
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
