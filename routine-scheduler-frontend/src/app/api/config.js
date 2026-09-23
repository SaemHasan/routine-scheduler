import axios from 'axios';
import { baseUrl } from './index';

/**
 * Get all configuration values
 * @returns {Promise<Object>} Configuration values
 */
export const getAllConfigurations = async () => {
    const response = await axios.get(`${baseUrl}/config`);
    return response.data.data;
};

/**
 * Get a specific configuration value by key
 * @param {string} key - Configuration key
 * @returns {Promise<any>} Configuration value
 */
export const getConfiguration = async (key) => {
    const response = await axios.get(`${baseUrl}/config/${key}`);
    return response.data.data;
};

/**
 * Set a configuration value
 * @param {string} key - Configuration key
 * @param {any} value - Configuration value
 * @returns {Promise<Object>} Result
 */
export const setConfiguration = async (key, value) => {
    const response = await axios.post(`${baseUrl}/config/${key}`, { value });
    return response.data;
};

/**
 * Initialize default configurations
 * @returns {Promise<Object>} Result with default configurations
 */
export const initializeConfigurations = async () => {
    const response = await axios.post(`${baseUrl}/config/init`);
    return response.data;
};
