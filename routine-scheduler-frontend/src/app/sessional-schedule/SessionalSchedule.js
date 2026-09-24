import { useEffect, useMemo, useCallback, useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { Form } from "react-bootstrap";
import { useConfig } from "../shared/ConfigContext";
import {
  getActiveDepartments,
  getDepartmentalLevelTermBatches,
  getSessionalSectionsByDeptAndLevelTerm,
  getTheorySectionsByDeptAndLevelTerm,
  getSessionalCoursesByDeptLevelTerm,
} from "../api/db-crud";
import toast from "react-hot-toast";
import {
  getSessionalSchedules,
  setSessionalSchedules,
} from "../api/sessional-schedule";
import { getSchedules } from "../api";
import { mdiContentSave, mdiAccountGroupOutline } from "@mdi/js";
import Icon from "@mdi/react";
import { useHistory } from "react-router-dom";

/**
 * Helper function to format section display for 0.75 credit courses
 * @param {string} section - The section (A, B, C, etc.)
 * @param {number} classPerWeek - The class per week value (1 for 0.75 credit, 2 for 1.5 credit)
 * @returns {string} - Formatted section display
 */
function formatSectionDisplay(section, classPerWeek) {
  // For 0.75 credit courses (class_per_week = 0.75), show (A1/A2) format
  if (classPerWeek === 0.75) {
    return `${section}1/${section}2`;
  }
  // For other courses, show the section as is
  return section;
}

export default function SessionalSchedule() {
  // Memoized values for configuration settings
  const { days, times, possibleLabTimes } = useConfig();

  // Theory schedules
  const [theorySchedules, setTheorySchedules] = useState({});

  // Selection state
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedLevelTermBatch, setSelectedLevelTermBatch] = useState(null);
  const [selectedCourse] = useState(null);

  // Data state
  const [allDepartments, setAllDepartments] = useState([]);
  const [allLevelTermBatches, setAllLevelTermBatches] = useState([]);
  const [allSessionalSections, setAllSessionalSections] = useState([]);
  const [allTheorySections, setAllTheorySections] = useState([]);
  const [allSessionalCourses, setAllSessionalCourses] = useState([]);

  // Schedule state
  const [labSchedulesBySection, setLabSchedulesBySection] = useState({});
  const [labTimes, setLabTimes] = useState([]);

  // UI state
  const [isChanged, setIsChanged] = useState(false);
  // Bumped to reload the routine from the server, e.g. after a rejected save
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Modal states for course selection
  const [showLabCoursesModal, setShowLabCoursesModal] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);

  // Confirmation modal states
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [courseToRemove, setCourseToRemove] = useState(null);

  // Add state for original schedules
  const [originalLabSchedulesBySection, setOriginalLabSchedulesBySection] =
    useState({});

  // Use the custom hook for data loading
  const { loadData } = useLoadData();
  const history = useHistory();

  // Schedule table styles (similar to SessionalDistribution)
  const scheduleTableStyle = {
    table: {
      width: '100%',
      margin: '0 auto',
      textAlign: 'center',
      backgroundColor: '#f8f9fa',
      boxShadow: '0 3px 12px rgba(0,0,0,0.1)',
      borderRadius: '8px',
      overflow: 'hidden',
      borderCollapse: 'separate',
      borderSpacing: 0,
      border: '1px solid rgb(194, 137, 248)'
    },
    headerCell: {
      width: '200px',
      textAlign: 'center',
      fontWeight: '600',
      padding: '12px 8px',
      background: 'linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(154, 77, 226) 100%)',
      color: 'white',
      border: 'none',
      fontSize: '0.9rem',
    },
    dayCell: {
      fontWeight: '600',
      background: 'linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(154, 77, 226) 100%)',
      color: 'white',
      width: '80px',
      border: 'none',
      padding: '12px 8px',
      fontSize: '0.9rem',
      verticalAlign: 'middle',
    },
    courseCell: {
      height: '100px',
      border: '1px solid rgb(194, 137, 248)',
      padding: '8px',
      fontSize: '0.85rem',
      verticalAlign: 'top',
      backgroundColor: 'white',
      width: '200px',
      minWidth: '200px',
    },
    courseItem: {
      padding: '10px',
      margin: '4px 0',
      borderRadius: '8px',
      transition: 'all 0.2s ease',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      position: 'relative',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    },
    alreadyScheduledCourseItem: {
      background: 'linear-gradient(135deg, rgba(195, 134, 252, 0.18) 0%, rgba(174, 117, 228, 0.1) 100%)',
      border: '2px solid rgb(194, 137, 248)',
      color: 'rgba(133, 47, 214, 1)',
    },
    courseTitle: {
      fontWeight: '600',
      fontSize: '0.9rem',
      marginBottom: '4px',
      width: '100%',
      textAlign: 'center',
    },
    sectionBadge: {
      backgroundColor: 'rgba(229, 200, 255, 1)',
      padding: '4px 8px',
      fontSize: '0.8rem',
      fontWeight: '600',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '4px',
      minWidth: '100px',
    },
  };

  // Modal styles for overlay
  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  };

  // Fetch all active departments on component mount
  useEffect(() => {
    loadData(
      getActiveDepartments,
      "Failed to load departments",
      setAllDepartments
    );
  }, [loadData]);

  // Fetch all level term batches when department changes
  useEffect(() => {
    if (selectedDepartment) {
      loadData(
        () => getDepartmentalLevelTermBatches(selectedDepartment),
        "Failed to load level terms",
        setAllLevelTermBatches
      );
    }
  }, [selectedDepartment, loadData]);

  // Fetch sections and courses when department or level term changes
  useEffect(() => {
    if (selectedDepartment && selectedLevelTermBatch) {
      // Load theory sections
      loadData(
        () =>
          getTheorySectionsByDeptAndLevelTerm(
            selectedDepartment,
            selectedLevelTermBatch.level_term
          ),
        "Failed to load theory sections",
        setAllTheorySections
      );

      // Load sessional sections
      loadData(
        () =>
          getSessionalSectionsByDeptAndLevelTerm(
            selectedDepartment,
            selectedLevelTermBatch.level_term
          ),
        "Failed to load sessional sections",
        setAllSessionalSections
      );

      // Load sessional courses
      loadData(
        () =>
          getSessionalCoursesByDeptLevelTerm(
            selectedDepartment,
            selectedLevelTermBatch.level_term
          ),
        "Failed to load sessional courses",
        setAllSessionalCourses
      );
    }
  }, [selectedDepartment, selectedLevelTermBatch, loadData]);

  // Load theory schedules when sections are available
  useEffect(() => {
    // Using loop load theory schedules for each section
    if (allTheorySections && allTheorySections.length > 0) {
      const loadingToast = toast.loading("Loading theory schedules...");
      setIsLoading(true);
      const loadTheorySchedules = async () => {
        try {
          // The API separates the main section from its lab subsections.
          const schedulesResults = await Promise.all(
            allTheorySections.map(async (section) => {
              const scheduleData = await getSchedules(
                selectedDepartment,
                selectedLevelTermBatch.batch,
                section.section
              );
              // Return an object with the section identifier and its schedules
              return {
                section: section.section,
                schedules: (scheduleData.mainSection || []).filter(
                  (slot) => Number(slot.type) === 0 || Number(slot.type) === 2
                ),
              };
            })
          );

          // Create a mapping object where keys are section identifiers and values are schedules
          const schedulesMap = {};
          schedulesResults.forEach((result) => {
            schedulesMap[result.section] = result.schedules;
          });

          setTheorySchedules(schedulesMap);

          toast.dismiss(loadingToast);
        } catch (error) {
          console.error("Error loading theory schedules:", error);
          toast.dismiss(loadingToast);
          toast.error("Failed to load theory schedules");
        } finally {
          setIsLoading(false);
        }
      };
      loadTheorySchedules();
    } else {
      setTheorySchedules({});
    }
  }, [allTheorySections, selectedDepartment, selectedLevelTermBatch]);

  // Group sections by main section and subsections - memoized to prevent unnecessary recalculation
  const groupedSections = useMemo(() => {
    if (!allSessionalSections || !allSessionalSections.length) {
      return {};
    }

    const groups = {};
    allSessionalSections.forEach((section) => {
      // Extract main section letter and subsection identifier
      // The first character is the main section (e.g., 'A' from 'A1')
      const mainSection = section.section.charAt(0); // A, B, C
      // The rest of the characters form the subsection identifier (could be '1', '2', '3', etc.)
      const subSection = section.section.substring(1);

      if (!groups[mainSection]) {
        groups[mainSection] = { subsections: {} };
      }

      // Create a proper sectionKey with batch, section, and department
      let sectionKey;
      if (
        selectedLevelTermBatch &&
        typeof selectedLevelTermBatch.batch !== "undefined"
      ) {
        sectionKey = `${selectedDepartment} ${selectedLevelTermBatch.batch} ${section.section}`;
      } else {
        console.warn(
          "Missing batch in selectedLevelTermBatch:",
          selectedLevelTermBatch
        );
        sectionKey = section.section;
      }

      groups[mainSection].subsections[subSection] = {
        ...section,
        sectionKey: sectionKey,
      };
    });

    return groups;
  }, [allSessionalSections, selectedLevelTermBatch, selectedDepartment]);

  // Get all section keys from grouped sections structure - memoized
  const getAllSectionKeys = useMemo(() => {
    const keys = [];
    Object.keys(groupedSections).forEach((mainSection) => {
      // Add main section key for 0.75 credit courses (e.g., "Department Batch A")
      const mainSectionKey = `${selectedDepartment} ${selectedLevelTermBatch?.batch} ${mainSection}`;
      if (selectedDepartment && selectedLevelTermBatch?.batch) {
        keys.push(mainSectionKey);
      }
      
      // Add subsection keys for other courses (e.g., "Department Batch A1", "Department Batch A2")
      Object.keys(groupedSections[mainSection].subsections).forEach(
        (subSection) => {
          keys.push(
            groupedSections[mainSection].subsections[subSection].sectionKey
          );
        }
      );
    });
    return keys;
  }, [groupedSections, selectedDepartment, selectedLevelTermBatch]);

  // Since we don't need to check theory schedules, simplify lab times computation
  const computedLabTimes = useMemo(() => {
    const result = [];
    days.forEach((day) => {
      possibleLabTimes.forEach((time) => {
        // Include all possible lab times without theory schedule constraints
        result.push(`${day} ${time}`);
      });
    });

    // Add any special lab time slots if needed
    return result;
  }, []);

  // Set lab times only once when computed lab times change
  useEffect(() => {
    setLabTimes(computedLabTimes);
  }, [computedLabTimes]);

  // Load schedules when sections, department or level term changes
  useEffect(() => {
    if (
      selectedLevelTermBatch &&
      selectedLevelTermBatch.batch &&
      selectedDepartment
    ) {
      const batch = selectedLevelTermBatch.batch;
      const department = selectedDepartment;

      // Safety check for sections
      if (!allSessionalSections || allSessionalSections.length === 0) {
        return;
      }

      // Show loading indicator
      const loadingSchedules = toast.loading("Loading schedules...");
      setIsLoading(true);

      // Create promises for fetching each section's schedule
      const loadScheduleForSection = async (section) => {
        // Create a proper section key
        const sectionKey = `${department} ${batch} ${section.section}`;

        // Validate the section key
        if (!validateSectionKey(sectionKey)) {
          return { sectionKey: null, schedules: [] };
        }

        try {
          const res = await getSessionalSchedules(batch, section.section);
          // Safety check - ensure res is an array
          const schedules = Array.isArray(res) ? res : [];

          // Filter by department and ensure exact section matches
          const filteredSchedules = schedules.filter(
            (s) => s.department === department && s.section === section.section
          );

          return {
            sectionKey: sectionKey,
            schedules: filteredSchedules,
          };
        } catch (error) {
          console.error(
            `Error fetching schedules for section ${section.section}:`,
            error
          );
          return {
            sectionKey: sectionKey,
            schedules: [],
          };
        }
      };

      // Also create promises for main sections (A, B, C) for 0.75 credit courses
      const loadScheduleForMainSection = async (mainSection) => {
        const mainSectionKey = `${department} ${batch} ${mainSection}`;

        try {
          const res = await getSessionalSchedules(batch, mainSection);
          // Safety check - ensure res is an array
          const schedules = Array.isArray(res) ? res : [];

          // Filter by department and ensure exact section matches
          const filteredSchedules = schedules.filter(
            (s) => s.department === department && s.section === mainSection
          );

          return {
            sectionKey: mainSectionKey,
            schedules: filteredSchedules,
          };
        } catch (error) {
          console.error(
            `Error fetching schedules for main section ${mainSection}:`,
            error
          );
          return {
            sectionKey: mainSectionKey,
            schedules: [],
          };
        }
      };

      // Get unique main sections from allSessionalSections
      const mainSections = [...new Set(allSessionalSections.map(s => s.section.charAt(0)))];

      // Execute all schedule loading operations in parallel
      const schedulePromises = [
        ...allSessionalSections.map(loadScheduleForSection),
        ...mainSections.map(loadScheduleForMainSection)
      ];

      Promise.all(schedulePromises)
        .then((results) => {
          toast.dismiss(loadingSchedules);
          const newLabSchedulesBySection = {};
          let validSchedulesCount = 0;
          results.forEach(({ sectionKey, schedules }) => {
            if (!sectionKey) return;
            newLabSchedulesBySection[sectionKey] = schedules;
            if (schedules.length > 0) {
              validSchedulesCount++;
            }
          });
          setLabSchedulesBySection(newLabSchedulesBySection);
          // Deep clone for original
          setOriginalLabSchedulesBySection(
            JSON.parse(JSON.stringify(newLabSchedulesBySection))
          );
          if (validSchedulesCount > 0) {
            toast.success(
              `Loaded schedules for ${validSchedulesCount} sections`
            );
          }
        })
        .catch((error) => {
          toast.dismiss(loadingSchedules);
          console.error("Error processing schedules:", error);
          toast.error("Failed to process schedules");
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setLabSchedulesBySection({});
    }
  }, [
    selectedLevelTermBatch,
    allSessionalCourses,
    allSessionalSections,
    selectedDepartment,
    reloadKey,
  ]);

  const getSelectedCourseSlots = useCallback(
    (sectionKey) => {
      if (!labSchedulesBySection[sectionKey]) return [];
      return labSchedulesBySection[sectionKey]
        .filter((slot) => slot.course_id === selectedCourse?.course_id)
        .map((slot) => `${slot.day} ${slot.time}`);
    },
    [labSchedulesBySection, selectedCourse]
  );

  // Handle slot changes efficiently
  const handleSlotChange = useCallback(
    (day, time, courseId, sectionKey) => {
      // Parse the section key
      const { department, batch, section } = parseSectionKey(sectionKey);

      if (!department || !batch || !section) {
        console.error(
          "Invalid section key format in handleSlotChange:",
          sectionKey
        );
        toast.error("Error processing section data");
        return;
      }

      // If courseId is empty, remove any existing assignment for this slot
      if (!courseId) {
        setIsChanged(true);
        setLabSchedulesBySection((prev) => ({
          ...prev,
          [sectionKey]: (prev[sectionKey] || []).filter(
            (slot) => !(slot.day === day && slot.time === time)
          ),
        }));

        return;
      }

      // Find the course object
      const course = allSessionalCourses.find((c) => c.course_id === courseId);
      if (!course) {
        toast.error("Invalid course selection");
        return;
      }

      // Optional courses of the same option may share a slot.
      const existingSlots = (labSchedulesBySection[sectionKey] || []).filter(
        (slot) => slot.day === day && slot.time === time
      );
      if (existingSlots.some((slot) => slot.course_id === courseId)) {
        toast.error(`${courseId} is already scheduled in this slot`);
        return;
      }
      const sameOption = Boolean(course.optional) && existingSlots.length > 0 &&
        existingSlots.every((slot) => {
          const scheduledCourse = allSessionalCourses.find((c) => c.course_id === slot.course_id);
          return Boolean(scheduledCourse?.optional) &&
            scheduledCourse.option_group != null &&
            scheduledCourse.option_group === course.option_group;
        });

      if (sameOption) {
        setIsChanged(true);
        setLabSchedulesBySection((prev) => ({
          ...prev,
          [sectionKey]: [...(prev[sectionKey] || []), { day, time, course_id: courseId, section, department }],
        }));
      } else if (existingSlots.length === 1) {
        // Replace the one course occupying this section's slot.
        setIsChanged(true);
        setLabSchedulesBySection((prev) => ({
          ...prev,
          [sectionKey]: [
            ...(prev[sectionKey] || []).filter(
              (slot) => !(slot.day === day && slot.time === time)
            ),
            { day, time, course_id: courseId, section, department },
          ],
        }));
      } else if (existingSlots.length > 1) {
        toast.error("Remove the elective courses in this slot before replacing the group");
        return;
      } else {
        // Add a new assignment
        // Check if adding this assignment is valid based on credit hours
        const selectedSlotsForCourse = (
          labSchedulesBySection[sectionKey] || []
        ).filter((slot) => slot.course_id === courseId).length;

        if (selectedSlotsForCourse >= Math.ceil(course.class_per_week)) {
          toast.error(
            `You can only select ${Math.ceil(
              course.class_per_week
            )} slots for ${courseId}`
          );
          return;
        }

        setIsChanged(true);
        setLabSchedulesBySection((prev) => ({
          ...prev,
          [sectionKey]: [
            ...(prev[sectionKey] || []),
            { day, time, course_id: courseId, section, department },
          ],
        }));
      }
    },
    [allSessionalCourses, labSchedulesBySection]
  );

  // Handle course removal with confirmation
  const handleCourseRemoval = useCallback((day, time, sectionKey, courseId) => {
    setCourseToRemove({ day, time, sectionKey, courseId });
    setShowConfirmation(true);
  }, []);

  // Execute course removal after confirmation
  const executeCourseRemoval = useCallback(() => {
    if (courseToRemove) {
      const { day, time, sectionKey, courseId } = courseToRemove;
      const updatedSchedules = { ...labSchedulesBySection };
      if (updatedSchedules[sectionKey]) {
        updatedSchedules[sectionKey] = updatedSchedules[sectionKey]
          .filter(slot => !(slot.day === day && slot.time === time && slot.course_id === courseId));
      }
      setLabSchedulesBySection(updatedSchedules);
      setIsChanged(true);
      toast.success("Course removed successfully");
    }
    setShowConfirmation(false);
    setCourseToRemove(null);
  }, [courseToRemove, labSchedulesBySection]);

  // Save all schedules efficiently
  const saveAllSchedules = useCallback(async () => {
    if (!selectedLevelTermBatch || !selectedLevelTermBatch.batch) {
      toast.error("Select a batch first");
      return;
    }
    if (!selectedDepartment) {
      toast.error("Select a department first");
      return;
    }
    if (getAllSectionKeys.length === 0) {
      toast.error("No sections found to save schedules for");
      return;
    }
    setIsLoading(true);
    const savingToast = toast.loading("Saving all schedules...");
    // For each section, find changed slots
    const savePromises = getAllSectionKeys.map(async (sectionKey) => {
      if (!sectionKey) return [];
      const { department, batch, section } = parseSectionKey(sectionKey);
      if (!department || !batch || !section) return [];
      const keyOf = (slot) => `${slot.day}|${slot.time}|${slot.course_id}`;
      const current = new Map((labSchedulesBySection[sectionKey] || []).map((slot) => [keyOf(slot), slot]));
      const original = new Map((originalLabSchedulesBySection[sectionKey] || []).map((slot) => [keyOf(slot), slot]));
      const removed = [...original].filter(([key]) => !current.has(key)).map(([, slot]) => slot);
      const added = [...current].filter(([key]) => !original.has(key)).map(([, slot]) => slot);
      const results = [];

      // Remove individual courses first, then add new ones. An elective slot
      // may contain several courses, so a day/time pair is not a unique key.
      for (const change of [
        ...removed.map((slot) => ({ slot, remove: true })),
        ...added.map((slot) => ({ slot, remove: false })),
      ]) {
        const { slot, remove } = change;
        try {
          await setSessionalSchedules(batch, section, department, {
            day: slot.day,
            time: slot.time,
            course_id: remove ? "None" : slot.course_id,
            ...(remove ? { old_course_id: slot.course_id } : { add: true }),
          });
          results.push({ success: true, section, slot: `${slot.day} ${slot.time}` });
        } catch (error) {
          results.push({
            success: false,
            section,
            slot: `${slot.day} ${slot.time}`,
            message: error?.response?.data?.error?.message,
          });
        }
      }
      return results;
    });
    Promise.all(savePromises)
      .then((results) => {
        toast.dismiss(savingToast);
        setIsLoading(false);
        setIsChanged(false);
        // After successful save, update originalLabSchedulesBySection to match current
        setOriginalLabSchedulesBySection(
          JSON.parse(JSON.stringify(labSchedulesBySection))
        );
        const flatResults = results.flat();
        const failures = flatResults.filter((r) => !r.success);
        const totalCount = flatResults.length;
        const successCount = totalCount - failures.length;
        if (failures.length === 0) {
          toast.success("All schedules saved successfully");
        } else {
          // Show why (e.g. a section clash) and reload what was really saved
          const reasons = failures.map((f) => f.message).filter(Boolean);
          toast.error(
            `${
              failures.length < totalCount
                ? `Saved ${successCount} out of ${totalCount} schedules.`
                : "Failed to save any schedules."
            }${reasons.length ? ` ${reasons.slice(0, 2).join(" · ")}` : ""}`,
            { duration: 8000 }
          );
          setReloadKey((k) => k + 1);
        }
      })
      .catch(() => {
        toast.dismiss(savingToast);
        setIsLoading(false);
        toast.error("Failed to save schedules");
      });
  }, [
    selectedLevelTermBatch,
    selectedDepartment,
    getAllSectionKeys,
    labSchedulesBySection,
    originalLabSchedulesBySection,
  ]);

  // Define a shared style object for modal action buttons (copied from Teachers.js)
  const modalButtonStyle = {
    borderRadius: "6px",
    padding: "10px 20px",
    fontWeight: "600",
    background: "rgba(154, 77, 226, 0.15)",
    border: "1px solid rgba(154, 77, 226, 0.5)",
    color: "rgb(154, 77, 226)",
    transition: "all 0.3s ease",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "1rem",
    position: "relative",
    overflow: "hidden",
  };

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

  // JSX for rendering the component UI is unchanged
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
            <Icon path={mdiAccountGroupOutline} size={1} color="white" />
          </div>
          Sessional Schedule Assign
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
              Sessional Schedule
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
                  position: "relative",
                  overflow: "hidden",
                  letterSpacing: "0.3px",
                }}
              >
                <span style={{ marginRight: "8px" }}>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19Z"
                      fill="rgb(194, 137, 248)"
                    />
                    <path
                      d="M7 12H9V17H7V12ZM11 7H13V17H11V7ZM15 9H17V17H15V9Z"
                      fill="rgb(194, 137, 248)"
                    />
                  </svg>
                </span>
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
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M12 3L1 9L12 15L23 9L12 3Z"
                          stroke="rgb(194, 137, 248)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M5 11.5V17L12 21L19 17V11.5"
                          stroke="rgb(194, 137, 248)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
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
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23c289f8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                        backgroundPosition: "right 14px center",
                        backgroundSize: "16px",
                        transition:
                          "all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)",
                        background:
                          "linear-gradient(to bottom, #ffffff, #fdfaff)",
                      }}
                      onChange={(e) => {
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
                      }}
                    >
                      <option value="">Select Department</option>
                      {allDepartments.map((department) => (
                        <option key={department} value={department}>
                          {department}
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
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M21 4H3C1.89543 4 1 4.89543 1 6V18C1 19.1046 1.89543 20 3 20H21C22.1046 20 23 19.1046 23 18V6C23 4.89543 22.1046 4 21 4Z"
                          stroke="rgb(194, 137, 248)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M16 12L8 12"
                          stroke="rgb(194, 137, 248)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M12 8L12 16"
                          stroke="rgb(194, 137, 248)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Level-Term
                    </label>
                    <Form.Select
                      id="levelTermSelect"
                      className="form-control btn-block"
                      value={
                        selectedLevelTermBatch
                          ? JSON.stringify(selectedLevelTermBatch)
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
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23c289f8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3Csvg%3E")`,
                        backgroundPosition: "right 14px center",
                        backgroundSize: "16px",
                        transition:
                          "all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)",
                        background:
                          "linear-gradient(to bottom, #ffffff, #fdfaff)",
                      }}
                      onChange={(e) => {
                        try {
                          const newValue = e.target.value
                            ? JSON.parse(e.target.value)
                            : null;

                          if (
                            newValue !== selectedLevelTermBatch &&
                            isChanged &&
                            !window.confirm(
                              "You have unsaved changes. Are you sure you want to continue?"
                            )
                          ) {
                            return;
                          }

                          // Ensure both batch and level_term are present
                          if (
                            newValue &&
                            (!newValue.batch || !newValue.level_term)
                          ) {
                            console.error(
                              "Invalid level term batch selected",
                              newValue
                            );
                            toast.error("Invalid level term batch data");
                            return;
                          }

                          setSelectedLevelTermBatch(newValue);
                        } catch (error) {
                          console.error(
                            "Error parsing level term batch:",
                            error
                          );
                          toast.error("Failed to parse level term batch data");
                        }
                      }}
                      disabled={!selectedDepartment}
                    >
                      <option value="">
                        {selectedDepartment
                          ? "Select Level-Term"
                          : "First select a department"}
                      </option>
                      {allLevelTermBatches.map((levelTermBatch) => (
                        <option
                          key={levelTermBatch.batch}
                          value={JSON.stringify(levelTermBatch)}
                        >
                          {levelTermBatch.level_term} ({levelTermBatch.batch}{" "}
                          Batch)
                        </option>
                      ))}
                    </Form.Select>
                  </div>
                </div>
              </Form>
              <div className="d-flex justify-content-between align-items-center mt-3">
                {isLoading && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      color: "rgb(154, 77, 226)",
                      fontWeight: "500",
                      background: "rgba(194, 137, 248, 0.08)",
                      padding: "8px 14px",
                      borderRadius: "20px",
                      boxShadow: "0 2px 6px rgba(194, 137, 248, 0.15)",
                      animation: "pulse-light 2s infinite ease-in-out",
                    }}
                  >
                    <span
                      className="spinner-border spinner-border-sm"
                      role="status"
                      aria-hidden="true"
                      style={{
                        color: "rgb(154, 77, 226)",
                        width: "20px",
                        height: "20px",
                      }}
                    ></span>
                    Loading data...
                    <style jsx="true">{`
                      @keyframes pulse-light {
                        0% {
                          opacity: 1;
                        }
                        50% {
                          opacity: 0.85;
                        }
                        100% {
                          opacity: 1;
                        }
                      }
                    `}</style>
                  </div>
                )}
                {selectedLevelTermBatch && (
                  <div className="ml-auto">
                    <Button
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
                      onClick={saveAllSchedules}
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
                        size={0.9}
                        style={{ marginRight: 8 }}
                      />
                      {isChanged ? "Save All Changes" : "No Changes to Save"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Display grouped section tables */}
      {selectedLevelTermBatch &&
        (Object.keys(groupedSections).length === 0 ? (
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
          // Render section tables
          Object.keys(groupedSections).map((mainSection) => {
            // Get all subsections for this main section
            const subsections = groupedSections[mainSection].subsections;
            const subsectionKeys = Object.keys(subsections);

            // Create simple array of section names for the table
            const subsectionNames = subsectionKeys.map((key) => {
              return subsections[key].section; // Just the section name like "A1", "A2"
            });

            return (
              <div className="row mb-4" key={`section-${mainSection}`}>
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
                            fontWeight: "600",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
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
                            {mainSection}
                          </span>
                          Section {mainSection} ({subsectionNames.length}{" "}
                          Subsections)
                        </h4>
                      </div>

                      {/* Custom schedule table styled like SessionalDistribution */}
                      <div style={{ marginTop: '20px' }}>
                        <div className="table-responsive" style={{ overflowX: 'auto', maxHeight: '80vh' }}>
                          <table style={{
                            ...scheduleTableStyle.table,
                            minWidth: `${possibleLabTimes.length * 200 + 100}px`
                          }}>
                            <thead>
                              <tr>
                                <th style={scheduleTableStyle.headerCell}>Day / Time</th>
                                {possibleLabTimes.map(time => (
                                  <th key={time} style={{
                                    ...scheduleTableStyle.headerCell,
                                    width: '200px',
                                    minWidth: '200px'
                                  }}>{time}:00</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {days.map((day) => (
                                <tr key={day}>
                                  <td style={scheduleTableStyle.dayCell}>{day}</td>
                                  {possibleLabTimes.map((time) => {
                                    const startIndex = times.findIndex((period) => Number(period) === Number(time));
                                    const labPeriods = startIndex < 0
                                      ? [Number(time)]
                                      : times.slice(startIndex, startIndex + 3).map(Number);
                                    const fixedCourses = [];
                                    const addFixedCourse = (slot) => {
                                      if (slot.day !== day || !labPeriods.includes(Number(slot.time))) return;
                                      const existing = fixedCourses.find((fixed) => fixed.course_id === slot.course_id);
                                      if (existing) {
                                        existing.periods.push(slot.time);
                                      } else {
                                        fixedCourses.push({ ...slot, periods: [slot.time] });
                                      }
                                    };
                                    (theorySchedules[mainSection] || []).forEach(addFixedCourse);
                                    Object.values(theorySchedules).flat()
                                      .filter((slot) => slot.optional && Number(slot.optional_section_count) <= 1)
                                      .forEach(addFixedCourse);
                                    const isTheorySlot = fixedCourses.length > 0;
                                    
                                    // Ensure subsectionNames is an array
                                    const subsections = Array.isArray(subsectionNames) ? subsectionNames : [];
                                    
                                    // Get all scheduled courses for this slot across all subsections
                                    const scheduledCourses = subsections.flatMap(subsection => {
                                      if (!selectedDepartment || !selectedLevelTermBatch || !selectedLevelTermBatch.batch) {
                                        return [];
                                      }
                                      
                                      const sectionKey = `${selectedDepartment} ${selectedLevelTermBatch.batch} ${subsection}`;
                                      const schedule = labSchedulesBySection[sectionKey] || [];
                                      return schedule
                                        .filter(slot => slot.day === day && Number(slot.time) === Number(time) && slot.course_id)
                                        .map(slot => ({
                                          course: allSessionalCourses.find(c => c.course_id === slot.course_id),
                                          subsection,
                                          sectionKey,
                                          courseId: slot.course_id
                                        }));
                                    });

                                    // Also check for courses scheduled in the main section (for 0.75 credit courses)
                                    const mainSectionKey = `${selectedDepartment} ${selectedLevelTermBatch.batch} ${mainSection}`;
                                    const mainSectionSchedule = labSchedulesBySection[mainSectionKey] || [];
                                    mainSectionSchedule
                                      .filter(slot => slot.day === day && Number(slot.time) === Number(time) && slot.course_id)
                                      .forEach(slot => {
                                      const course = allSessionalCourses.find(c => c.course_id === slot.course_id);
                                      scheduledCourses.push({
                                        course,
                                        subsection: mainSection,
                                        sectionKey: mainSectionKey,
                                        courseId: slot.course_id
                                      });
                                    });

                                    // A single-group elective lab serves every main section,
                                    // even though its assignment is stored under one group.
                                    const sharedOptionalCourses = Object.entries(labSchedulesBySection)
                                      .flatMap(([sectionKey, schedule]) => schedule
                                        .filter(slot => slot.day === day && Number(slot.time) === Number(time))
                                        .map(slot => ({
                                          course: allSessionalCourses.find(c => c.course_id === slot.course_id),
                                          sectionKey,
                                          courseId: slot.course_id,
                                        })))
                                      .filter(({ course }) => course?.optional && Number(course.optional_section_count) <= 1);
                                    const sharedElsewhere = sharedOptionalCourses.some(({ sectionKey }) =>
                                      !sectionKey.split(' ').pop().startsWith(mainSection)
                                    );
                                    sharedOptionalCourses.forEach(({ course, sectionKey, courseId }) => {
                                      if (!scheduledCourses.some((scheduled) => scheduled.courseId === courseId)) {
                                        scheduledCourses.push({ course, subsection: mainSection, sectionKey, courseId, readOnly: true });
                                      }
                                    });
                                    const isBlockedSlot = isTheorySlot || sharedElsewhere;
                                    
                                    return (
                                      <td 
                                        key={time} 
                                        style={{
                                          ...scheduleTableStyle.courseCell,
                                          backgroundColor: isBlockedSlot ? '#f8f9fa' : 'white',
                                          position: 'relative'
                                        }}
                                      >
                                        {/* Edit icon in top-right corner */}
                                        {!isBlockedSlot && (
                                          <div style={{
                                            position: 'absolute',
                                            top: '8px',
                                            right: '8px',
                                            zIndex: 2
                                          }}>
                                            <i
                                              className="mdi mdi-pencil"
                                              style={{
                                                color: '#667eea',
                                                cursor: 'pointer',
                                                fontSize: '1rem',
                                                padding: '4px',
                                                borderRadius: '50%',
                                                backgroundColor: 'white',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                                transition: 'all 0.2s ease',
                                              }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                // For edit, choose first available subsection or existing one
                                                let targetSubsection = subsections[0];
                                                let currentCourseId = null;
                                                
                                                // Check if there's already a course scheduled
                                                for (const subsection of subsections) {
                                                  const sectionKey = `${selectedDepartment} ${selectedLevelTermBatch.batch} ${subsection}`;
                                                  const schedule = labSchedulesBySection[sectionKey] || [];
                                                  const existingSlot = schedule.find(slot => slot.day === day && slot.time === time);
                                                  if (existingSlot && existingSlot.course_id) {
                                                    targetSubsection = subsection;
                                                    currentCourseId = existingSlot.course_id;
                                                    break;
                                                  }
                                                }
                                                
                                                if (subsections.length > 0) {
                                                  setSelectedCell({
                                                    day,
                                                    time,
                                                    sectionKey: `${selectedDepartment} ${selectedLevelTermBatch.batch} ${targetSubsection}`,
                                                    subsection: targetSubsection,
                                                    currentCourseId
                                                  });
                                                  setShowLabCoursesModal(true);
                                                }
                                              }}
                                              onMouseOver={(e) => {
                                                e.currentTarget.style.backgroundColor = '#667eea';
                                                e.currentTarget.style.color = 'white';
                                                e.currentTarget.style.transform = 'scale(1.1)';
                                              }}
                                              onMouseOut={(e) => {
                                                e.currentTarget.style.backgroundColor = 'white';
                                                e.currentTarget.style.color = '#667eea';
                                                e.currentTarget.style.transform = 'scale(1)';
                                              }}
                                            />
                                          </div>
                                        )}
                                        
                                        {fixedCourses.map((slot) => (
                                          <div
                                            key={`${slot.section}-${slot.course_id}`}
                                            style={{
                                              ...scheduleTableStyle.courseItem,
                                              backgroundColor: Number(slot.type) === 2 ? '#e8f2ff' : '#f0f0f4',
                                              border: Number(slot.type) === 2 ? '1px solid #8db8ed' : '1px solid #d4d4df',
                                              color: '#39445a',
                                            }}
                                            title={`${slot.name || slot.course_id} (${[...new Set(slot.periods)].map((period) => `${period}:00`).join(', ')})`}
                                          >
                                            <div style={scheduleTableStyle.courseTitle}>{slot.course_id}</div>
                                            <div style={scheduleTableStyle.sectionBadge}>
                                              {Number(slot.type) === 2 ? 'Thesis' : slot.optional ? 'Optional theory' : 'Theory'}
                                            </div>
                                          </div>
                                        ))}
                                        <>
                                            {scheduledCourses.map(({ course, subsection, sectionKey, courseId, readOnly }, index) => (
                                              <div 
                                                key={`${subsection}-${courseId}-${index}`}
                                                style={{
                                                  ...scheduleTableStyle.courseItem,
                                                  ...scheduleTableStyle.alreadyScheduledCourseItem,
                                                  cursor: readOnly ? 'default' : 'pointer',
                                                  margin: '2px 0',
                                                  position: 'relative'
                                                }}
                                              >
                                                <div style={scheduleTableStyle.courseTitle}>
                                                  {course && (course.course_id || course.course_code)
                                                    ? (course.course_id || course.course_code)
                                                    : `Course ${courseId || 'Unknown'}`
                                                  }
                                                </div>
                                                <div style={scheduleTableStyle.sectionBadge}>
                                                  {course?.optional && Number(course.optional_section_count) <= 1
                                                    ? Object.keys(groupedSections).join('/')
                                                    : formatSectionDisplay(subsection, course?.class_per_week || 1)}
                                                </div>
                                                {/* Shared electives are edited in their assigned group. */}
                                                {!readOnly && <div
                                                  style={{
                                                    position: 'absolute',
                                                    right: '8px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    cursor: 'pointer',
                                                    zIndex: 2
                                                  }}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Show confirmation modal before removing course
                                                    handleCourseRemoval(day, time, sectionKey, courseId);
                                                  }}
                                                >
                                                  <i
                                                    className="mdi mdi-close-circle"
                                                    style={{
                                                      color: '#dc3545',
                                                      fontSize: '1.2rem',
                                                      transition: 'all 0.2s ease'
                                                    }}
                                                    onMouseOver={(e) => {
                                                      e.currentTarget.style.color = '#c82333';
                                                      e.currentTarget.style.transform = 'scale(1.1)';
                                                    }}
                                                    onMouseOut={(e) => {
                                                      e.currentTarget.style.color = '#dc3545';
                                                      e.currentTarget.style.transform = 'scale(1)';
                                                    }}
                                                  />
                                                </div>}
                                              </div>
                                            ))}
                                        </>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
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
        @media (max-width: 900px) {
          .page-header {
            padding: 1rem !important;
            border-radius: 12px !important;
          }
          .page-title {
            font-size: 1.2rem !important;
          }
          .card-body {
            padding: 1rem !important;
          }
        }
        @media (max-width: 600px) {
          .page-header {
            padding: 0.7rem !important;
            border-radius: 10px !important;
          }
          .page-title {
            font-size: 1rem !important;
          }
          .card-body {
            padding: 0.7rem !important;
          }
          .row.mb-4,
          .row {
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
          .save-button {
            width: 100% !important;
            min-width: 0 !important;
            font-size: 0.98rem !important;
            padding: 10px 0 !important;
            margin-top: 10px !important;
          }
          .form-label,
          .form-control {
            font-size: 0.95rem !important;
          }
        }
        @media (max-width: 420px) {
          .page-header {
            padding: 0.4rem !important;
            border-radius: 8px !important;
          }
          .page-title {
            font-size: 0.85rem !important;
          }
          .card-body {
            padding: 0.4rem !important;
          }
          .save-button {
            font-size: 0.85rem !important;
            padding: 8px 0 !important;
          }
        }
      `}</style>
      
      {/* Course Selection Modal - SessionalDistribution Style */}
      {showLabCoursesModal && selectedCell && (
        <>
          <div style={overlayStyle} onClick={() => setShowLabCoursesModal(false)} />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(174, 117, 228, 0.15)',
            border: 'none',
            padding: '0',
            zIndex: 1000,
            maxWidth: '520px',
            maxHeight: '80vh',
            overflowY: 'auto',
            minWidth: '480px'
          }}>
            {/* Modern Modal Header - Fixed */}
            <div style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              background: 'linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(154, 77, 226) 100%)',
              borderRadius: '16px 16px 0 0',
              color: 'white',
              padding: '1.2rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 10px rgba(174, 117, 228, 0.10)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                  <i className="mdi mdi-plus-circle-outline" style={{ fontSize: '1.5rem', color: 'white' }}></i>
                </div>
                <div>
                  <span style={{ fontWeight: '700', fontSize: '1.2rem', display: 'block' }}>Add Sessional Course</span>
                  <span style={{ fontSize: '0.9rem', opacity: 0.9, fontWeight: '500' }}>
                    {selectedCell.subsection} - {selectedCell.day} {selectedCell.time}:00
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowLabCoursesModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  transition: 'all 0.2s',
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = 'rgb(154, 77, 226)';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                  e.currentTarget.style.color = 'white';
                }}
              >
                <i className="mdi mdi-close"></i>
              </button>
            </div>
            
            {/* Modal Content */}
            <div style={{
              padding: '1.5rem',
              background: 'white',
              borderRadius: '0 0 16px 16px',
            }}>
              {allSessionalCourses.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '2rem',
                  color: '#718096',
                  fontSize: '1rem'
                }}>
                  No sessional courses available for this department and level-term.
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gap: '16px',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                }}>
                  {allSessionalCourses.map((course) => {
                    const mainSection = selectedCell.subsection.charAt(0);
                    const mainSections = Object.keys(groupedSections).sort();
                    const targetMainSections = course.optional
                      ? mainSections.slice(0, Math.max(1, Number(course.optional_section_count) || 1))
                      : [mainSection];
                    const courseCards = [];
                    targetMainSections.forEach((group) => {
                      const targetSections = Number(course.class_per_week) === 0.75
                        ? [group]
                        : Object.values(groupedSections[group]?.subsections || {})
                          .map((subsection) => subsection.section)
                          .filter((section) => section !== group);
                      targetSections.forEach((targetSection) => {
                        const targetSectionKey = `${selectedDepartment} ${selectedLevelTermBatch.batch} ${targetSection}`;
                        const isAlreadyScheduled = labSchedulesBySection[targetSectionKey]?.some(slot => 
                          slot.day === selectedCell.day && 
                          Number(slot.time) === Number(selectedCell.time) &&
                          slot.course_id === course.course_id
                        ) || false;
                        courseCards.push({
                          section: targetSection,
                          sectionKey: targetSectionKey,
                          isAlreadyScheduled,
                          displayText: course.optional && Number(course.optional_section_count) <= 1
                            ? `All sections (${mainSections.join('/')}) · group ${targetSection}`
                            : `Section ${targetSection}`,
                          courseId: course.course_id
                        });
                      });
                    });
                    
                    return courseCards.map((cardInfo) => (
                      <div
                        key={`${course.course_id || course.id}-${cardInfo.section}`}
                        style={{
                          padding: '16px',
                          borderRadius: '12px',
                          border: cardInfo.isAlreadyScheduled ? '2px solid rgba(220, 53, 69, 0.3)' : '2px solid rgba(194, 137, 248, 0.2)',
                          backgroundColor: cardInfo.isAlreadyScheduled ? 'rgba(220, 53, 69, 0.05)' : 'rgba(255, 255, 255, 0.9)',
                          cursor: cardInfo.isAlreadyScheduled ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease',
                          position: 'relative',
                          opacity: cardInfo.isAlreadyScheduled ? 0.6 : 1,
                        }}
                        onClick={() => {
                          if (!cardInfo.isAlreadyScheduled) {
                            // Add course to the specific section for this card
                            handleSlotChange(selectedCell.day, selectedCell.time, cardInfo.courseId, cardInfo.sectionKey);
                            setShowLabCoursesModal(false);
                          }
                        }}
                        onMouseOver={e => {
                          if (!cardInfo.isAlreadyScheduled) {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 8px 25px rgba(174, 117, 228, 0.15)';
                            e.currentTarget.style.borderColor = 'rgba(194, 137, 248, 0.4)';
                          }
                        }}
                        onMouseOut={e => {
                          if (!cardInfo.isAlreadyScheduled) {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                            e.currentTarget.style.borderColor = 'rgba(194, 137, 248, 0.2)';
                          }
                        }}
                      >
                        <div style={{
                          fontWeight: '700',
                          fontSize: '1rem',
                          color: cardInfo.isAlreadyScheduled ? '#6c757d' : '#2d3748',
                          marginBottom: '8px',
                          lineHeight: '1.2'
                        }}>
                          {course.course_id || course.course_code}
                        </div>
                        <div style={{
                          fontSize: '0.85rem',
                          color: cardInfo.isAlreadyScheduled ? '#6c757d' : '#718096',
                          marginBottom: '8px',
                          fontWeight: '500'
                        }}>
                          {course.name}
                        </div>
                        <div style={{
                          fontSize: '0.8rem',
                          color: cardInfo.isAlreadyScheduled ? '#6c757d' : '#a0aec0',
                          fontWeight: '600',
                          marginBottom: '8px'
                        }}>
                          {course.class_per_week} hours/week
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          backgroundColor: 'rgba(194, 137, 248, 0.1)',
                          color: 'rgb(154, 77, 226)',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontWeight: '600',
                          textAlign: 'center'
                        }}>
                          {cardInfo.displayText}
                        </div>
                        {cardInfo.isAlreadyScheduled && (
                          <div style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            fontSize: '0.7rem',
                            backgroundColor: 'rgba(220, 53, 69, 0.1)',
                            color: '#dc3545',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: '600'
                          }}>
                            Already Scheduled
                          </div>
                        )}
                      </div>
                    ));
                  }).flat()}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Confirmation Modal for Course Removal */}
      {showConfirmation && courseToRemove && (
        <>
          <div style={overlayStyle} onClick={() => setShowConfirmation(false)} />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(174, 117, 228, 0.15)',
            border: 'none',
            padding: '0',
            zIndex: 1000,
            maxWidth: '480px',
            minWidth: '400px'
          }}>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
              borderRadius: '16px 16px 0 0',
              color: 'white',
              padding: '1.2rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 4px 10px rgba(220, 53, 69, 0.15)',
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
                <i className="mdi mdi-alert-circle-outline" style={{ fontSize: '1.5rem', color: 'white' }}></i>
              </div>
              <div>
                <span style={{ fontWeight: '700', fontSize: '1.2rem', display: 'block' }}>Confirm Removal</span>
                <span style={{ fontSize: '0.9rem', opacity: 0.9, fontWeight: '500' }}>
                  Remove course from schedule
                </span>
              </div>
            </div>
            
            {/* Modal Content */}
            <div style={{
              padding: '1.5rem',
              background: 'white',
              borderRadius: '0 0 16px 16px',
              textAlign: 'center'
            }}>
              <p style={{
                fontSize: '1rem',
                color: '#495057',
                marginBottom: '1.5rem',
                lineHeight: '1.5'
              }}>
                Are you sure you want to remove this course from the schedule?
                <br />
                <strong style={{ color: '#dc3545' }}>
                  {courseToRemove.day} {courseToRemove.time}:00
                </strong>
              </p>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => setShowConfirmation(false)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: '1px solid #6c757d',
                    backgroundColor: 'white',
                    color: '#6c757d',
                    cursor: 'pointer',
                    fontWeight: '500',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.backgroundColor = '#6c757d';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.color = '#6c757d';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={executeCourseRemoval}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: '1px solid #dc3545',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: '500',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.backgroundColor = '#c82333';
                    e.currentTarget.style.borderColor = '#c82333';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.backgroundColor = '#dc3545';
                    e.currentTarget.style.borderColor = '#dc3545';
                  }}
                >
                  Remove Course
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Utility functions

// Section key validation helper
const validateSectionKey = (sectionKey) => {
  if (!sectionKey) {
    return false;
  }

  const parts = sectionKey.split(" ");
  if (parts.length < 3) {
    return false;
  }

  // Format is "department batch section"
  const department = parts[0];
  const batch = parts[1];
  const section = parts[2];

  return !!(department && batch && section);
};

// Data loading hook for common async pattern
const useLoadData = () => {
  const loadData = useCallback(async (loadFn, errorMessage, setStateFn) => {
    try {
      const response = await loadFn();
      if (response && response.data) {
        setStateFn(response.data);
        return response.data;
      } else {
        toast.error(errorMessage);
        return [];
      }
    } catch (error) {
      console.error(`${errorMessage}:`, error);
      toast.error(errorMessage);
      return [];
    }
  }, []);

  return { loadData };
};

// Parse section key into components
const parseSectionKey = (sectionKey) => {
  if (!sectionKey) return { department: null, batch: null, section: null };

  const parts = sectionKey.split(" ");
  if (parts.length >= 3) {
    return {
      department: parts[0],
      batch: parts[1],
      section: parts[2],
    };
  }

  console.error("Invalid section key format:", sectionKey);
  return {
    department: parts[0] || null,
    batch: parts[1] || null,
    section: null,
  };
};
