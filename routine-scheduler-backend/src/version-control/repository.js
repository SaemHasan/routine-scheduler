import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

const backupDir = '/backups';

if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

// Connection string for pg_dump and pg_restore, built from CONNECTION_URL
const dumpConnectionUrl = () => {
    const url = new URL(process.env.CONNECTION_URL);
    // Neon's pooler runs PgBouncer in transaction mode, which loses the session
    // settings pg_dump and pg_restore rely on, so connect to the compute directly
    url.hostname = url.hostname.replace('-pooler.', '.');
    // verify-full needs a CA bundle; use the operating system's trusted roots
    if (url.searchParams.get('sslmode') === 'verify-full' && !url.searchParams.has('sslrootcert')) {
        url.searchParams.set('sslrootcert', 'system');
    }
    return url.toString();
};

// execFile passes arguments without a shell, so names and the connection
// string cannot be interpreted as shell syntax
const runCommand = (command, args) => {
    return new Promise((resolve, reject) => {
        execFile(command, args, (error, stdout, stderr) => {
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
                        // Bind mounts from macOS report no birth time (the epoch)
                        const createdAt = stats.birthtimeMs > 0 ? stats.birthtime : stats.mtime;
                        return { filename: file, createdAt, size: stats.size };
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

    // Use -F c for custom-format archive file
    return runCommand('pg_dump', ['-d', dumpConnectionUrl(), '-F', 'c', '-f', backupPath])
        .catch((error) => {
            // pg_dump creates the file before connecting; remove it so a failed
            // backup does not show up as a version or block retrying the name
            fs.rmSync(backupPath, { force: true });
            throw error;
        });
};

export const restoreBackup = (filename) => {
    const backupPath = path.join(backupDir, filename);
    if (!fs.existsSync(backupPath)) {
        const error = new Error('Version not found.');
        error.statusCode = 404;
        throw error;
    }

    // Use pg_restore with --clean to drop existing objects before creating them.
    // --no-owner and --no-privileges let dumps taken under another role (such as
    // the old local Postgres user) restore as the Neon role in CONNECTION_URL
    return runCommand('pg_restore', [
        '-d', dumpConnectionUrl(),
        '--clean', '--if-exists', '--no-owner', '--no-privileges',
        backupPath,
    ]);
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
