import { useState, useEffect } from 'react';
import { useConfig } from '../shared/ConfigContext';
import { Button, Modal } from 'react-bootstrap';

// Database and API imports
import { getTeacher } from '../api/db-crud';
import {
  getTeacherTheoryAssigments,
  getTeacherSessionalAssignment,
  setTeacherSessionalAssignment,
  deleteTeacherSessionalAssignment,
  getSessionalTeachers,
  getTeacherTotalCredit
} from '../api/theory-assign';
import { getCourseAllSchedule, getCourseSectionalSchedule } from '../api/theory-schedule';
import { getDepartmentalSessionalSchedule } from '../api/sessional-schedule';

// UI components and utilities
import toast from 'react-hot-toast';

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

// Add some custom styles for the schedule table
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
    backgroundColor: 'rgba(194, 137, 248, 0.2)',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    border: '1px solid rgb(194, 137, 248)',
  },
  addButton: {
    position: 'absolute',
    right: '8px',
    top: '8px',
    padding: '4px 8px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: '#218838'
    }
  },
  alreadyScheduledCourseItem: {
    background: 'rgba(40, 167, 69, 0.15)',
    border: '1px solid #28a745',
    color: '#28a745',
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
  teacherBadge: {
    backgroundColor: 'rgba(0, 150, 136, 0.18)',
    color: '#00838f',
    padding: '4px 8px',
    fontSize: '0.8rem',
    fontWeight: '600',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '4px',
    width: '100%',
  },
  noTeacher: {
    backgroundColor: 'rgba(220, 53, 69, 0.18)',
    color: '#dc3545',
    padding: '4px 8px',
    fontSize: '0.8rem',
    fontWeight: '600',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '4px',
    width: '100%',
  },
};

/**
 * CourseTeachers Component
 * 
 * Fetches and displays the teachers assigned to a specific course section.
 * Handles loading states and displays appropriate messages if no teachers are assigned.
 */
function CourseTeachers({ courseId, section, fetchTeachers, isAlreadyScheduled, currentTeacherId, refreshKey }) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadTeachers = async () => {
      try {
        setLoading(true);
        const teachersList = await fetchTeachers(courseId, section);

        if (isMounted) {
          setTeachers(teachersList);
          setLoading(false);
        }
      } catch (error) {
        console.error(`Error loading teachers for ${courseId} (${section}):`, error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadTeachers();

    return () => {
      isMounted = false;
    };
  }, [courseId, section, fetchTeachers, refreshKey]); // Added refreshKey as dependency

  const textStyle = isAlreadyScheduled ? { color: '#28a745' } : {};

  if (loading) {
    return <span style={{ ...textStyle, fontSize: '0.85rem' }}>Loading teachers...</span>;
  }

  if (teachers.length === 0) {
    return <span style={{ ...textStyle, fontSize: '0.85rem' }}>No teachers assigned</span>;
  }

  return (
    <div style={{ fontSize: '0.85rem', marginTop: '3px' }}>
      <span style={textStyle}>Teachers: </span>
      <span style={textStyle}>
        {teachers.map((teacher, index) => (
          <span key={teacher.initial}>
            <span style={{ fontWeight: teacher.initial === currentTeacherId ? '600' : 'normal' }}>
              {teacher.initial}
            </span>
            {index < teachers.length - 1 ? ', ' : ''}
          </span>
        ))}
      </span>
    </div>
  );
}

/**
 * TeacherDetails Component
 * 
 * Displays detailed information about a teacher and allows for course assignments.
 * This component handles both theory and sessional course assignments, schedules,
 * and status management. It provides interfaces for selecting and assigning courses,
 * viewing existing assignments, and managing schedule conflicts.
 */
export default function TeacherDetails(props) {
  // Get the teacher ID and callback from props
  const { teacherId, onAssignmentChange } = props;

  // Memoized values for configuration settings
  const { days, times, possibleLabTimes } = useConfig();

  const [departmentalSessionalSchedules, setdepartmentalSessionalSchedules] = useState([]); // All available sessional schedules

  // Basic teacher information
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totalCredits, setTotalCredits] = useState(0);
  const [loadingCredits, setLoadingCredits] = useState(false);

  // Course and assignment data
  const [assignedTheoryCourses, setAssignedTheoryCourses] = useState([]);       // Assigned theory courses
  const [assignedSessionalCourses, setAssignedSessionalCourses] = useState([]); // Assigned sessional courses
  const [theorySchedule, setTheorySchedule] = useState([]);                     // Theory schedules
  const [sessionalSchedule, setSessionalSchedule] = useState([]);               // Sessional schedules

  // Selection and schedule tracking
  const [selectedSessionalSchedules, setSelectedSessionalSchedules] = useState([]); // Selected course schedules

  // Cache for course teachers to avoid redundant API calls
  const [courseTeachersCache, setCourseTeachersCache] = useState({});
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [submittingSessional, setSubmittingSessional] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Add refresh key to trigger re-renders

  const [selectedAssignment, setSelectedAssignment] = useState(null);


  useEffect(() => {
    // Fetch all sessional schedules on component mount
    getDepartmentalSessionalSchedule().then(data => {
      setdepartmentalSessionalSchedules(data);
    }).catch(error => {
      console.error("Error fetching all schedules:", error);
      toast.error("Failed to load all schedules");
    });
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all data in parallel for better performance
        const [
          teacherData,
          assignedTheoryCoursesData,
          assignedSessionalCoursesData,
        ] = await Promise.all([
          getTeacher(teacherId).catch(error => {
            console.error("Error fetching teacher data:", error);
            toast.error("Failed to load teacher information");
            return null;
          }),
          getTeacherTheoryAssigments(teacherId).catch(error => {
            console.error("Error fetching assigned theory courses:", error);
            toast.error("Failed to load assigned theory courses");
            return [];
          }),
          getTeacherSessionalAssignment(teacherId).catch(error => {
            console.error("Error fetching assigned sessional courses:", error);
            toast.error("Failed to load assigned sessional courses");
            return [];
          })
        ]);

        setTeacher(teacherData);
        setAssignedTheoryCourses(assignedTheoryCoursesData);
        setAssignedSessionalCourses(assignedSessionalCoursesData);
      } catch (error) {
        console.error("Error fetching teacher details:", error);
        toast.error("Failed to load teacher details");
      } finally {
        setLoading(false);
      }
    };
    if (teacherId) {
      // Only fetch data if teacherId is provided
      fetchData();
    }
  }, [teacherId]);

  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        setLoadingSchedules(true);

        // Create arrays to hold the promises for each course
        const theoryPromises = assignedTheoryCourses.map(course =>
          getCourseAllSchedule(teacherId, course.course_id).catch(error => {
            console.error(`Error fetching schedule for teacher ${teacherId} course ${course.course_id}:`, error);
            return []; // Return empty array for failed requests
          })
        );

        const sessionalPromises = assignedSessionalCourses.map(course =>
          getCourseSectionalSchedule(course.course_id, course.section).catch(error => {
            console.error(`Error fetching sessional schedules for ${course.batch} ${course.section}:`, error);
            return []; // Return empty array for failed requests
          })
        );

        // Fetch all schedules in parallel - one array for theory, one for sessional
        const [theoryResults, sessionalResults] = await Promise.all([
          Promise.all(theoryPromises),
          Promise.all(sessionalPromises)
        ]);

        // Flatten results if needed (depends on your API response structure)
        const theorySchedules = theoryResults.flat();
        const sessionalSchedules = sessionalResults.flat();

        // Update state with fetched schedules
        setTheorySchedule(theorySchedules);
        setSessionalSchedule(sessionalSchedules);

        // Schedules have been fetched successfully
      } catch (error) {
        console.error("Error fetching schedules:", error);
        toast.error("Failed to load schedules");
      } finally {
        // Always set loading to false when done, whether successful or not
        setLoadingSchedules(false);
      }
    };

    if (assignedTheoryCourses.length > 0 || assignedSessionalCourses.length > 0) {
      fetchSchedules();
    }
  }, [assignedTheoryCourses, assignedSessionalCourses, teacherId]);

  // Fetch total credits whenever teacher assignments change
  useEffect(() => {
    const fetchTotalCredits = async () => {
      if (!teacherId) return;
      
      try {
        setLoadingCredits(true);
        const creditData = await getTeacherTotalCredit(teacherId);
        setTotalCredits(creditData?.totalCredit || 0);
      } catch (error) {
        console.error("Error fetching teacher total credits:", error);
        setTotalCredits(0); // Set to 0 on error
      } finally {
        setLoadingCredits(false);
      }
    };

    fetchTotalCredits();
  }, [teacherId, assignedTheoryCourses, assignedSessionalCourses]); // Refetch when assignments change

  /**
   * Check for time conflicts with existing schedules
   * @param {string} day - The day to check
   * @param {number} time - The time slot to check
   * @returns {object} - Detailed conflict information
   */
  const hasTimeConflict = (day, time) => {
    // Check theory schedules for conflicts
    const theoryConflict = theorySchedule.some(schedule =>
      schedule.day === day &&
      (schedule.time === time ||
        schedule.time === (time % 12) + 1 ||
        schedule.time === ((time + 1) % 12) + 1)
    );

    // Check already assigned sessional courses for conflicts - two methods:
    // 1. Direct check: Look for courses in assignedSessionalCourses that have day/time info
    // 2. Schedule lookup: Find sessionalSchedule items that match this day/time and 
    //    correspond to a course in assignedSessionalCourses

    const directAssignedConflict = assignedSessionalCourses.some(course =>
      course.day === day && course.time === time
    );

    const scheduleAssignedConflict = !directAssignedConflict && sessionalSchedule.some(schedule =>
      schedule.day === day &&
      schedule.time === time &&
      assignedSessionalCourses.some(course =>
        course.course_id === schedule.course_id &&
        course.section === schedule.section
      )
    );

    const assignedSessionalConflict = directAssignedConflict || scheduleAssignedConflict;

    // Check if already selected in this time slot for the current selection process
    const alreadySelected = selectedSessionalSchedules.some(selected =>
      selected.day === day && selected.time === time
    );

    // Determine conflict type prioritizing the most restrictive conflict
    // Order of priority: theory > already-scheduled > selected
    const type = theoryConflict ? 'theory' :
      (assignedSessionalConflict ? 'already-scheduled' :
        (alreadySelected ? 'selected' : null));

    return {
      hasConflict: theoryConflict || assignedSessionalConflict || alreadySelected,
      theoryConflict,
      assignedSessionalConflict,
      alreadySelected,
      type
    };
  };

  /**
   * Get details about conflicting schedules for a specific day and time
   * This helps provide better user feedback about which specific classes conflict
   * @param {string} day - The day to check
   * @param {number} time - The time slot to check
   * @returns {Array} - Array of conflict details grouped by type
   */
  const getConflictDetails = (day, time) => {
    const details = [];

    // 1. Check theory schedules
    const conflictingTheory = theorySchedule.filter(schedule =>
      schedule.day === day && schedule.time === time
    );

    if (conflictingTheory.length > 0) {
      details.push({
        type: 'theory',
        courses: conflictingTheory.map(s => ({
          id: s.course_id,
          time: s.time || time
        }))
      });
    }

    // 2. Check already assigned sessional courses - two approaches:
    const alreadyScheduledSessional = [];

    // a) First check for direct assignments with day/time info
    const directScheduledCourses = assignedSessionalCourses.filter(course =>
      course.day === day && course.time === time
    );

    directScheduledCourses.forEach(course => {
      alreadyScheduledSessional.push({
        id: course.course_id,
        section: course.section || 'Unknown',
        batch: course.batch || 'All',
        day: course.day,
        time: course.time,
        class_per_week: course.class_per_week
      });
    });

    // b) Then check through sessional schedule
    // If we don't have any direct conflicts yet, check through the schedule
    if (alreadyScheduledSessional.length === 0) {
      assignedSessionalCourses.forEach(course => {
        const courseSchedule = sessionalSchedule.find(schedule =>
          schedule.course_id === course.course_id &&
          schedule.section === course.section &&
          schedule.day === day &&
          schedule.time === time
        );

        if (courseSchedule) {
          alreadyScheduledSessional.push({
            id: course.course_id,
            section: course.section || courseSchedule.section || 'Unknown',
            batch: course.batch || 'All',
            day: day,
            time: time
          });
        }
      });
    }

    if (alreadyScheduledSessional.length > 0) {
      details.push({
        type: 'already-scheduled',
        courses: alreadyScheduledSessional
      });
    }

    return details;
  };

  /**
   * Generate detailed tooltip text for conflicts
   * Uses the conflict details to create a more descriptive tooltip
   * @param {string} day - The day to check
   * @param {number} time - The time slot to check
   * @returns {string} - Multi-line tooltip text
   */
  const generateConflictTooltip = (day, time) => {
    // Get conflicts for all three lab hours (lab sessions are 3 hours)
    // Using spread syntax to combine arrays efficiently
    const details = [
      ...getConflictDetails(day, time),
      ...getConflictDetails(day, time + 1),
      ...getConflictDetails(day, time + 2)
    ];

    if (details.length === 0) return '';

    // Format the tooltip text with each conflict on a new line
    const tooltips = [];

    // Helper function to process and format conflict details by type
    const formatConflictsByType = (details, type, headerText, formatCourse) => {
      const filteredDetails = details.filter(d => d.type === type);

      if (filteredDetails.length > 0) {
        tooltips.push(headerText);

        // Loop through each conflict detail and format each course
        filteredDetails.forEach(detail => {
          detail.courses.forEach(course => {
            tooltips.push(formatCourse(course));
          });
        });
      }
    };

    // Format theory conflicts
    formatConflictsByType(
      details,
      'theory',
      'Theory class conflicts:',
      course => `  • ${course.id} (At: ${course.time}:00)`
    );

    // Format already scheduled sessional conflicts
    formatConflictsByType(
      details,
      'already-scheduled',
      'Already assigned courses:',
      course => `  • ${course.id} (Section: ${course.section}${course.batch ? `, Batch: ${course.batch}` : ''})`
    );

    // Format other sessional conflicts
    formatConflictsByType(
      details,
      'sessional',
      'Sessional class conflicts:',
      course => `  • ${course.id} (Section: ${course.section})`
    );

    // Join all tooltip lines with newline characters
    return tooltips.join('\n');
  };

  // Simple selectable sessional schedule table
  const SessionalScheduleTable = ({ schedules, selectedSchedules, onSelectSchedule }) => {
    // Use possibleLabTimes for lab times
    const labTimes = possibleLabTimes;
    // Create a map of day -> time -> courses (array)
    const scheduleMap = {};
    // Initialize schedule map with empty arrays for each cell
    days.forEach(day => {
      scheduleMap[day] = {};
      labTimes.forEach(time => {
        scheduleMap[day][time] = [];
      });
    });

    // Build a map of all conflicts for each day and time slot
    // This improves performance by calculating conflicts once
    const conflictMap = days.reduce((dayMap, day) => {
      // Initialize map for this day
      dayMap[day] = {};

      // For each time slot in this day
      labTimes.forEach(time => {
        // Get detailed conflict information
        const timeConflict = hasTimeConflict(day, time);

        // Special handling for 'selected' conflicts - these aren't blocking
        // but we want to keep the type for styling purposes
        if (timeConflict.type === 'selected') {
          dayMap[day][time] = {
            ...timeConflict,
            hasConflict: false, // Mark as non-blocking
            type: 'selected'    // Keep type for styles
          };
        } else {
          dayMap[day][time] = timeConflict;
        }
      });

      return dayMap;
    }, {});

    // Fill in the schedule map with courses, avoiding duplicates
    schedules.forEach(schedule => {
      const day = schedule.day;
      const displayTime = schedule.time;
      if (scheduleMap[day] && scheduleMap[day][displayTime]) {
        const alreadyExists = scheduleMap[day][displayTime].some(
          s => s.course_id === schedule.course_id &&
            (s.section || '') === (schedule.section || '') &&
            (s.batch || '') === (schedule.batch || '')
        );
        if (!alreadyExists) {
          scheduleMap[day][displayTime].push({
            ...schedule,
            course_id: schedule.course_id,
            section: schedule.section || '',
            batch: schedule.batch || ''
          });
        }
      }
    });
    return (
      <div className="table-responsive">
        <table className="table table-bordered" style={scheduleTableStyle.table}>
          <thead>
            <tr>
              <th style={scheduleTableStyle.dayCell}>Day / Time</th>
              {labTimes.map(time => (
                <th key={time} style={scheduleTableStyle.headerCell}>
                  {time}:00
                  {time === 12 && <span className="ms-1">(PM)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map(day => {
              const merged = Array(labTimes.length).fill(false);
              return (
                <tr key={day}>
                  <th style={scheduleTableStyle.dayCell}>{day}</th>
                  {labTimes.map((time, timeIdx) => {
                    if (merged[timeIdx]) return null; // Skip merged cells
                    const courseInfoArray = scheduleMap[day][time];
                    const hasSchedules = courseInfoArray.length > 0;
                    if (hasSchedules) {
                      const courseInfo = courseInfoArray[0];
                      const mergeLength = 3;
                      let canMerge = true;
                      for (let offset = 1; offset < mergeLength; offset++) {
                        const nextTime = labTimes[timeIdx + offset];
                        if (!nextTime) { canMerge = false; break; }
                        const nextCell = scheduleMap[day][nextTime];
                        if (!nextCell.some(s => s.course_id === courseInfo.course_id && s.section === courseInfo.section && s.batch === courseInfo.batch)) {
                          canMerge = false;
                          break;
                        }
                      }
                      if (canMerge) {
                        for (let offset = 1; offset < mergeLength; offset++) {
                          if (timeIdx + offset < merged.length) merged[timeIdx + offset] = true;
                        }
                        return (
                          <td
                            key={`${day}-${time}`}
                            colSpan={3}
                            style={{
                              ...scheduleTableStyle.courseCell,
                              ...scheduleTableStyle.selectableCell
                            }}
                            className="text-center"
                          >
                            <div
                              onClick={() => onSelectSchedule({ ...courseInfo, day, time })}
                              style={{
                                ...scheduleTableStyle.courseItem,
                                ...getCourseColorStyles(courseInfo.course_id, courseInfo.section),
                                ...(selectedSchedules.some(selected =>
                                  selected.day === day &&
                                  selected.time === time &&
                                  selected.course_id === courseInfo.course_id &&
                                  selected.section === courseInfo.section &&
                                  selected.batch === courseInfo.batch)
                                  ? scheduleTableStyle.selectedCourseItem
                                  : {})
                              }}
                              title={`${courseInfo.course_id} - Section ${formatSectionDisplay(courseInfo.section, courseInfo.class_per_week)} (Batch ${courseInfo.batch})`}
                            >
                              <strong>{courseInfo.course_id}</strong>
                              <br />
                              {courseInfo.section && <span>Section: {formatSectionDisplay(courseInfo.section, courseInfo.class_per_week)}</span>}
                              {courseInfo.batch && <span> | Batch: {courseInfo.batch}</span>}
                            </div>
                          </td>
                        );
                      }
                    }
                    // If not merging, render as usual
                    const conflict = conflictMap[day][time].hasConflict;
                    const conflictType = conflictMap[day][time].type;

                    /**
                     * Get conflict styling and information based on conflict type
                     * This helper consolidates styling and feedback logic for different conflict types
                     */
                    const getConflictInfo = (conflict, conflictType, day, time, selectedSchedules) => {
                      // Default values
                      let style = {};
                      let icon = null;
                      let tooltip = '';

                      if (!conflict) return { style, icon, tooltip };

                      // Common position styling
                      const baseStyle = { position: 'relative' };

                      // Style and feedback configuration by conflict type
                      const conflictConfig = {
                        theory: {
                          style: {
                            backgroundColor: 'rgba(220, 53, 69, 0.1)',
                            border: '2px dashed #dc3545',
                          },
                          icon: <i className="mdi mdi-book-open-variant text-danger"></i>,
                          defaultTooltip: 'You have a theory class at this time'
                        },
                        'already-scheduled': {
                          style: {
                            backgroundColor: 'rgba(40, 167, 69, 0.1)',
                            border: '2px solid #28a745',
                          },
                          icon: <i className="mdi mdi-calendar-check text-success"></i>,
                          defaultTooltip: 'You are already assigned to a sessional class at this time'
                        },
                        selected: {
                          style: {
                            backgroundColor: 'rgba(23, 162, 184, 0.1)',
                            border: '2px dashed #17a2b8',
                          },
                          icon: <i className="mdi mdi-check-circle-outline text-info"></i>,
                          defaultTooltip: 'You already selected a course for this time slot'
                        }
                      };

                      // Get configuration for current conflict type
                      const config = conflictConfig[conflictType] || {};

                      if (config) {
                        style = { ...baseStyle, ...config.style };
                        icon = config.icon;

                        // Generate tooltip based on conflict type
                        if (conflictType === 'selected') {
                          // Get details of the already selected course
                          const selectedCourse = selectedSchedules.find(s => s.day === day && s.time === time);
                          tooltip = selectedCourse
                            ? `Already selected: ${selectedCourse.course_id} (Section ${formatSectionDisplay(selectedCourse.section, selectedCourse.class_per_week)})`
                            : config.defaultTooltip;
                        } else {
                          tooltip = generateConflictTooltip(day, time) || config.defaultTooltip;
                        }
                      }

                      return { style, icon, tooltip };
                    };

                    // Get conflict styling and information
                    const { style: conflictStyle, icon: conflictIcon, tooltip: conflictTooltip } =
                      getConflictInfo(conflict, conflictType, day, time, selectedSchedules);

                    return (
                      <td
                        key={`${day}-${time}`}
                        style={{
                          ...scheduleTableStyle.courseCell,
                          ...(hasSchedules && (!conflict || conflictType === 'selected') ? scheduleTableStyle.selectableCell : {}),
                          ...conflictStyle
                        }}
                        className="text-center"
                        title={conflict ? conflictTooltip : ''}
                      >
                        {/* Show conflict indicator */}
                        {conflict && (
                          <div
                            style={{ position: 'absolute', top: '2px', right: '2px' }}
                            onClick={() => {
                              // Show a properly formatted toast notification when clicking the conflict icon
                              const formattedTooltip = conflictTooltip.split('\n').map((line, i) => (
                                <div key={i} style={{ marginBottom: i !== conflictTooltip.split('\n').length - 1 ? '4px' : '0' }}>
                                  {line}
                                </div>
                              ));
                              toast.custom(
                                <div className="bg-white shadow-lg rounded-lg px-4 py-3 border border-gray-200" style={{ maxWidth: '350px' }}>
                                  <div className="flex items-center mb-2">
                                    {conflictIcon}
                                    <span className="ml-2 font-semibold">Time Slot Conflict</span>
                                  </div>
                                  <div className="text-sm">{formattedTooltip}</div>
                                </div>,
                                { duration: 500 }
                              );
                            }}
                          >
                            {conflictIcon}
                          </div>
                        )}

                        {/* Show course info if available */}
                        {hasSchedules && (
                          <div className="d-flex flex-column">
                            {courseInfoArray.map((courseInfo, idx) => {
                              // Check if this course is already scheduled for the teacher
                              const isAlreadyScheduled = conflictType === 'already-scheduled' &&
                                getConflictDetails(day, time)
                                  .filter(d => d.type === 'already-scheduled')
                                  .flatMap(detail => detail.courses)
                                  .some(course => course.id === courseInfo.course_id && course.section === courseInfo.section);

                              const isSelected = selectedSchedules.some(selected =>
                                selected.day === day &&
                                selected.time === time &&
                                selected.course_id === courseInfo.course_id &&
                                selected.section === courseInfo.section &&
                                selected.batch === courseInfo.batch);
                              return (
                                <div
                                  key={`${courseInfo.course_id}-${courseInfo.section}-${idx}`}
                                  onClick={() => {
                                    // Function to show tooltip for blocking conflicts
                                    const showConflictTooltip = () => {
                                      // Format tooltip text with proper spacing
                                      const formattedTooltip = conflictTooltip.split('\n').map((line, i) => (
                                        <div
                                          key={i}
                                          style={{
                                            marginBottom: i !== conflictTooltip.split('\n').length - 1 ? '4px' : '0'
                                          }}
                                        >
                                          {line}
                                        </div>
                                      ));

                                      // Show a custom toast with the formatted tooltip
                                      toast.custom(
                                        <div className="bg-white shadow-lg rounded-lg px-4 py-3 border border-gray-200" style={{ maxWidth: '350px' }}>
                                          <div className="flex items-center mb-2">
                                            {conflictIcon}
                                            <span
                                              className="ml-2 font-semibold"
                                              style={{ color: isAlreadyScheduled ? '#28a745' : '#dc3545' }}
                                            >
                                              {isAlreadyScheduled ? 'Already Assigned' : 'Cannot Select Time Slot'}
                                            </span>
                                          </div>
                                          <div className="text-sm">{formattedTooltip}</div>
                                        </div>,
                                        { duration: 500 }
                                      );
                                    };

                                    // Handle click based on conflict status
                                    if (conflictType === 'theory') {
                                      showConflictTooltip();
                                      return;
                                    }

                                    // For already assigned courses, show options
                                    if (isAlreadyScheduled) {
                                      setSelectedAssignment(courseInfo);
                                      return;
                                    }

                                    // Allow selection if not blocked
                                    onSelectSchedule({ ...courseInfo, day, time });
                                  }}
                                  style={{
                                    ...scheduleTableStyle.courseItem,
                                    ...(isSelected ? scheduleTableStyle.selectedCourseItem : {}),
                                    ...(isAlreadyScheduled ? scheduleTableStyle.alreadyScheduledCourseItem : {}),
                                    ...(!isAlreadyScheduled && !isSelected ? getCourseColorStyles(courseInfo.course_id, courseInfo.section) : {}),
                                    ...((conflict && conflictType !== 'selected' && !isAlreadyScheduled) ? { opacity: 0.7 } : {}),
                                    cursor: 'pointer', // Make all courses clickable
                                    position: 'relative'
                                  }}
                                  // Keep a simple title for non-conflict items
                                  title={!conflict ? `${courseInfo.course_id} - Section ${formatSectionDisplay(courseInfo.section, courseInfo.class_per_week)} (Batch ${courseInfo.batch})` : ''}
                                >
                                  <strong style={isAlreadyScheduled ? { color: '#28a745' } : {}}>{courseInfo.course_id} ({formatSectionDisplay(courseInfo.section, courseInfo.class_per_week)})</strong>
                                  <br />
                                  {courseInfo.section && (
                                    <CourseTeachers
                                      courseId={courseInfo.course_id}
                                      section={courseInfo.section}
                                      fetchTeachers={fetchCourseTeachers}
                                      isAlreadyScheduled={isAlreadyScheduled}
                                      currentTeacherId={teacherId}
                                      refreshKey={refreshKey}
                                    />
                                  )}
                                  {isAlreadyScheduled && (
                                    <div style={{
                                      position: 'absolute',
                                      top: '3px',
                                      right: '6px',
                                      fontSize: '11px',
                                      color: '#28a745',
                                      fontWeight: 'normal'
                                    }}>
                                      <i className="mdi mdi-check-circle ml-1" style={{ fontSize: '14px', color: '#28a745' }}></i>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  /**
   * Fetches teachers for a specific course and section
   * @param {string} courseId - The course ID
   * @param {string} section - The section
   * @returns {Promise<Array>} - Promise resolving to an array of teachers
   */
  const fetchCourseTeachers = async (courseId, section) => {
    // Create a cache key for this course-section combination
    const cacheKey = `${courseId}-${section}`;

    // Check if we already have this data cached
    if (courseTeachersCache[cacheKey]) {
      return courseTeachersCache[cacheKey];
    }

    try {
      const teachers = await getSessionalTeachers(courseId, section);

      // Update the cache with the fetched data
      setCourseTeachersCache(prevCache => ({
        ...prevCache,
        [cacheKey]: teachers || []
      }));

      return teachers || [];
    } catch (error) {
      console.error(`Error fetching teachers for ${courseId} (${section}):`, error);
      return [];
    }
  };

  // Helper function to prepare assignment data
  const prepareAssignmentData = (initial, schedule) => {
    return {
      initial: initial,
      course_id: schedule.course_id,
      batch: schedule.batch, // Default batch if not provided
      section: schedule.section
    };
  };

  /**
   * Handle selection of a sessional schedule
   * Manages the addition, removal, and replacement of course selections
   * @param {object} schedule - The schedule to select/deselect
   */
  const handleSessionalScheduleSelect = (schedule) => {
    // Define helper functions for matching schedules
    const matchesTimeSlot = s => s.day === schedule.day && s.time === schedule.time;
    const isExactMatch = s => (
      matchesTimeSlot(s) &&
      s.course_id === schedule.course_id &&
      s.section === schedule.section
    );

    // Check selection state
    const isExactCourseSelected = selectedSessionalSchedules.some(isExactMatch);
    const existingSelectionForTimeSlot = selectedSessionalSchedules.find(matchesTimeSlot);

    // CASE 1: Toggle selection (clicking already selected course)
    if (isExactCourseSelected) {
      setSelectedSessionalSchedules(prev => prev.filter(s => !isExactMatch(s)));

      toast.success(`Removed ${schedule.course_id} (Section ${formatSectionDisplay(schedule.section, schedule.class_per_week)}) from selection`, {
        icon: '❌',
        duration: 2000
      });
      return;
    }

    // CASE 2: Check for blocking conflicts (theory or already scheduled)
    const conflictCheck = hasTimeConflict(schedule.day, schedule.time);
    if (conflictCheck.theoryConflict || conflictCheck.assignedSessionalConflict) {
      // Get list of conflicting courses by type
      const getConflictingCourseNames = (type) => {
        return getConflictDetails(schedule.day, schedule.time)
          .filter(detail => detail.type === type)
          .flatMap(detail => detail.courses.map(c => c.id))
          .join(", ");
      };

      // Format appropriate conflict message
      const conflictInfo = conflictCheck.theoryConflict
        ? {
          courses: getConflictingCourseNames('theory'),
          message: `You already have a theory class (%s) scheduled at ${schedule.day} ${schedule.time}:00`,
          icon: '📚'
        }
        : {
          courses: getConflictingCourseNames('already-scheduled'),
          message: `You are already assigned to teach (%s) at ${schedule.day} ${schedule.time}:00`,
          icon: '📅'
        };

      // Format and show error message
      const formattedMessage = conflictInfo.message.replace('%s', conflictInfo.courses);
      toast.error(`${conflictInfo.icon} ${formattedMessage}`, {
      });
    }

    // CASE 3: Replace an existing selection in the same time slot
    if (existingSelectionForTimeSlot) {
      // Replace the existing selection with the new one
      setSelectedSessionalSchedules(prev =>
        prev.map(s => matchesTimeSlot(s) ? schedule : s)
      );

      // Show a replacement notification using toast() instead of toast.info() which doesn't exist
      toast(`Replaced ${existingSelectionForTimeSlot.course_id} with ${schedule.course_id} for ${schedule.day} at ${schedule.time}:00`, {
        icon: '🔄',
        duration: 3000
      });
      return;
    }

    // CASE 4: Add a new selection (no conflicts, no existing selection for this time slot)
    setSelectedSessionalSchedules(prev => [...prev, schedule]);

    // Show a success notification
    toast.success(`Selected ${schedule.course_id} (Section ${formatSectionDisplay(schedule.section, schedule.class_per_week)}) for ${schedule.day} at ${schedule.time}:00`, {
      icon: '✅',
      duration: 2000
    });
  };

  // Handle assignment of sessional courses
  const handleSessionalCourseAssign = async () => {
    // Check if we have any selected schedules
    if (selectedSessionalSchedules.length === 0) {
      toast.error('Please select at least one course');
      return;
    }

    try {
      setSubmittingSessional(true);

      // Handle multiple assignments sequentially
      let successCount = 0;
      let failCount = 0;
      let failedCourses = [];

      // Show a loading toast
      const loadingToast = toast.loading(`Assigning ${selectedSessionalSchedules.length} courses...`);

      // Process each selected schedule
      for (const schedule of selectedSessionalSchedules) {
        try {
          // Prepare assignment data using helper function
          const assignment = prepareAssignmentData(teacherId, schedule);

          let success = false;

          try {
            // Call the API to save assignment
            const result = await setTeacherSessionalAssignment(assignment);

            // Check if assignment was successful based on backend response format
            if (result) {
              if (result.message.includes("Assignment Successful")) {
                success = true;
              } else {
                console.warn(`Assignment response didn't indicate success:`, result);
              }
            } else {
              console.warn(`Empty response received for ${schedule.course_id} assignment`);
            }
          } catch (error) {
            console.error(`Error assigning ${schedule.course_id} (Section ${formatSectionDisplay(schedule.section, schedule.class_per_week)}):`, error);

            // Extract and log detailed error information
            if (error.response) {
              console.error(`Server responded with status ${error.response.status}:`,
                error.response.data);
            } else if (error.request) {
              console.error("Request was sent but no response received:", error.request);
            } else {
              console.error("Error setting up request:", error.message);
            }
          }

          if (success) {
            successCount++;
          } else {
            failCount++;
            failedCourses.push(`${schedule.course_id} (Section ${formatSectionDisplay(schedule.section, schedule.class_per_week)})`);
          }
        } catch (error) {
          console.error(`Error assigning course ${schedule.course_id}:`, error);
          failCount++;
          failedCourses.push(`${schedule.course_id} (Section ${formatSectionDisplay(schedule.section, schedule.class_per_week)})`);
        }
      }

      // Dismiss loading toast
      toast.dismiss(loadingToast);

      if (failCount > 0) {
        toast.error(
          <div>
            <div>Failed to assign {failCount} course{failCount !== 1 ? 's' : ''}:</div>
            <ul style={{ margin: '5px 0 0 20px', padding: 0 }}>
              {failedCourses.map((course, index) => (
                <li key={index} style={{ listStyleType: 'disc' }}>{course}</li>
              ))}
            </ul>
          </div>,
          { duration: 4000 }
        );
      }

      // Clear the selected schedules regardless of success/failure
      setSelectedSessionalSchedules([]);

      // If at least one assignment succeeded, update the teacher cache and refresh data
      if (successCount > 0) {
        // Show a notification about updating the view
        toast.success(
          `Successfully assigned ${successCount} course${successCount !== 1 ? 's' : ''}`,
          { duration: 3000 }
        );

        // Update the course teachers cache to include the current teacher for successfully assigned courses
        const updatedCache = { ...courseTeachersCache };

        selectedSessionalSchedules.forEach(schedule => {
          const cacheKey = `${schedule.course_id}-${schedule.section}`;
          const existingTeachers = updatedCache[cacheKey] || [];

          // Check if the current teacher is already in the list
          const teacherExists = existingTeachers.some(teacher => teacher.initial === teacherId);

          if (!teacherExists) {
            // Add the current teacher to the list
            updatedCache[cacheKey] = [
              ...existingTeachers,
              {
                initial: teacherId,
                name: teacher?.name || teacherId
              }
            ];
          }
        });

        setCourseTeachersCache(updatedCache);

        // Trigger a refresh of CourseTeachers components
        setRefreshKey(prev => prev + 1);

        // Also update the assigned sessional courses state
        try {
          const updatedSessionalCourses = await getTeacherSessionalAssignment(teacherId);
          if (updatedSessionalCourses) {
            setAssignedSessionalCourses(updatedSessionalCourses);
            onAssignmentChange();
          }
        } catch (error) {
          console.error("Error refreshing sessional assignments:", error);
        }
      }

    } catch (error) {
      console.error('Error assigning sessional courses:', error);

      // Show specific error message if available
      const errorMessage = error.response?.data?.message ||
        'Failed to complete all course assignments. Please try again.';

      toast.error(errorMessage);
    } finally {
      setSubmittingSessional(false);
    }
  };

  /**
   * Handle unassigning a teacher from a sessional course
   * @param {object} courseInfo - The course information containing course_id and section
   */
  const handleUnassignCourse = async (courseInfo) => {
    try {
      // Show loading state
      const loadingToast = toast.loading(`Unassigning from ${courseInfo.course_id}...`);

      // Prepare unassignment data (this might need to be adjusted based on your backend API)
      const unassignmentData = {
        initial: teacherId,
        course_id: courseInfo.course_id,
        batch: courseInfo.batch,
        section: courseInfo.section
      };

      try {
        // Call the API to remove assignment
        const result = await deleteTeacherSessionalAssignment(unassignmentData);

        // Dismiss loading toast
        toast.dismiss(loadingToast);

        if (result && result.success) {
          // Success - update local state
          toast.success(`Successfully unassigned from ${courseInfo.course_id} (Section ${courseInfo.section})`);

          // Update the assigned sessional courses state
          const updatedCourses = assignedSessionalCourses.filter(course =>
            !(course.course_id === courseInfo.course_id && course.section === courseInfo.section)
          );
          setAssignedSessionalCourses(updatedCourses);

          // Update the course teachers cache to remove the current teacher
          const cacheKey = `${courseInfo.course_id}-${courseInfo.section}`;
          setCourseTeachersCache(prevCache => ({
            ...prevCache,
            [cacheKey]: (prevCache[cacheKey] || []).filter(teacher => teacher.initial !== teacherId)
          }));

          // Trigger refresh of CourseTeachers components
          setRefreshKey(prev => prev + 1);

          // Notify parent component of assignment change
          onAssignmentChange();
        } else {
          toast.error("Failed to unassign from course. Please try again.");
        }
      } catch (error) {
        toast.dismiss(loadingToast);
        console.error("Error unassigning course:", error);

        if (error.response?.data?.message) {
          toast.error(`Error: ${error.response.data.message}`);
        } else {
          toast.error("Failed to unassign from course. Please try again.");
        }
      }
    } catch (error) {
      console.error("Error in handleUnassignCourse:", error);
      toast.error("An unexpected error occurred. Please try again.");
    }
  };

  /**
   * Check if a course has permanent teachers assigned
   * @param {string} courseId - The course ID
   * @param {string} section - The section
   * @returns {boolean} - True if the course has permanent teachers
   */
  const hasPermanentTeachers = (courseId, section) => {
    const cacheKey = `${courseId}-${section}`;
    const teachers = courseTeachersCache[cacheKey] || [];
    const hasPermanent = teachers.some(teacher => teacher.full_time_status === true);
    return hasPermanent;
  };

  /**
   * Get the course color based on permanent teacher status
   * @param {string} courseId - The course ID
   * @param {string} section - The section
   * @returns {object} - Color styles for the course
   */
  const getCourseColorStyles = (courseId, section) => {
    const hasPermanent = hasPermanentTeachers(courseId, section);
    return {
      backgroundColor: hasPermanent ? '#1714dd2f' : '#f8d7da',
      borderColor: hasPermanent ? '#1714ddff' : '#dc3545',
      color: hasPermanent ? '#1714ddff' : '#721c24'
    };
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center flex-column" style={{ minHeight: '300px' }}>
        <div className="spinner-border text-gradient-primary" style={{ width: '3rem', height: '3rem' }} role="status">
          <span className="sr-only">Loading...</span>
        </div>
        <div className="mt-3 text-primary">Loading teacher details...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header" style={{
        background: "linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(154, 77, 226) 100%)",
        borderRadius: "16px",
        padding: "1.5rem",
        marginBottom: "2rem",
        boxShadow: "0 8px 32px rgba(174, 117, 228, 0.15)",
        color: "white",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <h3 className="page-title" style={{
          fontSize: "1.8rem",
          fontWeight: "700",
          marginBottom: "0",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          color: "white"
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
            <i className="mdi mdi-account-tie"></i>
          </div>
          {teacher?.name || teacherId}
        </h3>
        
        {/* Total Credits Display */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          backgroundColor: "rgba(255, 255, 255, 0.15)",
          borderRadius: "12px",
          padding: "12px 20px",
          backdropFilter: "blur(10px)",
          boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)"
        }}>
          <div style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            backgroundColor: "rgba(255, 255, 255, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <i className="mdi mdi-calculator" style={{ fontSize: "18px" }}></i>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <span style={{ 
              fontSize: "0.85rem", 
              opacity: 0.9, 
              fontWeight: "500",
              lineHeight: 1,
              marginBottom: "2px"
            }}>
              Total Credits
            </span>
            {loadingCredits ? (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div 
                  className="spinner-border spinner-border-sm" 
                  style={{ 
                    width: "14px", 
                    height: "14px",
                    borderWidth: "2px",
                    color: "rgba(255, 255, 255, 0.8)"
                  }}
                ></div>
                <span style={{ fontSize: "1.1rem", fontWeight: "600" }}>Loading...</span>
              </div>
            ) : (
              <span style={{ 
                fontSize: "1.4rem", 
                fontWeight: "700",
                lineHeight: 1,
                color: totalCredits > 12 ? "#ffeb3b" : "white"
              }}>
                {totalCredits.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
      {teacher && (
        <div>
          <div className="row mb-4">
            <div className="col-12">
              <div className="card" style={{
                borderRadius: "16px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
                border: "none",
                transition: "all 0.3s ease",
                background: "white"
              }}>
                <div className="card-body" style={{ padding: "2rem" }}>
                  <div style={{ borderBottom: "3px solid rgb(194, 137, 248)", paddingBottom: "16px", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4 className="card-title" style={{
                      color: "rgb(174, 117, 228)",
                      marginBottom: 0,
                      fontWeight: "700",
                      display: "flex",
                      alignItems: "center",
                      fontSize: "1.5rem",
                      letterSpacing: "0.3px"
                    }}>
                      <i className="mdi mdi-clipboard-text mr-2"></i>Current Schedule Assignments
                    </h4>
                  </div>
                  {(assignedTheoryCourses.length > 0 || assignedSessionalCourses.length > 0) ? (
                    <div>
                      <style jsx="true">{`
                            .assignment-schedule-table {
                              border-collapse: separate;
                              border-spacing: 0;
                              text-align: center;
                              background-color: #f8f9fa;
                              box-shadow: 0 3px 12px rgba(0,0,0,0.1);
                              border-radius: 8px;
                              overflow: hidden;
                              width: 100%;
                              margin: 0 auto;
                              border: 1px solid rgb(194, 137, 248);
                            }
                            .assignment-schedule-table thead th {
                              background: linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(154, 77, 226) 100%);
                              color: white;
                              font-weight: 600;
                              padding: 12px 8px;
                              letter-spacing: 0.5px;
                              border: none;
                              font-size: 0.9rem;
                            }
                            .assignment-schedule-table tbody th {
                              background: linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(154, 77, 226) 100%);
                              color: white;
                              font-weight: 600;
                              padding: 8px;
                              border: none;
                              width: 100px;
                              min-width: 100px;
                              max-width: 100px;
                              font-size: 0.85rem;
                            }
                            .assignment-schedule-table td {
                              border: 1px solid rgb(194, 137, 248);
                              height: 55px;
                              width: 120px;
                              min-width: 120px;
                              max-width: 120px;
                              padding: 4px;
                              vertical-align: middle;
                              position: relative;
                              background-color: white;
                            }
                            .theory-assignment {
                              background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
                              border: 2px solid #1976d2;
                              color: #0d47a1;
                              font-weight: 600;
                              border-radius: 6px;
                              padding: 8px;
                              font-size: 0.8rem;
                              display: flex;
                              flex-direction: column;
                              align-items: center;
                              justify-content: center;
                              height: 100%;
                              position: relative;
                            }
                            .sessional-assignment {
                              background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%);
                              border: 2px solid #7b1fa2;
                              color: #4a148c;
                              font-weight: 600;
                              border-radius: 6px;
                              padding: 8px;
                              font-size: 0.8rem;
                              display: flex;
                              flex-direction: column;
                              align-items: center;
                              justify-content: center;
                              height: 100%;
                              position: relative;
                            }
                            .assignment-unassign-btn {
                              position: absolute;
                              top: 2px;
                              right: 2px;
                              width: 20px;
                              height: 20px;
                              border-radius: 50%;
                              border: none;
                              background: rgba(220, 53, 69, 0.9);
                              color: white;
                              font-size: 10px;
                              cursor: pointer;
                              display: flex;
                              align-items: center;
                              justify-content: center;
                              opacity: 0.8;
                              transition: all 0.2s ease;
                            }
                            .assignment-unassign-btn:hover {
                              opacity: 1;
                              transform: scale(1.1);
                              background: #dc3545;
                            }
                            .empty-slot {
                              background-color: #f8f9fa;
                              color: #6c757d;
                              font-style: italic;
                              font-size: 0.75rem;
                            }
                          `}</style>
                      <div className="table-responsive">
                        <table className="table assignment-schedule-table">
                          <thead>
                            <tr>
                              <th>Day / Time</th>
                              {times.map((time) => (
                                <th key={time}>{time}:00{time === 12 ? ' PM' : time > 12 ? ' PM' : ' AM'}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {days.map((day) => {
                              // Track merged cells to skip rendering
                              const merged = Array(times.length).fill(false);

                              return (
                                <tr key={day}>
                                  <th>{day}</th>
                                  {times.map((time, timeIndex) => {
                                    // Skip if this cell is already merged
                                    if (merged[timeIndex]) return null;

                                    // Check for theory assignment
                                    const theoryAssignment = theorySchedule.find(schedule =>
                                      schedule.day === day && schedule.time === time
                                    );

                                    // Check for sessional assignment - check both direct assignment and through schedule
                                    let sessionalAssignment = assignedSessionalCourses.find(course =>
                                      course.day === day && course.time === time
                                    );

                                    // If not found directly, check through sessionalSchedule
                                    if (!sessionalAssignment) {
                                      const scheduleEntry = sessionalSchedule.find(schedule =>
                                        schedule.day === day && schedule.time === time
                                      );

                                      if (scheduleEntry) {
                                        // Find if this schedule entry matches any assigned course
                                        sessionalAssignment = assignedSessionalCourses.find(course =>
                                          course.course_id === scheduleEntry.course_id &&
                                          course.section === scheduleEntry.section
                                        );
                                      }
                                    }

                                    // If sessional assignment, merge 3 cells
                                    if (sessionalAssignment) {
                                      // Mark next 2 cells as merged
                                      if (timeIndex + 1 < times.length) merged[timeIndex + 1] = true;
                                      if (timeIndex + 2 < times.length) merged[timeIndex + 2] = true;

                                      return (
                                        <td
                                          key={`${day}-${time}`}
                                          colSpan={3}
                                          style={{ width: '360px', minWidth: '360px', maxWidth: '360px' }}
                                        >
                                          <div className="sessional-assignment">
                                            <button
                                              onClick={() => setSelectedAssignment(sessionalAssignment)}
                                              className="assignment-unassign-btn"
                                              title="Unassign from this course"
                                            >
                                              <i className="mdi mdi-close"></i>
                                            </button>
                                            <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                                              {sessionalAssignment.course_id}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                                              Section {formatSectionDisplay(sessionalAssignment.section,sessionalAssignment.class_per_week)}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                                              <i className="mdi mdi-flask"></i> Lab
                                            </div>
                                          </div>
                                        </td>
                                      );
                                    }

                                    // If theory assignment, single cell
                                    if (theoryAssignment) {
                                      return (
                                        <td key={`${day}-${time}`}>
                                          <div className="theory-assignment">
                                            <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                                              {theoryAssignment.course_id}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                                              Section {theoryAssignment.section || 'All'}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                                              <i className="mdi mdi-book-open-variant"></i> Theory
                                            </div>
                                          </div>
                                        </td>
                                      );
                                    }

                                    // Empty slot
                                    return (
                                      <td key={`${day}-${time}`}>
                                        <div className="empty-slot"></div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="mb-3">
                        <i className="mdi mdi-clipboard-text-outline" style={{ fontSize: '3rem', color: '#6c757d', opacity: 0.5 }}></i>
                      </div>
                      <h6 className="text-muted mb-2">No Current Assignments</h6>
                      <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>
                        This teacher has no theory or sessional course assignments yet.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="row mb-4">
            <div className="col-12">
              <div className="card" style={{
                borderRadius: "16px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
                border: "none",
                transition: "all 0.3s ease",
                background: "white"
              }}>
                <div className="card-body" style={{ padding: "2rem" }}>
                  <div style={{ borderBottom: "3px solid rgb(194, 137, 248)", paddingBottom: "16px", marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4 className="card-title" style={{
                      color: "rgb(174, 117, 228)",
                      marginBottom: 0,
                      fontWeight: "700",
                      display: "flex",
                      alignItems: "center",
                      fontSize: "1.5rem",
                      letterSpacing: "0.3px"
                    }}><i className="mdi mdi-table-large mr-2"></i>Sessional Choice Table
                    </h4>
                  </div>
                  {loadingSchedules ? (
                    <div className="text-center py-4">
                      <div className="spinner-border text-info" role="status">
                        <span className="sr-only">Loading...</span>
                      </div>
                      <p className="mt-2 text-muted">Loading available schedules...</p>
                    </div>
                  ) : departmentalSessionalSchedules.length > 0 ? (
                    <div>
                      <SessionalScheduleTable
                        schedules={departmentalSessionalSchedules}
                        selectedSchedules={selectedSessionalSchedules}
                        onSelectSchedule={handleSessionalScheduleSelect}
                      />
                      {selectedSessionalSchedules.length > 0 && (
                        <div className="mt-4 card shadow-lg" style={{
                          borderRadius: '10px',
                          overflow: 'hidden',
                          border: 'none',
                          boxShadow: '0 6px 15px rgba(0,0,0,0.075)'
                        }}>
                          <div className="table-responsive">
                            <table className="table assignment-schedule-table">
                              <thead>
                                <tr>
                                  <th style={{
                                    background: 'linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(154, 77, 226) 100%)',
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    borderBottom: 'none',
                                    padding: '12px 16px'
                                  }}>Course</th>
                                  <th style={{
                                    background: 'linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(154, 77, 226) 100%)',
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    borderBottom: 'none',
                                    padding: '12px 16px'
                                  }}>Section</th>
                                  <th style={{
                                    background: 'linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(154, 77, 226) 100%)',
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    borderBottom: 'none',
                                    padding: '12px 16px'
                                  }}>Day</th>
                                  <th style={{
                                    background: 'linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(154, 77, 226) 100%)',
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    borderBottom: 'none',
                                    padding: '12px 16px'
                                  }}>Time</th>
                                  <th style={{
                                    background: 'linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(154, 77, 226) 100%)',
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    borderBottom: 'none',
                                    padding: '12px 16px'
                                  }}>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedSessionalSchedules.map((schedule, index) => (
                                  <tr
                                    key={`${schedule.course_id}-${schedule.section}-${index}`}
                                    style={{ transition: "all 0.2s", cursor: "pointer" }}
                                    onMouseEnter={e => e.currentTarget.style.background = "rgba(194, 137, 248, 0.08)"}
                                    onMouseLeave={e => e.currentTarget.style.background = ""}
                                  >
                                    <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                                      <div className="d-flex align-items-center">
                                        <div className="course-index mr-3" style={{
                                          width: '32px',
                                          height: '32px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontSize: '14px',
                                          fontWeight: '600',
                                          borderRadius: '50%',
                                          color: 'white',
                                          background: 'linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(154, 77, 226) 100%)'
                                        }}>
                                          {index + 1}
                                        </div>
                                        <div>
                                          <span className="font-weight-bold" style={{ color: '#344767', fontSize: '15px' }}>{schedule.course_id}</span>
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                                      <span className="badge" style={{
                                        backgroundColor: 'rgba(111, 66, 193, 0.18)',
                                        color: '#6f42c1',
                                        padding: '8px 14px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        borderRadius: '6px',
                                        boxShadow: '0 2px 4px rgba(111, 66, 193, 0.15)'
                                      }}>
                                        <i className="mdi mdi-account-group mr-1"></i>{schedule.section}
                                      </span>
                                    </td>
                                    <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                                      <span className="badge" style={{
                                        backgroundColor: 'rgba(40, 167, 69, 0.18)',
                                        color: '#28a745',
                                        padding: '8px 14px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        borderRadius: '6px',
                                        boxShadow: '0 2px 4px rgba(40, 167, 69, 0.15)'
                                      }}>
                                        <i className="mdi mdi-calendar-week mr-1"></i>{schedule.day}
                                      </span>
                                    </td>
                                    <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                                      <span className="badge" style={{
                                        backgroundColor: 'rgba(23, 162, 184, 0.18)',
                                        color: '#17a2b8',
                                        padding: '8px 14px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        borderRadius: '6px',
                                        boxShadow: '0 2px 4px rgba(23, 162, 184, 0.15)'
                                      }}>
                                        <i className="mdi mdi-clock-time-four-outline mr-1"></i>{schedule.time}:00
                                      </span>
                                    </td>
                                    <td style={{ padding: '14px 16px', verticalAlign: 'middle', alignItems: 'center' }}>
                                      <button
                                        type="button"
                                        style={{
                                          background: "rgba(220, 53, 69, 0.1)",
                                          color: "#dc3545",
                                          border: "1px solid rgba(220, 53, 69, 0.3)",
                                          padding: "8px 14px",
                                          fontSize: '13px',
                                          fontWeight: "600",
                                          borderRadius: "6px",
                                          transition: "all 0.3s ease",
                                          boxShadow: '0 2px 4px rgba(23, 162, 184, 0.15)'
                                        }}
                                        onClick={() => handleSessionalScheduleSelect(schedule)}
                                        onMouseOver={e => {
                                          e.currentTarget.style.background = "#dc3545";
                                          e.currentTarget.style.color = "white";
                                        }}
                                        onMouseOut={e => {
                                          e.currentTarget.style.background = "rgba(220, 53, 69, 0.1)";
                                          e.currentTarget.style.color = "#dc3545";
                                        }}
                                      >
                                        <i className="mdi mdi-close"></i>
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="card-footer py-3" style={{ backgroundColor: '#f8f9fa', borderTop: '1px solid #edf2f9' }}>
                            <div className="d-flex justify-content-between align-items-center">
                              <small className="text-muted d-flex align-items-center">
                                <i className="mdi mdi-information-outline mr-1" style={{ fontSize: '16px' }}></i>
                                These courses will be assigned to this teacher
                              </small>
                              <small className="text-primary">
                                <i className="mdi mdi-gesture-tap mr-1"></i>
                                Click the <i className="mdi mdi-close mx-1 text-danger"></i> button to unselect a course
                              </small>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="alert alert-warning border-left border-warning" style={{ borderLeftWidth: '4px' }}>
                      <div className="d-flex align-items-center">
                        <i className="mdi mdi-alert-circle-outline mr-3" style={{ fontSize: '24px' }}></i>
                        <span>No schedules found for sessional courses.</span>
                      </div>
                    </div>
                  )}
                  <div className="d-flex justify-content-end mt-4 pb-4">
                    <button
                      className="btn"
                      onClick={handleSessionalCourseAssign}
                      disabled={submittingSessional || selectedSessionalSchedules.length === 0}
                      style={{
                        background: 'linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(154, 77, 226) 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '0.75rem 1.5rem',
                        fontSize: '14px',
                        fontWeight: '600',
                        borderRadius: '6px',
                        boxShadow: '0 3px 6px rgba(0,0,0,0.1)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {submittingSessional ?
                        <><span className="spinner-border spinner-border-sm mr-2"></span>Assigning...</> :
                        <><i className="mdi mdi-check-circle mr-2"></i>Assign {selectedSessionalSchedules.length} Sessional Course{selectedSessionalSchedules.length !== 1 ? 's' : ''}</>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {selectedAssignment && (
        <Modal
          show={selectedAssignment !== null}
          onHide={() => setSelectedAssignment(null)}
          size="md"
          centered
          contentClassName="border-0 shadow"
          backdrop="static"
        >
          <Modal.Header
            style={{
              background: "linear-gradient(135deg, rgba(220, 53, 69, 0.05) 0%, rgba(220, 53, 69, 0.1) 100%)",
              borderBottom: "1px solid rgba(220, 53, 69, 0.2)",
              paddingTop: "16px",
              paddingBottom: "16px"
            }}
          >
            <div className="d-flex align-items-center">
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                backgroundColor: "rgba(220, 53, 69, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: "10px"
              }}>
                <i className="mdi mdi-alert-circle-outline" style={{ fontSize: "18px", color: "#dc3545" }}></i>
              </div>
              <Modal.Title style={{ fontSize: "18px", fontWeight: "600", color: "#dc3545" }}>Unassign Course</Modal.Title>
            </div>
          </Modal.Header>
          <Modal.Body className="px-4 bg-white border-radius-0">
            <p style={{ fontSize: "16px", color: "#495057" }}>
              Are you sure you want to unassign the assignment: <strong>{selectedAssignment.course_id}</strong>?
            </p>
            <p style={{ fontSize: "14px", color: "#6c757d" }}>
              This action cannot be undone. Assignment related to this course will be removed.
            </p>
          </Modal.Body>
          <Modal.Footer style={{ backgroundColor: "#ffffff", borderTop: "1px solid rgba(220, 53, 69, 0.2)", padding: "16px" }}>
            <Button
              style={{
                background: "rgba(154, 77, 226, 0.15)",
                color: "rgb(154, 77, 226)",
                border: "1.5px solid rgba(154, 77, 226, 0.5)",
                borderRadius: "8px",
                padding: "8px 20px",
                fontWeight: "500",
                fontSize: "1rem",
                marginRight: "10px",
                transition: "all 0.3s ease"
              }}
              onClick={() => setSelectedAssignment(null)}
              onMouseOver={e => {
                e.currentTarget.style.background = "rgb(154, 77, 226)";
                e.currentTarget.style.color = "white";
                e.currentTarget.style.borderColor = "rgb(154, 77, 226)";
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = "rgba(154, 77, 226, 0.15)";
                e.currentTarget.style.color = "rgb(154, 77, 226)";
                e.currentTarget.style.borderColor = "rgba(154, 77, 226, 0.5)";
              }}
            >
              <i className="mdi mdi-close mr-1"></i>
              Cancel
            </Button>
            <Button
              style={{
                background: "rgba(220, 53, 69, 0.1)",
                color: "#dc3545",
                border: "1.5px solid rgba(220, 53, 69, 0.3)",
                borderRadius: "8px",
                padding: "8px 20px",
                fontWeight: "500",
                marginLeft: "10px",
                transition: "all 0.3s ease"
              }}
              onClick={(e) => {
                handleUnassignCourse(selectedAssignment)
                setSelectedAssignment(null);
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = "#dc3545";
                e.currentTarget.style.color = "white";
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = "rgba(220, 53, 69, 0.1)";
                e.currentTarget.style.color = "#dc3545";
              }}
            >
              <i className="mdi mdi-delete-outline mr-1"></i>
              Unassign
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
}
