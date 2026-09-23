import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Alert, Modal, Dropdown } from "react-bootstrap";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { mdiDeleteOutline, mdiPlus } from "@mdi/js";
import { getTeachers } from "../api/db-crud";
import {
  finalize,
  getStatus,
  setTheoryAssignStatus,
  initiate,
  setTeacherAssignment,
  resendTheoryPrefMail,
  saveReorderedTeacherPreference,
  getAllTheoryTeacherAssignment,
  addTheoryTeacherAssignment,
  deleteTheoryTeacherAssignment,
} from "../api/theory-assign";
import Icon from "@mdi/react";
import CardWithButton from "../shared/CardWithButton";
import ConfirmationModal from "../shared/ConfirmationModal";

export default function TheoryPreference() {
  const [status, setStatus] = useState({
    status: 0,
    values: [],
    submitted: [],
  });
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState([]);
  const [allTeachers, setAllTeachers] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState("");
  const [selectedTeacherRow, setSelectedTeacherRow] = useState(null);
  const [allCourses] = useState([]);
  const [allTheoryTeacherAssignment, setAllTheoryTeacherAssignment] = useState(
    []
  );
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

  const handleGetStatus = () => {
    getStatus().then((res) => {
      // Sort the teachers in the status by seniority rank
      let modifiedRes = { ...res };
      if (modifiedRes.values && modifiedRes.values.length > 0) {
        modifiedRes.values = [...modifiedRes.values].sort(
          (a, b) => a.seniority_rank - b.seniority_rank
        );
      }
      if (modifiedRes.submitted && modifiedRes.submitted.length > 0) {
        modifiedRes.submitted = [...modifiedRes.submitted].sort(
          (a, b) => a.seniority_rank - b.seniority_rank
        );
      }
      setStatus({ values: [], submitted: [], ...modifiedRes });
    });
  };

  useEffect(() => {
    handleGetStatus();
    getTeachers().then((res) => {
      res = res.filter((t) => t.active === 1);
      // Sort teachers by seniority rank (lower rank means more senior)
      const sortedTeachers = [...res].sort(
        (a, b) => a.seniority_rank - b.seniority_rank
      );
      setAllTeachers(sortedTeachers);
    });
    getAllTheoryTeacherAssignment().then((res) => {
      setAllTheoryTeacherAssignment(res);
    });
  }, []);

  // Helper to get courses not in selectedCourse
  const getOfferedCourses = () =>
    allCourses.filter((c) => !selectedCourse.includes(c));

  // Drag and drop handler for reordering and moving between lists
  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;

    // Drag within Your Preference
    if (
      source.droppableId === "preference-list" &&
      destination.droppableId === "preference-list"
    ) {
      const reordered = Array.from(selectedCourse);
      const [removed] = reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, removed);
      setSelectedCourse(reordered);
      return;
    }

    // Drag from Offered Courses to Your Preference
    if (
      source.droppableId === "offered-list" &&
      destination.droppableId === "preference-list"
    ) {
      const offered = getOfferedCourses();
      const course = offered[source.index];
      if (!selectedCourse.includes(course)) {
        const newPref = Array.from(selectedCourse);
        newPref.splice(destination.index, 0, course);
        setSelectedCourse(newPref);
      }
      return;
    }

    // Drag from Your Preference to Offered Courses (remove from preference)
    if (
      source.droppableId === "preference-list" &&
      destination.droppableId === "offered-list"
    ) {
      const newPref = Array.from(selectedCourse);
      newPref.splice(source.index, 1);
      setSelectedCourse(newPref);
      return;
    }
  };

  const handleFinalizeConfirmation = () => {
    handleShowConfirmation(
      "Finalize Assignments",
      "Are you sure you want to finalize the assignments? This action cannot be undone.",
      "Finalize",
      "Cancel",
      handleFinalize,
      "mdi-check-circle-outline",
      40,
      167,
      69
    );
  };

  const handleFinalize = () => {
    const loadingToast = toast.loading("Finalizing assignments...");
    finalize()
      .then(() => {
        return getStatus();
      })
      .then((res) => {
        // Sort the teachers in the status by seniority rank
        let modifiedRes = { ...res };
        if (modifiedRes.values && modifiedRes.values.length > 0) {
          modifiedRes.values = [...modifiedRes.values].sort(
            (a, b) => a.seniority_rank - b.seniority_rank
          );
        }
        if (modifiedRes.submitted && modifiedRes.submitted.length > 0) {
          modifiedRes.submitted = [...modifiedRes.submitted].sort(
            (a, b) => a.seniority_rank - b.seniority_rank
          );
        }

        setShowConfirmation(false);

        // Update backend status
        return setTheoryAssignStatus(3).then(() => {
          // Set complete status with all updates at once
          setStatus({
            values: [],
            submitted: [],
            ...modifiedRes,
            status: 3,
          });

          getAllTheoryTeacherAssignment().then((res) => {
            setAllTheoryTeacherAssignment(res);
          });

          // Dismiss loading and show success
          toast.dismiss(loadingToast);
          toast.success("Assignments finalized successfully");
        });
      })
      .catch((error) => {
        toast.dismiss(loadingToast);
        toast.error("Failed to finalize assignments");
        console.error("Error finalizing assignments:", error);
      });
  };

  return (
    <div>
      {/* Modern Page Header */}
      <div className="page-header">
        <h3 className="page-title">
          <div className="page-title-icon-container mdi mdi-book-open-variant"></div>
          Theory Course Assign
        </h3>
      </div>
      {(status.values.length !== 0 || parseInt(status.status) < 3) && (
        <div className="mb-4">
          <CardWithButton
            title="Send Email with Form Link"
            subtitle="Initial Phase"
            status={parseInt(status.status) === 0 ? "Click to Start" : "Sent"}
            bgColor={parseInt(status.status) === 0 ? "info" : "success"}
            icon={parseInt(status.status) === 0 ? "mdi-autorenew" : "mdi-check"}
            disabled={false}
            onClick={(e) => {
              // Show a loading toast
              const loadingToast = toast.loading("Sending emails...");

              initiate()
                .then((res) => {
                  getStatus()
                    .then((res) => {
                      // Sort the teachers in the status by seniority rank
                      let modifiedRes = { ...res };
                      if (modifiedRes.values && modifiedRes.values.length > 0) {
                        modifiedRes.values = [...modifiedRes.values].sort(
                          (a, b) => a.seniority_rank - b.seniority_rank
                        );
                      }
                      if (
                        modifiedRes.submitted &&
                        modifiedRes.submitted.length > 0
                      ) {
                        modifiedRes.submitted = [...modifiedRes.submitted].sort(
                          (a, b) => a.seniority_rank - b.seniority_rank
                        );
                      }

                      // Update status with modified response, ensuring status is set to 1
                      setStatus({
                        values: [],
                        submitted: [],
                        ...modifiedRes,
                        status: 1,
                      });

                      // Update the status in the backend
                      setTheoryAssignStatus(1)
                        .then(() => {
                          // Dismiss loading toast and show success
                          toast.dismiss(loadingToast);
                          toast.success("Emails sent successfully!");
                        })
                        .catch((error) => {
                          // Handle error
                          toast.dismiss(loadingToast);
                          toast.error("Failed to update status");
                          console.error("Error updating status:", error);
                        });
                    })
                    .catch((error) => {
                      toast.dismiss(loadingToast);
                      toast.error("Failed to get status");
                      console.error("Error getting status:", error);
                    });
                })
                .catch((error) => {
                  toast.dismiss(loadingToast);
                  toast.error("Failed to initiate email process");
                  console.error("Error initiating:", error);
                });
            }}
          />
        </div>
      )}
      {(status.values.length !== 0 ||
        (parseInt(status.status) > 0 && parseInt(status.status) < 3)) && (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-view">
                <div className="card-control-container">
                  <h4 className="card-name">
                    <div className="card-name-icon mdi mdi-account-multiple"></div>
                    Yet to submit the form
                  </h4>
                </div>
                <div className="card-table-container table-responsive">
                  <table className="card-table table">
                    <thead className="card-table-header">
                      <tr>
                        <th>
                          <i className="mdi mdi-account" />
                          Initial
                        </th>
                        <th>
                          <i className="mdi mdi-account-box" />
                          Name
                        </th>
                        <th>
                          <i className="mdi mdi-email" />
                          Email
                        </th>
                        <th>
                          <i className="mdi mdi-account-tie" />
                          Seniority Rank
                        </th>
                        <th>
                          <i className="mdi mdi-cog" />
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="card-table-body">
                      {[...status.values]
                        .sort((a, b) => a.seniority_rank - b.seniority_rank)
                        .map((teacher, index) => (
                          <tr key={index}>
                            <td>{teacher.initial}</td>
                            <td>{teacher.name}</td>
                            <td>{teacher.email}</td>
                            <td>{teacher.seniority_rank}</td>
                            <td className="d-flex align-items-center">
                              <button
                                className="card-control-button mdi mdi-send"
                                onClick={() => {
                                  setConfirmAction("Resend");
                                  setSelectedTeacherRow(teacher);
                                  setShowConfirm(true);
                                }}
                              >
                                Resend
                              </button>
                              <button
                                type="button"
                                style={{
                                  marginLeft: "8px",
                                  borderRadius: "6px",
                                  padding: "7px 14px",
                                  fontWeight: "500",
                                  background: "rgba(40, 167, 69, 0.15)",
                                  border: "1px solid rgba(40, 167, 69, 0.5)",
                                  color: "rgb(40, 167, 69)",
                                  transition: "all 0.3s ease",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  fontSize: "0.9rem",
                                }}
                                onMouseEnter={(e) => {
                                  e.target.style.background =
                                    "rgb(40, 167, 69)";
                                  e.target.style.color = "white";
                                  e.target.style.borderColor =
                                    "rgb(40, 167, 69)";
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.background =
                                    "rgba(40, 167, 69, 0.15)";
                                  e.target.style.color = "rgb(40, 167, 69)";
                                  e.target.style.borderColor =
                                    "rgba(40, 167, 69, 0.5)";
                                }}
                                onClick={() => {
                                  setSelectedTeacherRow(teacher);
                                  // Open directly in new tab
                                  const newWindow = window.open(
                                    `/form/theory-pref/${teacher.initial}`,
                                    "_blank"
                                  );

                                  // Set up polling to check if window closed
                                  const pollTimer = setInterval(() => {
                                    if (newWindow.closed) {
                                      clearInterval(pollTimer);
                                      // Refresh data when child window closes
                                      getStatus().then((res) => {
                                        // Sort the teachers in the status by seniority rank
                                        let modifiedRes = { ...res };
                                        if (
                                          modifiedRes.values &&
                                          modifiedRes.values.length > 0
                                        ) {
                                          modifiedRes.values = [
                                            ...modifiedRes.values,
                                          ].sort(
                                            (a, b) =>
                                              a.seniority_rank -
                                              b.seniority_rank
                                          );
                                        }
                                        if (
                                          modifiedRes.submitted &&
                                          modifiedRes.submitted.length > 0
                                        ) {
                                          modifiedRes.submitted = [
                                            ...modifiedRes.submitted,
                                          ].sort(
                                            (a, b) =>
                                              a.seniority_rank -
                                              b.seniority_rank
                                          );
                                        }
                                        setStatus({
                                          values: [],
                                          submitted: [],
                                          ...modifiedRes,
                                        });
                                      });
                                    }
                                  }, 500);
                                }}
                              >
                                <i
                                  className="mdi mdi-plus-circle"
                                  style={{
                                    fontSize: "16px",
                                    marginRight: "4px",
                                  }}
                                ></i>
                                Add Preference
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {status.values.length === 0 && parseInt(status.status) >= 2 && (
                  <Alert variant="success text-center">
                    All submitted, waiting for next phase
                  </Alert>
                )}
                {status.values.length === 0 &&
                  parseInt(status.status) === 0 && (
                    <Alert variant="info text-center">
                      Click "Initial Phase" to start the process
                    </Alert>
                  )}
                {status.values.length === 0 &&
                  parseInt(status.status) === 1 && (
                    <Alert variant="info text-center">
                      Table is ready for teachers to submit preferences
                    </Alert>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
      {(status.values.length !== 0 ||
        (parseInt(status.status) > 0 && parseInt(status.status) < 3)) && (
        <div className="card">
          <div className="card-view">
            <div className="card-control-container">
              <h4 className="card-name">
                <div className="card-name-icon mdi mdi-account-multiple"></div>
                Already Submitted
              </h4>
            </div>
            {(status.submitted.length !== 0 ||
              parseInt(status.status) >= 1) && (
              <div className="card-table-container table-responsive">
                <table className="card-table table">
                  <thead className="card-table-header">
                    <tr>
                      <th>
                        <i className="mdi mdi-account" />
                        Initial
                      </th>
                      <th>
                        <i className="mdi mdi-account-box" />
                        Name
                      </th>
                      <th>
                        <i className="mdi mdi-email" />
                        Email
                      </th>
                      <th>
                        <i className="mdi mdi-account-tie" />
                        Seniority Rank
                      </th>
                      <th>
                        <i className="mdi mdi-cog" />
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="card-table-body">
                    {[...status.submitted]
                      .sort((a, b) => a.seniority_rank - b.seniority_rank)
                      .map((teacher, index) => (
                        <tr key={index}>
                          <td> {teacher.initial}</td>
                          <td>{teacher.name}</td>
                          <td>{teacher.email}</td>
                          <td>{teacher.seniority_rank}</td>
                          <td>
                            <button
                              className="card-control-button mdi mdi-pencil"
                              onClick={() => {
                                setSelectedTeacher({
                                  ...teacher,
                                });
                                setSelectedCourse(teacher.response);
                              }}
                            >
                              Edit Preference
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
            {status.submitted.length === 0 && parseInt(status.status) === 0 && (
              <Alert variant="info text-center">
                Click "Initial Phase" to start and show submitted teachers
              </Alert>
            )}
            {status.submitted.length === 0 && parseInt(status.status) >= 1 && (
              <Alert variant="info text-center">
                No teachers have submitted yet
              </Alert>
            )}
          </div>
        </div>
      )}
      {selectedTeacher !== null && (
        <Modal
          show={selectedTeacher !== null}
          onHide={() => setSelectedTeacher(null)}
          size="md"
          centered
          contentClassName="modal-content"
          backdrop="static"
        >
          <Modal.Header className="modal-header">
            <Modal.Title className="modal-header-content">
              <div>
                <h4 className="modal-title">Theory Course Preference</h4>
                <h6 className="ml-2">
                  Selected by {selectedTeacher.name} ({selectedTeacher.initial})
                </h6>
              </div>
            </Modal.Title>
            <button
              className="modal-header-close-button mdi mdi-close"
              onClick={() => setSelectedTeacher(null)}
            ></button>
          </Modal.Header>
          <Modal.Body className="modal-body">
            <DragDropContext onDragEnd={onDragEnd}>
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <div style={{ width: "100%", maxWidth: 540, padding: 10 }}>
                  <h6
                    style={{
                      fontSize: "1.05rem",
                      fontWeight: "600",
                      color: "rgb(174, 117, 228)",
                      marginBottom: "12px",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <i className="mdi mdi-clipboard-outline" />
                    Your Preference (Drag to reorder)
                  </h6>
                  <Droppable droppableId="preference-list">
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        style={{
                          border: "1px solid rgba(174, 117, 228, 0.3)",
                          borderRadius: "10px",
                          minHeight: 250,
                          maxHeight: 350,
                          overflowY: "auto",
                          padding: 10,
                          background: "white",
                          width: "100%",
                          boxShadow: "0 4px 15px rgba(174, 117, 228, 0.08)",
                        }}
                      >
                        {selectedCourse.map((course, idx) => (
                          <Draggable
                            key={course}
                            draggableId={course}
                            index={idx}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={{
                                  userSelect: "none",
                                  padding: "10px 12px",
                                  margin: "0 0 8px 0",
                                  background: snapshot.isDragging
                                    ? "rgba(174, 117, 228, 0.08)"
                                    : "#fff",
                                  border:
                                    "1px solid " +
                                    (snapshot.isDragging
                                      ? "rgba(174, 117, 228, 0.5)"
                                      : "rgba(0, 0, 0, 0.1)"),
                                  borderRadius: 8,
                                  display: "flex",
                                  alignItems: "center",
                                  boxShadow: snapshot.isDragging
                                    ? "0 4px 10px rgba(174, 117, 228, 0.2)"
                                    : "0 2px 4px rgba(0, 0, 0, 0.05)",
                                  fontWeight: "500",
                                  color: snapshot.isDragging
                                    ? "rgb(174, 117, 228)"
                                    : "#333",
                                  ...provided.draggableProps.style,
                                }}
                              >
                                <span style={{ flex: 1 }}>{course}</span>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              </div>
            </DragDropContext>
            <div className="modal-divider"></div>
          </Modal.Body>
          <Modal.Footer className="modal-footer">
            <button
              className="card-control-button mdi mdi-close"
              onClick={() => {
                setSelectedTeacher(null);
              }}
            >
              Close
            </button>
            <button
              className="card-control-button mdi mdi-content-save"
              onClick={() => {
                saveReorderedTeacherPreference(
                  selectedTeacher.initial,
                  selectedCourse
                ).then(() => {
                  // Refresh the status to show updated data
                  handleGetStatus();
                  setSelectedTeacher(null);
                  toast.success("Preferences saved successfully!");
                });
              }}
            >
              Save
            </button>
          </Modal.Footer>
        </Modal>
      )}
      <div className="mb-4">
        <CardWithButton
          title="Assign Teachers according to Seniorty"
          subtitle="Final Phase"
          status={
            parseInt(status.status) === 0
              ? "Click to Start"
              : parseInt(status.status) < 3
              ? "Click to Assign"
              : "This Phase is Completed"
          }
          bgColor={
            parseInt(status.status) === 0
              ? "info"
              : parseInt(status.status) < 3
              ? "info"
              : "success"
          }
          icon={
            parseInt(status.status) === 0
              ? "mdi-autorenew"
              : parseInt(status.status) < 3
              ? "mdi-autorenew"
              : "mdi-check"
          }
          disabled={false}
          onClick={() => {
            setTheoryAssignStatus(3).then(() => {
              setStatus({ ...status, status: 3 });
              if (parseInt(status.status) >= 3) {
                handleFinalizeConfirmation();
              } else {
                handleFinalize();
              }
            });
          }}
        />
      </div>
      <ConfirmationModal
        show={showConfirmation}
        onHide={handleHideConfirmation}
        title={confirmationDetails.title}
        body={confirmationDetails.body}
        confirmText={confirmationDetails.confirmText}
        cancelText={confirmationDetails.cancelText}
        onConfirm={confirmationDetails.onConfirm}
        onCancel={handleHideConfirmation}
        confirmIcon={confirmationDetails.confirmIcon}
        red={confirmationDetails.red}
        green={confirmationDetails.green}
        blue={confirmationDetails.blue}
      />

      {parseInt(status.status) === 3 && (
        <div>
          <div className="card mb-4">
            <div className="card-view">
              <div className="card-control-container">
                <h4 className="card-name">
                  <div className="card-icon mdi mdi-open-in-new" />
                  Assigned Teachers
                </h4>
              </div>
              <div className="card-table-container table-responsive">
                {(status.assignment || []).length > 0 ? (
                  <table className="card-table table">
                    <thead className="card-table-header">
                      <tr>
                        <th>
                          <i className="mdi mdi-book" />
                          Course ID
                        </th>
                        <th>
                          <i className="mdi mdi-book-open-variant" />
                          Course Name
                        </th>
                        <th>
                          <i className="mdi mdi-door" />
                          Section Count
                        </th>
                        <th style={{ textAlign: "center" }}>
                          <i className="mdi mdi-clipboard-outline" />
                          Status
                        </th>
                        <th>
                          <i className="mdi mdi-account-multiple" />
                          Teachers
                        </th>
                      </tr>
                    </thead>
                    <tbody className="card-table-body">
                      {status.assignment.map((course, index) => {
                        return (
                          <tr key={index}>
                            <td>{course.course_id}</td>
                            <td>{course.name}</td>
                            <td className="text-center">
                              {course.section_count}
                            </td>
                            <td className="text-center">
                              {course.teachers ? (
                                course.teachers.length <
                                parseInt(course.section_count) ? (
                                  <i
                                    className="mdi mdi-alert-circle-outline"
                                    title="Not enough teachers assigned"
                                    style={{ color: "orange" }}
                                  />
                                ) : course.teachers.length ===
                                  parseInt(course.section_count) ? (
                                  <i
                                    className="mdi mdi-check-circle-outline"
                                    title="Teachers assigned correctly"
                                    style={{ color: "green" }}
                                  />
                                ) : (
                                  <i
                                    className="mdi mdi-close-circle-outline"
                                    title="More teachers than sections"
                                    style={{ color: "red" }}
                                  />
                                )
                              ) : (
                                <i
                                  className="mdi mdi-alert-circle-outline"
                                  title="No teachers assigned"
                                  style={{ color: "orange" }}
                                />
                              )}
                            </td>
                            <td>
                              <div className="d-flex flex-wrap align-items-center">
                                {course.teachers &&
                                  course.teachers.map((teacher) => (
                                    <div
                                      key={`${course.course_id}-${teacher.initial}`}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        background: "rgba(174, 117, 228, 0.1)",
                                        borderRadius: "4px",
                                        padding: "4px 8px",
                                        margin: "2px",
                                        border:
                                          "1px solid rgba(174, 117, 228, 0.2)",
                                      }}
                                    >
                                      <span
                                        style={{
                                          color: "#333",
                                          fontWeight: "500",
                                          marginRight: "5px",
                                        }}
                                      >
                                        {teacher.initial}
                                      </span>
                                      <button
                                        onClick={() => {
                                          const loadingToast = toast.loading(
                                            "Removing teacher..."
                                          );

                                          setTeacherAssignment({
                                            course_id: course.course_id,
                                            initial: "None",
                                            old_initial: teacher.initial,
                                          })
                                            .then(() => {
                                              handleGetStatus();
                                              getAllTheoryTeacherAssignment().then(
                                                setAllTheoryTeacherAssignment
                                              );
                                              toast.dismiss(loadingToast);
                                              toast.success(
                                                `Removed ${teacher.initial} from ${course.course_id}`
                                              );
                                            })
                                            .catch((error) => {
                                              toast.dismiss(loadingToast);
                                              toast.error(
                                                "Failed to remove teacher"
                                              );
                                              console.error(
                                                "Error removing teacher:",
                                                error
                                              );
                                            });
                                        }}
                                        style={{
                                          background: "none",
                                          border: "none",
                                          cursor: "pointer",
                                          display: "flex",
                                          padding: "2px",
                                          color: "#dc3545",
                                        }}
                                      >
                                        <i className="mdi mdi-delete-outline" />
                                      </button>
                                    </div>
                                  ))}

                                <Dropdown>
                                  <Dropdown.Toggle
                                    variant="outline-primary"
                                    id={`dropdown-${course.course_id}`}
                                    size="sm"
                                    style={{
                                      padding: "6px 12px",
                                      borderRadius: "4px",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "6px",
                                      fontSize: "0.95rem",
                                    }}
                                  >
                                    <i className="mdi mdi-plus" />
                                  </Dropdown.Toggle>

                                  <Dropdown.Menu
                                    style={{
                                      padding: "8px",
                                      borderRadius: "8px",
                                      boxShadow:
                                        "0 4px 16px rgba(0, 0, 0, 0.1)",
                                      border:
                                        "1px solid rgba(174, 117, 228, 0.2)",
                                      zIndex: 1,
                                    }}
                                  >
                                    {allTeachers
                                      .filter((teacher) => {
                                        // If course.teachers is not defined or not an array, allow all teachers
                                        if (!Array.isArray(course.teachers))
                                          return true;
                                        // Exclude teachers already assigned to this course
                                        return !course.teachers.some(
                                          (t) => t.initial === teacher.initial
                                        );
                                      })
                                      .map((teacher) => (
                                        <Dropdown.Item
                                          key={teacher.initial}
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            padding: "8px 12px",
                                            borderRadius: "4px",
                                            transition: "background 0.2s ease",
                                          }}
                                          onClick={() => {
                                            // Check if the course has already reached its section limit
                                            if (
                                              course.teachers &&
                                              course.teachers.length >=
                                                parseInt(course.section_count)
                                            ) {
                                              toast.error(
                                                `The course ${course.course_id} has been assigned more teachers than its section count`
                                              );
                                            }
                                            // Check if the teacher is already assigned to another course
                                            const isAlreadyAssigned =
                                              status.assignment.some(
                                                (c) =>
                                                  c.teachers &&
                                                  c.teachers.some(
                                                    (t) =>
                                                      t.initial ===
                                                      teacher.initial
                                                  )
                                              );
                                            if (isAlreadyAssigned) {
                                              toast.error(
                                                `${teacher.initial} is already assigned to another course`
                                              );
                                            }
                                            const loadingToast =
                                              toast.loading(
                                                "Adding teacher..."
                                              );

                                            setTeacherAssignment({
                                              course_id: course.course_id,
                                              initial: teacher.initial,
                                              old_initial: "None",
                                            })
                                              .then(() => {
                                                handleGetStatus();
                                                getAllTheoryTeacherAssignment().then(
                                                  setAllTheoryTeacherAssignment
                                                );
                                                toast.dismiss(loadingToast);
                                                toast.success(
                                                  `Added ${teacher.initial} to ${course.course_id}`
                                                );
                                              })
                                              .catch((error) => {
                                                toast.dismiss(loadingToast);
                                                toast.error(
                                                  "Failed to add teacher"
                                                );
                                                console.error(
                                                  "Error adding teacher:",
                                                  error
                                                );
                                              });
                                          }}
                                        >
                                          <span
                                            style={{
                                              flex: 1,
                                              color: "#333",
                                              fontWeight: "500",
                                            }}
                                          >
                                            {teacher.initial} - {teacher.name}
                                          </span>
                                        </Dropdown.Item>
                                      ))}
                                    {allTeachers.filter((teacher) => {
                                      if (!Array.isArray(course.teachers))
                                        return true;
                                      return !course.teachers.some(
                                        (t) => t.initial === teacher.initial
                                      );
                                    }).length === 0 && (
                                      <Dropdown.Item disabled>
                                        No available teachers
                                      </Dropdown.Item>
                                    )}
                                  </Dropdown.Menu>
                                </Dropdown>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
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
                    <h6 className="text-muted mb-2">Not Inialize Yet</h6>
                    <p
                      className="text-muted mb-0"
                      style={{ fontSize: "0.9rem" }}
                    >
                      First initialize the routine to assign teachers.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-view">
              <div className="card-control-container">
                <h4 className="card-name">
                  <div className="card-icon mdi mdi-account-multiple" />
                  Sectionwise Assigned Teachers
                </h4>
              </div>
              <div className="card-table-container table-responsive">
                {allTheoryTeacherAssignment.length === 0 ? (
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
                    <h6 className="text-muted mb-2">No Current Assignments</h6>
                    <p
                      className="text-muted mb-0"
                      style={{ fontSize: "0.9rem" }}
                    >
                      No teacher has theory course assignments yet.
                    </p>
                  </div>
                ) : (
                  <table className="card-table table">
                    <thead className="card-table-header">
                      <tr>
                        <th>
                          <i className="mdi mdi-book" />
                          Course ID
                        </th>
                        <th>
                          <i className="mdi mdi-book-open-variant" />
                          Sections
                        </th>
                        <th className="text-center">
                          <i className="mdi mdi-clipboard-outline" />
                          Status
                        </th>
                        <th>
                          <i className="mdi mdi-account-multiple" />
                          Teachers
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTheoryTeacherAssignment.map((course) =>
                        course.sections.map((section, index) => (
                          <tr key={index}>
                            {index === 0 && (
                              <td rowSpan={course.sections.length}>
                                {course.course_id}
                              </td>
                            )}
                            <td style={{ borderLeft: "1px solid #f0f0f0" }}>
                              {section.section}
                            </td>
                            <td className="text-center">
                              {section.teachers &&
                              section.teachers.length > 0 ? (
                                <i
                                  className="mdi mdi-check-circle-outline"
                                  title="Teachers assigned correctly"
                                  style={{ color: "green" }}
                                />
                              ) : (
                                <i
                                  className="mdi mdi-alert-circle-outline"
                                  title="No teachers assigned"
                                  style={{ color: "orange" }}
                                />
                              )}
                            </td>
                            <td style={{ position: "relative" }}>
                              <div className="d-flex flex-wrap align-items-center">
                                {section.teachers.map((teacher) => (
                                  <div
                                    key={`${course.course_id}-${section.section}-${teacher}`}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      background: "rgba(174, 117, 228, 0.1)",
                                      borderRadius: "4px",
                                      padding: "4px 8px",
                                      margin: "2px",
                                      border:
                                        "1px solid rgba(174, 117, 228, 0.2)",
                                    }}
                                  >
                                    <span
                                      style={{
                                        color: "#333",
                                        fontWeight: "500",
                                        marginRight: "5px",
                                      }}
                                    >
                                      {teacher}
                                    </span>
                                    <button
                                      onClick={() => {
                                        const loadingToast = toast.loading(
                                          "Removing teacher..."
                                        );

                                        deleteTheoryTeacherAssignment(
                                          course.course_id,
                                          section.section,
                                          teacher
                                        )
                                          .then(() => {
                                            getAllTheoryTeacherAssignment().then(
                                              setAllTheoryTeacherAssignment
                                            );
                                            toast.dismiss(loadingToast);
                                            toast.success(
                                              `Removed ${teacher} from ${course.course_id} section ${section.section}`
                                            );
                                          })
                                          .catch((error) => {
                                            toast.dismiss(loadingToast);
                                            toast.error(
                                              "Failed to remove teacher"
                                            );
                                            console.error(
                                              "Error removing teacher:",
                                              error
                                            );
                                          });
                                      }}
                                      style={{
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        display: "flex",
                                        padding: "2px",
                                        color: "#dc3545",
                                      }}
                                    >
                                      <Icon
                                        path={mdiDeleteOutline}
                                        size={0.7}
                                      />
                                    </button>
                                  </div>
                                ))}

                                <Dropdown style={{ marginLeft: "5px" }}>
                                  <Dropdown.Toggle
                                    variant="outline-primary"
                                    id={`dropdown-${course.course_id}-${section.section}`}
                                    size="sm"
                                    style={{
                                      padding: "6px 12px",
                                      borderRadius: "4px",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "6px",
                                      fontSize: "0.95rem",
                                    }}
                                  >
                                    <Icon path={mdiPlus} size={0.7} />
                                  </Dropdown.Toggle>

                                  <Dropdown.Menu
                                    style={{
                                      padding: "8px",
                                      borderRadius: "8px",
                                      boxShadow:
                                        "0 4px 16px rgba(0, 0, 0, 0.1)",
                                      border:
                                        "1px solid rgba(174, 117, 228, 0.2)",
                                    }}
                                  >
                                    {status.assignment
                                      .filter(
                                        (a) => a.course_id === course.course_id
                                      )
                                      .map(
                                        (assignment) =>
                                          assignment.teachers &&
                                          assignment.teachers.length > 0 &&
                                          assignment.teachers
                                            .filter(
                                              (teacher) =>
                                                !section.teachers.includes(
                                                  teacher.initial
                                                )
                                            )
                                            .map((teacher) => (
                                              <Dropdown.Item
                                                key={teacher.initial}
                                                onClick={() => {
                                                  const loadingToast =
                                                    toast.loading(
                                                      "Adding teacher..."
                                                    );

                                                  addTheoryTeacherAssignment(
                                                    course.course_id,
                                                    section.section,
                                                    teacher.initial
                                                  )
                                                    .then(() => {
                                                      getAllTheoryTeacherAssignment().then(
                                                        setAllTheoryTeacherAssignment
                                                      );
                                                      toast.dismiss(
                                                        loadingToast
                                                      );
                                                      toast.success(
                                                        `Added ${teacher.initial} to ${course.course_id} section ${section.section}`
                                                      );
                                                    })
                                                    .catch((error) => {
                                                      toast.dismiss(
                                                        loadingToast
                                                      );
                                                      toast.error(
                                                        "Failed to add teacher"
                                                      );
                                                      console.error(
                                                        "Error adding teacher:",
                                                        error
                                                      );
                                                    });
                                                }}
                                                style={{
                                                  display: "flex",
                                                  alignItems: "center",
                                                  padding: "8px 12px",
                                                  borderRadius: "4px",
                                                  transition:
                                                    "background 0.2s ease",
                                                }}
                                              >
                                                <span
                                                  style={{
                                                    flex: 1,
                                                    color: "#333",
                                                    fontWeight: "500",
                                                  }}
                                                >
                                                  {teacher.initial} -{" "}
                                                  {teacher.name}
                                                </span>
                                              </Dropdown.Item>
                                            ))
                                      )}
                                    {allTeachers.filter(
                                      (teacher) =>
                                        !section.teachers.includes(
                                          teacher.initial
                                        )
                                    ).length === 0 && (
                                      <Dropdown.Item
                                        disabled
                                        style={{ color: "#999" }}
                                      >
                                        No available teachers
                                      </Dropdown.Item>
                                    )}
                                  </Dropdown.Menu>
                                </Dropdown>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <Modal show={true} onHide={() => setShowConfirm(false)} centered>
          <Modal.Header className="modal-header">
            <Modal.Title className="modal-header-content">
              <div className="modal-header-icon mdi mdi-information"></div>
              <h4 className="modal-title">Confirm Action</h4>
            </Modal.Title>
            <button
              className="modal-header-close-button mdi mdi-close"
              onClick={() => {
                setShowConfirm(false);
              }}
            ></button>
          </Modal.Header>
          <Modal.Body className="modal-body">
            <div className="modal-body-content-container">
              Are you sure you want to proceed with <b>{confirmAction}</b> for{" "}
              <b>{selectedTeacherRow?.name}</b> ({selectedTeacherRow?.initial})?
            </div>
            <div className="modal-divider"></div>
          </Modal.Body>
          <Modal.Footer className="modal-footer">
            <button
              className="card-control-button mdi mdi-close"
              onClick={() => setShowConfirm(false)}
            >
              Cancel
            </button>
            <button
              className="card-control-button mdi mdi-reload"
              onClick={async () => {
                if (confirmAction === "Resend") {
                  try {
                    // Show loading toast
                    const loadingToast = toast.loading("Resending email...");

                    // Resend email
                    await resendTheoryPrefMail(selectedTeacherRow.initial);

                    // Refresh status data to update UI
                    const res = await getStatus();

                    // Sort the teachers in the status by seniority rank
                    let modifiedRes = { ...res };
                    if (modifiedRes.values && modifiedRes.values.length > 0) {
                      modifiedRes.values = [...modifiedRes.values].sort(
                        (a, b) => a.seniority_rank - b.seniority_rank
                      );
                    }
                    if (
                      modifiedRes.submitted &&
                      modifiedRes.submitted.length > 0
                    ) {
                      modifiedRes.submitted = [...modifiedRes.submitted].sort(
                        (a, b) => a.seniority_rank - b.seniority_rank
                      );
                    }

                    // Update the state with the new data
                    setStatus({ values: [], submitted: [], ...modifiedRes });

                    // Dismiss loading and show success
                    toast.dismiss(loadingToast);
                    toast.success("Resent email successfully");
                  } catch (err) {
                    toast.error("Failed to resend email");
                    console.error("Error resending email:", err);
                  }
                }
                setShowConfirm(false);
              }}
            >
              Confirm
            </button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
}
