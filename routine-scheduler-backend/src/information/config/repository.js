import { connect } from '../../config/database.js';

/**
 * Get a configuration value by key
 * @param {string} key - The configuration key
 * @returns {Promise<string|null>} - The configuration value or null if not found
 */
export const getConfigValue = async (key) => {
    const client = await connect();
    try {
        const { rows } = await client.query(
            `SELECT value FROM configs WHERE key = $1`,
            [key]
        );
        return rows.length ? rows[0].value : null;
    } finally {
        client.release();
    }
};

/**
 * Get all configuration values
 * @returns {Promise<Array>} - Array of config key-value pairs
 */
export const getAllConfigs = async () => {
    const client = await connect();
    try {
        const { rows } = await client.query(`SELECT key, value FROM configs`);
        return rows;
    } finally {
        client.release();
    }
};

/**
 * Set a configuration value
 * @param {string} key - The configuration key
 * @param {string} value - The configuration value (will be JSON stringified if object)
 * @returns {Promise<boolean>} - True if successful
 */
export const setConfigValue = async (key, value) => {
    const client = await connect();
    try {
        // Convert value to string if it's an object/array
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        
        await client.query(
            `INSERT INTO configs (key, value) VALUES ($1, $2)
             ON CONFLICT (key) DO UPDATE SET value = $2`,
            [key, stringValue]
        );
        return true;
    } finally {
        client.release();
    }
};

/**
 * Delete a configuration value
 * @param {string} key - The configuration key to delete
 * @returns {Promise<boolean>} - True if successful
 */
export const deleteConfigValue = async (key) => {
    const client = await connect();
    try {
        await client.query(`DELETE FROM configs WHERE key = $1`, [key]);
        return true;
    } finally {
        client.release();
    }
};
