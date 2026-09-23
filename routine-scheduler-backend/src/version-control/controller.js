import * as repository from './repository.js';

export const getVersions = async (req, res, next) => {
    try {
        const versions = await repository.listVersions();
        res.json(versions);
    } catch (error) {
        next(error);
    }
};

export const saveVersion = async (req, res, next) => {
    try {
        const { versionName } = req.body;
        await repository.createBackup(versionName);
        res.status(201).json({ message: `Version '${versionName}' saved successfully.` });
    } catch (error) {
        next(error);
    }
};

export const loadVersion = async (req, res, next) => {
    try {
        const { filename } = req.params;
        await repository.restoreBackup(filename);
        res.json({ message: `Version '${filename}' loaded successfully.` });
    } catch (error) {
        next(error);
    }
};

export const deleteVersion = async (req, res, next) => {
    try {
        const { filename } = req.params;
        await repository.deleteBackup(filename);
        res.json({ message: `Version '${filename}' deleted successfully.` });
    } catch (error) {
        next(error);
    }
};

export const downloadVersion = async (req, res, next) => {
    try {
        const { filename } = req.params;
        const filePath = await repository.getBackupPath(filename);
        
        // Set headers for file download
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        
        // Send the file
        res.sendFile(filePath);
    } catch (error) {
        next(error);
    }
};

export const uploadVersion = async (req, res, next) => {
    try {
        if (!req.file) {
            const error = new Error('No file uploaded.');
            error.statusCode = 400;
            throw error;
        }

        const { originalname } = req.file;
        const { versionName } = req.body;

        // Use provided version name or original filename
        const finalName = versionName || originalname.replace('.dump', '');
        
        await repository.saveUploadedBackup(req.file.path, finalName);
        
        res.status(201).json({ 
            message: `Version '${finalName}' uploaded successfully.`,
            filename: `${finalName}.dump`
        });
    } catch (error) {
        next(error);
    }
};
