import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { Modal, Button } from 'react-bootstrap';
import { getVersions, saveVersion, loadVersion, deleteVersion, downloadVersion, uploadVersion } from '../api/versions';
import { mdiContentSave, mdiDatabaseCheck, mdiDatabaseCog, mdiDownload, mdiUpload } from '@mdi/js';
import Icon from '@mdi/react';

const Spinner = () => (
    <div className="spinner-border spinner-border-sm" role="status">
        <span className="visually-hidden">Loading...</span>
    </div>
);

const Backup = () => {
    const [versions, setVersions] = useState([]);
    const [newVersionName, setNewVersionName] = useState('');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [selectedFilename, setSelectedFilename] = useState(null);
    const [showDeleteWarning, setShowDeleteWarning] = useState(false);
    const [showLoadWarning, setShowLoadWarning] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadVersionName, setUploadVersionName] = useState('');
    const fileInputRef = useRef(null);

    const fetchVersions = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getVersions();
            setVersions(data);
        } catch (err) {
            toast.error('Failed to fetch backup versions.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchVersions();
    }, [fetchVersions]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!newVersionName) {
            toast.error('Please enter a name for the backup.');
            return;
        }

        setActionLoading('save');
        try {
            const data = await saveVersion(newVersionName);
            toast.success(data.message);
            setNewVersionName('');
            fetchVersions();
        } catch (err) {
            toast.error('Failed to save backup version.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleLoad = async (filename) => {
        setActionLoading(filename);
        try {
            const data = await loadVersion(filename);
            toast.success(`${data.message} Please refresh to see changes.`);
        } catch (err) {
            toast.error('Failed to load backup version.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async (filename) => {
        setActionLoading(filename);
        try {
            const data = await deleteVersion(filename);
            toast.success(data.message);
            fetchVersions();
        } catch (err) {
            toast.error('Failed to delete backup version.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDownload = async (filename) => {
        setActionLoading(`download_${filename}`);
        try {
            const data = await downloadVersion(filename);
            toast.success(data.message);
        } catch (err) {
            toast.error('Failed to download backup version.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (!file.name.endsWith('.dump')) {
                toast.error('Please select a .dump file.');
                return;
            }
            setUploadFile(file);
            setUploadVersionName(file.name.replace('.dump', ''));
        }
    };

    const handleUpload = async () => {
        if (!uploadFile) {
            toast.error('Please select a file to upload.');
            return;
        }

        if (!uploadVersionName.trim()) {
            toast.error('Please enter a version name.');
            return;
        }

        setActionLoading('upload');
        try {
            const data = await uploadVersion(uploadFile, uploadVersionName.trim());
            toast.success(data.message);
            setUploadFile(null);
            setUploadVersionName('');
            setShowUploadModal(false);
            fetchVersions();
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (err) {
            toast.error('Failed to upload backup version.');
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div>
            {/* Modern Page Header */}
            <div className="page-header" style={{
                background: "linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(154, 77, 226) 100%)",
                borderRadius: "16px",
                padding: "1.5rem",
                marginBottom: "2rem",
                boxShadow: "0 8px 32px rgba(174, 117, 228, 0.15)",
                color: "white"
            }}>
                <h3 className="page-title" style={{
                    fontSize: "1.8rem",
                    fontWeight: "700",
                    marginBottom: "0.5rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    color: "white"
                }}>
                    <div style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "10px",
                        backgroundColor: "rgba(255, 255, 255, 0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)"
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89317 18.7122 8.75608 18.1676 9.45768C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    Database Backup and Restore
                </h3>
            </div>
            <div className="row mb-4">
                <div className="col-12">
                    <div className="card" style={{
                        borderRadius: "16px",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
                        border: "none",
                        transition: "all 0.3s ease",
                        background: "white"
                    }}>
                        <div className="card-body" style={{ padding: "2rem" }}>
                            <div style={{ borderBottom: "3px solid rgb(194, 137, 248)", paddingBottom: "16px", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <h4 className="card-title" style={{
                                    color: "rgb(174, 117, 228)",
                                    marginBottom: 0,
                                    fontWeight: "700",
                                    display: "flex",
                                    alignItems: "center",
                                    fontSize: "1.5rem",
                                    letterSpacing: "0.3px"
                                }}>
                                    <span style={{ marginRight: "12px" }}>
                                        <Icon path={mdiDatabaseCheck} size={1} color="rgb(194, 137, 248)" />
                                    </span>
                                    Database Backup
                                </h4>
                            </div>
                            <div className="card-body" style={{ padding: "2rem" }}>
                                <h5 className="card-title">Save New Backup</h5>
                                <form onSubmit={handleSave} className="mb-4">
                                    <div className="input-group">
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g., final-exam-draft-1"
                                            value={newVersionName}
                                            onChange={(e) => setNewVersionName(e.target.value)}
                                            disabled={actionLoading === 'save'}
                                            style={{
                                                borderRadius: "12px",
                                                border: "1.5px solid rgba(194, 137, 248, 0.3)",
                                                boxShadow: "0 2px 5px rgba(194, 137, 248, 0.05)",
                                                padding: "8px 12px",
                                                fontSize: "15px",
                                                transition: "all 0.3s ease"
                                            }}
                                        />
                                        <button className="btn btn-primary" type="submit" disabled={actionLoading === 'save'}
                                            style={{
                                                background: "rgba(154, 77, 226, 0.15)",
                                                color: "rgb(154, 77, 226)",
                                                border: "1px solid rgba(154, 77, 226, 0.5)",
                                                borderRadius: "12px",
                                                padding: "7px 14px",
                                                transition: "all 0.3s ease",
                                                fontWeight: "500",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "6px",
                                                marginLeft: "16px"
                                            }}
                                            onMouseOver={e => {
                                                e.currentTarget.style.background = "rgb(154, 77, 226)";
                                                e.currentTarget.style.color = "white";
                                            }}
                                            onMouseOut={e => {
                                                e.currentTarget.style.background = "rgba(154, 77, 226, 0.15)";
                                                e.currentTarget.style.color = "rgb(154, 77, 226)";
                                            }}
                                        >
                                            <Icon path={mdiContentSave} size={0.7} style={{ marginRight: "6px" }} />
                                            {actionLoading === 'save' ? <Spinner /> : 'Save Current State'}
                                        </button>
                                    </div>
                                </form>

                                <h5 className="card-title">Upload Backup File</h5>
                                <div className="mb-3">
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => setShowUploadModal(true)}
                                        disabled={!!actionLoading}
                                        style={{
                                            background: "rgba(108, 117, 125, 0.15)",
                                            color: "rgb(108, 117, 125)",
                                            border: "1px solid rgba(108, 117, 125, 0.5)",
                                            borderRadius: "12px",
                                            padding: "7px 14px",
                                            transition: "all 0.3s ease",
                                            fontWeight: "500",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "6px"
                                        }}
                                        onMouseOver={e => {
                                            e.currentTarget.style.background = "rgb(108, 117, 125)";
                                            e.currentTarget.style.color = "white";
                                        }}
                                        onMouseOut={e => {
                                            e.currentTarget.style.background = "rgba(108, 117, 125, 0.15)";
                                            e.currentTarget.style.color = "rgb(108, 117, 125)";
                                        }}
                                    >
                                        <Icon path={mdiUpload} size={0.7} style={{ marginRight: "6px" }} />
                                        Upload Backup File
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <div className="row mb-4">
                <div className="col-12">
                    <div className="card" style={{
                        borderRadius: "16px",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
                        border: "none",
                        transition: "all 0.3s ease",
                        background: "white"
                    }}>
                        <div className="card-body" style={{ padding: "2rem" }}>
                            <div style={{ borderBottom: "3px solid rgb(194, 137, 248)", paddingBottom: "16px", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <h4 className="card-title" style={{
                                    color: "rgb(174, 117, 228)",
                                    marginBottom: 0,
                                    fontWeight: "700",
                                    display: "flex",
                                    alignItems: "center",
                                    fontSize: "1.5rem",
                                    letterSpacing: "0.3px"
                                }}>
                                    <span style={{ marginRight: "12px" }}>
                                        <Icon path={mdiDatabaseCog} size={1} color="rgb(194, 137, 248)" />
                                    </span>
                                    Database Restore
                                </h4>
                            </div>
                            <div className="card-body" style={{ padding: "2rem" }}>
                                <h5 className="card-title">Saved Backups</h5>
                                {loading ? (
                                    <div className="text-center p-4"><Spinner /></div>
                                ) : (
                                    <ul className="list-group">
                                        {versions.length > 0 ? versions.map(version => (
                                            <li key={version.filename} className="list-group-item d-flex justify-content-between align-items-center" style={{
                                                borderRadius: "12px",
                                                border: "1.5px solid rgba(194, 137, 248, 0.3)",
                                                boxShadow: "0 2px 5px rgba(194, 137, 248, 0.05)",
                                                marginBottom: "8px",
                                                padding: "12px 16px",
                                                transition: "all 0.3s ease"
                                            }}>
                                                <div>
                                                    <strong>{version.filename.replace('.dump', '')}</strong>
                                                    <br />
                                                    <small className="text-muted">
                                                        Saved: {new Date(version.createdAt).toLocaleString()} | Size: {Math.round(version.size / 1024)} KB
                                                    </small>
                                                </div>
                                                <div className="btn-group" role="group">
                                                    <button
                                                        className="btn btn-info btn-sm"
                                                        onClick={() => handleDownload(version.filename)}
                                                        disabled={!!actionLoading}
                                                        title={`Download ${version.filename}`}
                                                        style={{
                                                            borderRadius: "6px",
                                                            fontWeight: "500",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                            padding: "7px 14px",
                                                            border: "1px solid rgba(23, 162, 184, 0.3)",
                                                            color: "#17a2b8",
                                                            transition: "all 0.3s ease",
                                                            background: "rgba(23, 162, 184, 0.1)",
                                                            fontSize: "0.9rem",
                                                            marginRight: "8px"
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.target.style.background = "#17a2b8";
                                                            e.target.style.color = "white";
                                                            e.target.style.borderColor = "#17a2b8";
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.target.style.background = "rgba(23, 162, 184, 0.1)";
                                                            e.target.style.color = "#17a2b8";
                                                            e.target.style.borderColor = "rgba(23, 162, 184, 0.3)";
                                                        }}
                                                    >
                                                        <Icon path={mdiDownload} size={0.6} />
                                                        {actionLoading === `download_${version.filename}` ? <Spinner /> : 'Download'}
                                                    </button>
                                                    <button
                                                        className="btn btn-success btn-sm"
                                                        onClick={() => {
                                                            setSelectedFilename(version.filename);
                                                            setShowLoadWarning(true);
                                                        }}
                                                        disabled={!!actionLoading}
                                                        title={`Load ${version.filename}`}
                                                        style={{
                                                            borderRadius: "6px",
                                                            fontWeight: "500",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                            padding: "7px 14px",
                                                            border: "1px solid rgba(40, 167, 69, 0.3)",
                                                            color: "#28a745",
                                                            transition: "all 0.3s ease",
                                                            background: "rgba(40, 167, 69, 0.1)",
                                                            fontSize: "0.9rem",
                                                            marginRight: "8px"

                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.target.style.background = "#28a745";
                                                            e.target.style.color = "white";
                                                            e.target.style.borderColor = "#28a745";
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.target.style.background = "rgba(40, 167, 69, 0.1)";
                                                            e.target.style.color = "#28a745";
                                                            e.target.style.borderColor = "rgba(40, 167, 69, 0.3)";
                                                        }}
                                                    >
                                                        <i className="mdi mdi-backup-restore mr-1"></i>
                                                        {actionLoading === version.filename ? <Spinner /> : 'Load'}
                                                    </button>
                                                    <button
                                                        className="btn btn-danger btn-sm"
                                                        onClick={() => {
                                                            setShowDeleteWarning(true);
                                                            setSelectedFilename(version.filename);
                                                        }}
                                                        disabled={!!actionLoading}
                                                        title={`Delete ${version.filename}`}
                                                        style={{
                                                            background: "rgba(220, 53, 69, 0.1)",
                                                            color: "#dc3545",
                                                            border: "1px solid rgba(220, 53, 69, 0.3)",
                                                            borderRadius: "6px",
                                                            padding: "7px 14px",
                                                            transition: "all 0.3s ease",
                                                            fontWeight: "500",
                                                            marginLeft: "16px"
                                                        }}
                                                        onMouseOver={(e) => {
                                                            e.currentTarget.style.background = "#dc3545";
                                                            e.currentTarget.style.color = "white";
                                                        }}
                                                        onMouseOut={(e) => {
                                                            e.currentTarget.style.background = "rgba(220, 53, 69, 0.1)";
                                                            e.currentTarget.style.color = "#dc3545";
                                                        }}
                                                    >
                                                        <i className="mdi mdi-delete-outline mr-1"></i>
                                                        {actionLoading === version.filename ? <Spinner /> : 'Delete'}
                                                    </button>
                                                </div>
                                            </li>
                                        )) : (
                                            <li className="list-group-item">No saved backups found.</li>
                                        )}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Load Confirmation Modal */}
            {showLoadWarning && (
                <Modal
                    show={showLoadWarning}
                    onHide={() => setShowLoadWarning(false)}
                    size="md"
                    centered
                    contentClassName="border-0 shadow"
                    backdrop="static"
                >
                    <Modal.Header
                        style={{
                            background: "linear-gradient(135deg, rgba(40, 167, 69, 0.05) 0%, rgba(40, 167, 69, 0.1) 100%)",
                            borderBottom: "1px solid rgba(40, 167, 69, 0.2)",
                            paddingTop: "16px",
                            paddingBottom: "16px"
                        }}
                    >
                        <div className="d-flex align-items-center">
                            <div style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "8px",
                                backgroundColor: "rgba(40, 167, 69, 0.15)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: "10px"
                            }}>
                                <i className="mdi mdi-backup-restore" style={{ fontSize: "18px", color: "#28a745" }}></i>
                            </div>
                            <Modal.Title style={{ fontSize: "18px", fontWeight: "600", color: "#28a745" }}>Load Backup</Modal.Title>
                        </div>
                    </Modal.Header>
                    <Modal.Body className="px-4 py-4">
                        <p>Are you sure you want to load: {selectedFilename}?</p>
                        <p>This will overwrite the current routine. Please ensure you have saved any important changes.</p>
                    </Modal.Body>
                    <Modal.Footer style={{ borderTop: "1px solid rgba(40, 167, 69, 0.2)", padding: "16px" }}>
                        <Button
                            style={{
                                background: "rgba(154, 77, 226, 0.15)",
                                color: "rgb(154, 77, 226)",
                                border: "1.5px solid rgba(154, 77, 226, 0.5)",
                                borderRadius: "8px",
                                padding: "8px 20px",
                                fontWeight: "500",
                                fontSize: "1rem",
                                marginRight: "10px",
                                transition: "all 0.3s ease"
                            }}
                            onClick={() => {
                                setSelectedFilename(null);
                                setShowLoadWarning(false);
                            }}
                            onMouseOver={e => {
                                e.currentTarget.style.background = "rgb(154, 77, 226)";
                                e.currentTarget.style.color = "white";
                                e.currentTarget.style.borderColor = "rgb(154, 77, 226)";
                            }}
                            onMouseOut={e => {
                                e.currentTarget.style.background = "rgba(154, 77, 226, 0.15)";
                                e.currentTarget.style.color = "rgb(154, 77, 226)";
                                e.currentTarget.style.borderColor = "rgba(154, 77, 226, 0.5)";
                            }}
                        >
                            <i className="mdi mdi-close mr-1"></i>
                            Cancel
                        </Button>
                        <Button
                            style={{
                                background: "rgba(40, 167, 69, 0.1)",
                                color: "#28a745",
                                border: "1.5px solid rgba(40, 167, 69, 0.3)",
                                borderRadius: "8px",
                                padding: "8px 20px",
                                fontWeight: "500",
                                marginLeft: "10px",
                                transition: "all 0.3s ease"
                            }}
                            onClick={e => {
                                handleLoad(selectedFilename);
                                setShowLoadWarning(false);
                                setSelectedFilename(null);
                            }}
                            onMouseOver={e => {
                                e.currentTarget.style.background = "#28a745";
                                e.currentTarget.style.color = "white";
                            }}
                            onMouseOut={e => {
                                e.currentTarget.style.background = "rgba(40, 167, 69, 0.1)";
                                e.currentTarget.style.color = "#28a745";
                            }}
                        >
                            <i className="mdi mdi-check mr-1"></i>
                            Load
                        </Button>
                    </Modal.Footer>
                </Modal>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteWarning && (
                <Modal
                    show={showDeleteWarning}
                    onHide={() => setShowDeleteWarning(false)}
                    size="md"
                    centered
                    contentClassName="border-0 shadow"
                    backdrop="static"
                >
                    <Modal.Header
                        style={{
                            background: "linear-gradient(135deg, rgba(220, 53, 69, 0.05) 0%, rgba(220, 53, 69, 0.1) 100%)",
                            borderBottom: "1px solid rgba(220, 53, 69, 0.2)",
                            paddingTop: "16px",
                            paddingBottom: "16px"
                        }}
                    >
                        <div className="d-flex align-items-center">
                            <div style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "8px",
                                backgroundColor: "rgba(220, 53, 69, 0.15)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: "10px"
                            }}>
                                <i className="mdi mdi-alert-circle-outline" style={{ fontSize: "18px", color: "#dc3545" }}></i>
                            </div>
                            <Modal.Title style={{ fontSize: "18px", fontWeight: "600", color: "#dc3545" }}>Delete Backup</Modal.Title>
                        </div>
                    </Modal.Header>
                    <Modal.Body className="px-4 py-4">
                        <p>Are you sure you want to delete: {selectedFilename}</p>
                        <p className="text-danger">This will permanently delete the backup.</p>
                    </Modal.Body>
                    <Modal.Footer style={{ borderTop: "1px solid rgba(220, 53, 69, 0.2)", padding: "16px" }}>
                        <Button
                            style={{
                                background: "rgba(154, 77, 226, 0.15)",
                                color: "rgb(154, 77, 226)",
                                border: "1.5px solid rgba(154, 77, 226, 0.5)",
                                borderRadius: "8px",
                                padding: "8px 20px",
                                fontWeight: "500",
                                fontSize: "1rem",
                                marginRight: "10px",
                                transition: "all 0.3s ease"
                            }}
                            onClick={() => {
                                setSelectedFilename(null);
                                setShowDeleteWarning(false);
                            }}
                            onMouseOver={e => {
                                e.currentTarget.style.background = "rgb(154, 77, 226)";
                                e.currentTarget.style.color = "white";
                                e.currentTarget.style.borderColor = "rgb(154, 77, 226)";
                            }}
                            onMouseOut={e => {
                                e.currentTarget.style.background = "rgba(154, 77, 226, 0.15)";
                                e.currentTarget.style.color = "rgb(154, 77, 226)";
                                e.currentTarget.style.borderColor = "rgba(154, 77, 226, 0.5)";
                            }}
                        >
                            <i className="mdi mdi-close mr-1"></i>
                            Cancel
                        </Button>
                        <Button
                            style={{
                                background: "rgba(220, 53, 69, 0.1)",
                                color: "#dc3545",
                                border: "1.5px solid rgba(220, 53, 69, 0.3)",
                                borderRadius: "8px",
                                padding: "8px 20px",
                                fontWeight: "500",
                                marginLeft: "10px",
                                transition: "all 0.3s ease"
                            }}
                            onClick={e => {
                                handleDelete(selectedFilename);
                                setShowDeleteWarning(false);
                                setSelectedFilename(null);
                            }}
                            onMouseOver={e => {
                                e.currentTarget.style.background = "#dc3545";
                                e.currentTarget.style.color = "white";
                            }}
                            onMouseOut={e => {
                                e.currentTarget.style.background = "rgba(220, 53, 69, 0.1)";
                                e.currentTarget.style.color = "#dc3545";
                            }}
                        >
                            <i className="mdi mdi-delete-outline mr-1"></i>
                            Delete
                        </Button>
                    </Modal.Footer>
                </Modal>
            )}

            {/* Upload Modal */}
            {showUploadModal && (
                <Modal
                    show={showUploadModal}
                    onHide={() => {
                        if (actionLoading !== 'upload') {
                            setShowUploadModal(false);
                            setUploadFile(null);
                            setUploadVersionName('');
                            if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                            }
                        }
                    }}
                    size="md"
                    centered
                    contentClassName="border-0 shadow"
                    backdrop="static"
                >
                    <Modal.Header
                        style={{
                            background: "linear-gradient(135deg, rgba(108, 117, 125, 0.05) 0%, rgba(108, 117, 125, 0.1) 100%)",
                            borderBottom: "1px solid rgba(108, 117, 125, 0.2)",
                            paddingTop: "16px",
                            paddingBottom: "16px"
                        }}
                    >
                        <div className="d-flex align-items-center">
                            <div style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "8px",
                                backgroundColor: "rgba(108, 117, 125, 0.15)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: "10px"
                            }}>
                                <Icon path={mdiUpload} size={0.8} color="rgb(108, 117, 125)" />
                            </div>
                            <Modal.Title style={{ fontSize: "18px", fontWeight: "600", color: "rgb(108, 117, 125)" }}>Upload Backup File</Modal.Title>
                        </div>
                    </Modal.Header>
                    <Modal.Body className="px-4 py-4">
                        <div className="mb-3">
                            <label htmlFor="fileInput" className="form-label">Select Backup File (.dump)</label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="form-control"
                                id="fileInput"
                                accept=".dump"
                                onChange={handleFileSelect}
                                disabled={actionLoading === 'upload'}
                                style={{
                                    borderRadius: "8px",
                                    border: "1.5px solid rgba(108, 117, 125, 0.3)",
                                    padding: "8px 12px",
                                    transition: "all 0.3s ease"
                                }}
                            />
                            {uploadFile && (
                                <small className="text-muted">Selected: {uploadFile.name}</small>
                            )}
                        </div>
                        <div className="mb-3">
                            <label htmlFor="versionNameInput" className="form-label">Version Name</label>
                            <input
                                type="text"
                                className="form-control"
                                id="versionNameInput"
                                placeholder="e.g., imported-backup-1"
                                value={uploadVersionName}
                                onChange={(e) => setUploadVersionName(e.target.value)}
                                disabled={actionLoading === 'upload'}
                                style={{
                                    borderRadius: "8px",
                                    border: "1.5px solid rgba(108, 117, 125, 0.3)",
                                    padding: "8px 12px",
                                    transition: "all 0.3s ease"
                                }}
                            />
                            <small className="text-muted">This will be the name shown in your backup list.</small>
                        </div>
                    </Modal.Body>
                    <Modal.Footer style={{ borderTop: "1px solid rgba(108, 117, 125, 0.2)", padding: "16px" }}>
                        <Button
                            style={{
                                background: "rgba(154, 77, 226, 0.15)",
                                color: "rgb(154, 77, 226)",
                                border: "1.5px solid rgba(154, 77, 226, 0.5)",
                                borderRadius: "8px",
                                padding: "8px 20px",
                                fontWeight: "500",
                                fontSize: "1rem",
                                marginRight: "10px",
                                transition: "all 0.3s ease"
                            }}
                            onClick={() => {
                                setShowUploadModal(false);
                                setUploadFile(null);
                                setUploadVersionName('');
                                if (fileInputRef.current) {
                                    fileInputRef.current.value = '';
                                }
                            }}
                            disabled={actionLoading === 'upload'}
                            onMouseOver={e => {
                                e.currentTarget.style.background = "rgb(154, 77, 226)";
                                e.currentTarget.style.color = "white";
                                e.currentTarget.style.borderColor = "rgb(154, 77, 226)";
                            }}
                            onMouseOut={e => {
                                e.currentTarget.style.background = "rgba(154, 77, 226, 0.15)";
                                e.currentTarget.style.color = "rgb(154, 77, 226)";
                                e.currentTarget.style.borderColor = "rgba(154, 77, 226, 0.5)";
                            }}
                        >
                            <i className="mdi mdi-close mr-1"></i>
                            Cancel
                        </Button>
                        <Button
                            style={{
                                background: "rgba(108, 117, 125, 0.1)",
                                color: "rgb(108, 117, 125)",
                                border: "1.5px solid rgba(108, 117, 125, 0.3)",
                                borderRadius: "8px",
                                padding: "8px 20px",
                                fontWeight: "500",
                                marginLeft: "10px",
                                transition: "all 0.3s ease"
                            }}
                            onClick={handleUpload}
                            disabled={!uploadFile || !uploadVersionName.trim() || actionLoading === 'upload'}
                            onMouseOver={e => {
                                if (!e.currentTarget.disabled) {
                                    e.currentTarget.style.background = "rgb(108, 117, 125)";
                                    e.currentTarget.style.color = "white";
                                }
                            }}
                            onMouseOut={e => {
                                if (!e.currentTarget.disabled) {
                                    e.currentTarget.style.background = "rgba(108, 117, 125, 0.1)";
                                    e.currentTarget.style.color = "rgb(108, 117, 125)";
                                }
                            }}
                        >
                            <Icon path={mdiUpload} size={0.6} style={{ marginRight: "6px" }} />
                            {actionLoading === 'upload' ? <Spinner /> : 'Upload'}
                        </Button>
                    </Modal.Footer>
                </Modal>
            )}
        </div >
    );
};

export default Backup;
