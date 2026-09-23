import { useEffect, useState } from "react";
import { Form } from "react-bootstrap";
import {
  getAllInitial,
  getPdfForStudent,
  getPdfForTeacher,
  getAllRooms,
  getPdfForRoom,
  getAllLevelTerms,
  regeneratePdfLevelTerm,
  regenerateRoom,
  regenerateTeacher,
  regenerateAllLevelTerms,
  regenerateAllTeachers,
  regenerateAllRooms,
  getPdfForAllLevelTerms,
  getPdfForAllTeachers,
  getPdfForAllRooms,
  getAllDepartments,
  getPdfForDepartment,
  getPdfForAllDepartments,
  regenerateDepartment,
  regenerateAllDepartments,
} from "../api/pdf";
import { toast } from "react-hot-toast";
import { sendMail } from "../api/pdf";

export default function ShowPdf() {
  const [forStudent, setForStudent] = useState(true);
  const [forTeacher, setForTeacher] = useState(false);
  const [forRoom, setForRoom] = useState(false);
  const [forDepartment, setForDepartment] = useState(false);

  const [initials, setInitials] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [allLevels, setAllLevels] = useState([]);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    getAllInitial().then((res) => {
      setInitials(res.initials);
    });
    getAllRooms().then((res) => {
      setRooms(res.rooms);
    });
    getAllLevelTerms().then((res) => {
      setAllLevels(res);
    });
    getAllDepartments().then((res) => {
      setDepartments(res.departments);
    });
  }, []);

  const [selectedInitial, setSelectedInitial] = useState("All Teacher");
  const [selectedRoom, setSelectedRoom] = useState("All rooms");
  const [lvlTerm, setLvlTerm] = useState("All Level-Term");
  const [selectedDepartment, setSelectedDepartment] =
    useState("All Departments");
  const [pdfData, setpdfData] = useState("");

  const handleSelect = (e) => {
    const selectedOption = e.target.value;
    setForStudent(false);
    setForTeacher(false);
    setForRoom(false);
    setForDepartment(false);

    switch (selectedOption) {
      case "For Student":
        setForStudent(true);
        break;
      case "For Teacher":
        setForTeacher(true);
        break;
      case "For Room":
        setForRoom(true);
        break;
      case "For Department":
        setForDepartment(true);
        break;
      default:
        break;
    }
  };

  const handleDropdownChange = (e, type) => {
    const value = e.target.value;
    if (type === "levelTerm") {
      setLvlTerm(value);
    } else if (type === "teacher") {
      setSelectedInitial(value);
    } else if (type === "room") {
      setSelectedRoom(value);
    } else if (type === "department") {
      setSelectedDepartment(value);
    }
  };

  const displayPdf = () => {
    try {
      const toastId = toast.loading("Loading PDF...");

      let pdfPromise;
      let selectedType = "";
      let selectedValue = "";

      if (forStudent) {
        if (!lvlTerm) {
          toast.dismiss(toastId);
          toast.error("Please select a level term");
          return;
        }
        if (lvlTerm === "All Level-Term") {
          pdfPromise = getPdfForAllLevelTerms();
          selectedType = "student";
          selectedValue = "All Level-Term";
        } else {
          pdfPromise = getPdfForStudent(lvlTerm, "a");
          selectedType = "student";
          selectedValue = lvlTerm;
        }
      } else if (forTeacher) {
        if (!selectedInitial) {
          toast.dismiss(toastId);
          toast.error("Please select a teacher");
          return;
        }
        if (selectedInitial === "All Teacher") {
          pdfPromise = getPdfForAllTeachers();
          selectedType = "teacher";
          selectedValue = "All Teacher";
        } else {
          pdfPromise = getPdfForTeacher(selectedInitial);
          selectedType = "teacher";
          selectedValue = selectedInitial;
        }
      } else if (forRoom) {
        if (!selectedRoom) {
          toast.dismiss(toastId);
          toast.error("Please select a room");
          return;
        }
        if (selectedRoom === "All rooms") {
          pdfPromise = getPdfForAllRooms();
          selectedType = "room";
          selectedValue = "All rooms";
        } else {
          pdfPromise = getPdfForRoom(selectedRoom);
          selectedType = "room";
          selectedValue = selectedRoom;
        }
      } else if (forDepartment) {
        if (!selectedDepartment) {
          toast.dismiss(toastId);
          toast.error("Please select a department");
          return;
        }
        if (selectedDepartment === "All Departments") {
          pdfPromise = getPdfForAllDepartments();
          selectedType = "department";
          selectedValue = "All Departments";
        } else {
          pdfPromise = getPdfForDepartment(selectedDepartment);
          selectedType = "department";
          selectedValue = selectedDepartment;
        }
      } else {
        toast.dismiss(toastId);
        toast.error("Please select a format");
        return;
      }

      pdfPromise
        .then((res) => {
          if (!res || res.status === 404 || res.length === 0) {
            toast.dismiss(toastId);
            toast.error(`No ${selectedType} PDF found for ${selectedValue}`);
            return;
          }
          const pdfBlob = new Blob([res], { type: "application/pdf" });
          setpdfData(pdfBlob);
          toast.dismiss(toastId);
          toast.success("PDF loaded successfully");
        })
        .catch((error) => {
          toast.dismiss(toastId);
          toast.error(
            `Failed to load ${selectedType} PDF for ${selectedValue}`
          );
        });
    } catch (err) {
      console.error("Error in displayPdf:", err);
      toast.error("An unexpected error occurred");
    }
  };

  const regeneratePdf = () => {
    try {
      let toastId;
      let regeneratePromise;
      let selectedType = "";
      let selectedValue = "";

      if (forStudent) {
        if (!lvlTerm) {
          toast.error("Please select a level term");
          return;
        }

        if (lvlTerm === "All Level-Term") {
          // Generate consolidated PDF for all level terms
          toastId = toast.loading(
            `Generating consolidated PDF for all level terms...`
          );
          regeneratePromise = regenerateAllLevelTerms();
          selectedType = "student";
          selectedValue = "all level terms";
        } else {
          toastId = toast.loading(`Generating PDF for ${lvlTerm}...`);
          regeneratePromise = regeneratePdfLevelTerm(lvlTerm);
          selectedType = "student";
          selectedValue = lvlTerm;
        }
      } else if (forTeacher) {
        if (!selectedInitial) {
          toast.error("Please select a teacher");
          return;
        }

        if (selectedInitial === "All Teacher") {
          // Generate consolidated PDF for all teachers
          toastId = toast.loading(
            `Generating consolidated PDF for all teachers...`
          );
          regeneratePromise = regenerateAllTeachers();
          selectedType = "teacher";
          selectedValue = "all teachers";
        } else {
          toastId = toast.loading(
            `Generating PDF for teacher ${selectedInitial}...`
          );
          regeneratePromise = regenerateTeacher(selectedInitial);
          selectedType = "teacher";
          selectedValue = selectedInitial;
        }
      } else if (forRoom) {
        if (!selectedRoom) {
          toast.error("Please select a room");
          return;
        }

        if (selectedRoom === "All rooms") {
          // Generate consolidated PDF for all rooms
          toastId = toast.loading(
            `Generating consolidated PDF for all rooms...`
          );
          regeneratePromise = regenerateAllRooms();
          selectedType = "room";
          selectedValue = "all rooms";
        } else {
          toastId = toast.loading(`Generating PDF for room ${selectedRoom}...`);
          regeneratePromise = regenerateRoom(selectedRoom);
          selectedType = "room";
          selectedValue = selectedRoom;
        }
      } else if (forDepartment) {
        if (!selectedDepartment) {
          toast.error("Please select a department");
          return;
        }

        if (selectedDepartment === "All Departments") {
          // Generate consolidated PDF for all  departments
          toastId = toast.loading(
            `Generating consolidated PDF for all departments...`
          );
          regeneratePromise = regenerateAllDepartments();
          selectedType = "department";
          selectedValue = "all departments";
        } else {
          toastId = toast.loading(
            `Generating PDF for department ${selectedDepartment}...`
          );
          regeneratePromise = regenerateDepartment(selectedDepartment);
          selectedType = "department";
          selectedValue = selectedDepartment;
        }
      } else {
        toast.error("Please select a format");
        return;
      }

      regeneratePromise
        .then((res) => {
          toast.dismiss(toastId);

          // Handle response for consolidated "All" operations
          if (selectedValue.includes("all")) {
            const totalCount = res.totalCount || 0;

            if (totalCount > 0) {
              toast.success(
                `Consolidated PDF generated successfully with ${totalCount} ${selectedType} schedules!`
              );
              // Auto-load the consolidated PDF after regeneration
              displayPdf();
            } else {
              toast.error(`No data found for ${selectedType} schedules`);
            }
          } else {
            toast.success(
              `PDF generated successfully for ${selectedType} ${selectedValue}`
            );
            // Auto-load the PDF after regeneration for individual items
            displayPdf();
          }
        })
        .catch((error) => {
          toast.dismiss(toastId);
          console.error(`Error generating ${selectedType} PDF:`, error);
          toast.error(
            <div>
              <p>{`Failed to generate PDF for ${selectedType} ${selectedValue}`}</p>
              <p style={{ fontSize: "0.8rem", marginTop: "8px" }}>
                Reason:{" "}
                {error.message || "Server error - contact administrator"}
              </p>
            </div>,
            { duration: 5000 }
          );
        });
    } catch (err) {
      console.error("Error in regeneratePdf:", err);
      toast.error("An unexpected error occurred");
    }
  };

  return (
    <div>
      {/* Modern Page Header */}
      <div
        className="page-header"
        style={{
          background:
            "linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(154, 77, 226) 100%)",
          borderRadius: "16px",
          padding: "1.5rem",
          marginBottom: "2rem",
          boxShadow: "0 8px 32px rgba(174, 117, 228, 0.15)",
          color: "white",
        }}
      >
        <h3
          className="page-title"
          style={{
            fontSize: "1.8rem",
            fontWeight: "700",
            marginBottom: "0.5rem",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            color: "white",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              backgroundColor: "rgba(255, 255, 255, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 2V8H20"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          Routine Generate
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
                PDF
              </a>
            </li>
            <li
              className="breadcrumb-item active"
              aria-current="page"
              style={{ color: "rgba(255,255,255,0.9)", fontWeight: "500" }}
            >
              Generate
            </li>
          </ol>
        </nav>
      </div>

      {/* Control Panel */}
      <div className="row mb-4">
        <div className="col-12">
          <div
            className="card"
            style={{
              borderRadius: "16px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
              border: "none",
              transition: "all 0.3s ease",
              background: "white",
            }}
          >
            <div className="card-body" style={{ padding: "2rem" }}>
              <div
                style={{
                  borderBottom: "3px solid rgb(194, 137, 248)",
                  paddingBottom: "16px",
                  marginBottom: "24px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h4
                  className="card-title"
                  style={{
                    color: "rgb(174, 117, 228)",
                    marginBottom: 0,
                    fontWeight: "700",
                    display: "flex",
                    alignItems: "center",
                    fontSize: "1.5rem",
                    letterSpacing: "0.3px",
                  }}
                >
                  <span style={{ marginRight: "12px" }}>
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z"
                        stroke="rgb(194, 137, 248)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M14 2V8H20"
                        stroke="rgb(194, 137, 248)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  PDF Format Selection
                </h4>
              </div>
              <div className="row">
                <div className="col-md-4">
                  <label
                    htmlFor="formatSelect"
                    className="form-label"
                    style={{
                      fontWeight: "600",
                      marginBottom: "12px",
                      color: "rgb(174, 117, 228)",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "0.95rem",
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z"
                        stroke="rgb(174, 117, 228)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M14 2V8H20"
                        stroke="rgb(174, 117, 228)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Format Type
                  </label>
                  <Form.Select
                    id="formatSelect"
                    className="form-control btn-block"
                    onChange={handleSelect}
                    style={{
                      height: "48px",
                      borderRadius: "8px",
                      border: "1px solid rgba(174, 117, 228, 0.3)",
                      boxShadow: "0 2px 8px rgba(174, 117, 228, 0.1)",
                      fontWeight: "500",
                      color: "#333",
                      padding: "0 14px",
                      transition: "all 0.25s ease",
                      background: "white",
                    }}
                  >
                    <option value="" hidden>
                      Select Format
                    </option>
                    <option value="For Student">For Student</option>
                    <option value="For Teacher">For Teacher</option>
                    <option value="For Room">For Room</option>
                    <option value="For Department">For Department</option>
                  </Form.Select>
                </div>

                {/* Conditional Second Column */}
                {forStudent && (
                  <div className="col-md-4">
                    <label
                      className="form-label"
                      style={{
                        fontWeight: "600",
                        marginBottom: "12px",
                        color: "rgb(174, 117, 228)",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "0.95rem",
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12Z"
                          stroke="rgb(174, 117, 228)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21"
                          stroke="rgb(174, 117, 228)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Level Term
                    </label>
                    <Form.Select
                      value={lvlTerm}
                      onChange={(e) => handleDropdownChange(e, "levelTerm")}
                      style={{
                        height: "48px",
                        borderRadius: "8px",
                        border: "1px solid rgba(174, 117, 228, 0.3)",
                        boxShadow: "0 2px 8px rgba(174, 117, 228, 0.1)",
                        fontWeight: "500",
                        color: "#333",
                        padding: "0 14px",
                        transition: "all 0.25s ease",
                        background: "white",
                      }}
                    >
                      <option value="All Level-Term">All Level-Term</option>
                      {allLevels.map((level, index) => (
                        <option key={index} value={level.name || level}>
                          {level.name || level}
                        </option>
                      ))}
                    </Form.Select>
                  </div>
                )}

                {forTeacher && (
                  <div className="col-md-4">
                    <label
                      className="form-label"
                      style={{
                        fontWeight: "600",
                        marginBottom: "12px",
                        color: "rgb(174, 117, 228)",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "0.95rem",
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12Z"
                          stroke="rgb(174, 117, 228)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21"
                          stroke="rgb(174, 117, 228)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Teacher
                    </label>
                    <Form.Select
                      value={selectedInitial}
                      onChange={(e) => handleDropdownChange(e, "teacher")}
                      style={{
                        height: "48px",
                        borderRadius: "8px",
                        border: "1px solid rgba(174, 117, 228, 0.3)",
                        boxShadow: "0 2px 8px rgba(174, 117, 228, 0.1)",
                        fontWeight: "500",
                        color: "#333",
                        padding: "0 14px",
                        transition: "all 0.25s ease",
                        background: "white",
                      }}
                    >
                      <option value="All Teacher">All Teacher</option>
                      {initials.map((initial, index) => (
                        <option key={index} value={initial.initial}>
                          {initial.initial}
                        </option>
                      ))}
                    </Form.Select>
                  </div>
                )}

                {forRoom && (
                  <div className="col-md-4">
                    <label
                      className="form-label"
                      style={{
                        fontWeight: "600",
                        marginBottom: "12px",
                        color: "rgb(174, 117, 228)",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "0.95rem",
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z"
                          stroke="rgb(174, 117, 228)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M9 22V12H15V22"
                          stroke="rgb(174, 117, 228)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Room
                    </label>
                    <Form.Select
                      value={selectedRoom}
                      onChange={(e) => handleDropdownChange(e, "room")}
                      style={{
                        height: "48px",
                        borderRadius: "8px",
                        border: "1px solid rgba(174, 117, 228, 0.3)",
                        boxShadow: "0 2px 8px rgba(174, 117, 228, 0.1)",
                        fontWeight: "500",
                        color: "#333",
                        padding: "0 14px",
                        transition: "all 0.25s ease",
                        background: "white",
                      }}
                    >
                      <option value="All rooms">All rooms</option>
                      {rooms.map((room, index) => (
                        <option
                          key={index}
                          value={room.room || room.name || room}
                        >
                          {room.room || room.name || room}
                        </option>
                      ))}
                    </Form.Select>
                  </div>
                )}

                {forDepartment && (
                  <div className="col-md-4">
                    <label
                      className="form-label"
                      style={{
                        fontWeight: "600",
                        marginBottom: "12px",
                        color: "rgb(174, 117, 228)",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "0.95rem",
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M9 11H1V9H9L12 6L9 3V1L16 8L9 15V13H1V11H9Z"
                          stroke="rgb(174, 117, 228)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Department
                    </label>
                    <Form.Select
                      value={selectedDepartment}
                      onChange={(e) => handleDropdownChange(e, "department")}
                      style={{
                        height: "48px",
                        borderRadius: "8px",
                        border: "1px solid rgba(174, 117, 228, 0.3)",
                        boxShadow: "0 2px 8px rgba(174, 117, 228, 0.1)",
                        fontWeight: "500",
                        color: "#333",
                        padding: "0 14px",
                        transition: "all 0.25s ease",
                        background: "white",
                      }}
                    >
                      <option value="All Departments">All Departments</option>
                      {departments.map((dept, index) => (
                        <option key={index} value={dept.department}>
                          {dept.department}
                        </option>
                      ))}
                    </Form.Select>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="col-md-4 d-flex align-items-end">
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      type="button"
                      onClick={regeneratePdf}
                      style={{
                        borderRadius: "8px",
                        padding: "10px 16px",
                        fontWeight: "600",
                        background: "rgba(108, 117, 125, 0.15)",
                        border: "1px solid rgba(108, 117, 125, 0.5)",
                        color: "rgb(108, 117, 125)",
                        transition: "all 0.3s ease",
                        flex: "1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        fontSize: "0.95rem",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = "rgb(108, 117, 125)";
                        e.target.style.color = "white";
                        e.target.style.borderColor = "rgb(108, 117, 125)";
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = "rgba(108, 117, 125, 0.15)";
                        e.target.style.color = "rgb(108, 117, 125)";
                        e.target.style.borderColor = "rgba(108, 117, 125, 0.5)";
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M17 3V2M17 2V13M17 2L12 7L7 2V13"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M2 17L12 12L22 17"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M2 21L12 16L22 21"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Regenerate
                    </button>
                    <button
                      type="button"
                      onClick={displayPdf}
                      style={{
                        borderRadius: "8px",
                        padding: "10px 16px",
                        fontWeight: "600",
                        background: "rgba(154, 77, 226, 0.15)",
                        border: "1px solid rgba(154, 77, 226, 0.5)",
                        color: "rgb(154, 77, 226)",
                        transition: "all 0.3s ease",
                        flex: "1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        fontSize: "0.95rem",
                        cursor: "pointer",
                      }}
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
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M1 12S5 4 12 4S23 12 23 12S19 20 12 20S1 12 1 12Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="3"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Show PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Viewer */}
      {pdfData && (
        <div className="row mb-4">
          <div className="col-12">
            <div
              className="card"
              style={{
                borderRadius: "16px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
                border: "none",
                transition: "all 0.3s ease",
                background: "white",
                overflow: "hidden",
              }}
            >
              <div className="card-body" style={{ padding: "2rem" }}>
                <div
                  style={{
                    borderBottom: "3px solid rgb(194, 137, 248)",
                    paddingBottom: "16px",
                    marginBottom: "24px",
                  }}
                >
                  <h4
                    className="card-title"
                    style={{
                      color: "rgb(174, 117, 228)",
                      marginBottom: 0,
                      fontWeight: "700",
                      display: "flex",
                      alignItems: "center",
                      fontSize: "1.5rem",
                      letterSpacing: "0.3px",
                    }}
                  >
                    <span style={{ marginRight: "12px" }}>
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z"
                          stroke="rgb(194, 137, 248)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M14 2V8H20"
                          stroke="rgb(194, 137, 248)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    PDF Preview
                  </h4>
                </div>
                <div
                  style={{
                    borderRadius: "8px",
                    overflow: "hidden",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                >
                  <iframe
                    title="PDF Viewer"
                    src={URL.createObjectURL(pdfData)}
                    width="100%"
                    height="600px"
                    style={{ border: "none" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mail Button */}
      {forTeacher && selectedInitial && selectedInitial !== "All Teacher" && (
        <div className="row mb-4">
          <div className="col-12">
            <div
              className="card"
              style={{
                borderRadius: "16px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
                border: "none",
                transition: "all 0.3s ease",
                background: "white",
              }}
            >
              <div className="card-body" style={{ padding: "2rem" }}>
                <div
                  style={{
                    borderBottom: "3px solid rgb(194, 137, 248)",
                    paddingBottom: "16px",
                    marginBottom: "24px",
                  }}
                >
                  <h4
                    className="card-title"
                    style={{
                      color: "rgb(174, 117, 228)",
                      marginBottom: 0,
                      fontWeight: "700",
                      display: "flex",
                      alignItems: "center",
                      fontSize: "1.5rem",
                      letterSpacing: "0.3px",
                    }}
                  >
                    <span style={{ marginRight: "12px" }}>
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z"
                          stroke="rgb(194, 137, 248)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M22 6L12 13L2 6"
                          stroke="rgb(194, 137, 248)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    Email Options
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const toastId = toast.loading("Sending email...");
                    sendMail(selectedInitial)
                      .then((res) => {
                        toast.dismiss(toastId);
                        toast.success("Email sent successfully");
                      })
                      .catch((error) => {
                        toast.dismiss(toastId);
                        toast.error("Failed to send email");
                        console.error("Error sending email:", error);
                      });
                  }}
                  style={{
                    borderRadius: "8px",
                    padding: "12px 20px",
                    fontWeight: "600",
                    background: "rgba(154, 77, 226, 0.15)",
                    border: "1px solid rgba(154, 77, 226, 0.5)",
                    color: "rgb(154, 77, 226)",
                    transition: "all 0.3s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "0.95rem",
                    cursor: "pointer",
                  }}
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
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M22 6L12 13L2 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Send Email to Teacher
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
