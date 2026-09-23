import { connect } from "../config/database.js";

export async function getSectionCountDB(batch, department) {
    const query = `
        SELECT section_count, subsection_count_per_section
        FROM section_count
        WHERE batch = $1 AND department = $2
    `;
    const values = [batch, department];

    const client = await connect();
    const result = await client.query(query, values);
    client.release();
    return result.rows[0];
}

export async function getAllSectionCountDB() {
    const query = `
        SELECT department, batch, section_count, subsection_count_per_section
        FROM section_count
        ORDER BY department, batch
    `;
    const client = await connect();
    const result = await client.query(query);
    client.release();
    return result.rows;
}

export async function setSectionCountDB(batch, department, section_count, subsection_count_per_section) {
    const query = `
        INSERT INTO section_count (batch, department, section_count, subsection_count_per_section)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (batch, department) DO UPDATE SET 
            section_count = excluded.section_count,
            subsection_count_per_section = excluded.subsection_count_per_section
    `;
    const values = [batch, department, section_count, subsection_count_per_section];

    const client = await connect();
    const result = await client.query(query, values);
    client.release();
    return result.rowCount > 0;
}

export async function deleteSectionCountDB(batch, department) {
    const query = `
        DELETE FROM section_count
        WHERE batch = $1 AND department = $2
    `;
    const values = [batch, department];

    const client = await connect();
    const result = await client.query(query, values);
    client.release();
    return result.rowCount > 0;
}

export async function getDefaultSectionCountDB(department) {
    const query = `
        SELECT section_count, subsection_count_per_section
        FROM default_section_count
        WHERE department = $1
    `;
    const values = [department];

    const client = await connect();
    const result = await client.query(query, values);
    client.release();
    return result.rows[0];
}

export async function getDefaultAllSectionCountDB() {
    const query = `
        SELECT *
        FROM default_section_count
        ORDER BY department
    `;
    const client = await connect();
    const result = await client.query(query);
    client.release();
    return result.rows;
}

export async function setDefaultSectionCountDB(department, section_count, subsection_count_per_section) {
    const query = `
        INSERT INTO default_section_count (department, section_count, subsection_count_per_section)
        VALUES ($1, $2, $3)
        ON CONFLICT (department) DO UPDATE SET 
            section_count = excluded.section_count,
            subsection_count_per_section = excluded.subsection_count_per_section
    `;
    const values = [department, section_count, subsection_count_per_section];

    const client = await connect();
    const result = await client.query(query, values);
    client.release();
    return result.rowCount > 0;
}

export async function deleteDefaultSectionCountDB(department) {
    const query = `
        DELETE FROM default_section_count
        WHERE department = $1
    `;
    const values = [department];

    const client = await connect();
    const result = await client.query(query, values);
    client.release();
    return result.rowCount > 0;
}

export async function getBatchesDB() {
    const query = `
        SELECT DISTINCT batch
        FROM section_count
        ORDER BY batch
    `;

    const client = await connect();
    const result = await client.query(query);
    client.release();
    return result.rows.map(row => row.batch);
}

export async function addBatchDB(batch) {
    const query = `
        INSERT INTO section_count (batch, department, section_count, subsection_count_per_section)
        SELECT $1, department, section_count, subsection_count_per_section 
        FROM default_section_count 
        ON CONFLICT (batch, department) DO UPDATE SET
            section_count = excluded.section_count,
            subsection_count_per_section = excluded.subsection_count_per_section
    `;
    const values = [batch];

    const client = await connect();
    const result = await client.query(query, values);
    client.release();
    return result.rowCount > 0;
}

export async function deleteBatchDB(batch) {
    const query = `
        DELETE FROM section_count
        WHERE batch = $1
    `;
    const values = [batch];

    const client = await connect();
    const result = await client.query(query, values);
    client.release();
    return result.rowCount > 0;
}

export async function getDepartmentsDB() {
    const query = `
        SELECT DISTINCT department
        FROM section_count
        ORDER BY department
    `;

    const client = await connect();
    const result = await client.query(query);
    client.release();
    return result.rows.map(row => row.department);
}

export async function getLevelTermsDB() {
    const level_query = `SELECT value FROM configs WHERE key = 'LEVEL_COUNT'`;
    const term_query = `SELECT value FROM configs WHERE key = 'TERM_COUNT'`;

    const client = await connect();
    const levelResult = await client.query(level_query);

    const termResult = await client.query(term_query);
    client.release();
    if (levelResult.rows.length === 0 || termResult.rows.length === 0)
        throw new Error("Configuration for LEVEL_COUNT or TERM_COUNT not found");
    const level = parseInt(levelResult.rows[0].value, 10);
    const term = parseInt(termResult.rows[0].value, 10);
    if (isNaN(level) || isNaN(term))
        throw new Error("Invalid LEVEL_COUNT or TERM_COUNT value");

    // create a 2D array to hold the level-term combinations
    const result = [];
    for (let i = 1; i <= level; i++) {
        for (let j = 1; j <= term; j++) {
            result.push(`L-${i} T-${j}`);
        }
    }
    return result;
}

export async function getHostedDepartmentsDB() {
    const query = `
        SELECT department
        FROM hosted_departments
        ORDER BY department
    `;

    const client = await connect();
    const result = await client.query(query);
    client.release();
    return result.rows.map(row => row.department);
}

export async function addHostedDepartmentDB(department) {
    const query = `
        INSERT INTO hosted_departments (department)
        VALUES ($1)
        ON CONFLICT (department) DO NOTHING
    `;
    const values = [department];

    const client = await connect();
    const result = await client.query(query, values);
    client.release();
    return result.rowCount > 0;
}

export async function deleteHostedDepartmentDB(department) {
    const query = `
        DELETE FROM hosted_departments
        WHERE department = $1
    `;
    const values = [department];

    const client = await connect();
    const result = await client.query(query, values);
    client.release();
    return result.rowCount > 0;
}