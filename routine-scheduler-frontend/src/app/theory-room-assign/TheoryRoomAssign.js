import { useState, useEffect } from "react";
import { Button, Modal } from "react-bootstrap";
import { Form, FormControl } from "react-bootstrap";

import { toast } from "react-hot-toast";
import {
  getAllTheoryRoomAssignment,
  updateTheoryRoomAssignment,
  getAllSectionRoomAllocation,
  updateSectionRoomAllocation,
} from "../api/theory-room-assign";
import {
  mdiDomain,
  mdiFormatListBulletedType,
  mdiDoor,
  mdiCalendar,
  mdiBookOpenPageVariant,
  mdiCheckCircle,
  mdiPencil,
  mdiContentSave,
  mdiClose,
} from "@mdi/js";
import Icon from "@mdi/react";

const validateAssignment = (assignment) => {
  if (!assignment.section) {
    return "Section cannot be empty";
  }

  if (!assignment.day) {
    return "Day cannot be empty";
  }

  if (!assignment.time) {
    return "Time cannot be empty";
  }

  if (!assignment.course_id) {
    return "Course ID cannot be empty";
  }

  if (!assignment.room_no) {
    return "Room number cannot be empty";
  }

  return null;
};

// Define a consistent style object for all input cells
const inputCellStyle = {
  minWidth: "110px",
  width: "100%",
  borderRadius: "12px",
  border: "1.5px solid rgba(194, 137, 248, 0.3)",
  boxShadow: "0 2px 5px rgba(194, 137, 248, 0.05)",
  fontWeight: 500,
  color: "#333",
  background: "#f8faff",
  fontSize: "1rem",
  padding: "8px 12px",
  height: "40px",
  transition: "all 0.3s ease",
};

// Define a shared style object for modal action buttons
const modalButtonStyle = {
  borderRadius: "6px",
  padding: "7px 14px",
  fontWeight: "500",
  background: "rgba(154, 77, 226, 0.15)",
  border: "1px solid rgba(154, 77, 226, 0.5)",
  color: "rgb(154, 77, 226)",
  transition: "all 0.3s ease",
  display: "flex",
  alignItems: "center",
  gap: "4px",
  fontSize: "0.9rem",
};

export default function TheoryRoomAssign() {
  const [allSectionRoomAllocation, setAllSectionRoomAllocation] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedSectionRoom, setSelectedSectionRoom] = useState(null);

  useEffect(() => {
    getAllSectionRoomAllocation()
      .then((response) => {
        setAllSectionRoomAllocation(response);
      })
      .catch((error) => {
        toast.error("Failed to load section room allocations");
      });

    getAllTheoryRoomAssignment()
      .then((response) => {
        setAssignments(response);
      })
      .catch((error) => {
        toast.error("Failed to load theory room assignments");
      });
  }, []);

  return (
    <div>
      <div className="page-header">
        <h3 className="page-title">
          <div className="page-title-icon-container mdi mdi-door"></div>
          Theory Room Assignment
        </h3>
      </div>
      <div className="card" style={{ marginBottom: "24px" }}>
        <div className="card-view">
          <div className="card-control-container">
            <h4 className="card-name">
              <div className="card-icon mdi mdi-door"></div>
              Section Room Management
            </h4>
          </div>
          <div className="card-table-container table-responsive">
            {Array.isArray(allSectionRoomAllocation) &&
            allSectionRoomAllocation.length === 0 ? (
              <div className="text-center py-4">
                <div className="mb-3">
                  <i
                    className="mdi mdi-book-off-outline"
                    style={{
                      fontSize: "3rem",
                      color: "#6c757d",
                      opacity: 0.5,
                    }}
                  ></i>
                </div>
                <h6 className="text-muted mb-2">Routine Not Initailized.</h6>
                <p className="text-muted mb-0" style={{ fontSize: "0.9rem" }}>
                  Initialize routine to assign rooms to theory sections.
                </p>
              </div>
            ) : (
              <table className="card-table table">
                <thead className="card-table-header">
                  <tr style={{ textAlign: "center" }}>
                    <th>
                      <i className="mdi mdi-domain"></i>
                      Department
                    </th>
                    <th>
                      <i className="mdi mdi-format-list-bulleted-type"></i>
                      Level-Term
                    </th>
                    <th>
                      <i className="mdi mdi-book"></i>
                      Section
                    </th>
                    <th>
                      <i className="mdi mdi-door"></i>
                      Room No
                    </th>
                    <th
                      style={{
                        padding: "18px 20px",
                        color: "rgb(174, 117, 228)",
                        fontWeight: "700",
                        fontSize: "0.95rem",
                        border: "none",
                      }}
                    >
                      <Icon
                        path={mdiCheckCircle}
                        size={0.7}
                        color="rgb(174, 117, 228)"
                        style={{ marginRight: "8px", verticalAlign: "middle" }}
                      />
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(allSectionRoomAllocation) &&
                    allSectionRoomAllocation.map(
                      (theoryRoomAllocation, index) => (
                        <tr key={index} style={{ textAlign: "center" }}>
                          <td> {theoryRoomAllocation.department} </td>
                          <td> {theoryRoomAllocation.level_term} </td>
                          <td> {theoryRoomAllocation.section} </td>
                          <td> {theoryRoomAllocation.room_no} </td>
                          <td>
                            <div className="d-flex justify-content-center">
                              <button
                                type="button"
                                style={{
                                  background: "rgba(154, 77, 226, 0.15)",
                                  color: "rgb(154, 77, 226)",
                                  border: "1px solid rgba(154, 77, 226, 0.5)",
                                  borderRadius: "6px",
                                  padding: "7px 14px",
                                  transition: "all 0.3s ease",
                                  fontWeight: "500",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  marginRight: "8px",
                                }}
                                className="btn"
                                onClick={() =>
                                  setSelectedSectionRoom({
                                    ...theoryRoomAllocation,
                                  })
                                }
                                onMouseOver={(e) => {
                                  e.currentTarget.style.background =
                                    "rgb(154, 77, 226)";
                                  e.currentTarget.style.color = "white";
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.background =
                                    "rgba(154, 77, 226, 0.15)";
                                  e.currentTarget.style.color =
                                    "rgb(154, 77, 226)";
                                }}
                              >
                                <Icon
                                  path={mdiPencil}
                                  size={0.7}
                                  style={{ marginRight: "6px" }}
                                />
                                Update
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-view">
          <div className="card-control-container">
            <h4 className="card-name">
              <div className="card-icon mdi mdi-book-open-page-variant"></div>
              Course Room Management
            </h4>
          </div>
          <div className="card-table-container table-responsive">
            {Array.isArray(assignments) && assignments.length === 0 ? (
              <div className="text-center py-4">
                <div className="mb-3">
                  <i
                    className="mdi mdi-book-off-outline"
                    style={{
                      fontSize: "3rem",
                      color: "#6c757d",
                      opacity: 0.5,
                    }}
                  ></i>
                </div>
                <h6 className="text-muted mb-2">No Theory Course Assignment</h6>
                <p className="text-muted mb-0" style={{ fontSize: "0.9rem" }}>
                  No teacher have been assigned to any theory course yet.
                </p>
              </div>
            ) : (
              <table className="card-table table">
                <thead className="card-table-header">
                  <tr style={{ textAlign: "center" }}>
                    <th>
                      <i className="mdi mdi-book-open-page-variant"></i>
                      Course ID
                    </th>
                    <th>
                      <i className="mdi mdi-format-list-bulleted-type"></i>
                      Section
                    </th>
                    <th>
                      <i className="mdi mdi-calendar"></i>
                      Day
                    </th>
                    <th>
                      <i className="mdi mdi-clock"></i>
                      Time
                    </th>
                    <th>
                      <i className="mdi mdi-door"></i>
                      Room No
                    </th>
                    <th>
                      <i className="mdi mdi-check-circle"></i>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment, index) => (
                    <tr key={index} style={{ textAlign: "center" }}>
                      <td> {assignment.course_id} </td>
                      <td> {assignment.section} </td>
                      <td> {assignment.day} </td>
                      <td> {assignment.time} </td>
                      <td> {assignment.room_no} </td>
                      <td>
                        <div className="d-flex justify-content-center">
                          <button
                            className="card-control-button"
                            onClick={() =>
                              setSelectedSection({
                                ...assignment,
                              })
                            }
                          >
                            <i className="mdi mdi-pencil"></i>
                            Update
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      {selectedSection !== null && (
        <Modal
          show={true}
          onHide={() => setSelectedSection(null)}
          size="md"
          centered
          contentClassName="border-0 shadow add-section-modal-content"
          backdrop="static"
        >
          <style>{`
            .add-section-modal-content {
              border-radius: 20px !important;
              box-shadow: 0 10px 30px rgba(0,0,0,0.08), 0 0 0 1px rgba(194, 137, 248, 0.1) !important;
              animation: fadeInModal 0.3s ease;
              overflow: hidden;
              border: none;
            }
            @keyframes fadeInModal {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .add-section-modal-header-bg {
              position: absolute;
              top: 0; left: 0; right: 0; bottom: 0;
              background-image: url('data:image/svg+xml,%3Csvg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath fill-rule="evenodd" clip-rule="evenodd" d="M11 100H89V0H11V100ZM0 0V100H100V0H0Z" fill="white" fill-opacity="0.05"/%3E%3C/svg%3E'), url('data:image/svg+xml,%3Csvg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"%3E%3Ccircle cx="10" cy="10" r="2" fill="white" fill-opacity="0.08"/%3E%3C/svg%3E');
              background-size: 80px 80px, 20px 20px;
              opacity: 0.15;
              z-index: 0;
            }
            .add-section-modal-header-content {
              position: relative;
              z-index: 1;
              display: flex;
              align-items: center;
            }
            .add-section-modal-header-icon {
              width: 32px;
              height: 32px;
              border-radius: 8px;
              background-color: rgba(255, 255, 255, 0.15);
              display: flex;
              align-items: center;
              justify-content: center;
              margin-right: 12px;
              box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
            }
            .add-section-modal-title {
              margin: 0;
              font-weight: 600;
              font-size: 18px;
              letter-spacing: 0.5px;
              color: white;
            }
            .add-section-modal-divider {
              border-top: 1px solid #e1e5e9;
              margin: 0 -2rem 1.5rem -2rem;
            }
          `}</style>
          <Modal.Header
            style={{
              background:
                "linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(174, 117, 228) 100%)",
              color: "white",
              borderBottom: "none",
              borderRadius: "20px 20px 0 0",
              padding: "24px 30px 24px 30px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div className="add-section-modal-header-bg"></div>
            <div className="add-section-modal-header-content">
              <div className="add-section-modal-header-icon">
                <Icon path={mdiDoor} size={1} color="white" />
              </div>
              <h4 className="add-section-modal-title">
                Update Theory Room Assignment
              </h4>
            </div>
          </Modal.Header>
          <Modal.Body
            style={{
              background: "#f8f9fa",
              borderRadius: "0 0 20px 20px",
              padding: "2rem 2rem 0 2rem",
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: "16px",
                boxShadow: "0 4px 24px rgba(174, 117, 228, 0.08)",
                padding: "2rem 1.5rem",
                marginBottom: "1.5rem",
              }}
            >
              <Form>
                <div className="d-flex align-items-center mb-3">
                  <Form.Label
                    style={{
                      fontWeight: 600,
                      color: "#7c4fd5",
                      marginRight: "15px",
                      marginBottom: 0,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Section
                  </Form.Label>
                  <div style={{ flex: 1, fontWeight: 500, color: "#666" }}>
                    {selectedSection.section} - {selectedSection.course_id} (
                    {selectedSection.day}, {selectedSection.time})
                  </div>
                </div>
                <div className="d-flex align-items-center">
                  <Form.Label
                    style={{
                      fontWeight: 600,
                      color: "#7c4fd5",
                      marginRight: "15px",
                      marginBottom: 0,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Room No
                  </Form.Label>
                  <FormControl
                    type="text"
                    placeholder="Enter Room Number"
                    value={selectedSection.room_no ?? ""}
                    onChange={(e) =>
                      setSelectedSection({
                        ...selectedSection,
                        room_no: e.target.value,
                      })
                    }
                    style={{
                      ...inputCellStyle,
                      flex: 1,
                    }}
                  />
                </div>
              </Form>
            </div>
            <div className="add-section-modal-divider"></div>
          </Modal.Body>
          <Modal.Footer
            style={{
              borderTop: "none",
              padding: "0 2rem 1.5rem 2rem",
              background: "#f8f9fa",
            }}
          >
            <Button
              style={modalButtonStyle}
              className="d-flex align-items-center justify-content-center"
              onMouseEnter={(e) => {
                e.target.style.background = "rgb(154, 77, 226)";
                e.target.style.color = "white";
                e.target.style.borderColor = "rgb(154, 77, 226)";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "rgba(154, 77, 226, 0.15)";
                e.target.style.color = "rgb(154, 77, 226)";
                e.target.style.borderColor = "rgba(154, 77, 226, 0.5)";
              }}
              onClick={() => setSelectedSection(null)}
            >
              <Icon path={mdiClose} size={0.9} style={{ marginRight: 6 }} />
              Close
            </Button>
            <Button
              style={modalButtonStyle}
              className="d-flex align-items-center justify-content-center"
              onMouseEnter={(e) => {
                e.target.style.background = "rgb(154, 77, 226)";
                e.target.style.color = "white";
                e.target.style.borderColor = "rgb(154, 77, 226)";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "rgba(154, 77, 226, 0.15)";
                e.target.style.color = "rgb(154, 77, 226)";
                e.target.style.borderColor = "rgba(154, 77, 226, 0.5)";
              }}
              onClick={(e) => {
                e.preventDefault();
                const result = validateAssignment(selectedSection);
                if (result === null) {
                  updateTheoryRoomAssignment(selectedSection)
                    .then((res) => {
                      getAllTheoryRoomAssignment()
                        .then((response) => {
                          const assignmentData = response.data || response;
                          setAssignments(
                            Array.isArray(assignmentData) ? assignmentData : []
                          );
                          setSelectedSection(null);
                          toast.success("Assignment updated successfully");
                        })
                        .catch((error) => {
                          setSelectedSection(null);
                          toast.success("Error refreshing assignments");
                        });
                    })
                    .catch((error) => {
                      console.error("Error saving assignment:", error);
                      toast.error("Failed to save assignment");
                    });
                } else toast.error(result);
              }}
            >
              <Icon
                path={mdiContentSave}
                size={0.9}
                style={{ marginRight: 6 }}
              />
              Save
            </Button>
          </Modal.Footer>
        </Modal>
      )}
      {selectedSectionRoom !== null && (
        <Modal
          show={true}
          onHide={() => setSelectedSectionRoom(null)}
          size="md"
          centered
          contentClassName="border-0 shadow add-section-modal-content"
          backdrop="static"
        >
          <style>{`
            .add-section-modal-content {
              border-radius: 20px !important;
              box-shadow: 0 10px 30px rgba(0,0,0,0.08), 0 0 0 1px rgba(194, 137, 248, 0.1) !important;
              animation: fadeInModal 0.3s ease;
              overflow: hidden;
              border: none;
            }
            @keyframes fadeInModal {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .add-section-modal-header-bg {
              position: absolute;
              top: 0; left: 0; right: 0; bottom: 0;
              background-image: url('data:image/svg+xml,%3Csvg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath fill-rule="evenodd" clip-rule="evenodd" d="M11 100H89V0H11V100ZM0 0V100H100V0H0Z" fill="white" fill-opacity="0.05"/%3E%3C/svg%3E'), url('data:image/svg+xml,%3Csvg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"%3E%3Ccircle cx="10" cy="10" r="2" fill="white" fill-opacity="0.08"/%3E%3C/svg%3E');
              background-size: 80px 80px, 20px 20px;
              opacity: 0.15;
              z-index: 0;
            }
            .add-section-modal-header-content {
              position: relative;
              z-index: 1;
              display: flex;
              align-items: center;
            }
            .add-section-modal-header-icon {
              width: 32px;
              height: 32px;
              border-radius: 8px;
              background-color: rgba(255, 255, 255, 0.15);
              display: flex;
              align-items: center;
              justify-content: center;
              margin-right: 12px;
              box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
            }
            .add-section-modal-title {
              margin: 0;
              font-weight: 600;
              font-size: 18px;
              letter-spacing: 0.5px;
              color: white;
            }
            .add-section-modal-divider {
              border-top: 1px solid #e1e5e9;
              margin: 0 -2rem 1.5rem -2rem;
            }
          `}</style>
          <Modal.Header
            style={{
              background:
                "linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(174, 117, 228) 100%)",
              color: "white",
              borderBottom: "none",
              borderRadius: "20px 20px 0 0",
              padding: "24px 30px 24px 30px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div className="add-section-modal-header-bg"></div>
            <div className="add-section-modal-header-content">
              <div className="add-section-modal-header-icon">
                <Icon path={mdiDoor} size={1} color="white" />
              </div>
              <h4 className="add-section-modal-title">
                Update Section Room Assignment
              </h4>
            </div>
          </Modal.Header>
          <Modal.Body
            style={{
              background: "#f8f9fa",
              borderRadius: "0 0 20px 20px",
              padding: "2rem 2rem 0 2rem",
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: "16px",
                boxShadow: "0 4px 24px rgba(174, 117, 228, 0.08)",
                padding: "2rem 1.5rem",
                marginBottom: "1.5rem",
              }}
            >
              <Form>
                <div className="d-flex align-items-center mb-3">
                  <Form.Label
                    style={{
                      fontWeight: 600,
                      color: "#7c4fd5",
                      marginRight: "15px",
                      marginBottom: 0,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Section
                  </Form.Label>
                  <div style={{ flex: 1, fontWeight: 500, color: "#666" }}>
                    {selectedSectionRoom.section} (
                    {selectedSectionRoom.level_term},{" "}
                    {selectedSectionRoom.department})
                  </div>
                </div>
                <div className="d-flex align-items-center">
                  <Form.Label
                    style={{
                      fontWeight: 600,
                      color: "#7c4fd5",
                      marginRight: "15px",
                      marginBottom: 0,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Room No
                  </Form.Label>
                  <FormControl
                    type="text"
                    placeholder="Enter Room Number"
                    value={selectedSectionRoom.room_no ?? ""}
                    onChange={(e) =>
                      setSelectedSectionRoom({
                        ...selectedSectionRoom,
                        room_no: e.target.value,
                      })
                    }
                    style={{
                      ...inputCellStyle,
                      flex: 1,
                    }}
                  />
                </div>
              </Form>
            </div>
            <div className="add-section-modal-divider"></div>
          </Modal.Body>
          <Modal.Footer
            style={{
              borderTop: "none",
              padding: "0 2rem 1.5rem 2rem",
              background: "#f8f9fa",
            }}
          >
            <Button
              style={modalButtonStyle}
              className="d-flex align-items-center justify-content-center"
              onMouseEnter={(e) => {
                e.target.style.background = "rgb(154, 77, 226)";
                e.target.style.color = "white";
                e.target.style.borderColor = "rgb(154, 77, 226)";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "rgba(154, 77, 226, 0.15)";
                e.target.style.color = "rgb(154, 77, 226)";
                e.target.style.borderColor = "rgba(154, 77, 226, 0.5)";
              }}
              onClick={() => setSelectedSectionRoom(null)}
            >
              <Icon path={mdiClose} size={0.9} style={{ marginRight: 6 }} />
              Close
            </Button>
            <Button
              style={modalButtonStyle}
              className="d-flex align-items-center justify-content-center"
              onMouseEnter={(e) => {
                e.target.style.background = "rgb(154, 77, 226)";
                e.target.style.color = "white";
                e.target.style.borderColor = "rgb(154, 77, 226)";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "rgba(154, 77, 226, 0.15)";
                e.target.style.color = "rgb(154, 77, 226)";
                e.target.style.borderColor = "rgba(154, 77, 226, 0.5)";
              }}
              onClick={(e) => {
                e.preventDefault();
                if (
                  !selectedSectionRoom.room_no ||
                  selectedSectionRoom.room_no.trim() === ""
                ) {
                  toast.error("Room number cannot be empty");
                  return;
                }

                updateSectionRoomAllocation(selectedSectionRoom)
                  .then((res) => {
                    getAllSectionRoomAllocation()
                      .then((response) => {
                        setAllSectionRoomAllocation(response);
                        toast.success("Section room updated successfully");
                      })
                      .catch((error) => {
                        toast.error("Error refreshing section rooms");
                      });
                    getAllTheoryRoomAssignment()
                      .then((response) => {
                        setAssignments(response);
                      })
                      .catch((error) => {
                        toast.error("Failed to refresh assignments");
                      });
                    setSelectedSectionRoom(null);
                  })
                  .catch((error) => {
                    setSelectedSectionRoom(null);
                    toast.error("Failed to update section room");
                  });
              }}
            >
              <Icon
                path={mdiContentSave}
                size={0.9}
                style={{ marginRight: 6 }}
              />
              Save
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
}
