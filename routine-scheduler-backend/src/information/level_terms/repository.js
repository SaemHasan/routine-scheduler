import e from "express";
import { connect } from "../../config/database.js";
import { HttpError } from "../../config/error-handle.js";

export async function getAll() {
    const query = `
        SELECT 
            ltu.department, 
            ltu.level_term, 
            ltu.active,
            ltu.batch
        FROM 
            level_term_unique ltu
        GROUP BY 
            ltu.department, 
            ltu.level_term,
            ltu.active,
            ltu.batch
        ORDER BY 
            ltu.department, 
            ltu.level_term;
    `;
    const client = await connect();
    const result = await client.query(query);
    client.release();
    const level_terms = result.rows;
    return level_terms;
}

export async function getAllActiveDepartments() {
    const query = `
        SELECT DISTINCT department
        FROM level_term_unique
        WHERE active = true;
    `;
    const client = await connect();
    const result = await client.query(query);
    client.release();
    const departments = result.rows.map(row => row.department);
    return departments;
}

export async function getDepartmentalLevelTermBatches(department) {
    const query = `
        SELECT DISTINCT level_term, batch
        FROM level_term_unique
        WHERE department = $1
        AND active = true
        ORDER BY level_term;
    `;
    const client = await connect();
    const result = await client.query(query, [department]);
    client.release();
    const levelTermBatches = result.rows;
    return levelTermBatches;
}

export async function updateLevelTerms(levelTerms) {
    const query = `
        UPDATE level_term_unique
        SET 
            active = $1,
            batch = $2
        WHERE 
            level_term = $3 AND department = $4;
    `;

    const client = await connect();

    try {
        await client.query("BEGIN");

        const promises = levelTerms.map(levelTerm => {
            const batch_value = (levelTerm.batch === "" || levelTerm.batch === undefined) ? 0 : parseInt(levelTerm.batch);
            const values = [levelTerm.active, batch_value, levelTerm.level_term, levelTerm.department];
            return client.query(query, values);
        });

        await Promise.all(promises);

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function addLevelTermDB(level_term, department) {
    const query = `
        INSERT INTO level_term_unique (level_term, department)
        VALUES ($1, $2)
        ON CONFLICT (level_term, department) DO UPDATE SET batch = excluded.batch;
    `;
    const client = await connect();
    const values = [level_term, department];
    let result = false;
    try {
        await client.query("BEGIN");
        const res = await client.query(query, values);
        if (res.rowCount > 0) {
            result = true;
        }
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
        return result;
    }
}

export async function deleteLevelTermDB(level_term, department) {
    const query = `
        DELETE FROM level_term_unique
        WHERE level_term = $1
        AND department = $2
    `;
    const client = await connect();
    const values = [level_term, department];

    let result = false;

    try {
        await client.query("BEGIN");
        await client.query(query, values);
        await client.query("COMMIT");
        result = true;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
        return result;
    }
}

async function clearTables() {
    const query = `
        truncate schedule_assignment, teacher_sessional_assignment, courses_sections, sections, teacher_assignment, courses, forms;
    `;
    const client = await connect();

    try {
        await client.query("BEGIN");

        await client.query(query);

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function getSession() {
    const query = `
        SELECT value
        FROM configs
        WHERE key = 'CURRENT_SESSION';
    `
    const client = await connect();
    const result = await client.query(query);
    client.release();
    return result.rows[0].value;
}

async function initializeSectionsTable(levelTerms, session) {
    const activeLevelTerms = levelTerms.filter((levelTerm) => levelTerm.active);
    const client = await connect();
    try {
        await client.query("BEGIN");
        const section_count_query = `
            select coalesce(sc.section_count, d.section_count) as section_count,
                   coalesce(sc.subsection_count_per_section, d.subsection_count_per_section) as subsection_count_per_section
            from default_section_count d
            left join section_count sc on sc.department = d.department and sc.batch = $1
            where d.department = $2;
        `;
        for (const levelTerm of activeLevelTerms) {
            const section_count_values = [parseInt(levelTerm.batch), levelTerm.department];
            const section_count_result = await client.query(section_count_query, section_count_values);
            if (section_count_result.rows.length === 0) {
                throw new HttpError(404, `Section count not found for batch ${levelTerm.batch} and department ${levelTerm.department}`);
            }
            const levelTermSectionCount = parseInt(section_count_result.rows[0].section_count);
            const subsection_count_per_section = parseInt(section_count_result.rows[0].subsection_count_per_section);
            for (let i = 0; i < levelTermSectionCount; i++) {
                const section = String.fromCharCode(65 + i);
                const query = `
                    INSERT INTO sections (batch, section, "type", session, level_term, department)
                    VALUES ($1, $2, $3,$4, $5, $6)
                    ON CONFLICT (department, batch, section)
                    DO UPDATE SET "type" = $3, session = $4, level_term = $5
                `;
                const values = [parseInt(levelTerm.batch), section, 0, session, levelTerm.level_term, levelTerm.department];
                await client.query(query, values);
                for(let j = 1; j <= subsection_count_per_section; j++){
                    const values2 = [parseInt(levelTerm.batch), `${section}${j}`, 1, session, levelTerm.level_term, levelTerm.department];
                    await client.query(query, values2);
                }
            }
        }
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }

}

async function getAllActiveCourses(levelTerms, session) {
    const activeLevelTerms = levelTerms.filter((levelTerm) => levelTerm.active);
    // Optional courses are catalogue entries until someone offers them to
    // specific sections, so they are not activated with the level-term.
    const query = `
        select ac.*
        from level_term_unique ltu
        join all_courses ac
        on ac.level_term = ltu.level_term and ac."to" = ltu.department
        where ltu.level_term = $1 and ltu.department = $2 and ac.optional = 0;
    `;
    const section_count_query = `
        select coalesce(sc.section_count, d.section_count) as section_count
        from default_section_count d
        left join section_count sc on sc.department = d.department and sc.batch = $1
        where d.department = $2;
    `;
    const client = await connect();
    let activeCourses = [];
    for (const levelTerm of activeLevelTerms) {
        const values = [levelTerm.level_term, levelTerm.department];
        const result = await client.query(query, values);
        const section_count_values = [parseInt(levelTerm.batch), levelTerm.department];
        const section_count_result = await client.query(section_count_query, section_count_values);
        if (section_count_result.rows.length === 0) {
            throw new HttpError(404, `Section count not found for batch ${levelTerm.batch} and department ${levelTerm.department}`);
        }
        const levelTermSectionCount = parseInt(section_count_result.rows[0].section_count);
        const courses = result.rows.map((c) => {
            return {
                ...c,
                session: session,
                teacher_credit: c.class_per_week * levelTermSectionCount
            }
        });
        activeCourses = activeCourses.concat(courses);
    }
    client.release();
    return activeCourses;
}

async function initializeCoursesTable(activeCourses) {
    const query = `
        INSERT INTO courses (course_id, session, "name", "type", class_per_week, "from", "to", teacher_credit, level_term, sessional_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
    `;
    const query2 = `
        INSERT INTO courses (course_id, session, "name", "type", class_per_week, "from", "to") VALUES ($1, $2, $3, $4, $5, $6, $7);
    `;
    const values2 = ['CT', activeCourses[0].session, 'Class Test', 0, 3, 'CSE', 'CSE'];
    const client = await connect();
    try {
        await client.query("BEGIN");
        console.log(activeCourses);
        for (const course of activeCourses) {
            const values = [course.course_id, course.session, course.name, course.type, course.class_per_week, course.from, course.to, course.teacher_credit, course.level_term, course.sessional_type || null];
            await client.query(query, values);
        }
        await client.query(query2, values2);
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

async function initializeCoursesSectionsTable() {
    const query = `
        INSERT INTO courses_sections (course_id, session, batch, section, department)
        SELECT c.course_id, c.session, s.batch, s.section, s.department
        FROM courses c
        JOIN sections s 
        ON c.level_term = s.level_term AND c.type = s.type AND c."to" = s.department;
    `;
    const query2 = `
        SELECT course_id 
        FROM courses
        WHERE class_per_week = 0.75
    `;
    const client = await connect();
    try {
        await client.query("BEGIN");
        await client.query(query);
        const result = await client.query(query2);
        const courses = result.rows.map(row => row.course_id);

        // For 0.75 credit courses, remove subsection entries and add main section entries
        for (const courseId of courses) {
            // First, get the distinct main sections before deleting
            const selectQuery = `
                SELECT DISTINCT session, batch, LEFT(section, 1) as main_section, department
                FROM courses_sections 
                WHERE course_id = $1 AND section ~ '^[A-Z][0-9]+$'
            `;
            const sectionsResult = await client.query(selectQuery, [courseId]);
            
            // Delete existing subsection entries (like A1, A2) for this course
            const deleteQuery = `
                DELETE FROM courses_sections 
                WHERE course_id = $1 AND section ~ '^[A-Z][0-9]+$'
            `;
            await client.query(deleteQuery, [courseId]);

            // Insert main section entries (like A, B) for this course
            for (const sectionData of sectionsResult.rows) {
                const insertQuery = `
                    INSERT INTO courses_sections (course_id, session, batch, section, department)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT DO NOTHING
                `;
                await client.query(insertQuery, [
                    courseId, 
                    sectionData.session, 
                    sectionData.batch, 
                    sectionData.main_section, 
                    sectionData.department
                ]);
            }
        }

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

const hasBatch = (levelTerm) =>
    levelTerm.batch !== "" &&
    levelTerm.batch !== undefined &&
    levelTerm.batch !== null &&
    Number(levelTerm.batch) !== 0;

/**
 * Gives each active level-term left without a batch the batch normally in it:
 * the newest batch is in Level 1, the one before it in Level 2, and so on.
 */
export async function fillMissingBatches(levelTerms) {
    if (levelTerms.every((levelTerm) => !levelTerm.active || hasBatch(levelTerm))) {
        return levelTerms;
    }

    const client = await connect();
    let newest;
    try {
        const result = await client.query("SELECT MAX(batch) AS batch FROM section_count");
        newest = result.rows[0].batch;
    } finally {
        client.release();
    }
    if (newest === null) {
        throw new HttpError(400, "No batches are set up yet, so choose a batch for each level-term.");
    }

    return levelTerms.map((levelTerm) => {
        if (!levelTerm.active || hasBatch(levelTerm)) return levelTerm;
        const level = parseInt((levelTerm.level_term.match(/L-(\d+)/) || [])[1], 10);
        if (!level) {
            throw new HttpError(400, `Choose a batch for ${levelTerm.level_term} (${levelTerm.department})`);
        }
        return { ...levelTerm, batch: newest - (level - 1) };
    });
}

export async function initiateDB(levelTerms) {
    await clearTables();
    console.log("Database tables cleared");

    const session = await getSession();
    console.log("Fetched current session: " + session);

    await initializeSectionsTable(levelTerms, session);
    console.log("Sections table initialized");

    const activeCourses = await getAllActiveCourses(levelTerms, session);
    console.log("Fetched all active courses");

    await initializeCoursesTable(activeCourses);
    console.log("Courses table initialized");

    await initializeCoursesSectionsTable();
    console.log("Courses_Sections table initialized");

}
