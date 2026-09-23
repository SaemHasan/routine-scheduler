import { useEffect } from "react";
import { useState } from "react";
import { Modal } from "react-bootstrap";
import { Form, Row, Col, FormControl, FormGroup } from "react-bootstrap";
import { toast } from "react-hot-toast";
import {
  createTeacher,
  deleteTeacher,
  getTeachers,
  reorderTeachers,
  updateTeacher,
} from "../api/db-crud";
import ConfirmationModal from "../shared/ConfirmationModal";
import CreatableSelect from "react-select/creatable";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const initial_regex = /^[A-Z]{2,6}$/;
const email_regex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/;

const validate = (teacher) => {
  if (teacher.initial === "") {
    return "Initial cannot be empty";
  }
  if (teacher.name === "") {
    return "Name cannot be empty";
  }
  if (teacher.surname === "") {
    return "Surname cannot be empty";
  }
  if (teacher.email === "") {
    return "Email cannot be empty";
  }
  if (teacher.seniority_rank === "") {
    return "Seniority Rank cannot be empty";
  }
  if (teacher.theory_courses === "") {
    return "Theory Courses cannot be empty";
  }
  if (teacher.sessional_courses === "") {
    return "Sessional Courses cannot be empty";
  }
  if (!email_regex.test(teacher.email)) {
    return "Invalid email";
  }
  if (!initial_regex.test(teacher.initial)) {
    return "Invalid initial";
  }
  return null;
};

// Teachers with a doctorate supervise Thesis 1 by default.
const hasDoctorate = (name) => /(^|\s)Dr\./i.test(name || "");

// Credit hours a teacher takes on by default, by designation.
const DEFAULT_CREDITS = {
  Professor: 15,
  "Associate Professor": 15,
  "Assistant Professor": 18,
  Lecturer: 21,
};

const DESIGNATION_SUGGESTIONS = [
  { value: "Professor", label: "Professor" },
  { value: "Associate Professor", label: "Associate Professor" },
  { value: "Assistant Professor", label: "Assistant Professor" },
  { value: "Lecturer", label: "Lecturer" },
  { value: "Adjunct Lecturer", label: "Adjunct Lecturer" },
];

export default function Teachers() {
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  // Once Thesis 1 is toggled by hand, the name no longer decides it.
  const [thesis1Touched, setThesis1Touched] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [showMapCredit, setShowMapCredit] = useState(false);
  const [mapDesignation, setMapDesignation] = useState("");
  const [mapCredit, setMapCredit] = useState("");
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

  // Effect to fetch and sort teachers on component mount
  useEffect(() => {
    getTeachers().then((res) => {
      const sortedTeachers = [...res].sort(
        (a, b) => a.seniority_rank - b.seniority_rank
      );
      setTeachers(sortedTeachers);
    });
  }, []);

  // Handler for Map Credit Apply
  const handleMapCreditApply = () => {
    if (!mapDesignation.trim() || !mapCredit || isNaN(mapCredit)) {
      toast.error("Please enter a valid designation and credit hour");
      return;
    }

    // Find all teachers with the matching designation
    const teachersToUpdate = teachers.filter(
      (t) =>
        t.designation?.toLowerCase() === mapDesignation.trim().toLowerCase()
    );

    if (teachersToUpdate.length === 0) {
      toast.error(`No teachers found with designation '${mapDesignation}'`);
      return;
    }

    // Update local state first
    setTeachers((prev) =>
      prev.map((t) =>
        t.designation?.toLowerCase() === mapDesignation.trim().toLowerCase()
          ? { ...t, teacher_credits_offered: Number(mapCredit) }
          : t
      )
    );

    // Save each teacher to the database
    const updatePromises = teachersToUpdate.map((teacher) =>
      updateTeacher(teacher.initial, {
        ...teacher,
        teacher_credits_offered: Number(mapCredit),
      })
    );

    // Wait for all updates to complete
    Promise.all(updatePromises)
      .then(() => {
        setShowMapCredit(false);
        setMapDesignation("");
        setMapCredit("");
        toast.success(
          `Updated credit hours for all '${mapDesignation}' teachers`
        );
      })
      .catch((error) => {
        console.error("Error updating teachers:", error);
        toast.error("Failed to update some teachers. Please try again.");
      });
  };

  const handleDeleteTeacher = (initial) => {
    handleShowConfirmation(
      "Delete Teacher",
      `Are you sure you want to delete ${initial}?`,
      "Delete",
      "Cancel",
      async () => {
        deleteTeacher(initial)
          .then((res) => {
            getTeachers().then((updated) => {
              setTeachers(
                updated.sort((a, b) => a.seniority_rank - b.seniority_rank)
              );
              toast.success("Teacher deleted successfully");
            });
          })
          .catch((error) => {
            toast.error("Failed to delete teacher");
          });
      },
      "mdi-delete",
      220,
      53,
      69
    );
  };

  const reloadTeachers = () =>
    getTeachers().then((updated) =>
      setTeachers(updated.sort((a, b) => a.seniority_rank - b.seniority_rank))
    );

  // Saves a new seniority order; the list's position becomes each rank.
  const applyOrder = (ordered) => {
    const previous = teachers;
    setTeachers(
      ordered.map((teacher, index) => ({
        ...teacher,
        seniority_rank: index + 1,
      }))
    );
    setSavingOrder(true);
    reorderTeachers(ordered.map((teacher) => teacher.initial))
      .then(() => toast.success("Seniority updated"))
      .catch((error) => {
        setTeachers(previous);
        toast.error(
          error?.response?.data?.error?.message || "Failed to update seniority"
        );
      })
      .finally(() => setSavingOrder(false));
  };

  const moveTeacher = (from, to) => {
    if (to < 0 || to >= teachers.length || from === to) return;
    const ordered = [...teachers];
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    applyOrder(ordered);
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    moveTeacher(result.source.index, result.destination.index);
  };

  return (
    <div>
      {/* Modern Page Header */}
      <div className="page-header">
        <h3 className="page-title">
          <div className="page-title-icon-container mdi mdi-account-multiple"></div>
          Teacher Information
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
                Information
              </a>
            </li>
            <li
              className="breadcrumb-item active"
              aria-current="page"
              style={{ color: "rgba(255,255,255,0.9)", fontWeight: "500" }}
            >
              Teachers
            </li>
          </ol>
        </nav>
      </div>
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-view">
              <div className="card-control-container">
                <h4 className="card-name">
                  <div className="card-icon mdi mdi-account-multiple"></div>
                  Teacher Management
                </h4>
                <div className="card-control-button-container">
                  <button
                    className="card-control-button mdi mdi-map-marker"
                    onClick={() => setShowMapCredit(true)}
                  >
                    Map Credit
                  </button>
                  <button
                    className="card-control-button mdi mdi-plus-circle"
                    onClick={(e) => {
                      setThesis1Touched(false);
                      setSelectedTeacher({
                        initial: "",
                        name: "",
                        surname: "",
                        email: "",
                        seniority_rank: 0,
                        active: 1,
                        theory_courses: 0,
                        sessional_courses: 0,
                        designation: "",
                        full_time_status: false,
                        offers_thesis_1: false,
                        offers_thesis_2: false,
                        offers_msc: false,
                        teacher_credits_offered: 0,
                        prev_initial: "",
                      });
                    }}
                  >
                    Add New Teacher
                  </button>
                </div>
              </div>
              <div className="card-table-container table-responsive">
                <table className="card-table table">
                  <thead className="card-table-header">
                    <tr>
                      <th className="sticky-col">
                        <i className="mdi mdi-account"></i>Initial
                      </th>
                      <th>
                        <i className="mdi mdi-account-multiple"></i>Name
                      </th>
                      <th>
                        <i className="mdi mdi-account-multiple-outline"></i>
                        Surname
                      </th>
                      <th>
                        <i className="mdi mdi-email-outline"></i>Email
                      </th>
                      <th>
                        <i className="mdi mdi-format-list-numbered"></i>
                        Seniority Rank
                      </th>
                      <th>
                        <i className="mdi mdi-check-circle-outline"></i>
                        Active
                      </th>
                      <th>
                        <i className="mdi mdi-account-tie"></i>
                        Designation
                      </th>
                      <th>
                        <i className="mdi mdi-account-check"></i>
                        Full Time Status
                      </th>
                      <th>
                        <i className="mdi mdi-book-open-page-variant"></i>
                        Offer Thesis 1
                      </th>
                      <th>
                        <i className="mdi mdi-book-open-page-variant"></i>
                        Offer Thesis 2
                      </th>
                      <th>
                        <i className="mdi mdi-book-open-page-variant"></i>
                        Offer MSC
                      </th>
                      <th>
                        <i className="mdi mdi-clock"></i>
                        Credits Offered
                      </th>
                      <th>
                        <i className="mdi mdi-cog"></i> Action
                      </th>
                    </tr>
                  </thead>
                  <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="teacher-seniority">
                    {(dropProvided) => (
                  <tbody
                    className="card-table-body"
                    ref={dropProvided.innerRef}
                    {...dropProvided.droppableProps}
                  >
                    {teachers.map((teacher, idx) => (
                      <Draggable
                        key={teacher.initial}
                        draggableId={teacher.initial}
                        index={idx}
                        isDragDisabled={savingOrder}
                      >
                        {(dragProvided, snapshot) => (
                      <tr
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        style={{
                          ...dragProvided.draggableProps.style,
                          background: snapshot.isDragging
                            ? "rgba(174, 117, 228, 0.12)"
                            : undefined,
                        }}
                      >
                        <td className="sticky-col">{teacher.initial}</td>
                        <td>
                          <input
                            type="text"
                            className="form-input"
                            style={{ minWidth: "240px" }}
                            value={teacher.name}
                            onChange={(e) => {
                              const newTeachers = [...teachers];
                              newTeachers[idx].name = e.target.value;
                              setTeachers(newTeachers);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                updateTeacher(
                                  teacher.prev_initial || teacher.initial,
                                  {
                                    ...teacher,
                                    name: e.target.value,
                                  }
                                )
                                  .then(() =>
                                    toast.success(
                                      "Teacher updated successfully"
                                    )
                                  )
                                  .catch((error) => {
                                    toast.error("Failed to update teacher");
                                  });
                              }
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-input"
                            style={{ minWidth: "100px" }}
                            value={teacher.surname}
                            onChange={(e) => {
                              const newTeachers = [...teachers];
                              newTeachers[idx].surname = e.target.value;
                              setTeachers(newTeachers);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                updateTeacher(
                                  teacher.prev_initial || teacher.initial,
                                  {
                                    ...teacher,
                                    surname: e.target.value,
                                  }
                                )
                                  .then(() =>
                                    toast.success(
                                      "Teacher updated successfully"
                                    )
                                  )
                                  .catch((error) => {
                                    toast.error("Failed to update teacher");
                                  });
                              }
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-input"
                            style={{ minWidth: "280px" }}
                            value={teacher.email}
                            onChange={(e) => {
                              const newTeachers = [...teachers];
                              newTeachers[idx].email = e.target.value;
                              setTeachers(newTeachers);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                updateTeacher(
                                  teacher.prev_initial || teacher.initial,
                                  {
                                    ...teacher,
                                    email: e.target.value,
                                  }
                                )
                                  .then(() =>
                                    toast.success(
                                      "Teacher updated successfully"
                                    )
                                  )
                                  .catch((error) => {
                                    toast.error("Failed to update teacher");
                                  });
                              }
                            }}
                          />
                        </td>
                        <td>
                          <div
                            className="d-flex align-items-center"
                            style={{ gap: "6px", whiteSpace: "nowrap" }}
                          >
                            <span
                              {...dragProvided.dragHandleProps}
                              className="mdi mdi-drag"
                              title="Drag to change seniority"
                              style={{ fontSize: "20px", cursor: "grab" }}
                            ></span>
                            <span style={{ minWidth: "24px", fontWeight: 600 }}>
                              {teacher.seniority_rank}
                            </span>
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-0 mdi mdi-arrow-up-bold"
                              title="Move up (more senior)"
                              disabled={savingOrder || idx === 0}
                              onClick={() => moveTeacher(idx, idx - 1)}
                            ></button>
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-0 mdi mdi-arrow-down-bold"
                              title="Move down (less senior)"
                              disabled={
                                savingOrder || idx === teachers.length - 1
                              }
                              onClick={() => moveTeacher(idx, idx + 1)}
                            ></button>
                          </div>
                        </td>
                        <td>
                          <div
                            className={`custom-checkbox ${
                              teacher.active === 1 || teacher.active === true
                                ? "checked mdi mdi-check"
                                : "unchecked"
                            }`}
                            onClick={(e) => {
                              const newChecked = !(
                                teacher.active === 1 || teacher.active === true
                              );
                              const newTeachers = [...teachers];
                              newTeachers[idx].active = newChecked ? 1 : 0;
                              setTeachers(newTeachers);
                              updateTeacher(
                                teacher.prev_initial || teacher.initial,
                                {
                                  ...teacher,
                                  active: newChecked ? 1 : 0,
                                }
                              )
                                .then(() =>
                                  toast.success("Teacher updated successfully")
                                )
                                .catch((error) => {
                                  toast.error("Failed to update teacher");
                                });
                            }}
                          ></div>
                        </td>
                        <td>
                          <CreatableSelect
                            styles={{
                              control: (provided) => ({
                                ...provided,
                                width: "100%",
                                minWidth: "200px",
                                borderRadius: "12px",
                                border: "1.5px solid rgba(194, 137, 248, 0.3)",
                                boxShadow:
                                  "0 2px 5px rgba(194, 137, 248, 0.05)",
                                backgroundColor: "white",
                                fontSize: "15px",
                                transition: "all 0.3s ease",
                                "&:hover": {
                                  borderColor: "rgb(154, 77, 226)",
                                },
                              }),
                            }}
                            value={{
                              value: teacher.designation,
                              label: teacher.designation,
                            }}
                            onChange={(e) => {
                              const newTeachers = [...teachers];
                              newTeachers[idx].designation = e.value;
                              setTeachers(newTeachers);
                              updateTeacher(
                                teacher.prev_initial || teacher.initial,
                                {
                                  ...teacher,
                                  designation: e.value,
                                }
                              )
                                .then(() =>
                                  toast.success("Teacher updated successfully")
                                )
                                .catch((error) => {
                                  toast.error("Failed to update teacher");
                                });
                            }}
                            options={DESIGNATION_SUGGESTIONS}
                            placeholder="Select or create a designation (e.g., Lecturer)"
                            formatCreateLabel={(inputValue) =>
                              `Create "${inputValue}"`
                            }
                          />
                        </td>
                        <td>
                          <div
                            className={`custom-checkbox ${
                              teacher.full_time_status
                                ? "checked mdi mdi-check"
                                : "unchecked"
                            }`}
                            onClick={(e) => {
                              const newChecked = !teacher.full_time_status;
                              const newTeachers = [...teachers];
                              newTeachers[idx].full_time_status = newChecked;
                              setTeachers(newTeachers);
                              updateTeacher(
                                teacher.prev_initial || teacher.initial,
                                {
                                  ...teacher,
                                  full_time_status: newChecked,
                                }
                              )
                                .then(() =>
                                  toast.success("Teacher updated successfully")
                                )
                                .catch((error) => {
                                  toast.error("Failed to update teacher");
                                });
                            }}
                          ></div>
                        </td>
                        <td>
                          <div
                            className={`custom-checkbox ${
                              teacher.offers_thesis_1
                                ? "checked mdi mdi-check"
                                : "unchecked"
                            }`}
                            onClick={(e) => {
                              const newChecked = !teacher.offers_thesis_1;
                              const newTeachers = [...teachers];
                              newTeachers[idx].offers_thesis_1 = newChecked;
                              setTeachers(newTeachers);
                              updateTeacher(
                                teacher.prev_initial || teacher.initial,
                                {
                                  ...teacher,
                                  offers_thesis_1: newChecked,
                                }
                              )
                                .then(() =>
                                  toast.success("Teacher updated successfully")
                                )
                                .catch((error) => {
                                  toast.error("Failed to update teacher");
                                });
                            }}
                          ></div>
                        </td>
                        <td>
                          <div
                            className={`custom-checkbox ${
                              teacher.offers_thesis_2
                                ? "checked mdi mdi-check"
                                : "unchecked"
                            }`}
                            onClick={(e) => {
                              const newChecked = !teacher.offers_thesis_2;
                              const newTeachers = [...teachers];
                              newTeachers[idx].offers_thesis_2 = newChecked;
                              setTeachers(newTeachers);
                              updateTeacher(
                                teacher.prev_initial || teacher.initial,
                                {
                                  ...teacher,
                                  offers_thesis_2: newChecked,
                                }
                              )
                                .then(() =>
                                  toast.success("Teacher updated successfully")
                                )
                                .catch((error) => {
                                  toast.error("Failed to update teacher");
                                });
                            }}
                          ></div>
                        </td>
                        <td>
                          <div
                            className={`custom-checkbox ${
                              teacher.offers_msc
                                ? "checked mdi mdi-check"
                                : "unchecked"
                            }`}
                            onClick={(e) => {
                              const newChecked = !teacher.offers_msc;
                              const newTeachers = [...teachers];
                              newTeachers[idx].offers_msc = newChecked;
                              setTeachers(newTeachers);
                              updateTeacher(
                                teacher.prev_initial || teacher.initial,
                                {
                                  ...teacher,
                                  offers_msc: newChecked,
                                }
                              )
                                .then(() =>
                                  toast.success("Teacher updated successfully")
                                )
                                .catch((error) => {
                                  toast.error("Failed to update teacher");
                                });
                            }}
                          ></div>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input"
                            value={teacher.teacher_credits_offered}
                            onChange={(e) => {
                              const newTeachers = [...teachers];
                              newTeachers[idx].teacher_credits_offered = Number(
                                e.target.value
                              );
                              setTeachers(newTeachers);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                updateTeacher(
                                  teacher.prev_initial || teacher.initial,
                                  {
                                    ...teacher,
                                    teacher_credits_offered: Number(
                                      e.target.value
                                    ),
                                  }
                                )
                                  .then(() =>
                                    toast.success(
                                      "Teacher updated successfully"
                                    )
                                  )
                                  .catch((error) => {
                                    toast.error("Failed to update teacher");
                                  });
                              }
                            }}
                          />
                        </td>
                        <td>
                          <div className="d-flex">
                            <button
                              className="edit mdi mdi-pencil"
                              title="Edit teacher"
                              onClick={() => {
                                setThesis1Touched(true);
                                setSelectedTeacher({
                                  ...teacher,
                                  prev_initial: teacher.initial,
                                });
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="delete mdi mdi-delete-outline"
                              onClick={() => {
                                handleDeleteTeacher(teacher.initial);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                        )}
                      </Draggable>
                    ))}
                    {dropProvided.placeholder}
                  </tbody>
                    )}
                  </Droppable>
                  </DragDropContext>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Map Credit Modal */}
      <Modal
        show={showMapCredit}
        onHide={() => setShowMapCredit(false)}
        centered
        contentClassName="modal-content"
        backdrop="static"
      >
        <Modal.Header className="modeal-header">
          <Modal.Title className="modal-header-content">
            <div className="modal-header-icon mdi mdi-cash-multiple"></div>
            <h4 className="modal-title">Map Credit by Designation</h4>
          </Modal.Title>
          <button
            className="modal-header-close-button mdi mdi-close"
            onClick={() => {
              setShowMapCredit(false);
              setMapDesignation("");
              setMapCredit("");
            }}
          ></button>
        </Modal.Header>
        <Modal.Body className="modal-body">
          <div className="modal-body-content-container">
            <Form>
              <FormGroup>
                <Form.Label className="form-label">Designation</Form.Label>
                <CreatableSelect
                  styles={{
                    control: (provided) => ({
                      ...provided,
                      width: "100%",
                      borderRadius: "12px",
                      border: "1.5px solid rgba(194, 137, 248, 0.3)",
                      boxShadow: "0 2px 5px rgba(194, 137, 248, 0.05)",
                      backgroundColor: "white",
                      padding: "5px 2px",
                      fontSize: "15px",
                      transition: "all 0.3s ease",
                      "&:hover": {
                        borderColor: "rgb(154, 77, 226)",
                      },
                    }),
                  }}
                  onChange={(e) => {
                    if (!e) {
                      setMapDesignation("");
                    } else {
                      setMapDesignation(e.value);
                    }
                  }}
                  options={DESIGNATION_SUGGESTIONS}
                  placeholder="Select or create a designation (e.g., Lecturer)"
                  isClearable
                  formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
                />
              </FormGroup>
              <FormGroup className="mt-3">
                <Form.Label className="form-label">Credit Hour</Form.Label>
                <FormControl
                  type="number"
                  className="form-control"
                  value={mapCredit}
                  onChange={(e) => setMapCredit(e.target.value)}
                  placeholder="Enter credit hour"
                />
              </FormGroup>
            </Form>
          </div>
          <div className="modal-divider"></div>
        </Modal.Body>
        <Modal.Footer className="modal-footer">
          <button
            className="card-control-button mdi mdi-close"
            onClick={() => {
              setShowMapCredit(false);
              setMapDesignation("");
              setMapCredit("");
            }}
          >
            Cancel
          </button>
          <button
            className="card-control-button mdi mdi-content-save"
            onClick={handleMapCreditApply}
          >
            Apply
          </button>
        </Modal.Footer>
      </Modal>

      {selectedTeacher !== null && (
        <Modal
          show={true}
          onHide={() => setSelectedTeacher(null)}
          size="md"
          centered
          contentClassName="modal-content"
          backdrop="static"
        >
          <Modal.Header className="modal-header">
            <Modal.Title className="modal-header-content">
              <div className="modal-header-icon">
                <i className="mdi mdi-account-plus-outline"></i>
              </div>
              <h4 className="modal-title">
                {selectedTeacher.prev_initial === "" ? "Add" : "Edit"} Teacher
              </h4>
            </Modal.Title>
            <button
              className="modal-header-close-button mdi mdi-close"
              onClick={() => {
                setSelectedTeacher(null);
              }}
            ></button>
          </Modal.Header>
          <Modal.Body className="modal-body">
            <div className="modal-body-content-container">
              <Form>
                <Row>
                  <Col md={4} className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">Initial</Form.Label>
                      <FormControl
                        type="text"
                        className="form-control"
                        placeholder="Enter Initial"
                        value={selectedTeacher.initial}
                        onChange={(e) =>
                          setSelectedTeacher({
                            ...selectedTeacher,
                            initial: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </FormGroup>
                  </Col>
                  <Col className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">Name</Form.Label>
                      <FormControl
                        type="text"
                        className="form-control"
                        placeholder="Enter Name"
                        value={selectedTeacher.name}
                        onChange={(e) =>
                          setSelectedTeacher({
                            ...selectedTeacher,
                            name: e.target.value,
                            offers_thesis_1: thesis1Touched
                              ? selectedTeacher.offers_thesis_1
                              : hasDoctorate(e.target.value),
                          })
                        }
                      />
                    </FormGroup>
                  </Col>
                </Row>
                <Row>
                  <Col md={4} className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">Surname</Form.Label>
                      <FormControl
                        type="text"
                        className="form-control"
                        placeholder="Enter Surname"
                        value={selectedTeacher.surname}
                        onChange={(e) =>
                          setSelectedTeacher({
                            ...selectedTeacher,
                            surname: e.target.value,
                          })
                        }
                      />
                    </FormGroup>
                  </Col>
                  <Col className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">Email</Form.Label>
                      <FormControl
                        type="text"
                        className="form-control"
                        placeholder="Enter Email"
                        value={selectedTeacher.email}
                        onChange={(e) =>
                          setSelectedTeacher({
                            ...selectedTeacher,
                            email: e.target.value,
                          })
                        }
                      />
                    </FormGroup>
                  </Col>
                </Row>
                <Row>
                  <Col className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">
                        Designation
                      </Form.Label>
                      <CreatableSelect
                        styles={{
                          control: (provided) => ({
                            ...provided,
                            width: "100%",
                            borderRadius: "12px",
                            border: "1.5px solid rgba(194, 137, 248, 0.3)",
                            boxShadow: "0 2px 5px rgba(194, 137, 248, 0.05)",
                            backgroundColor: "white",
                            padding: "5px 2px",
                            fontSize: "15px",
                            transition: "all 0.3s ease",
                            "&:hover": {
                              borderColor: "rgb(154, 77, 226)",
                            },
                          }),
                        }}
                        value={
                          selectedTeacher.designation
                            ? {
                                value: selectedTeacher.designation,
                                label: selectedTeacher.designation,
                              }
                            : null
                        }
                        onChange={(e) => {
                          if (!e) return;
                          const isNew = selectedTeacher.prev_initial === "";
                          setSelectedTeacher({
                            ...selectedTeacher,
                            designation: e.value,
                            // A new teacher starts with the usual credit hours
                            // for the designation; it can still be changed.
                            teacher_credits_offered:
                              isNew && DEFAULT_CREDITS[e.value] !== undefined
                                ? DEFAULT_CREDITS[e.value]
                                : selectedTeacher.teacher_credits_offered,
                          });
                        }}
                        options={DESIGNATION_SUGGESTIONS}
                        placeholder="Select or create a designation (e.g., Lecturer)"
                        isClearable
                        formatCreateLabel={(inputValue) =>
                          `Create "${inputValue}"`
                        }
                      />
                    </FormGroup>
                  </Col>
                </Row>
                <Row>
                  <Col md={6} className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">
                        Seniority Rank
                      </Form.Label>
                      <FormControl
                        type="text"
                        className="form-control"
                        placeholder="Enter Seniority Rank"
                        value={selectedTeacher.seniority_rank}
                        // An existing teacher is moved with drag-and-drop or
                        // the arrows in the table, which keep ranks gap-free.
                        disabled={selectedTeacher.prev_initial !== ""}
                        title={
                          selectedTeacher.prev_initial !== ""
                            ? "Drag the row or use the arrows in the table to change seniority"
                            : undefined
                        }
                        onChange={(e) =>
                          setSelectedTeacher({
                            ...selectedTeacher,
                            seniority_rank: Number.parseInt(
                              e.target.value || "0"
                            ),
                          })
                        }
                      />
                    </FormGroup>
                  </Col>
                  <Col md={6} className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">
                        Teacher Credits Offered
                      </Form.Label>
                      <FormControl
                        type="text"
                        className="form-control"
                        placeholder="Enter credits"
                        value={selectedTeacher.teacher_credits_offered}
                        onChange={(e) =>
                          setSelectedTeacher({
                            ...selectedTeacher,
                            teacher_credits_offered:
                              Number(e.target.value) || 0,
                          })
                        }
                      />
                    </FormGroup>
                  </Col>
                </Row>
                <Row>
                  <Col className="px-2 py-1 d-flex align-items-center">
                    <div
                      className={`custom-checkbox ${
                        selectedTeacher.full_time_status
                          ? "checked mdi mdi-check"
                          : "unchecked"
                      }`}
                      onClick={(e) => {
                        setSelectedTeacher({
                          ...selectedTeacher,
                          full_time_status: !selectedTeacher.full_time_status,
                        });
                      }}
                    ></div>
                    <span className="custom-checkbox-label">
                      Full Time Status:
                    </span>
                    <span>
                      {selectedTeacher.full_time_status
                        ? "FULL TIME"
                        : "PART TIME"}
                    </span>
                  </Col>
                </Row>
                <Row>
                  <Col className="px-2 py-1 d-flex align-items-center">
                    <div
                      className={`custom-checkbox ${
                        selectedTeacher.offers_thesis_1
                          ? "checked mdi mdi-check"
                          : "unchecked"
                      }`}
                      onClick={(e) => {
                        setThesis1Touched(true);
                        setSelectedTeacher({
                          ...selectedTeacher,
                          offers_thesis_1: !selectedTeacher.offers_thesis_1,
                        });
                      }}
                    ></div>
                    <span className="custom-checkbox-label">
                      Offer Thesis 1:
                    </span>
                    <span>
                      {selectedTeacher.offers_thesis_1 ? "YES" : "NO"}
                    </span>
                  </Col>
                  <Col className="px-2 py-1 d-flex align-items-center">
                    <div
                      className={`custom-checkbox ${
                        selectedTeacher.offers_thesis_2
                          ? "checked mdi mdi-check"
                          : "unchecked"
                      }`}
                      onClick={(e) => {
                        setSelectedTeacher({
                          ...selectedTeacher,
                          offers_thesis_2: !selectedTeacher.offers_thesis_2,
                        });
                      }}
                    ></div>
                    <span className="custom-checkbox-label">
                      Offer Thesis 2:
                    </span>
                    <span>
                      {selectedTeacher.offers_thesis_2 ? "YES" : "NO"}
                    </span>
                  </Col>
                </Row>
                <Row>
                  <Col className="px-2 py-1 d-flex align-items-center">
                    <div
                      className={`custom-checkbox ${
                        selectedTeacher.offers_msc
                          ? "checked mdi mdi-check"
                          : "unchecked"
                      }`}
                      onClick={(e) => {
                        setSelectedTeacher({
                          ...selectedTeacher,
                          offers_msc: !selectedTeacher.offers_msc,
                        });
                      }}
                    ></div>
                    <span className="custom-checkbox-label">Offer MSc:</span>
                    <span>{selectedTeacher.offers_msc ? "YES" : "NO"}</span>
                  </Col>
                  <Col className="px-2 py-1 d-flex align-items-center">
                    <div
                      className={`custom-checkbox ${
                        selectedTeacher.active
                          ? "checked mdi mdi-check"
                          : "unchecked"
                      }`}
                      onClick={(e) => {
                        setSelectedTeacher({
                          ...selectedTeacher,
                          active: selectedTeacher.active ? 0 : 1,
                        });
                      }}
                    ></div>
                    <span className="custom-checkbox-label">
                      {selectedTeacher.active ? "ACTIVE" : "INACTIVE"}
                    </span>
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
                setSelectedTeacher(null);
              }}
            >
              Close
            </button>
            <button
              className="card-control-button mdi mdi-content-save"
              onClick={(e) => {
                e.preventDefault();
                const result = validate(selectedTeacher);
                if (result === null) {
                  if (selectedTeacher.prev_initial === "") {
                    createTeacher(selectedTeacher)
                      .then((res) => {
                        getTeachers().then((updated) => {
                          setTeachers(
                            updated.sort(
                              (a, b) => a.seniority_rank - b.seniority_rank
                            )
                          );
                          toast.success("Teacher added successfully");
                        });
                      })
                      .catch((error) => {
                        toast.error("Failed to add teacher");
                      });
                  } else {
                    // The URL names the teacher by the old initial; the body
                    // carries the new one when it was changed.
                    updateTeacher(selectedTeacher.prev_initial, selectedTeacher)
                      .then(() => reloadTeachers())
                      .then(() => toast.success("Teacher updated successfully"))
                      .catch((error) => {
                        toast.error(
                          error?.response?.data?.error?.message ||
                            "Failed to update teacher"
                        );
                      });
                  }
                  setSelectedTeacher(null);
                } else toast.error(result);
              }}
            >
              Save
            </button>
          </Modal.Footer>
        </Modal>
      )}

      {/* Delete Teacher Confirmation Modal */}
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
    </div>
  );
}
