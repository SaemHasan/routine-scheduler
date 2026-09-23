import express from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import * as controller from './controller.js';
// CORRECTED IMPORT PATH
import validate from '../config/validation.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ 
    dest: '/tmp/', // Temporary directory for uploads
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// GET /v1/versions/
router.get('/', controller.getVersions);

// POST /v1/versions/save
router.post(
    '/save',
    validate([
        body('versionName')
            .notEmpty().withMessage('Version name cannot be empty.')
            .isString()
            .matches(/^[a-zA-Z0-9_.-]+$/).withMessage('Version name can only contain letters, numbers, underscores, and hyphens.')
    ]),
    controller.saveVersion
);

// POST /v1/versions/load/:filename
router.post('/load/:filename', controller.loadVersion);

// DELETE /v1/versions/:filename
router.delete('/:filename', controller.deleteVersion);

// GET /v1/versions/download/:filename - Download dump file
router.get('/download/:filename', controller.downloadVersion);

// POST /v1/versions/upload - Upload dump file
router.post('/upload', upload.single('dumpFile'), controller.uploadVersion);

export default router;
