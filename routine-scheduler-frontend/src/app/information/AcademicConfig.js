import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Form, Row, Col, FormGroup, FormControl } from "react-bootstrap";
import { toast } from "react-hot-toast";

import {
  getBatches,
  addBatch,
  deleteBatch,
  getAllSectionCount,
  setSectionCount,
  deleteSectionCount,
  getDefaultAllSectionCount,
  setDefaultSectionCount,
  deleteDefaultSectionCount,
  getHostedDepartments,
  addHostedDepartment,
  deleteHostedDepartment,
} from "../api/academic-config";
import { getConfiguration, setConfiguration } from "../api/config";
import { useConfig } from "../shared/ConfigContext";
import ConfirmationModal from "../shared/ConfirmationModal";

const DANGER = { icon: "mdi-delete", red: 220, green: 53, blue: 69 };

const emptyDepartment = {
  department: "",
  section_count: 1,
  subsection_count_per_section: 1,
};

const emptySectionCount = {
  batch: "",
  department: "",
  section_count: 1,
  subsection_count_per_section: 1,
};

/** Section labels follow the A, B, C… convention used across the scheduler. */
const sectionLabels = (count) =>
  Array.from({ length: Math.max(0, count) }, (_, i) =>
    String.fromCharCode(65 + i)
  );

const validateCounts = ({ section_count, subsection_count_per_section }) => {
  if (!Number.isInteger(section_count) || section_count < 1) {
    return "Section count must be a whole number of at least 1";
  }
  if (section_count > 26) {
    return "Section count cannot exceed 26 (sections are labelled A-Z)";
  }
  if (
    !Number.isInteger(subsection_count_per_section) ||
    subsection_count_per_section < 1
  ) {
    return "Subsection count must be a whole number of at least 1";
  }
  if (subsection_count_per_section > 10) {
    return "Subsection count per section cannot exceed 10";
  }
  return null;
};

export default function AcademicConfig() {
  const { refreshConfigs } = useConfig();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [batches, setBatches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sectionCounts, setSectionCounts] = useState([]);
  const [hostedDepartments, setHostedDepartments] = useState([]);

  const [levelCount, setLevelCount] = useState(4);
  const [termCount, setTermCount] = useState(2);
  const [savedLevelTerm, setSavedLevelTerm] = useState({ level: 4, term: 2 });

  // Filters for the per-batch section count table
  const [batchFilter, setBatchFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  // Modals
  const [batchModal, setBatchModal] = useState(null); // { batch }
  const [departmentModal, setDepartmentModal] = useState(null); // { ...dept, originalDept }
  const [sectionCountModal, setSectionCountModal] = useState(null); // { ...row, isNew }
  const [hostedModal, setHostedModal] = useState(null); // { department }

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationDetails, setConfirmationDetails] = useState({
    title: "",
    body: "",
    confirmText: "Delete",
    cancelText: "Cancel",
    onConfirm: () => {},
    confirmIcon: DANGER.icon,
    red: DANGER.red,
    green: DANGER.green,
    blue: DANGER.blue,
  });

  const confirm = (title, body, onConfirm, confirmText = "Delete") => {
    setConfirmationDetails({
      title,
      body,
      confirmText,
      cancelText: "Cancel",
      onConfirm,
      confirmIcon: DANGER.icon,
      red: DANGER.red,
      green: DANGER.green,
      blue: DANGER.blue,
    });
    setShowConfirmation(true);
  };

  /* ----------------------------------------------------------------- data */

  const loadBatches = useCallback(async () => {
    const data = await getBatches();
    setBatches(Array.isArray(data) ? data : []);
  }, []);

  const loadDepartments = useCallback(async () => {
    const data = await getDefaultAllSectionCount();
    setDepartments(Array.isArray(data) ? data : []);
  }, []);

  const loadSectionCounts = useCallback(async () => {
    const data = await getAllSectionCount();
    setSectionCounts(Array.isArray(data) ? data : []);
  }, []);

  const loadHostedDepartments = useCallback(async () => {
    const data = await getHostedDepartments();
    setHostedDepartments(Array.isArray(data) ? data : []);
  }, []);

  const loadLevelTermConfig = useCallback(async () => {
    const [level, term] = await Promise.all([
      getConfiguration("LEVEL_COUNT"),
      getConfiguration("TERM_COUNT"),
    ]);
    const parsedLevel = parseInt(level, 10);
    const parsedTerm = parseInt(term, 10);
    if (!Number.isNaN(parsedLevel)) setLevelCount(parsedLevel);
    if (!Number.isNaN(parsedTerm)) setTermCount(parsedTerm);
    setSavedLevelTerm({
      level: Number.isNaN(parsedLevel) ? 4 : parsedLevel,
      term: Number.isNaN(parsedTerm) ? 2 : parsedTerm,
    });
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadBatches(),
        loadDepartments(),
        loadSectionCounts(),
        loadHostedDepartments(),
        loadLevelTermConfig(),
      ]);
    } catch (err) {
      console.error("Error loading academic configuration:", err);
      toast.error("Failed to load academic configuration");
    } finally {
      setLoading(false);
    }
  }, [
    loadBatches,
    loadDepartments,
    loadSectionCounts,
    loadHostedDepartments,
    loadLevelTermConfig,
  ]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* ------------------------------------------------------------- derived */

  const filteredSectionCounts = useMemo(
    () =>
      sectionCounts.filter(
        (row) =>
          (batchFilter === "" || String(row.batch) === String(batchFilter)) &&
          (departmentFilter === "" || row.department === departmentFilter)
      ),
    [sectionCounts, batchFilter, departmentFilter]
  );

  const totalSections = useMemo(
    () => sectionCounts.reduce((sum, row) => sum + (row.section_count || 0), 0),
    [sectionCounts]
  );

  const departmentNames = useMemo(
    () => departments.map((d) => d.department),
    [departments]
  );

  const levelTermCount = levelCount * termCount;

  const levelTermDirty =
    levelCount !== savedLevelTerm.level || termCount !== savedLevelTerm.term;

  /* ------------------------------------------------------------- actions */

  const saveLevelTermConfig = async () => {
    if (levelCount < 1 || termCount < 1) {
      toast.error("Level and term counts must be at least 1");
      return;
    }
    setSaving(true);
    try {
      const [level, term] = await Promise.all([
        setConfiguration("LEVEL_COUNT", levelCount.toString()),
        setConfiguration("TERM_COUNT", termCount.toString()),
      ]);
      if (!level.success || !term.success) {
        throw new Error("Failed to save level or term configuration");
      }
      setSavedLevelTerm({ level: levelCount, term: termCount });
      refreshConfigs();
      toast.success("Level-Term configuration saved");
    } catch (err) {
      console.error("Error saving level-term configuration:", err);
      toast.error("Failed to save level-term configuration");
    } finally {
      setSaving(false);
    }
  };

  const submitBatch = async () => {
    const batch = (batchModal.batch || "").trim();
    if (batch === "") {
      toast.error("Batch cannot be empty");
      return;
    }
    if (!/^\d+$/.test(batch)) {
      toast.error("Batch must be a number, e.g. 25");
      return;
    }
    if (batches.some((b) => String(b) === batch)) {
      toast.error(`Batch ${batch} already exists`);
      return;
    }
    if (departments.length === 0) {
      toast.error("Add at least one department before creating a batch");
      return;
    }
    setSaving(true);
    try {
      await addBatch({ batch });
      toast.success(
        `Batch ${batch} created with the default section counts of every department`
      );
      setBatchModal(null);
      await Promise.all([loadBatches(), loadSectionCounts()]);
    } catch (err) {
      console.error("Error adding batch:", err);
      toast.error("Failed to add batch");
    } finally {
      setSaving(false);
    }
  };

  const removeBatch = (batch) =>
    confirm(
      "Delete Batch",
      `Delete batch ${batch}? Every section count configured for this batch will be removed.`,
      async () => {
        try {
          await deleteBatch({ batch });
          toast.success(`Batch ${batch} deleted`);
          await Promise.all([loadBatches(), loadSectionCounts()]);
        } catch (err) {
          console.error("Error deleting batch:", err);
          toast.error(`Failed to delete batch ${batch}`);
        }
      }
    );

  const submitDepartment = async () => {
    const department = (departmentModal.department || "").trim().toUpperCase();
    if (department === "") {
      toast.error("Department code cannot be empty");
      return;
    }
    const countError = validateCounts(departmentModal);
    if (countError) {
      toast.error(countError);
      return;
    }
    const isNew = !departmentModal.originalDept;
    if (
      isNew &&
      departments.some((d) => d.department.toUpperCase() === department)
    ) {
      toast.error(`Department ${department} already exists`);
      return;
    }
    setSaving(true);
    try {
      await setDefaultSectionCount({
        department,
        section_count: departmentModal.section_count,
        subsection_count_per_section:
          departmentModal.subsection_count_per_section,
      });
      toast.success(`Department ${department} ${isNew ? "added" : "updated"}`);
      setDepartmentModal(null);
      await Promise.all([loadDepartments(), loadSectionCounts()]);
    } catch (err) {
      console.error("Error saving department:", err);
      toast.error(`Failed to ${isNew ? "add" : "update"} department`);
    } finally {
      setSaving(false);
    }
  };

  const removeDepartment = (department) =>
    confirm(
      "Delete Department",
      `Delete department ${department}? Its per-batch section counts will be removed as well.`,
      async () => {
        try {
          await deleteDefaultSectionCount({ department });
          toast.success(`Department ${department} deleted`);
          await Promise.all([loadDepartments(), loadSectionCounts()]);
        } catch (err) {
          console.error("Error deleting department:", err);
          toast.error(`Failed to delete department ${department}`);
        }
      }
    );

  const submitSectionCount = async () => {
    const { batch, department, isNew } = sectionCountModal;
    if (!batch || !department) {
      toast.error("Batch and department are required");
      return;
    }
    const countError = validateCounts(sectionCountModal);
    if (countError) {
      toast.error(countError);
      return;
    }
    if (
      isNew &&
      sectionCounts.some(
        (row) =>
          String(row.batch) === String(batch) && row.department === department
      )
    ) {
      toast.error(
        `Batch ${batch} already has a configuration for ${department} — edit it instead`
      );
      return;
    }
    setSaving(true);
    try {
      await setSectionCount({
        batch,
        department,
        section_count: sectionCountModal.section_count,
        subsection_count_per_section:
          sectionCountModal.subsection_count_per_section,
      });
      toast.success(`Section count for ${department} ${batch} saved`);
      setSectionCountModal(null);
      await Promise.all([loadSectionCounts(), loadBatches()]);
    } catch (err) {
      console.error("Error saving section count:", err);
      toast.error("Failed to save section count");
    } finally {
      setSaving(false);
    }
  };

  const removeSectionCount = (row) =>
    confirm(
      "Delete Section Count",
      `Remove the section configuration for ${row.department} batch ${row.batch}?`,
      async () => {
        try {
          await deleteSectionCount({
            batch: row.batch,
            department: row.department,
          });
          toast.success("Section count removed");
          await Promise.all([loadSectionCounts(), loadBatches()]);
        } catch (err) {
          console.error("Error deleting section count:", err);
          toast.error("Failed to remove section count");
        }
      }
    );

  const submitHostedDepartment = async () => {
    const department = (hostedModal.department || "").trim().toUpperCase();
    if (department === "") {
      toast.error("Department code cannot be empty");
      return;
    }
    if (hostedDepartments.some((d) => d.toUpperCase() === department)) {
      toast.error(`${department} is already an offering department`);
      return;
    }
    setSaving(true);
    try {
      await addHostedDepartment({ department });
      toast.success(`${department} added as an offering department`);
      setHostedModal(null);
      await loadHostedDepartments();
    } catch (err) {
      console.error("Error adding offering department:", err);
      toast.error("Failed to add offering department");
    } finally {
      setSaving(false);
    }
  };

  const removeHostedDepartment = (department) =>
    confirm(
      "Delete Offering Department",
      `Remove ${department} from the list of departments that can offer courses?`,
      async () => {
        try {
          await deleteHostedDepartment({ department });
          toast.success(`${department} removed`);
          await loadHostedDepartments();
        } catch (err) {
          console.error("Error deleting offering department:", err);
          toast.error(`Failed to remove ${department}`);
        }
      }
    );

  /* -------------------------------------------------------------- render */

  return (
    <div>
      <div className="page-header">
        <h3 className="page-title">
          <div className="page-title-icon-container mdi mdi-tune-variant"></div>
          Academic Configuration
        </h3>
        <nav aria-label="breadcrumb">
          <ol
            className="breadcrumb"
            style={{ marginBottom: 0, background: "transparent" }}
          >
            <li
              className="breadcrumb-item"
              style={{ color: "rgba(255,255,255,0.8)" }}
            >
              <a
                href="!#"
                onClick={(event) => event.preventDefault()}
                style={{
                  color: "rgba(255,255,255,0.8)",
                  textDecoration: "none",
                }}
              >
                Information
              </a>
            </li>
            <li
              className="breadcrumb-item active"
              aria-current="page"
              style={{ color: "rgba(255,255,255,0.9)", fontWeight: 500 }}
            >
              Academic Configuration
            </li>
          </ol>
        </nav>
      </div>

      {/* ---------------------------------------------------- summary tiles */}
      <div className="stat-tile-grid">
        <div className="stat-tile">
          <div className="stat-tile-icon mdi mdi-account-group"></div>
          <div>
            <div className="stat-tile-value">{batches.length}</div>
            <div className="stat-tile-label">Batches</div>
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-icon blue mdi mdi-domain"></div>
          <div>
            <div className="stat-tile-value">{departments.length}</div>
            <div className="stat-tile-label">Departments</div>
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-icon teal mdi mdi-view-grid-outline"></div>
          <div>
            <div className="stat-tile-value">{totalSections}</div>
            <div className="stat-tile-label">Total Sections</div>
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-icon amber mdi mdi-school"></div>
          <div>
            <div className="stat-tile-value">{levelTermCount}</div>
            <div className="stat-tile-label">Level-Terms</div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------ level-term config */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-view">
              <div className="card-control-container">
                <h4 className="card-name">
                  <div className="card-icon mdi mdi-school"></div>
                  Level-Term Structure
                </h4>
                <div className="card-control-button-container">
                  <button
                    className="card-control-button mdi mdi-content-save"
                    onClick={saveLevelTermConfig}
                    disabled={saving || !levelTermDirty}
                    style={levelTermDirty ? undefined : { opacity: 0.55 }}
                  >
                    {levelTermDirty ? "Save Changes" : "Saved"}
                  </button>
                </div>
              </div>

              <Row className="mt-4">
                <Col md={5} className="px-4">
                  <FormGroup className="mb-3">
                    <Form.Label className="form-label">
                      Number of Levels
                    </Form.Label>
                    <FormControl
                      type="number"
                      min="1"
                      max="10"
                      className="form-control"
                      value={levelCount}
                      onChange={(e) =>
                        setLevelCount(parseInt(e.target.value, 10) || 1)
                      }
                    />
                    <div className="field-hint">
                      Total levels in the programme — 4 for a typical
                      undergraduate degree.
                    </div>
                  </FormGroup>
                  <FormGroup>
                    <Form.Label className="form-label">
                      Terms per Level
                    </Form.Label>
                    <FormControl
                      type="number"
                      min="1"
                      max="4"
                      className="form-control"
                      value={termCount}
                      onChange={(e) =>
                        setTermCount(parseInt(e.target.value, 10) || 1)
                      }
                    />
                    <div className="field-hint">
                      Terms inside each level — 2 for a semester system.
                    </div>
                  </FormGroup>
                </Col>
                <Col md={7} className="px-4">
                  <Form.Label className="form-label">
                    Generated Level-Terms ({levelTermCount})
                  </Form.Label>
                  <div
                    style={{
                      background: "rgba(194, 137, 248, 0.05)",
                      border: "1px solid rgba(194, 137, 248, 0.2)",
                      borderRadius: "12px",
                      padding: "1rem",
                    }}
                  >
                    {Array.from({ length: levelCount }, (_, level) => (
                      <div key={level} className="mb-3">
                        <div
                          style={{
                            fontWeight: 600,
                            color: "rgb(154, 77, 226)",
                            marginBottom: "8px",
                          }}
                        >
                          Level {level + 1}
                        </div>
                        <div className="chip-row">
                          {Array.from({ length: termCount }, (_, term) => (
                            <span key={term} className="pill purple">
                              L-{level + 1} T-{term + 1}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {levelTermDirty && (
                    <div className="field-hint mt-2">
                      These level-terms are not saved yet — press Save Changes
                      to apply them across the system.
                    </div>
                  )}
                </Col>
              </Row>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------ batches */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-view">
              <div className="card-control-container">
                <h4 className="card-name">
                  <div className="card-icon mdi mdi-account-group"></div>
                  Batches
                </h4>
                <div className="card-control-button-container">
                  <button
                    className="card-control-button mdi mdi-plus-circle"
                    onClick={() => setBatchModal({ batch: "" })}
                  >
                    Add Batch
                  </button>
                </div>
              </div>
              <div className="card-section-note">
                Adding a batch copies every department's default section count
                into it. You can override any of those numbers below.
              </div>
              <div className="mt-3">
                {loading ? (
                  <div className="empty-state">
                    <i className="mdi mdi-loading mdi-spin"></i>
                    <div className="empty-state-title">Loading batches…</div>
                  </div>
                ) : batches.length === 0 ? (
                  <div className="empty-state">
                    <i className="mdi mdi-account-group-outline"></i>
                    <div className="empty-state-title">No batches yet</div>
                    <div className="empty-state-hint">
                      Add a batch to start configuring its sections.
                    </div>
                  </div>
                ) : (
                  <div className="chip-row">
                    {batches.map((batch) => (
                      <span key={batch} className="entity-chip">
                        Batch {batch}
                        <button
                          className="chip-remove mdi mdi-close"
                          title={`Delete batch ${batch}`}
                          onClick={() => removeBatch(batch)}
                        ></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------- department defaults */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-view">
              <div className="card-control-container">
                <h4 className="card-name">
                  <div className="card-icon mdi mdi-domain"></div>
                  Departments &amp; Default Section Counts
                </h4>
                <div className="card-control-button-container">
                  <button
                    className="card-control-button mdi mdi-plus-circle"
                    onClick={() =>
                      setDepartmentModal({ ...emptyDepartment, originalDept: null })
                    }
                  >
                    Add Department
                  </button>
                </div>
              </div>
              <div className="card-section-note">
                These values seed every new batch. Changing them does not
                rewrite batches that already exist.
              </div>
              <div className="card-table-container table-responsive mt-3">
                <table className="card-table table">
                  <thead className="card-table-header">
                    <tr>
                      <th className="sticky-col">
                        <i className="mdi mdi-domain"></i>
                        Department
                      </th>
                      <th>
                        <i className="mdi mdi-view-grid-outline"></i>
                        Sections
                      </th>
                      <th>
                        <i className="mdi mdi-view-split-vertical"></i>
                        Subsections / Section
                      </th>
                      <th>
                        <i className="mdi mdi-label-outline"></i>
                        Section Labels
                      </th>
                      <th>
                        <i className="mdi mdi-cog"></i>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="card-table-body">
                    {departments.length === 0 ? (
                      <tr>
                        <td colSpan={5}>
                          <div className="empty-state">
                            <i className="mdi mdi-domain"></i>
                            <div className="empty-state-title">
                              No departments configured
                            </div>
                            <div className="empty-state-hint">
                              Add a department to define its default section
                              layout.
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      departments.map((dept) => (
                        <tr key={dept.department}>
                          <td
                            className="sticky-col"
                            style={{ textAlign: "center", fontWeight: 600 }}
                          >
                            {dept.department}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {dept.section_count}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {dept.subsection_count_per_section}
                          </td>
                          <td>
                            <div className="chip-row">
                              {sectionLabels(dept.section_count).map((label) => (
                                <span key={label} className="pill muted">
                                  {label}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <div className="d-flex">
                              <button
                                className="edit mdi mdi-pencil"
                                title="Edit department"
                                onClick={() =>
                                  setDepartmentModal({
                                    department: dept.department,
                                    section_count: dept.section_count,
                                    subsection_count_per_section:
                                      dept.subsection_count_per_section,
                                    originalDept: dept.department,
                                  })
                                }
                              ></button>
                              <button
                                className="delete mdi mdi-delete-outline"
                                title="Delete department"
                                onClick={() =>
                                  removeDepartment(dept.department)
                                }
                              ></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------ per-batch section counts */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-view">
              <div className="card-control-container">
                <h4 className="card-name">
                  <div className="card-icon mdi mdi-view-grid-plus"></div>
                  Section Counts per Batch
                </h4>
                <div className="card-control-button-container">
                  <button
                    className="card-control-button mdi mdi-plus-circle"
                    onClick={() =>
                      setSectionCountModal({
                        ...emptySectionCount,
                        batch: batchFilter || batches[0] || "",
                        department: departmentFilter || departmentNames[0] || "",
                        isNew: true,
                      })
                    }
                    disabled={batches.length === 0 || departments.length === 0}
                  >
                    Add / Override
                  </button>
                </div>
              </div>

              <div className="card-toolbar">
                <div className="card-toolbar-field">
                  <label className="card-toolbar-label">Batch</label>
                  <Form.Select
                    className="form-select"
                    value={batchFilter}
                    onChange={(e) => setBatchFilter(e.target.value)}
                  >
                    <option value="">All batches</option>
                    {batches.map((batch) => (
                      <option key={batch} value={batch}>
                        Batch {batch}
                      </option>
                    ))}
                  </Form.Select>
                </div>
                <div className="card-toolbar-field">
                  <label className="card-toolbar-label">Department</label>
                  <Form.Select
                    className="form-select"
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                  >
                    <option value="">All departments</option>
                    {departmentNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Form.Select>
                </div>
                {(batchFilter || departmentFilter) && (
                  <div className="card-toolbar-field">
                    <label className="card-toolbar-label">&nbsp;</label>
                    <button
                      className="card-control-button mdi mdi-filter-remove-outline"
                      onClick={() => {
                        setBatchFilter("");
                        setDepartmentFilter("");
                      }}
                    >
                      Clear
                    </button>
                  </div>
                )}
                <div className="card-toolbar-result">
                  {filteredSectionCounts.length} of {sectionCounts.length}{" "}
                  configurations
                </div>
              </div>

              <div className="card-table-container table-responsive mt-3">
                <table className="card-table table">
                  <thead className="card-table-header">
                    <tr>
                      <th className="sticky-col">
                        <i className="mdi mdi-account-group"></i>
                        Batch
                      </th>
                      <th>
                        <i className="mdi mdi-domain"></i>
                        Department
                      </th>
                      <th>
                        <i className="mdi mdi-view-grid-outline"></i>
                        Sections
                      </th>
                      <th>
                        <i className="mdi mdi-view-split-vertical"></i>
                        Subsections / Section
                      </th>
                      <th>
                        <i className="mdi mdi-sigma"></i>
                        Total Subsections
                      </th>
                      <th>
                        <i className="mdi mdi-label-outline"></i>
                        Section Labels
                      </th>
                      <th>
                        <i className="mdi mdi-cog"></i>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="card-table-body">
                    {filteredSectionCounts.length === 0 ? (
                      <tr>
                        <td colSpan={7}>
                          <div className="empty-state">
                            <i className="mdi mdi-view-grid-outline"></i>
                            <div className="empty-state-title">
                              {sectionCounts.length === 0
                                ? "No section counts configured"
                                : "No configurations match these filters"}
                            </div>
                            <div className="empty-state-hint">
                              {sectionCounts.length === 0
                                ? "Add a batch to generate section counts from the department defaults."
                                : "Try clearing the batch or department filter."}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredSectionCounts.map((row) => (
                        <tr key={`${row.batch}-${row.department}`}>
                          <td
                            className="sticky-col"
                            style={{ textAlign: "center", fontWeight: 600 }}
                          >
                            {row.batch}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {row.department}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {row.section_count}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {row.subsection_count_per_section}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span className="pill purple">
                              {row.section_count *
                                row.subsection_count_per_section}
                            </span>
                          </td>
                          <td>
                            <div className="chip-row">
                              {sectionLabels(row.section_count).map((label) => (
                                <span key={label} className="pill muted">
                                  {label}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <div className="d-flex">
                              <button
                                className="edit mdi mdi-pencil"
                                title="Edit section count"
                                onClick={() =>
                                  setSectionCountModal({
                                    batch: row.batch,
                                    department: row.department,
                                    section_count: row.section_count,
                                    subsection_count_per_section:
                                      row.subsection_count_per_section,
                                    isNew: false,
                                  })
                                }
                              ></button>
                              <button
                                className="delete mdi mdi-delete-outline"
                                title="Delete section count"
                                onClick={() => removeSectionCount(row)}
                              ></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------- offering departments */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-view">
              <div className="card-control-container">
                <h4 className="card-name">
                  <div className="card-icon mdi mdi-office-building"></div>
                  Offering Departments
                </h4>
                <div className="card-control-button-container">
                  <button
                    className="card-control-button mdi mdi-plus-circle"
                    onClick={() => setHostedModal({ department: "" })}
                  >
                    Add Department
                  </button>
                </div>
              </div>
              <div className="card-section-note">
                Departments that can offer courses — these populate the
                "Offering From" list on the course form.
              </div>
              <div className="mt-3">
                {hostedDepartments.length === 0 ? (
                  <div className="empty-state">
                    <i className="mdi mdi-office-building-outline"></i>
                    <div className="empty-state-title">
                      No offering departments
                    </div>
                    <div className="empty-state-hint">
                      Add the departments that host courses for your programme.
                    </div>
                  </div>
                ) : (
                  <div className="chip-row">
                    {hostedDepartments.map((department) => (
                      <span key={department} className="entity-chip">
                        {department}
                        <button
                          className="chip-remove mdi mdi-close"
                          title={`Remove ${department}`}
                          onClick={() => removeHostedDepartment(department)}
                        ></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------- batch modal */}
      {batchModal !== null && (
        <Modal
          show
          onHide={() => setBatchModal(null)}
          size="md"
          centered
          contentClassName="modal-content"
          backdrop="static"
        >
          <Modal.Header className="modal-header">
            <Modal.Title className="modal-header-content">
              <div className="modal-header-icon">
                <i className="mdi mdi-account-group"></i>
              </div>
              <h4 className="modal-title">Add Batch</h4>
            </Modal.Title>
            <button
              className="modal-header-close-button mdi mdi-close"
              onClick={() => setBatchModal(null)}
            ></button>
          </Modal.Header>
          <Modal.Body className="modal-body">
            <div className="modal-body-content-container">
              <Form className="px-2 py-1">
                <FormGroup>
                  <Form.Label className="form-label">Batch</Form.Label>
                  <FormControl
                    type="text"
                    className="form-control"
                    placeholder="e.g. 25"
                    value={batchModal.batch}
                    autoFocus
                    onChange={(e) =>
                      setBatchModal({ batch: e.target.value })
                    }
                  />
                  <div className="field-hint">
                    The batch will be created with the default section count of
                    each of the {departments.length} configured departments.
                  </div>
                </FormGroup>
              </Form>
            </div>
            <div className="modal-divider"></div>
          </Modal.Body>
          <Modal.Footer className="modal-footer">
            <button
              className="card-control-button mdi mdi-close"
              onClick={() => setBatchModal(null)}
            >
              Cancel
            </button>
            <button
              className="card-control-button mdi mdi-content-save"
              onClick={submitBatch}
              disabled={saving}
            >
              Create Batch
            </button>
          </Modal.Footer>
        </Modal>
      )}

      {/* -------------------------------------------------- department modal */}
      {departmentModal !== null && (
        <Modal
          show
          onHide={() => setDepartmentModal(null)}
          size="md"
          centered
          contentClassName="modal-content"
          backdrop="static"
        >
          <Modal.Header className="modal-header">
            <Modal.Title className="modal-header-content">
              <div className="modal-header-icon">
                <i className="mdi mdi-domain"></i>
              </div>
              <h4 className="modal-title">
                {departmentModal.originalDept ? "Edit" : "Add"} Department
              </h4>
            </Modal.Title>
            <button
              className="modal-header-close-button mdi mdi-close"
              onClick={() => setDepartmentModal(null)}
            ></button>
          </Modal.Header>
          <Modal.Body className="modal-body">
            <div className="modal-body-content-container">
              <Form className="px-2 py-1">
                <Row>
                  <Col className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">
                        Department Code
                      </Form.Label>
                      <FormControl
                        type="text"
                        className="form-control"
                        placeholder="e.g. CSE"
                        value={departmentModal.department}
                        autoFocus={!departmentModal.originalDept}
                        disabled={!!departmentModal.originalDept}
                        onChange={(e) =>
                          setDepartmentModal({
                            ...departmentModal,
                            department: e.target.value.toUpperCase(),
                          })
                        }
                      />
                      {departmentModal.originalDept && (
                        <div className="field-hint">
                          The department code cannot be changed — the per-batch
                          section counts are keyed to it. Delete and re-add the
                          department to rename it.
                        </div>
                      )}
                    </FormGroup>
                  </Col>
                </Row>
                <Row>
                  <Col md={6} className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">
                        Section Count
                      </Form.Label>
                      <FormControl
                        type="number"
                        min="1"
                        max="26"
                        className="form-control"
                        value={departmentModal.section_count}
                        onChange={(e) =>
                          setDepartmentModal({
                            ...departmentModal,
                            section_count: parseInt(e.target.value, 10) || 0,
                          })
                        }
                      />
                    </FormGroup>
                  </Col>
                  <Col md={6} className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">
                        Subsections per Section
                      </Form.Label>
                      <FormControl
                        type="number"
                        min="1"
                        max="10"
                        className="form-control"
                        value={departmentModal.subsection_count_per_section}
                        onChange={(e) =>
                          setDepartmentModal({
                            ...departmentModal,
                            subsection_count_per_section:
                              parseInt(e.target.value, 10) || 0,
                          })
                        }
                      />
                    </FormGroup>
                  </Col>
                </Row>
                <div className="chip-row mt-2">
                  {sectionLabels(departmentModal.section_count).map((label) => (
                    <span key={label} className="pill purple">
                      {label}
                      {departmentModal.subsection_count_per_section > 1 &&
                        ` (${departmentModal.subsection_count_per_section})`}
                    </span>
                  ))}
                </div>
              </Form>
            </div>
            <div className="modal-divider"></div>
          </Modal.Body>
          <Modal.Footer className="modal-footer">
            <button
              className="card-control-button mdi mdi-close"
              onClick={() => setDepartmentModal(null)}
            >
              Cancel
            </button>
            <button
              className="card-control-button mdi mdi-content-save"
              onClick={submitDepartment}
              disabled={saving}
            >
              Save
            </button>
          </Modal.Footer>
        </Modal>
      )}

      {/* ------------------------------------------------ section count modal */}
      {sectionCountModal !== null && (
        <Modal
          show
          onHide={() => setSectionCountModal(null)}
          size="md"
          centered
          contentClassName="modal-content"
          backdrop="static"
        >
          <Modal.Header className="modal-header">
            <Modal.Title className="modal-header-content">
              <div className="modal-header-icon">
                <i className="mdi mdi-view-grid-plus"></i>
              </div>
              <h4 className="modal-title">
                {sectionCountModal.isNew ? "Add" : "Edit"} Section Count
              </h4>
            </Modal.Title>
            <button
              className="modal-header-close-button mdi mdi-close"
              onClick={() => setSectionCountModal(null)}
            ></button>
          </Modal.Header>
          <Modal.Body className="modal-body">
            <div className="modal-body-content-container">
              <Form className="px-2 py-1">
                <Row>
                  <Col md={6} className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">Batch</Form.Label>
                      <Form.Select
                        className="form-select"
                        value={sectionCountModal.batch}
                        disabled={!sectionCountModal.isNew}
                        onChange={(e) =>
                          setSectionCountModal({
                            ...sectionCountModal,
                            batch: e.target.value,
                          })
                        }
                      >
                        <option value="">Select batch</option>
                        {batches.map((batch) => (
                          <option key={batch} value={batch}>
                            Batch {batch}
                          </option>
                        ))}
                      </Form.Select>
                    </FormGroup>
                  </Col>
                  <Col md={6} className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">Department</Form.Label>
                      <Form.Select
                        className="form-select"
                        value={sectionCountModal.department}
                        disabled={!sectionCountModal.isNew}
                        onChange={(e) =>
                          setSectionCountModal({
                            ...sectionCountModal,
                            department: e.target.value,
                          })
                        }
                      >
                        <option value="">Select department</option>
                        {departmentNames.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </Form.Select>
                    </FormGroup>
                  </Col>
                </Row>
                <Row>
                  <Col md={6} className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">
                        Section Count
                      </Form.Label>
                      <FormControl
                        type="number"
                        min="1"
                        max="26"
                        className="form-control"
                        value={sectionCountModal.section_count}
                        onChange={(e) =>
                          setSectionCountModal({
                            ...sectionCountModal,
                            section_count: parseInt(e.target.value, 10) || 0,
                          })
                        }
                      />
                    </FormGroup>
                  </Col>
                  <Col md={6} className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">
                        Subsections per Section
                      </Form.Label>
                      <FormControl
                        type="number"
                        min="1"
                        max="10"
                        className="form-control"
                        value={
                          sectionCountModal.subsection_count_per_section
                        }
                        onChange={(e) =>
                          setSectionCountModal({
                            ...sectionCountModal,
                            subsection_count_per_section:
                              parseInt(e.target.value, 10) || 0,
                          })
                        }
                      />
                    </FormGroup>
                  </Col>
                </Row>
                <div className="chip-row mt-2">
                  {sectionLabels(sectionCountModal.section_count).map(
                    (label) => (
                      <span key={label} className="pill purple">
                        {label}
                        {sectionCountModal.subsection_count_per_section > 1 &&
                          ` (${sectionCountModal.subsection_count_per_section})`}
                      </span>
                    )
                  )}
                </div>
                <div className="field-hint mt-2">
                  This overrides the department default for this batch only.
                </div>
              </Form>
            </div>
            <div className="modal-divider"></div>
          </Modal.Body>
          <Modal.Footer className="modal-footer">
            <button
              className="card-control-button mdi mdi-close"
              onClick={() => setSectionCountModal(null)}
            >
              Cancel
            </button>
            <button
              className="card-control-button mdi mdi-content-save"
              onClick={submitSectionCount}
              disabled={saving}
            >
              Save
            </button>
          </Modal.Footer>
        </Modal>
      )}

      {/* ------------------------------------------ offering department modal */}
      {hostedModal !== null && (
        <Modal
          show
          onHide={() => setHostedModal(null)}
          size="md"
          centered
          contentClassName="modal-content"
          backdrop="static"
        >
          <Modal.Header className="modal-header">
            <Modal.Title className="modal-header-content">
              <div className="modal-header-icon">
                <i className="mdi mdi-office-building"></i>
              </div>
              <h4 className="modal-title">Add Offering Department</h4>
            </Modal.Title>
            <button
              className="modal-header-close-button mdi mdi-close"
              onClick={() => setHostedModal(null)}
            ></button>
          </Modal.Header>
          <Modal.Body className="modal-body">
            <div className="modal-body-content-container">
              <Form className="px-2 py-1">
                <FormGroup>
                  <Form.Label className="form-label">
                    Department Code
                  </Form.Label>
                  <FormControl
                    type="text"
                    className="form-control"
                    placeholder="e.g. MATH"
                    value={hostedModal.department}
                    autoFocus
                    onChange={(e) =>
                      setHostedModal({
                        department: e.target.value.toUpperCase(),
                      })
                    }
                  />
                  <div className="field-hint">
                    Appears in the "Offering From" list when adding a course.
                  </div>
                </FormGroup>
              </Form>
            </div>
            <div className="modal-divider"></div>
          </Modal.Body>
          <Modal.Footer className="modal-footer">
            <button
              className="card-control-button mdi mdi-close"
              onClick={() => setHostedModal(null)}
            >
              Cancel
            </button>
            <button
              className="card-control-button mdi mdi-content-save"
              onClick={submitHostedDepartment}
              disabled={saving}
            >
              Add
            </button>
          </Modal.Footer>
        </Modal>
      )}

      <ConfirmationModal
        show={showConfirmation}
        onHide={() => setShowConfirmation(false)}
        title={confirmationDetails.title}
        body={confirmationDetails.body}
        confirmText={confirmationDetails.confirmText}
        cancelText={confirmationDetails.cancelText}
        onConfirm={() => {
          confirmationDetails.onConfirm();
          setShowConfirmation(false);
        }}
        onCancel={() => setShowConfirmation(false)}
        confirmIcon={confirmationDetails.confirmIcon}
        red={confirmationDetails.red}
        green={confirmationDetails.green}
        blue={confirmationDetails.blue}
      />
    </div>
  );
}
