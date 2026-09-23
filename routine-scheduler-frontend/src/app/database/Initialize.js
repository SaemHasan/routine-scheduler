import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
  getLevelTerms,
  setLevelTermsDB,
  addLevelTerm,
  deleteLevelTerm,
} from "../api/db-crud";
import { setTheoryAssignStatus } from "../api/theory-assign";
import {
  getBatches,
  getDepartments,
  getAllLevelTermsName,
} from "../api/academic-config";
import { Modal, Form, Row, Col, FormGroup } from "react-bootstrap";
import ConfirmationModal from "../shared/ConfirmationModal";

export default function Initialize() {
  const [levelTerms, setLevelTerms] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLevelTerms, setSelectedLevelTerms] = useState([]);
  const [batchInputs, setBatchInputs] = useState({});
  const [allBatches, setAllBatches] = useState([]);
  const [newLevelTerm, setNewLevelTerm] = useState({
    department: "",
    level_term: "",
  });
  const [departments, setDepartments] = useState([]);
  const [allLevelTermNames, setAllLevelTermNames] = useState([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationDetails, setConfirmationDetails] = useState({
    title: "",
    body: "",
    confirmText: "",
    cancelText: "",
    onConfirm: () => {},
    onCancel: () => {},
    confirmIcon: "mdi-delete",
    red: 220,
    green: 53,
    blue: 69,
  });

  const handleShowConfirmation = (
    title,
    body,
    confirmText,
    cancelText,
    onConfirm,
    confirmIcon,
    red,
    green,
    blue
  ) => {
    setConfirmationDetails({
      title,
      body,
      confirmText,
      cancelText,
      onConfirm,
      confirmIcon,
      red,
      green,
      blue,
    });
    setShowConfirmation(true);
  };

  const handleHideConfirmation = () => {
    setShowConfirmation(false);
  };

  useEffect(() => {
    setIsLoading(true);
    getLevelTerms()
      .then((res) => {
        setLevelTerms(res.data);
      })
      .catch((error) => {
        toast.error("Failed to load level terms. Please try again later.");
        setLevelTerms([]);
      })
      .finally(() => setIsLoading(false));
    getBatches()
      .then((res) => {
        setAllBatches(res);
      })
      .catch((error) => {
        toast.error("Failed to load batches. Please try again later.");
        setAllBatches([]);
      });
    getDepartments()
      .then((res) => {
        setDepartments(res);
      })
      .catch((error) => {
        toast.error("Failed to load departments. Please try again later.");
        setDepartments([]);
      });
    getAllLevelTermsName()
      .then((res) => {
        setAllLevelTermNames(res);
      })
      .catch((error) => {
        toast.error("Failed to load level term names. Please try again later.");
        setAllLevelTermNames([]);
      });
  }, []);

  const handleAddLevelTerm = () => {
    if (!newLevelTerm.department || !newLevelTerm.level_term) {
      toast.error("Please select a department and enter a level-term");
      return;
    }

    const addToast = toast.loading("Adding level term...");
    addLevelTerm(newLevelTerm)
      .then((res) => {
        toast.dismiss(addToast);
        if (res.success) {
          toast.success(
            `Successfully added ${newLevelTerm.level_term} for ${newLevelTerm.department}`
          );
        }
        // Add the new level term to the state
        getLevelTerms()
          .then((res) => {
            setLevelTerms(res.data);
          })
          .catch((error) => {
            toast.error("Failed to load level terms. Please try again later.");
            setLevelTerms([]);
          });
        // Reset form
        setNewLevelTerm({ department: "", level_term: "" });
        setShowAddModal(false);
      })
      .catch((error) => {
        toast.dismiss(addToast);
        console.error("Error adding level term:", error);
        toast.error(
          `Failed to add level term. ${error.response?.data?.message || ""}`
        );
      });
  };

  const handleDelete = (level_term, department) => {
    handleShowConfirmation(
      "Delete Level Term",
      `Are you sure you want to delete ${level_term} for ${department}?`,
      "Delete",
      "Cancel",
      async () => {
        try {
          await deleteLevelTerm({ level_term, department });
          toast.success(`Successfully deleted ${level_term} for ${department}`);
          setLevelTerms((prev) =>
            prev.filter(
              (lt) =>
                !(lt.level_term === level_term && lt.department === department)
            )
          );
        } catch (error) {
          console.error("Error deleting level term:", error);
          toast.error(`Failed to delete ${level_term} for ${department}`);
        }
      },
      "mdi-delete",
      220,
      53,
      69
    );
  };

  // Handler for activating selected level-terms for all departments
  const handleActivateLevelTerms = () => {
    if (!selectedLevelTerms.length) {
      toast.error("Please select at least one level-term");
      return;
    }
    // Validate batch inputs
    for (const lt of selectedLevelTerms) {
      if (!batchInputs[lt] || batchInputs[lt] === "") {
        toast.error(`Please select a batch for ${lt}`);
        return;
      }
    }
    // Update level terms with selected status and batch inputs
    const updatedLevelTerms = levelTerms.map((lt) =>
      selectedLevelTerms.includes(lt.level_term)
        ? { ...lt, active: true, batch: batchInputs[lt.level_term] }
        : { ...lt, active: false, batch: 0 }
    );

    const submittingToast = toast.loading("Initializing system...");

    setLevelTermsDB(updatedLevelTerms)
      .then((res) => {
        setLevelTerms(updatedLevelTerms);
        toast.dismiss(submittingToast);
        toast.success(res.message);
      })
      .catch((error) => {
        toast.dismiss(submittingToast);
        console.error("Error initializing system:", error);
        toast.error("Failed to initialize system. Please try again.");
      });
    setTheoryAssignStatus(0);
    setShowActivateModal(false);
    setSelectedLevelTerms([]);
    setBatchInputs({});
  };

  return (
    <div>
      {/* Modern Page Header */}
      <div className="page-header">
        <h3 className="page-title">
          <div className="page-title-icon-container mdi mdi-check"></div>
          Active Level Terms
        </h3>
      </div>
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-view">
              <div className="card-control-container">
                <h4 className="card-name">
                  <div className="card-icon mdi mdi-clipboard-outline"></div>
                  Level Term Initialization
                </h4>
                <div className="card-control-button-container">
                  <button
                    className="card-control-button mdi mdi-plus-circle"
                    onClick={() => setShowAddModal(true)}
                  >
                    Add Level-Term
                  </button>
                  <button
                    className="card-control-button mdi mdi-check-circle"
                    onClick={() => setShowActivateModal(true)}
                  >
                    Activate Level-Term
                  </button>
                </div>
              </div>

              {/* Add loading state */}
              {isLoading ? (
                <div className="loading-banner-container">
                  <div className="loading-banner">
                    <span
                      className="loading-banner-spinner spinner-border"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Loading level terms...
                  </div>
                </div>
              ) : (
                <>
                  <div className="card-table-container table-responsive">
                    <table className="card-table table">
                      <thead className="card-table-header">
                        <tr>
                          <th>
                            <i className="mdi mdi-office-building-marker"></i>
                            Department
                          </th>
                          <th>
                            <i className="mdi mdi-format-list-bulleted"></i>{" "}
                            Level-Term
                          </th>
                          <th>
                            <i className="mdi mdi-list-status"></i>
                            Status
                          </th>
                          <th>
                            <i className="mdi mdi-account-badge"></i>
                            Batch
                          </th>
                          <th>
                            <i className="mdi mdi-delete-outline"></i>
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="card-table-body">
                        {levelTerms?.length === 0 ? (
                          <tr>
                            <td colSpan="5">
                              <div className="text-center py-4">
                                <div className="mb-3">
                                  <i
                                    className="mdi mdi-clipboard-text-outline"
                                    style={{
                                      fontSize: "3rem",
                                      color: "#6c757d",
                                      opacity: 0.5,
                                    }}
                                  ></i>
                                </div>
                                <h3 className="text-muted mb-2">
                                  No level terms found
                                </h3>
                                <p className="text-muted mb-0">
                                  There is no level term available. Please add a
                                  new level term to get started.
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          levelTerms?.map((levelTerm, index) => (
                            <tr key={index}>
                              <td>{levelTerm.department}</td>
                              <td>{levelTerm.level_term}</td>
                              <td>
                                {levelTerm.active ? (
                                  <div className="status active mdi mdi-check-circle">
                                    Active
                                  </div>
                                ) : (
                                  <div className="status inactive mdi mdi-close-circle">
                                    Inactive
                                  </div>
                                )}
                              </td>
                              <td>
                                {levelTerm.active ? (
                                  <div>{levelTerm.batch}</div>
                                ) : (
                                  <div>—</div>
                                )}
                              </td>
                              <td>
                                <button
                                  className="delete mdi mdi-delete-outline"
                                  onClick={() =>
                                    handleDelete(
                                      levelTerm.level_term,
                                      levelTerm.department
                                    )
                                  }
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <Modal
                    show={showAddModal}
                    centered
                    size="md"
                    contentClassName="modal-content"
                    backdrop="static"
                  >
                    <Modal.Header className="modal-header">
                      <Modal.Title className="modal-header-content">
                        <div className="modal-header-icon mdi mdi-plus-circle-outline"></div>
                        <h4 className="modal-title">Add New Level-Term</h4>
                      </Modal.Title>
                      <button
                        className="modal-header-close-button mdi mdi-close"
                        onClick={() => {
                          setShowAddModal(false);
                          setNewLevelTerm({
                            department: "",
                            level_term: "",
                          });
                        }}
                      ></button>
                    </Modal.Header>
                    <Modal.Body className="modal-body">
                      <div className="modal-body-content-container">
                        <Form>
                          <Row>
                            <Col>
                              <FormGroup className="mb-3">
                                <Form.Label className="form-label">
                                  Department
                                </Form.Label>
                                <Form.Select
                                  className="form-select"
                                  value={newLevelTerm.department}
                                  onChange={(e) =>
                                    setNewLevelTerm((prev) => ({
                                      ...prev,
                                      department: e.target.value,
                                    }))
                                  }
                                >
                                  <option value="">Select Department</option>
                                  {departments && departments.length > 0 ? (
                                    departments.map((dept, i) => (
                                      <option key={i} value={dept}>
                                        {dept}
                                      </option>
                                    ))
                                  ) : (
                                    <option disabled>
                                      No departments available
                                    </option>
                                  )}
                                </Form.Select>
                              </FormGroup>
                            </Col>
                          </Row>
                          <Row>
                            <Col>
                              <FormGroup>
                                <Form.Label className="form-label">
                                  Level-Term
                                </Form.Label>
                                <Form.Select
                                  className="form-select"
                                  value={newLevelTerm.level_term}
                                  onChange={(e) =>
                                    setNewLevelTerm((prev) => ({
                                      ...prev,
                                      level_term: e.target.value,
                                    }))
                                  }
                                >
                                  <option value="">Select Level-Term</option>
                                  {allLevelTermNames &&
                                  allLevelTermNames.length > 0 ? (
                                    allLevelTermNames.map((lt, i) => (
                                      <option key={i} value={lt}>
                                        {lt}
                                      </option>
                                    ))
                                  ) : (
                                    <option disabled>
                                      No level terms available
                                    </option>
                                  )}
                                </Form.Select>
                              </FormGroup>
                            </Col>
                          </Row>
                        </Form>
                      </div>
                      <div className="modal-divider"></div>
                    </Modal.Body>
                    <Modal.Footer className="modal-footer">
                      <button
                        className="card-control-button mdi mdi-close"
                        onClick={() => {
                          setShowAddModal(false);
                          setNewLevelTerm({
                            department: "",
                            level_term: "",
                          });
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="card-control-button mdi mdi-content-save"
                        onClick={handleAddLevelTerm}
                      >
                        Save
                      </button>
                    </Modal.Footer>
                  </Modal>
                  <Modal
                    show={showActivateModal}
                    centered
                    size="md"
                    contentClassName="shadow modal-content"
                    backdrop="static"
                  >
                    <Modal.Header className="modal-header">
                      <Modal.Title className="modal-header-content">
                        <div className="modal-header-icon mdi mdi-check-circle-outline"></div>
                        <h4 className="modal-title">Activate Level-Term</h4>
                      </Modal.Title>
                      <button
                        className="modal-header-close-button mdi mdi-close"
                        onClick={() => {
                          setShowActivateModal(false);
                          setSelectedLevelTerms([]);
                          setBatchInputs({});
                        }}
                      ></button>
                    </Modal.Header>
                    <Modal.Body className="modal-body">
                      <div className="modal-body-content-container">
                        <Form>
                          {allLevelTermNames.map((lt) => (
                            <Row key={lt} className="mb-3 align-items-center">
                              <Col xs={1} className="pl-3 pr-0">
                                <div
                                  className={`custom-checkbox ${
                                    selectedLevelTerms.includes(lt)
                                      ? "checked mdi mdi-check"
                                      : "unchecked"
                                  }`}
                                  onClick={() => {
                                    if (selectedLevelTerms.includes(lt)) {
                                      setSelectedLevelTerms((prev) =>
                                        prev.filter((x) => x !== lt)
                                      );
                                    } else {
                                      setSelectedLevelTerms((prev) => [
                                        ...prev,
                                        lt,
                                      ]);
                                    }
                                  }}
                                ></div>
                              </Col>
                              <Col xs={4}>{lt}</Col>
                              <Col xs={7}>
                                <Form.Select
                                  className="form-select"
                                  value={batchInputs[lt] || ""}
                                  onChange={(e) =>
                                    setBatchInputs((prev) => ({
                                      ...prev,
                                      [lt]: e.target.value,
                                    }))
                                  }
                                  disabled={!selectedLevelTerms.includes(lt)}
                                >
                                  <option value="">Select Batch</option>
                                  {allBatches && allBatches.length > 0 ? (
                                    allBatches.map((batch, i) => (
                                      <option key={i} value={batch}>
                                        {batch}
                                      </option>
                                    ))
                                  ) : (
                                    <option disabled>
                                      No batches available
                                    </option>
                                  )}
                                </Form.Select>
                              </Col>
                            </Row>
                          ))}
                        </Form>
                      </div>
                      <div className="modal-divider"></div>
                    </Modal.Body>
                    <Modal.Footer className="modal-footer">
                      <button
                        className="card-control-button mdi mdi-close"
                        onClick={() => {
                          setShowActivateModal(false);
                          setSelectedLevelTerms([]);
                          setBatchInputs({});
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="card-control-button mdi mdi-arrow-right-circle-outline"
                        onClick={handleActivateLevelTerms}
                      >
                        Activate
                      </button>
                    </Modal.Footer>
                  </Modal>
                  <ConfirmationModal
                    show={showConfirmation}
                    onHide={handleHideConfirmation}
                    title={confirmationDetails.title}
                    body={confirmationDetails.body}
                    confirmText={confirmationDetails.confirmText}
                    cancelText={confirmationDetails.cancelText}
                    onConfirm={() => {
                      confirmationDetails.onConfirm();
                      handleHideConfirmation();
                    }}
                    onCancel={handleHideConfirmation}
                    confirmIcon={confirmationDetails.confirmIcon}
                    red={confirmationDetails.red}
                    green={confirmationDetails.green}
                    blue={confirmationDetails.blue}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
