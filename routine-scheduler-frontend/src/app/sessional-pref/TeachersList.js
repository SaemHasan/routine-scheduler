import { useState, useEffect, useRef } from "react";
import { Modal } from "react-bootstrap";
import { getTeachers } from "../api/db-crud";
import { getAllSessionalAssignment } from "../api/theory-assign";
import TeacherDetails from "./TeacherDetails";
import toast from "react-hot-toast";

export default function TeachersList() {
  const [teachers, setTeachers] = useState([]);
  const [sessionalAssignments, setSessionalAssignments] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [selectedTeacherInitial, setSelectedTeacherInitial] = useState(null);
  const buttonRefs = useRef({});

  // Function to fetch teachers and assignments data
  const fetchTeachersAndAssignments = async () => {
    try {
      // Fetch and process teachers
      const data = await getTeachers();
      const activeTeachers = data
        .filter((teacher) => teacher.active === 1)
        .sort((a, b) => a.seniority_rank - b.seniority_rank);
      setTeachers(activeTeachers);

      // Fetch sessional assignments with fallback
      const assignmentData = await fetchAssignmentData();

      // Process assignments into teacher-indexed map
      const assignmentMap = processAssignmentData(assignmentData);
      setSessionalAssignments(assignmentMap);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load teachers or assignments");
    }
  };

  // Helper function to fetch assignment data with fallback
  const fetchAssignmentData = async () => {
    try {
      // Try the primary API endpoint
      const data = await getAllSessionalAssignment();
      return data;
    } catch (error) {
      console.error("Error with getAllSessionalAssignment:", error);
      return [];
    }
  };

  // Helper function to process assignment data into proper format
  const processAssignmentData = (assignments) => {
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return {};
    }

    // Group assignments by course
    const courseMap = {};
    assignments.forEach((assignment) => {
      const courseKey = `${assignment.course_id}-${assignment.section || ""}`;

      if (!courseMap[courseKey]) {
        courseMap[courseKey] = {
          course_id: assignment.course_id,
          section: assignment.section,
          batch: assignment.batch,
          teachers: [],
        };
      }

      if (
        !courseMap[courseKey].teachers.some(
          (t) => t.initial === assignment.initial
        )
      ) {
        courseMap[courseKey].teachers.push({ initial: assignment.initial });
      }
    });

    // Map courses to teachers
    const teacherMap = {};
    Object.values(courseMap).forEach((course) => {
      if (course.teachers && course.teachers.length) {
        course.teachers.forEach((teacher) => {
          if (!teacherMap[teacher.initial]) {
            teacherMap[teacher.initial] = [];
          }
          teacherMap[teacher.initial].push(course);
        });
      }
    });

    return teacherMap;
  };

  // Initial data fetch
  useEffect(() => {
    fetchTeachersAndAssignments();
  }, []);

  return (
    <div>
      {/* Modern Page Header */}
      <div className="page-header">
        <h3 className="page-title">
          <div className="page-title-icon-container">
            <i className="mdi mdi-account-multiple"></i>
          </div>
          Active Teachers
        </h3>
      </div>
      <div className="card">
        <div className="card-view">
          <div className="card-control-container">
            <h4 className="card-name">
              <i className="card-icon mdi mdi-account-multiple"></i>
              Teachers List
            </h4>
          </div>
          <div className="card-table-container table-responsive">
            <table className="card-table table">
              <thead className="card-table-header">
                <tr style={{ textAlign: "center" }}>
                  <th>
                    <i className="mdi mdi-sort"></i>
                    Seniority Rank
                  </th>
                  <th>
                    <i className="mdi mdi-account"></i>
                    Initial
                  </th>
                  <th>
                    <i className="mdi mdi-account-box"></i>
                    Name
                  </th>
                  <th>
                    <i className="mdi mdi-briefcase"></i>
                    Designation
                  </th>
                  <th>
                    <i className="mdi mdi-check-circle"></i>
                    Status
                  </th>
                  <th>
                    <i className="mdi mdi-cog"></i>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="card-table-body">
                {teachers.map((teacher) => (
                  <tr key={teacher.initial} style={{ textAlign: "center" }}>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          background:
                            "linear-gradient(135deg, rgba(194, 137, 248, 0.1) 0%, rgba(174, 117, 228, 0.1) 100%)",
                          border: "1px solid rgba(174, 117, 228, 0.2)",
                          color: "rgb(174, 117, 228)",
                          fontWeight: "600",
                          margin: "0 auto",
                        }}
                      >
                        {teacher.seniority_rank}
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "12px 22px",
                        fontWeight: "600",
                        borderBottom: "none",
                        color: "rgb(106, 27, 154)",
                        verticalAlign: "middle",
                      }}
                    >
                      {teacher.initial}
                    </td>
                    <td>{teacher.name}</td>
                    <td>{teacher.designation}</td>
                    <td
                      style={{
                        padding: "12px 22px",
                        borderBottom: "none",
                        verticalAlign: "middle",
                      }}
                    >
                      {sessionalAssignments[teacher.initial] &&
                      sessionalAssignments[teacher.initial].length > 0 ? (
                        <span
                          style={{
                            backgroundColor: "rgba(40, 167, 69, 0.1)",
                            color: "#28a745",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            fontWeight: "500",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <i className="mdi mdi-check-circle me-1"></i>
                          Assigned
                          <span
                            className="ms-1 badge"
                            style={{
                              backgroundColor: "rgba(40, 167, 69, 0.2)",
                              color: "#28a745",
                              fontSize: "10px",
                              padding: "2px 6px",
                            }}
                          >
                            {sessionalAssignments[teacher.initial].length}
                          </span>
                        </span>
                      ) : (
                        <span
                          style={{
                            backgroundColor: "rgba(220, 53, 69, 0.1)",
                            color: "#dc3545",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            fontWeight: "500",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <i className="mdi mdi-close-circle me-1"></i>
                          Not Assigned
                        </span>
                      )}
                    </td>
                    <td className="d-flex justify-content-center">
                      <button
                        className="card-control-button"
                        ref={(el) => (buttonRefs.current[teacher.initial] = el)}
                        onClick={() => {
                          setSelectedTeacherInitial(teacher.initial);
                          setShowModal(true);
                        }}
                      >
                        {sessionalAssignments[teacher.initial] &&
                        sessionalAssignments[teacher.initial].length > 0 ? (
                          <>
                            <i className="mdi mdi-account-details"></i>
                            View Details
                          </>
                        ) : (
                          <>
                            <i className="mdi mdi-plus-circle"></i>
                            Assign
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Floating Teacher Details Modal */}
      <Modal
        show={showModal}
        onHide={() => setShowModal(false)}
        onExited={() => setSelectedTeacherInitial(null)}
        size="lg"
        aria-labelledby="teacher-details-modal"
        scrollable
        animation={true}
        keyboard={true}
        backdrop="static"
        centered
        dialogClassName="teacher-details-modal"
      >
        <Modal.Header className="modal-header">
          <Modal.Title className="modal-header-content">
            <div className="modal-header-icon">
              <i className="mdi mdi-book-open-variant"></i>
            </div>
            <h4 className="modal-title">Sessional Course Assignments</h4>
          </Modal.Title>
          <button
            className="modal-header-close-button mdi mdi-close"
            onClick={() => setShowModal(false)}
          ></button>
        </Modal.Header>
        <Modal.Body className="modal-body">
          {selectedTeacherInitial && (
            <TeacherDetails
              teacherId={selectedTeacherInitial}
              onAssignmentChange={() => fetchTeachersAndAssignments()}
            />
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}
