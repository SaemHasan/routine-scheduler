import * as repository from './repository.js';

/**
 * Get a configuration value by key
 */
export const getConfig = async (req, res, next) => {
    try {
        const { key } = req.params;
        const value = await repository.getConfigValue(key);
        
        if (value === null) {
            return res.status(404).json({ success: false, message: 'Configuration not found' });
        }
        
        // Try to parse JSON if the value is a JSON string
        let parsedValue = value;
        try {
            parsedValue = JSON.parse(value);
        } catch (e) {
            // Not a valid JSON, keep as is
        }
        
        res.json({ success: true, data: parsedValue });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all configuration values
 */
export const getAllConfigs = async (req, res, next) => {
    try {
        const configs = await repository.getAllConfigs();
        
        // Try to parse JSON values where possible
        const parsedConfigs = configs.map(config => {
            try {
                return {
                    key: config.key,
                    value: JSON.parse(config.value)
                };
            } catch (e) {
                return config;
            }
        });
        
        res.json({ success: true, data: parsedConfigs });
    } catch (error) {
        next(error);
    }
};

/**
 * Set a configuration value
 */
export const setConfig = async (req, res, next) => {
    try {
        const { key } = req.params;
        const { value } = req.body;
        
        if (value === undefined) {
            return res.status(400).json({ success: false, message: 'Value is required' });
        }
        
        await repository.setConfigValue(key, value);
        res.json({ success: true, message: 'Configuration saved successfully' });
    } catch (error) {
        next(error);
    }
};

/**
 * Initialize system configurations
 */
export const initConfigs = async (req, res, next) => {
    try {
        // Define default configurations
        const defaultConfigs = {
            'CURRENT_SESSION': 'January 2025',
            'times': [8, 9, 10, 11, 12, 1, 2, 3, 4],
            'days': ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"],
            'possibleLabTimes': [8, 11, 2]
        };
        
        // Set each configuration
        for (const [key, value] of Object.entries(defaultConfigs)) {
            await repository.setConfigValue(key, value);
        }
        
        res.json({ 
            success: true, 
            message: 'System configurations initialized successfully',
            data: defaultConfigs
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete a configuration
 */
export const deleteConfig = async (req, res, next) => {
    try {
        const { key } = req.params;
        await repository.deleteConfigValue(key);
        res.json({ success: true, message: 'Configuration deleted successfully' });
    } catch (error) {
        next(error);
    }
};
