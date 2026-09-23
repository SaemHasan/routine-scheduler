// Initialize configuration values
import { setConfigValue } from '../information/config/repository.js';
import { connect } from './database.js';

/**
 * Initialize system configurations if they don't exist
 */
export const initSystemConfigs = async () => {
    try {
        const client = await connect();
        
        try {
            // Check if configs table exists
            const tableCheck = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'configs'
                );
            `);
            
            if (!tableCheck.rows[0].exists) {
                console.log('Config table does not exist. Skipping initialization.');
                return;
            }
            
            // Define default configurations
            const defaultConfigs = {
                'CURRENT_SESSION': 'January 2025',
                'times': [8, 9, 10, 11, 12, 1, 2, 3, 4],
                'days': ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"],
                'possibleLabTimes': [8, 11, 2]
            };
            
            // Check which configs are missing
            const { rows } = await client.query('SELECT key FROM configs');
            const existingKeys = rows.map(row => row.key);
            
            // Set each missing configuration
            for (const [key, value] of Object.entries(defaultConfigs)) {
                if (!existingKeys.includes(key)) {
                    await setConfigValue(key, value);
                    console.log(`Initialized config: ${key}`);
                }
            }
            
            console.log('System configurations checked/initialized successfully');
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error initializing system configs:', error);
    }
};
