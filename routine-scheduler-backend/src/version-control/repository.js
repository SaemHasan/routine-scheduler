import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const backupDir = '/backups';

if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

const runCommand = (command) => {
    return new Promise((resolve, reject) => {
        const fullCommand = `PGPASSWORD=${process.env.POSTGRES_PASSWORD} ${command}`;
        exec(fullCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`Command Error: ${stderr}`);
                return reject(new Error(`Execution failed: ${stderr}`));
            }
            resolve(stdout);
        });
    });
};

export const listVersions = () => {
    return new Promise((resolve, reject) => {
        // Look for .dump files now
        fs.readdir(backupDir, (err, files) => {
            if (err) return reject(err);
            const versions = files
                .filter(file => file.endsWith('.dump'))
                .map(file => {
                    try {
                        const stats = fs.statSync(path.join(backupDir, file));
                        return { filename: file, createdAt: stats.birthtime, size: stats.size };
                    } catch { return null; }
                })
                .filter(Boolean)
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            resolve(versions);
        });
    });
};

export const createBackup = (versionName) => {
    // Use .dump extension for custom format
    const filename = `${versionName}.dump`;
    const backupPath = path.join(backupDir, filename);

    if (fs.existsSync(backupPath)) {
        const error = new Error(`Version '${versionName}' already exists.`);
        error.statusCode = 409;
        throw error;
    }

    const { POSTGRES_USER, POSTGRES_DB } = process.env;
    // Use -F c for custom-format archive file
    const dumpCommand = `pg_dump -h db -U ${POSTGRES_USER} -d ${POSTGRES_DB} -F c -f "${backupPath}"`;
    return runCommand(dumpCommand);
};

export const restoreBackup = (filename) => {
    const backupPath = path.join(backupDir, filename);
    if (!fs.existsSync(backupPath)) {
        const error = new Error('Version not found.');
        error.statusCode = 404;
        throw error;
    }

    const { POSTGRES_USER, POSTGRES_DB } = process.env;
    // Use pg_restore with --clean to drop existing objects before creating them
    const restoreCommand = `pg_restore -h db -U ${POSTGRES_USER} -d ${POSTGRES_DB} --clean "${backupPath}"`;
    return runCommand(restoreCommand);
};

export const deleteBackup = (filename) => {
    return new Promise((resolve, reject) => {
        const backupPath = path.join(backupDir, filename);
        if (!fs.existsSync(backupPath)) {
            const error = new Error('Version not found.');
            error.statusCode = 404;
            return reject(error);
        }
        fs.unlink(backupPath, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
};

export const getBackupPath = (filename) => {
    return new Promise((resolve, reject) => {
        const backupPath = path.join(backupDir, filename);
        if (!fs.existsSync(backupPath)) {
            const error = new Error('Version not found.');
            error.statusCode = 404;
            return reject(error);
        }
        resolve(backupPath);
    });
};

export const saveUploadedBackup = (uploadedFilePath, versionName) => {
    return new Promise((resolve, reject) => {
        const filename = `${versionName}.dump`;
        const backupPath = path.join(backupDir, filename);

        if (fs.existsSync(backupPath)) {
            const error = new Error(`Version '${versionName}' already exists.`);
            error.statusCode = 409;
            return reject(error);
        }

        // Copy the uploaded file to the backup directory instead of rename
        fs.copyFile(uploadedFilePath, backupPath, (err) => {
            if (err) {
                // Clean up the temporary file
                fs.unlink(uploadedFilePath, () => {});
                return reject(err);
            }
            
            // Remove the temporary file after successful copy
            fs.unlink(uploadedFilePath, (unlinkErr) => {
                if (unlinkErr) {
                    console.warn('Failed to remove temporary file:', unlinkErr);
                }
                resolve();
            });
        });
    });
};
