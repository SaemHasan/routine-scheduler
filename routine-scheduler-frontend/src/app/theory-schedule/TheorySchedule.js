import { useState, useEffect, useCallback } from "react";
import { Form, Button } from "react-bootstrap";
import TheoryScheduleTable from "./TheoryScheduleTable";
import {
  getActiveDepartments,
  getDepartmentalLevelTermBatches,
  getTheorySectionsByDeptAndLevelTerm,
  getTheoryCoursesByDeptLevelTerm,
} from "../api/db-crud";
import { setSchedules, getSchedules } from "../api/theory-schedule";
import { toast } from "react-hot-toast";
import {
  mdiSchoolOutline,
  mdiDomain,
  mdiPlusBoxOutline,
  mdiContentSave,
} from "@mdi/js";
import Icon from "@mdi/react";
import { useHistory } from "react-router-dom";
import { useConfig } from "../shared/ConfigContext";

export default function TheorySchedule(props) {
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedLevelTermBatch, setSelectedLevelTermBatch] = useState("");
  const [allDepartments, setAllDepartments] = useState([]);
  const [allLevelTermBatches, setAllLevelTermBatches] = useState([]);
  const [allTheorySections, setAllTheorySections] = useState([]);
  const [allTheoryCourses, setAllTheoryCourses] = useState([]);
  const [theorySchedulesBySection, setTheorySchedulesBySection] = useState({});
  const [isChanged, setIsChanged] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [originalSchedulesBySection, setOriginalSchedulesBySection] = useState(
    {}
  );
  const history = useHistory();
  const { times } = useConfig();

  // Load departments on mount
  useEffect(() => {
    getActiveDepartments()
      .then((res) => setAllDepartments(Array.isArray(res.data) ? res.data : []))
      .catch(() => {
        setAllDepartments([]);
        toast.error("Failed to load departments");
      });
  }, []);

  // Load level-term batches when department changes
  useEffect(() => {
    if (selectedDepartment) {
      getDepartmentalLevelTermBatches(selectedDepartment)
        .then((res) =>
          setAllLevelTermBatches(Array.isArray(res.data) ? res.data : [])
        )
        .catch(() => {
          setAllLevelTermBatches([]);
          toast.error("Failed to load level-terms");
        });
    } else {
      setAllLevelTermBatches([]);
      setSelectedLevelTermBatch("");
    }
  }, [selectedDepartment]);

  // Load theory sections when department or level-term changes
  useEffect(() => {
    if (selectedDepartment && selectedLevelTermBatch) {
      // Use string value for API call
      const levelTermValue =
        typeof selectedLevelTermBatch === "object" &&
        selectedLevelTermBatch.level_term
          ? selectedLevelTermBatch.level_term
          : selectedLevelTermBatch;
      getTheorySectionsByDeptAndLevelTerm(selectedDepartment, levelTermValue)
        .then((res) =>
          setAllTheorySections(Array.isArray(res.data) ? res.data : [])
        )
        .catch(() => setAllTheorySections([]));
    } else {
      setAllTheorySections([]);
    }
  }, [selectedDepartment, selectedLevelTermBatch]);

  // Load theory courses when department or level-term changes
  useEffect(() => {
    if (selectedDepartment && selectedLevelTermBatch) {
      const levelTermValue =
        typeof selectedLevelTermBatch === "object" &&
        selectedLevelTermBatch.level_term
          ? selectedLevelTermBatch.level_term
          : selectedLevelTermBatch;
      getTheoryCoursesByDeptLevelTerm(selectedDepartment, levelTermValue)
        .then((res) =>
          setAllTheoryCourses(Array.isArray(res.data) ? res.data : [])
        )
        .catch(() => setAllTheoryCourses([]));
    } else {
      setAllTheoryCourses([]);
    }
  }, [selectedDepartment, selectedLevelTermBatch]);

  const handleDepartmentChange = (e) => {
    if (
      e.target.value !== selectedDepartment &&
      isChanged &&
      !window.confirm(
        "You have unsaved changes. Are you sure you want to continue?"
      )
    ) {
      e.target.value = selectedDepartment;
      return;
    }
    setSelectedDepartment(e.target.value);
    setSelectedLevelTermBatch("");
  };

  // Fix: Level-Term selector should store the full batch object, not just the string
  const handleLevelTermChange = (e) => {
    const value = e.target.value;
    const found = allLevelTermBatches.find((lt) => lt.level_term === value);
    if (
      found !== selectedLevelTermBatch &&
      isChanged &&
      !window.confirm(
        "You have unsaved changes. Are you sure you want to continue?"
      )
    ) {
      return;
    }
    setSelectedLevelTermBatch(found || value);
  };

  // Handler to update schedule for a section, with cross-section cell warning
  const handleTheoryCellChange = (sectionKey) => (day, time, courseIds) => {
    // If this is a no-op call (from the forced re-render), just return
    if (day === null && time === null) {
      return;
    }

    // Handle both single string and array of course IDs
    const courseIdsArray = Array.isArray(courseIds)
      ? courseIds
      : courseIds
      ? [courseIds]
      : [];

    const slotKey = `${day} ${time}`;
    // Get a fresh copy of the current section schedule to avoid stale data
    const currentSectionSchedule =
      { ...theorySchedulesBySection[sectionKey] } || {};

    // Check each course ID in the selection
    for (const courseId of courseIdsArray) {
      // Check for duplicate course in the same section on the same day
      let duplicateCount = 0;
      Object.entries(currentSectionSchedule).forEach(([slot, val]) => {
        // Check if this slot has the current course
        const slotCourseIds =
          val.course_ids || (val.course_id ? [val.course_id] : []);
        if (
          slotCourseIds.includes(courseId) &&
          slot.startsWith(day + " ") &&
          slot !== slotKey
        ) {
          duplicateCount++;
        }
      });

      // If already selected in another time slot on the same day, show warning
      if (duplicateCount > 0) {
        toast(
          `Course ${courseId} is already selected in this section on this day.`,
          { icon: "⚠️" }
        );
      }

      // Check if selected more than class_per_week times in this section
      let totalCount = 0;
      Object.entries(currentSectionSchedule).forEach(([slot, val]) => {
        const slotCourseIds =
          val.course_ids || (val.course_id ? [val.course_id] : []);
        if (slotCourseIds.includes(courseId)) totalCount++;
      });

      // If this is a new slot for this course, increment the count
      const existingSlotCourseIds =
        currentSectionSchedule[slotKey]?.course_ids ||
        (currentSectionSchedule[slotKey]?.course_id
          ? [currentSectionSchedule[slotKey].course_id]
          : []);

      if (!existingSlotCourseIds.includes(courseId)) {
        totalCount++;
      }

      // Find class_per_week for this course
      const courseObj = allTheoryCourses.find((c) => c.course_id === courseId);
      if (
        courseObj &&
        courseObj.class_per_week &&
        totalCount > courseObj.class_per_week
      ) {
        toast(
          `Warning: ${courseId} is selected more than ${courseObj.class_per_week} times in this section.`,
          { icon: "⚠️" }
        );
      }

      // Check all other sections for same course in same cell
      for (const otherSection of allTheorySections) {
        const otherSectionKey = `${selectedDepartment} ${otherSection.batch} ${otherSection.section}`;
        if (otherSectionKey !== sectionKey) {
          const otherSchedule = theorySchedulesBySection[otherSectionKey] || {};
          const otherSlotCourseIds =
            otherSchedule[slotKey]?.course_ids ||
            (otherSchedule[slotKey]?.course_id
              ? [otherSchedule[slotKey].course_id]
              : []);

          if (otherSlotCourseIds.includes(courseId)) {
            toast(
              `You have selected course ${courseId} in another section at the same time.`,
              { icon: "⚠️", duration: 4000 }
            );
            break;
          }
        }
      }
    } // Update the schedule with the new course IDs in a way that ensures React detects the change
    setTheorySchedulesBySection((prev) => {
      // Create a deep copy of the previous state to avoid mutation
      const updatedState = JSON.parse(JSON.stringify(prev));

      // Initialize the section if it doesn't exist
      if (!updatedState[sectionKey]) {
        updatedState[sectionKey] = {};
      }

      // Update the specific day-time slot with the new course IDs
      updatedState[sectionKey][slotKey] = { course_ids: courseIdsArray };

      return updatedState;
    });

    // Mark that changes have been made
    setIsChanged(true);
  };

  // Helper to determine if a course_id is sessional (even)
  const isSessionalCourse = (course_id) => {
    // Consider course_id as string, check if last char is even digit
    if (!course_id) return false;
    const lastDigit = course_id.match(/\d+/g)?.pop()?.slice(-1);
    return lastDigit && parseInt(lastDigit) % 2 === 0;
  };

  // Helper to check if a time slot should be disabled due to sessional scheduling
  const isDisabledTimeSlot = useCallback(
    (sectionKey, day, time) => {
      const scheduleObj = theorySchedulesBySection[sectionKey] || {};

      // Check if this time slot has a sessional course or is affected by one
      const timeIndex = times.indexOf(time);
      if (timeIndex < 0) return false;

      // For each time slot, check if there's a sessional course in any previous slot
      // that would affect this slot (current slot or up to 2 slots after a sessional)
      for (let i = Math.max(0, timeIndex - 2); i <= timeIndex; i++) {
        const checkTime = times[i];
        const checkSlotKey = `${day} ${checkTime}`;

        // Check if there are any sessional courses in this slot
        const slotData = scheduleObj[checkSlotKey];
        const courseIds =
          slotData?.course_ids ||
          (slotData?.course_id ? [slotData.course_id] : []);

        // Check if any of the courses in this slot is a sessional course
        const hasSessional = courseIds.some((id) => isSessionalCourse(id));

        if (hasSessional) {
          // Fetch the sessional assignments for this section
          const sessionalAssignment = courseIds.filter((id) =>
            isSessionalCourse(id)
          );
          if (timeIndex >= i && timeIndex <= i + 2) {
            return {
              isDisabled: true,
              sessionalAssignment: sessionalAssignment || null,
            };
          }
        }
      }
      return { isDisabled: false, sessionalAssignment: null };
    },
    [theorySchedulesBySection, isSessionalCourse, times]
  );

  // Fetch and populate already scheduled courses for all sections when loaded
  useEffect(() => {
    if (
      selectedDepartment &&
      selectedLevelTermBatch &&
      allTheorySections.length > 0
    ) {
      const batchValue =
        typeof selectedLevelTermBatch === "object" &&
        selectedLevelTermBatch.batch
          ? selectedLevelTermBatch.batch
          : null;
      allTheorySections.forEach((section) => {
        // Use a consistent format for section key
        const sectionKey = `${selectedDepartment} ${section.batch} ${section.section}`;
        const batchInt = parseInt(batchValue, 10); // Use batch from level-term selector
        if (!isNaN(batchInt)) {
          getSchedules(selectedDepartment, batchInt, section.section).then(
            (res) => {
              let allSchedules = [];
              if (res.mainSection) allSchedules = [...res.mainSection];
              if (res.subsections)
                Object.values(res.subsections).forEach((sub) => {
                  allSchedules = [...allSchedules, ...sub];
                });

              // Initialize cellMap with empty course_ids arrays for all day-time combinations
              const cellMap = {};
              // Pre-initialize all possible day-time slots
              times.forEach((time) => {
                [
                  "Saturday",
                  "Sunday",
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                ].forEach((day) => {
                  const key = `${day} ${time}`;
                  cellMap[key] = { course_ids: [] };
                });
              });

              // Process all schedules and add courses to the appropriate day-time slots
              allSchedules.forEach((sch) => {
                const slotKey = `${sch.day} ${sch.time}`;

                // Initialize the slot if it doesn't exist yet
                if (!cellMap[slotKey]) {
                  cellMap[slotKey] = { course_ids: [] };
                }

                // Add the course_id to the course_ids array if it's not already there
                if (
                  sch.course_id &&
                  !cellMap[slotKey].course_ids.includes(sch.course_id)
                ) {
                  cellMap[slotKey].course_ids.push(sch.course_id);
                }

                // Store the type information as well
                if (sch.type) {
                  cellMap[slotKey].type = sch.type;
                }
              });

              // Deep clone to ensure we're not sharing references
              const cellMapClone = JSON.parse(JSON.stringify(cellMap));

              // Make sure to use function form of setState to ensure we're using the latest state
              setTheorySchedulesBySection((prev) => {
                const updated = { ...prev };
                updated[sectionKey] = cellMapClone; // This ensures the exact same reference
                return updated;
              });

              setOriginalSchedulesBySection((prev) => {
                const updated = { ...prev };
                updated[sectionKey] = cellMapClone; // This ensures the exact same reference
                return updated;
              });
            }
          );
        }
      });
    }
    // eslint-disable-next-line
  }, [selectedDepartment, selectedLevelTermBatch, allTheorySections]);

  // Define a shared style object for modal action buttons (copied from Teachers.js)
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

  // Helper to run promises with concurrency limit
  async function promisePool(tasks, poolLimit = 5) {
    const results = [];
    const executing = [];
    for (const task of tasks) {
      const p = Promise.resolve().then(() => task());
      results.push(p);
      if (poolLimit <= tasks.length) {
        const e = p.then(() => executing.splice(executing.indexOf(e), 1));
        executing.push(e);
        if (executing.length >= poolLimit) {
          await Promise.race(executing);
        }
      }
    }
    return Promise.all(results);
  }

  // Save all schedules for all sections at once
  const saveAllSchedules = useCallback(async () => {
    if (!selectedDepartment || !selectedLevelTermBatch) {
      toast.error("Select department and level-term first");
      return;
    }
    const batchValue =
      typeof selectedLevelTermBatch === "object" && selectedLevelTermBatch.batch
        ? selectedLevelTermBatch.batch
        : null;
    const batch = parseInt(batchValue, 10);
    if (isNaN(batch)) {
      toast.error("Invalid batch value");
      return;
    }
    setIsLoading(true);
    const savingToast = toast.loading("Saving all schedules...");
    const savePromises = allTheorySections.map((section) => {
      const sectionKey = `${selectedDepartment} ${section.batch} ${section.section}`;
      const current = theorySchedulesBySection[sectionKey] || {};
      const original = originalSchedulesBySection[sectionKey] || {};
      // Find changed slots only
      const changedSlots = [];
      // Check all slots in current
      Object.entries(current).forEach(([slot, val]) => {
        // Handle both course_id and course_ids
        const prevCourseIds =
          original[slot]?.course_ids ||
          (original[slot]?.course_id ? [original[slot].course_id] : []);
        const newCourseIds =
          val.course_ids || (val.course_id ? [val.course_id] : []);

        // Check if arrays are different
        const prevIdsStr = JSON.stringify(prevCourseIds.sort());
        const newIdsStr = JSON.stringify(newCourseIds.sort());

        if (prevIdsStr !== newIdsStr) {
          // For backward compatibility, if there's only one course, use course_id
          if (newCourseIds.length === 0) {
            changedSlots.push({ slot, course_id: "None" });
          } else {
            // For each course_id, create a separate entry
            newCourseIds.forEach((courseId) => {
              changedSlots.push({ slot, course_id: courseId });
            });
          }
        }
      });

      // For each changed slot, send a setSchedules call, throttled
      const saveSectionTasks = changedSlots.map((slotData) => async () => {
        const [day, time] = slotData.slot.split(" ");
        try {
          // Handle both single course_id and multiple course_ids
          await setSchedules(batch, section.section, slotData.course_id, [
            { day, time },
          ]);
          return {
            success: true,
            section: section.section,
            slot: slotData.slot,
          };
        } catch {
          return {
            success: false,
            section: section.section,
            slot: slotData.slot,
          };
        }
      });
      return promisePool(saveSectionTasks, 5);
    });
    Promise.all(savePromises)
      .then((results) => {
        toast.dismiss(savingToast);
        setIsLoading(false);
        setIsChanged(false);
        // After successful save, update originalSchedulesBySection to match current
        setOriginalSchedulesBySection(
          JSON.parse(JSON.stringify(theorySchedulesBySection))
        );
        const flatResults = results.flat();
        const failures = flatResults.filter((r) => !r.success);
        const totalCount = flatResults.length;
        const successCount = totalCount - failures.length;
        if (failures.length === 0) {
          toast.success("All schedules saved successfully");
        } else if (failures.length < totalCount) {
          toast.error(`Saved ${successCount} out of ${totalCount} schedules`);
        } else {
          toast.error("Failed to save any schedules");
        }
      })
      .catch(() => {
        toast.dismiss(savingToast);
        setIsLoading(false);
        toast.error("Failed to save schedules");
      });
  }, [
    selectedDepartment,
    selectedLevelTermBatch,
    allTheorySections,
    theorySchedulesBySection,
    originalSchedulesBySection,
  ]);

  // Block in-app route changes if there are unsaved changes
  useEffect(() => {
    if (!isChanged) return;
    const unblock = history.block((location, action) => {
      return "You have unsaved changes. Are you sure you want to leave?";
    });
    return () => {
      unblock();
    };
  }, [isChanged, history]);

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
            <Icon path={mdiSchoolOutline} size={1} color="white" />
          </div>
          Theory Schedule Assign
        </h3>
        <nav aria-label="breadcrumb">
          <ol
            className="breadcrumb"
            style={{ marginBottom: "0", background: "transparent" }}
          >
            <li
              className="breadcrumb-item active"
              aria-current="page"
              style={{ color: "rgba(255,255,255,0.9)", fontWeight: "500" }}
            >
              Theory Schedule
            </li>
          </ol>
        </nav>
      </div>
      {/* Department/Level-Term Panel as Card */}
      <div className="row mb-4">
        <div className="col-12">
          <div
            className="card"
            style={{
              borderRadius: "16px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
              border: "none",
              background: "white",
            }}
          >
            <div className="card-body" style={{ padding: "2rem" }}>
              <h4
                className="card-title"
                style={{
                  color: "rgb(174, 117, 228)",
                  borderBottom: "3px solid rgb(194, 137, 248)",
                  paddingBottom: "16px",
                  marginBottom: "24px",
                  fontWeight: "700",
                  display: "flex",
                  alignItems: "center",
                  letterSpacing: "0.3px",
                }}
              >
                <Icon
                  path={mdiSchoolOutline}
                  size={0.9}
                  style={{ marginRight: 8 }}
                />
                Select Department and Level-Term
              </h4>
              <Form>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label
                      htmlFor="departmentSelect"
                      className="form-label"
                      style={{
                        fontWeight: "600",
                        marginBottom: "8px",
                        color: "#444",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Icon
                        path={mdiDomain}
                        size={0.8}
                        style={{ marginRight: 6, color: "rgb(194, 137, 248)" }}
                      />{" "}
                      Department
                    </label>
                    <Form.Select
                      id="departmentSelect"
                      className="form-control btn-block"
                      value={selectedDepartment || ""}
                      style={{
                        height: "48px",
                        borderRadius: "10px",
                        border: "1px solid #d0d5dd",
                        boxShadow: "0 1px 3px rgba(16, 24, 40, 0.1)",
                        fontWeight: "500",
                        color: "#333",
                        padding: "0 14px",
                        background:
                          "linear-gradient(to bottom, #ffffff, #fdfaff)",
                      }}
                      onChange={handleDepartmentChange}
                    >
                      <option value="">Select Department</option>
                      {allDepartments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </Form.Select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label
                      htmlFor="levelTermSelect"
                      className="form-label"
                      style={{
                        fontWeight: "600",
                        marginBottom: "8px",
                        color: "#444",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Icon
                        path={mdiPlusBoxOutline}
                        size={0.8}
                        style={{ marginRight: 6, color: "rgb(194, 137, 248)" }}
                      />{" "}
                      Level-Term
                    </label>
                    <Form.Select
                      id="levelTermSelect"
                      className="form-control btn-block"
                      value={
                        typeof selectedLevelTermBatch === "object" &&
                        selectedLevelTermBatch.level_term
                          ? selectedLevelTermBatch.level_term
                          : ""
                      }
                      style={{
                        height: "48px",
                        borderRadius: "10px",
                        border: "1px solid #d0d5dd",
                        boxShadow: "0 1px 3px rgba(16, 24, 40, 0.1)",
                        fontWeight: "500",
                        color: "#333",
                        padding: "0 14px",
                        background:
                          "linear-gradient(to bottom, #ffffff, #fdfaff)",
                      }}
                      onChange={handleLevelTermChange}
                      disabled={!selectedDepartment}
                    >
                      <option value="">
                        {selectedDepartment
                          ? "Select Level-Term"
                          : "First select a department"}
                      </option>
                      {Array.isArray(allLevelTermBatches) &&
                        allLevelTermBatches.map((lt) => (
                          <option key={lt.batch} value={lt.level_term}>
                            {lt.level_term} ({lt.batch} Batch)
                          </option>
                        ))}
                    </Form.Select>
                  </div>
                </div>
                {/* Save Button inside Department/Level-Term Panel */}
                {selectedDepartment &&
                  selectedLevelTermBatch &&
                  allTheorySections.length > 0 && (
                    <div className="d-flex justify-content-end mt-4 mb-2">
                      <Button
                        variant="primary"
                        onClick={saveAllSchedules}
                        style={{
                          ...modalButtonStyle,
                          background:
                            isChanged && !isLoading
                              ? "linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(154, 77, 226) 100%)"
                              : "rgba(154, 77, 226, 0.10)",
                          color:
                            isChanged && !isLoading
                              ? "white"
                              : "rgb(154, 77, 226)",
                          border:
                            isChanged && !isLoading
                              ? "1.5px solid rgb(154, 77, 226)"
                              : "1px solid rgba(154, 77, 226, 0.5)",
                          boxShadow:
                            isChanged && !isLoading
                              ? "0 4px 10px rgba(154, 77, 226, 0.25)"
                              : "none",
                          opacity: isChanged && !isLoading ? 1 : 0.7,
                          cursor:
                            isChanged && !isLoading ? "pointer" : "not-allowed",
                        }}
                        disabled={!isChanged || isLoading}
                        className="save-button d-flex align-items-center justify-content-center"
                        onMouseOver={(e) => {
                          if (isChanged && !isLoading) {
                            e.currentTarget.style.background =
                              "rgb(154, 77, 226)";
                            e.currentTarget.style.color = "white";
                            e.currentTarget.style.borderColor =
                              "rgb(154, 77, 226)";
                            e.currentTarget.style.boxShadow =
                              "0 6px 15px rgba(154, 77, 226, 0.35)";
                          }
                        }}
                        onMouseOut={(e) => {
                          if (isChanged && !isLoading) {
                            e.currentTarget.style.background =
                              "linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(154, 77, 226) 100%)";
                            e.currentTarget.style.color = "white";
                            e.currentTarget.style.borderColor =
                              "rgb(154, 77, 226)";
                            e.currentTarget.style.boxShadow =
                              "0 4px 10px rgba(154, 77, 226, 0.25)";
                          }
                        }}
                      >
                        <Icon
                          path={mdiContentSave}
                          size={0.8}
                          color={
                            isChanged && !isLoading
                              ? "white"
                              : "rgb(154, 77, 226)"
                          }
                          style={{ marginRight: 8 }}
                        />
                        {isChanged
                          ? isLoading
                            ? "Saving..."
                            : "Save All Changes"
                          : "No Changes to Save"}
                      </Button>
                    </div>
                  )}
              </Form>
            </div>
          </div>
        </div>
      </div>
      {/* Show section tables after both department and level-term are selected */}
      {selectedDepartment &&
        selectedLevelTermBatch &&
        (allTheorySections.length === 0 ? (
          <div className="row mb-4">
            <div className="col-12">
              <div
                className="card"
                style={{
                  borderRadius: "16px",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
                  border: "none",
                  background: "white",
                }}
              >
                <div className="card-body" style={{ padding: "2rem" }}>
                  <h4
                    className="card-title"
                    style={{
                      color: "rgb(194, 137, 248)",
                      borderBottom: "3px solid rgb(194, 137, 248)",
                      paddingBottom: "16px",
                      fontWeight: "600",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    No sections found
                  </h4>
                  <p>
                    No sections were found for the selected department and
                    level-term.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          allTheorySections.map((section) => {
            const sectionKey = `${selectedDepartment} ${section.batch} ${section.section}`;
            // Helper to get the schedule for this section in the format expected by setSchedules
            const getSectionSchedules = () => {
              const scheduleObj = theorySchedulesBySection[sectionKey] || {};
              // Map: { 'Saturday 8': {course_ids: ['CSE101', 'CSE102']}, ... } => { course_id: [ {day, time}, ... ] }
              const courseSlotMap = {};

              Object.entries(scheduleObj).forEach(([slot, val]) => {
                // Handle both course_id and course_ids formats
                const courseIds =
                  val.course_ids || (val.course_id ? [val.course_id] : []);

                if (!courseIds.length) return;

                const [day, time] = slot.split(" ");

                // For each course ID in this slot
                courseIds.forEach((courseId) => {
                  if (!courseId) return; // Skip empty values

                  if (!courseSlotMap[courseId]) {
                    courseSlotMap[courseId] = [];
                  }

                  courseSlotMap[courseId].push({ day, time });
                });
              });

              return courseSlotMap;
            };

            return (
              <div className="row mb-4" key={sectionKey}>
                <div className="col-12">
                  <div
                    className="card"
                    style={{
                      borderRadius: "16px",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
                      border: "none",
                      background: "white",
                    }}
                  >
                    <div className="card-body" style={{ padding: "2rem" }}>
                      <div className="mb-4">
                        <h4
                          className="card-title"
                          style={{
                            color: "rgb(194, 137, 248)",
                            borderBottom: "3px solid rgb(194, 137, 248)",
                            paddingBottom: "16px",
                            marginBottom: "24px",
                            fontWeight: "700",
                            display: "flex",
                            alignItems: "center",
                            letterSpacing: "0.3px",
                          }}
                        >
                          <span
                            style={{
                              backgroundColor: "rgb(194, 137, 248)",
                              color: "white",
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "1.1rem",
                              marginRight: "8px",
                              boxShadow: "0 2px 4px rgba(154, 77, 226, 0.3)",
                            }}
                          >
                            {section.section}
                          </span>
                          Section {section.section}
                        </h4>
                      </div>
                      {(() => {
                        const sectionData =
                          theorySchedulesBySection[sectionKey] || {};
                        return (
                          <TheoryScheduleTable
                            {...props}
                            allTheoryCourses={allTheoryCourses}
                            theorySchedules={sectionData}
                            onChange={handleTheoryCellChange(sectionKey)}
                            isDisabledTimeSlot={(day, time) =>
                              isDisabledTimeSlot(sectionKey, day, time)
                            }
                          />
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ))}
      <style jsx="true">{`
        .form-control {
          transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
          font-size: 1rem;
        }
        .form-control:focus {
          border-color: rgb(194, 137, 248) !important;
          box-shadow: 0 0 0 0.2rem rgba(194, 137, 248, 0.15) !important;
          background: linear-gradient(to bottom, #ffffff, #fdfaff) !important;
          color: #6b38a6 !important;
        }
        .form-control:hover {
          border-color: rgb(194, 137, 248) !important;
          box-shadow: 0 0 0 0.15rem rgba(194, 137, 248, 0.12) !important;
          background: linear-gradient(to bottom, #ffffff, #fdfaff) !important;
          color: #6b38a6 !important;
        }
      `}</style>
    </div>
  );
}
