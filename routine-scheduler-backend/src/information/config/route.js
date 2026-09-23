import express from 'express';
import * as controller from './controller.js';

const router = express.Router();

// Get all configs
router.get('/', controller.getAllConfigs);

// Initialize default configurations
router.post('/init', controller.initConfigs);

// Get a specific config by key
router.get('/:key', controller.getConfig);

// Set a config value
router.post('/:key', controller.setConfig);

// Delete a config
router.delete('/:key', controller.deleteConfig);

export default router;
