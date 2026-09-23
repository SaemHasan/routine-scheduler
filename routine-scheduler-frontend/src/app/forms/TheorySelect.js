import { useEffect } from "react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { useParams } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Modal } from "react-bootstrap";
import {
  getTheoryPreferencesForm,
  submitTheoryPreferencesForm,
} from "../api/form";

export default function TheorySelect() {
  const { initial } = useParams();
  const [offeredCourse, setOfferedCourse] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [teacher, setTeacher] = useState({
    initial: "...",
    name: "Loading...",
  });

  useEffect(() => {
    getTheoryPreferencesForm(initial).then((form) => {
      setTeacher(form.teacher);
      setOfferedCourse(form.courses);
      setSelectedCourse([]);
    });
  }, [initial]);

  // Drag and drop handler
  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;

    // Reorder within Offered Courses
    if (
      source.droppableId === "offered-list" &&
      destination.droppableId === "offered-list"
    ) {
      const reordered = Array.from(offeredCourse);
      const [removed] = reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, removed);
      setOfferedCourse(reordered);
      return;
    }
    // Reorder within Your Preference
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
      const offered = Array.from(offeredCourse);
      const [moved] = offered.splice(source.index, 1);
      setOfferedCourse(offered);
      setSelectedCourse([
        ...selectedCourse.slice(0, destination.index),
        moved,
        ...selectedCourse.slice(destination.index),
      ]);
      return;
    }
    // Drag from Your Preference to Offered Courses
    if (
      source.droppableId === "preference-list" &&
      destination.droppableId === "offered-list"
    ) {
      const preference = Array.from(selectedCourse);
      const [moved] = preference.splice(source.index, 1);
      setSelectedCourse(preference);
      setOfferedCourse([
        ...offeredCourse.slice(0, destination.index),
        moved,
        ...offeredCourse.slice(destination.index),
      ]);
      return;
    }
  };

  return (
    <div className="p-4">
      {/* Modern Page Header */}
      <div className="page-header">
        <h3 className="page-title">
          <div className="page-title-icon-container mdi mdi-book-open-page-variant"></div>
          Theory Course Preference
        </h3>
        <nav aria-label="breadcrumb">
          <ol
            className="breadcrumb"
            style={{ marginBottom: "0", background: "transparent" }}
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
                Forms
              </a>
            </li>
            <li
              className="breadcrumb-item active"
              aria-current="page"
              style={{ color: "rgba(255,255,255,0.9)", fontWeight: "500" }}
            >
              Theory Selection
            </li>
          </ol>
        </nav>
      </div>

      <div className="row mb-4">
        <div className="col-12">
          <div className="card" style={{ maxHeight: "920px" }}>
            <div className="card-view">
              <div className="card-control-container">
                <h4 className="card-name">
                  <span className="card-icon mdi mdi-account-tie"></span>
                  {teacher.name} ({teacher.initial})
                </h4>
              </div>

              <form>
                <DragDropContext onDragEnd={onDragEnd}>
                  <div className="row">
                    <div className="col-5">
                      <div
                        style={{
                          padding: "16px",
                          background: "rgba(174, 117, 228, 0.05)",
                          borderRadius: "12px",
                          marginTop: "16px",
                        }}
                      >
                        <h5
                          style={{
                            color: "rgb(154, 77, 226)",
                            marginBottom: "16px",
                            fontSize: "1.1rem",
                            fontWeight: "600",
                          }}
                        >
                          Offered Courses
                        </h5>
                        <Droppable droppableId="offered-list">
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              style={{
                                minHeight: 400,
                                maxHeight: 400,
                                overflowY: "auto",
                                borderRadius: "8px",
                                background: "white",
                                padding: "8px",
                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
                                border: "1px solid rgba(154, 77, 226, 0.1)",
                              }}
                            >
                              {offeredCourse.map((course, idx) => (
                                <Draggable
                                  key={course.course_id}
                                  draggableId={course.course_id}
                                  index={idx}
                                >
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      style={{
                                        userSelect: "none",
                                        padding: "12px 16px",
                                        margin: "0 0 10px 0",
                                        background: snapshot.isDragging
                                          ? "rgba(154, 77, 226, 0.1)"
                                          : "white",
                                        borderRadius: "8px",
                                        boxShadow:
                                          "0 3px 10px rgba(0, 0, 0, 0.05)",
                                        border:
                                          "1px solid rgba(154, 77, 226, 0.2)",
                                        fontSize: "0.95rem",
                                        fontWeight: "500",
                                        color: "rgb(75, 75, 75)",
                                        transition: "all 0.2s ease",
                                        ...provided.draggableProps.style,
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                        }}
                                      >
                                        <span
                                          style={{
                                            marginRight: "10px",
                                            color: "rgb(154, 77, 226)",
                                            fontSize: "1.2rem",
                                          }}
                                        >
                                          <i className="mdi mdi-drag-horizontal-variant"></i>
                                        </span>
                                        {course.course_id} - {course.name}
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                              {offeredCourse.length === 0 && (
                                <div
                                  style={{
                                    padding: "20px",
                                    textAlign: "center",
                                    color: "#888",
                                    fontSize: "0.95rem",
                                  }}
                                >
                                  All courses have been selected
                                </div>
                              )}
                            </div>
                          )}
                        </Droppable>
                      </div>
                    </div>

                    <div className="col-2 d-flex flex-column justify-content-center align-items-center">
                      <div
                        style={{
                          height: "150px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                          alignItems: "center",
                          gap: "20px",
                        }}
                      >
                        <div style={{ textAlign: "center" }}>
                          <svg
                            width="40"
                            height="40"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M5 12H19"
                              stroke="rgba(154, 77, 226, 0.5)"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M12 5L19 12L12 19"
                              stroke="rgba(154, 77, 226, 0.5)"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>

                          <p
                            style={{
                              marginTop: "10px",
                              fontSize: "0.9rem",
                              color: "rgba(154, 77, 226, 0.7)",
                              textAlign: "center",
                              marginBottom: "0",
                            }}
                          >
                            Drag & Drop
                          </p>
                        </div>

                        <button
                          className="card-control-button mdi mdi-refresh"
                          style={{
                            background: "rgba(220, 53, 69, 0.1)",
                            borderColor: "rgba(220, 53, 69, 0.3)",
                            color: "rgb(220, 53, 69)",
                            fontSize: "0.85rem",
                            padding: "6px 12px",
                            minWidth: "80px",
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            // Move all selected courses back to offered courses
                            setOfferedCourse([
                              ...offeredCourse,
                              ...selectedCourse,
                            ]);
                            setSelectedCourse([]);
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = "rgb(220, 53, 69)";
                            e.target.style.color = "white";
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background =
                              "rgba(220, 53, 69, 0.1)";
                            e.target.style.color = "rgb(220, 53, 69)";
                          }}
                          title="Clear all selections and move courses back to offered list"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    <div className="col-5">
                      <div
                        style={{
                          padding: "16px",
                          background: "rgba(174, 117, 228, 0.05)",
                          borderRadius: "12px",
                          marginTop: "16px",
                        }}
                      >
                        <h5
                          style={{
                            color: "rgb(154, 77, 226)",
                            marginBottom: "16px",
                            fontSize: "1.1rem",
                            fontWeight: "600",
                          }}
                        >
                          Your Preference
                        </h5>
                        <Droppable droppableId="preference-list">
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              style={{
                                minHeight: 400,
                                maxHeight: 400,
                                overflowY: "auto",
                                borderRadius: "8px",
                                background: "white",
                                padding: "8px",
                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
                                border: "1px solid rgba(154, 77, 226, 0.1)",
                              }}
                            >
                              {selectedCourse.map((course, idx) => (
                                <Draggable
                                  key={course.course_id}
                                  draggableId={course.course_id}
                                  index={idx}
                                >
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      style={{
                                        userSelect: "none",
                                        padding: "12px 16px",
                                        margin: "0 0 10px 0",
                                        background: snapshot.isDragging
                                          ? "rgba(154, 77, 226, 0.1)"
                                          : "white",
                                        borderRadius: "8px",
                                        boxShadow:
                                          "0 3px 10px rgba(0, 0, 0, 0.05)",
                                        border:
                                          "1px solid rgba(154, 77, 226, 0.2)",
                                        fontSize: "0.95rem",
                                        fontWeight: "500",
                                        color: "rgb(75, 75, 75)",
                                        transition: "all 0.2s ease",
                                        ...provided.draggableProps.style,
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                        }}
                                      >
                                        <span
                                          style={{
                                            marginRight: "10px",
                                            color: "rgb(154, 77, 226)",
                                            fontSize: "1.2rem",
                                          }}
                                        >
                                          <i className="mdi mdi-drag-horizontal-variant"></i>
                                        </span>
                                        <div>
                                          <strong
                                            style={{
                                              color: "rgb(154, 77, 226)",
                                            }}
                                          >
                                            {idx + 1}.{" "}
                                          </strong>
                                          {course.course_id} - {course.name}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                              {selectedCourse.length === 0 && (
                                <div
                                  style={{
                                    padding: "20px",
                                    textAlign: "center",
                                    color: "#888",
                                    fontSize: "0.95rem",
                                  }}
                                >
                                  Drag courses here to set your preferences
                                </div>
                              )}
                            </div>
                          )}
                        </Droppable>
                      </div>
                    </div>
                  </div>
                </DragDropContext>

                <div
                  style={{
                    padding: "16px",
                    background: "rgba(174, 117, 228, 0.08)",
                    borderRadius: "16px",
                    marginTop: "24px",
                    boxShadow: "0 4px 20px rgba(174, 117, 228, 0.1)",
                  }}
                >
                  {/* Information Note */}
                  <div
                    style={{
                      background: "#fff",
                      borderRadius: "12px",
                      padding: "16px",
                      marginBottom: "16px",
                      border: "1px solid rgba(174, 117, 228, 0.15)",
                      boxShadow: "0 6px 16px rgba(174, 117, 228, 0.08)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "16px",
                      }}
                    >
                      <div
                        style={{
                          background: "rgb(255, 193, 7)",
                          borderRadius: "50%",
                          width: "40px",
                          height: "40px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          boxShadow: "0 4px 12px rgba(255, 193, 7, 0.3)",
                        }}
                      >
                        <i
                          className="mdi mdi-lightbulb-outline"
                          style={{
                            color: "white",
                            fontSize: "20px",
                          }}
                        ></i>
                      </div>
                      <div style={{ flex: 1 }}>
                        <h6
                          style={{
                            color: "rgb(255, 152, 0)",
                            fontWeight: "700",
                            fontSize: "1.1rem",
                            marginBottom: "8px",
                            letterSpacing: "0.3px",
                          }}
                        >
                          Automatic Preference Completion
                        </h6>
                        <p
                          style={{
                            margin: 0,
                            color: "#555",
                            fontSize: "0.95rem",
                            lineHeight: "1.6",
                          }}
                        >
                          When you click <strong>Submit</strong>, any courses
                          remaining in the "Offered Courses" section will
                          automatically be added to your preference list in
                          their current order, positioned
                          <strong> after</strong> your manually selected
                          preferences.
                        </p>
                        <div
                          style={{
                            marginTop: "12px",
                            padding: "12px",
                            background: "rgba(255, 193, 7, 0.1)",
                            borderRadius: "8px",
                            border: "1px solid rgba(255, 193, 7, 0.2)",
                          }}
                        >
                          <p
                            style={{
                              margin: 0,
                              fontSize: "0.9rem",
                              color: "#666",
                              fontStyle: "italic",
                            }}
                          >
                            <strong>Example:</strong> If you select 3 courses
                            and leave 5 unselected, your final preference will
                            include all 8 courses with your 3 selections ranked
                            highest.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "16px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        color: "rgb(174, 117, 228)",
                        fontSize: "0.9rem",
                        fontWeight: "500",
                      }}
                    >
                      <i className="mdi mdi-clipboard-list-outline"></i>
                      <span>
                        Selected: {selectedCourse.length} courses | Remaining:{" "}
                        {offeredCourse.length}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "12px" }}>
                      <button
                        className="card-control-button mdi mdi-close"
                        onClick={(e) => {
                          e.preventDefault();
                          window.close();
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="card-control-button mdi mdi-check-circle"
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedCourse([
                            ...selectedCourse,
                            ...offeredCourse,
                          ]);
                          setOfferedCourse([]);
                          setShowConfirm(true);
                        }}
                      >
                        {"Submit"}
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              {/* Confirm Modal with updated styling */}
              <Modal
                show={showConfirm}
                onHide={() => setShowConfirm(false)}
                centered
                contentClassName="modal-content"
              >
                <Modal.Header className="modeal-header">
                  <Modal.Title className="modal-header-content">
                    <i className="modal-header-icon mdi mdi-alert-circle-outline me-2"></i>
                    <h4 className="modal-title">Confirm Submission</h4>
                  </Modal.Title>
                  <button
                    className="modal-header-close-button mdi mdi-close"
                    onClick={() => {
                      setShowConfirm(false);
                    }}
                  ></button>
                </Modal.Header>
                <Modal.Body style={{ padding: "20px" }}>
                  <p style={{ fontSize: "1rem" }}>
                    Are you sure you want to submit your preferences? This
                    action cannot be undone.
                  </p>
                  <div
                    style={{
                      marginTop: "10px",
                      background: "rgba(154, 77, 226, 0.05)",
                      padding: "15px",
                      borderRadius: "8px",
                    }}
                  >
                    <strong style={{ color: "rgb(154, 77, 226)" }}>
                      Selected Preferences:
                    </strong>
                    <ul style={{ marginTop: "10px", marginBottom: "0" }}>
                      {selectedCourse.slice(0, 5).map((course, idx) => (
                        <li
                          key={course.course_id}
                          style={{ marginBottom: "5px" }}
                        >
                          {idx + 1}. {course.course_id} - {course.name}
                        </li>
                      ))}
                      {selectedCourse.length > 5 && (
                        <li>... and {selectedCourse.length - 5} more</li>
                      )}
                      {selectedCourse.length === 0 && (
                        <li style={{ color: "#888" }}>No courses selected</li>
                      )}
                    </ul>
                  </div>
                </Modal.Body>
                <Modal.Footer className="modal-footer">
                  <button
                    className="card-control-button"
                    onClick={() => setShowConfirm(false)}
                  >
                    <i className="mdi mdi-close-circle me-1"></i> Cancel
                  </button>
                  <button
                    className="card-control-button"
                    onClick={() => {
                      setShowConfirm(false);
                      const preferences = selectedCourse.map(
                        (course) => course.course_id
                      );
                      submitTheoryPreferencesForm(initial, { preferences })
                        .then((res) => {
                          toast.success("Preferences saved successfully");
                          setTimeout(() => {
                            window.close();
                          }, 1500);
                        })
                        .catch(console.log);
                    }}
                  >
                    <i className="mdi mdi-check-circle me-1"></i> Submit
                  </button>
                </Modal.Footer>
              </Modal>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
