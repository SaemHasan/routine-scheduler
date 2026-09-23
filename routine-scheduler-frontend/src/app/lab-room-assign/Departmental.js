import { useEffect, useRef, useState } from "react";
import { Badge } from "react-bootstrap";
import { toast } from "react-hot-toast";
import { mdiAlertCircleOutline } from "@mdi/js";
import Icon from "@mdi/react";

import { getLabCourses, getLabRooms } from "../api/db-crud";
import { getRoomAssign, setRoomAssign } from "../api/theory-assign";
import { getAllSchedule } from "../api/theory-schedule";
import { useConfig } from "../shared/ConfigContext";
import { useHistory } from "react-router-dom";

export default function LabRoomAssign() {
  const history = useHistory();
  const { days, possibleLabTimes } = useConfig();
  const [offeredCourse, setOfferedCourse] = useState([]);
  const [sessionalSchedule, setSessionalSchedule] = useState([]);

  const [viewRoomAssignment, setViewRoomAssignment] = useState(false);
  const [viewCourseAssignment, setViewCourseAssignment] = useState(true);
  const [viewLevelTermAssignment, setViewLevelTermAssignment] = useState(false);

  const [rooms, setRooms] = useState([]);

  const [courseRoom, setCourseRoom] = useState([]);
  const [uniqueNamedCourses, setUniqueNamedCourses] = useState([]);
  const [fixedRoomAllocation, setFixedRoomAllocation] = useState([]);
  const [alreadySaved, setAlreadySaved] = useState(true);

  const selectedCourseRef = useRef(null);
  const selectedRoomRef = useRef(null);

  useEffect(() => {
    let rooms_, courses_;
    const labs = getLabRooms().then((res) => {
      rooms_ = res.sort((a, b) => a.room.localeCompare(b.room));
      setRooms(rooms_);
    });
    const courses = getLabCourses().then((res) => {
      courses_ = res;
      setOfferedCourse(res);
    });
    getAllSchedule().then((res) => {
      // Additional validation - ensure we have an array
      const scheduleData = Array.isArray(res) ? res : [];
      // Filter out any entries that don't have required fields
      const validSchedules = scheduleData.filter(
        (item) =>
          item && item.day && item.time && item.course_id && item.section
      );
      setSessionalSchedule(validSchedules);
    });

    Promise.all([labs, courses]).then(() => {
      getRoomAssign().then((res) => {
        if (res.length > 0) {
          const labRooms = rooms_.map((room) => {
            const courses = res
              .filter((obj) => obj.room && obj.room === room.room)
              .map((obj) => {
                return courses_.find(
                  (course) =>
                    course.course_id === obj.course_id &&
                    course.section === obj.section
                );
              });
            return {
              room: room.room,
              count: courses.length,
              courses: courses,
            };
          });
          setFixedRoomAllocation(labRooms);
        }
      });
    });
  }, []);

  useEffect(() => {
    const uniqueNames = {};
    const uniqueCourses = offeredCourse.filter((obj) => {
      if (!uniqueNames[obj.name]) {
        uniqueNames[obj.name] = true;
        return true;
      }
      return false;
    });
    setUniqueNamedCourses(uniqueCourses);
  }, [offeredCourse]);

  const levelTermAllocation = fixedRoomAllocation.reduce((map, room) => {
    room.courses.forEach((course) => {
      if (!course) return; // <-- Fix: skip undefined/null
      const { level_term } = course;
      if (!map[level_term]) map[level_term] = new Set();
      map[level_term].add(room.room);
    });
    return map;
  }, {});
  const levelTermAllocationArray = Object.keys(levelTermAllocation)
    .map((level_term) => {
      return {
        level_term,
        rooms: Array.from(levelTermAllocation[level_term]),
      };
    })
    .sort((a, b) => {
      return a.level_term.localeCompare(b.level_term);
    });

  const generateRoomAssignments = () => {
    // Initialize the roomBookings structure with a safer approach
    const roomBookings = {};
    days.forEach((day) => {
      roomBookings[day] = {};
      possibleLabTimes.forEach((time) => {
        roomBookings[day][time] = [];
      });
    });

    // Add a safety method to access roomBookings without causing undefined errors
    const safeGetRoomBooking = (day, time) => {
      if (!roomBookings[day]) return [];
      if (!roomBookings[day][time]) return [];
      return roomBookings[day][time];
    };

    // Make a copy of rooms array for tracking availability
    const availableRooms = [...rooms];

    // Get courses that have schedules
    const scheduledCourses = [];

    // Process each scheduled course
    sessionalSchedule.forEach((schedule) => {
      // Defensive programming - Handle cases where schedule might be malformed
      if (!schedule) {
        console.warn("Found undefined or null schedule entry");
        return;
      }

      const { day, time, course_id, section } = schedule;

      // Skip if day or time is missing or not valid
      if (
        !day ||
        !time ||
        !days.includes(day) ||
        !possibleLabTimes.includes(Number(time))
      ) {
        console.warn(`Invalid day or time in schedule: ${day} - ${time}`);
        return;
      }

      // Find the matching course in offered courses
      const course = offeredCourse.find(
        (c) => c.course_id === course_id && c.section === section
      );

      if (!course) {
        console.warn(
          `Course ${course_id} section ${section} not found in offered courses`
        );
        return;
      }

      scheduledCourses.push({
        ...course,
        day,
        time,
      });
    });

    // Sort courses by level_term (older batches get priority)
    scheduledCourses.sort((a, b) => {
      // Extract numeric values from level_term (e.g., "L-1 T-1" -> 1.1)
      const getNumericValue = (levelTerm) => {
        const level = parseInt(levelTerm.match(/L-(\d+)/)[1], 10);
        const term = parseInt(levelTerm.match(/T-(\d+)/)[1], 10);
        return level + term / 10;
      };

      try {
        return getNumericValue(a.level_term) - getNumericValue(b.level_term);
      } catch (e) {
        return 0;
      }
    });

    // Create room assignments
    const roomAssignments = [];

    // Check if any course has fixed room allocation
    const coursesWithFixedRooms = new Map();

    // Add fixed rooms from previous assignments
    fixedRoomAllocation.forEach((room) => {
      room.courses.forEach((course) => {
        const key = `${course.course_id}_${course.section}`;
        if (!coursesWithFixedRooms.has(key)) {
          coursesWithFixedRooms.set(key, []);
        }
        coursesWithFixedRooms.get(key).push(room.room);
      });
    });

    // Add fixed rooms from the "Must Use" selections
    courseRoom.forEach((item) => {
      // For each course_id in courseRoom, apply the constraint to all sections
      const matchingCourses = offeredCourse.filter(
        (course) => course.course_id === item.course_id
      );

      if (matchingCourses.length > 0) {
        matchingCourses.forEach((course) => {
          const key = `${course.course_id}_${course.section}`;
          // Clear any existing assignments for this course+section
          coursesWithFixedRooms.set(key, []);

          // Add all specified rooms for this course
          item.rooms.forEach((roomName) => {
            coursesWithFixedRooms.get(key).push(roomName);
          });
        });
      }
    });

    // Process each scheduled course for assignment
    scheduledCourses.forEach((course) => {
      const { course_id, section, day, time } = course;
      const courseKey = `${course_id}_${section}`;

      // Use our safe getter to avoid undefined errors
      // Check which rooms are available at this day and time
      const bookedRoomsAtThisTime = safeGetRoomBooking(day, time).map(
        (booking) => booking.room
      );
      const availableRoomsAtThisTime = availableRooms.filter(
        (room) => !bookedRoomsAtThisTime.includes(room.room)
      );

      let assignedRoom = null;

      // First try to assign to a fixed room if specified
      if (coursesWithFixedRooms.has(courseKey)) {
        const preferredRooms = coursesWithFixedRooms.get(courseKey);

        // Find the first available fixed room
        for (const roomName of preferredRooms) {
          const isAvailable = !bookedRoomsAtThisTime.includes(roomName);
          if (isAvailable) {
            assignedRoom = roomName;
            break;
          }
        }
      }

      // If no fixed room was available, assign to any available room,
      // preferring a lab of the kind the course needs (software/hardware)
      if (!assignedRoom && availableRoomsAtThisTime.length > 0) {
        const matchingRoom = course.lab_type
          ? availableRoomsAtThisTime.find(
              (room) => room.lab_type === course.lab_type
            )
          : null;
        assignedRoom = (matchingRoom || availableRoomsAtThisTime[0]).room;
      }

      // If a room was assigned, add it to bookings and assignments
      if (assignedRoom) {
        // Make sure the day and time slots exist in roomBookings before pushing
        if (!roomBookings[day]) roomBookings[day] = {};
        if (!roomBookings[day][time]) roomBookings[day][time] = [];

        roomBookings[day][time].push({
          room: assignedRoom,
          course: course,
        });

        roomAssignments.push({
          course_id,
          section,
          batch: course.batch,
          room: assignedRoom,
        });
      } else {
        console.warn(
          `Failed to assign room for ${course_id}-${section} on ${day} at ${time}`
        );
      }
    });

    // Create room allocation in the format expected by the UI
    const newRoomAllocation = rooms.map((room) => {
      const assignedCourses = roomAssignments
        .filter((assignment) => assignment.room === room.room)
        .map((assignment) => {
          return offeredCourse.find(
            (course) =>
              course.course_id === assignment.course_id &&
              course.section === assignment.section
          );
        })
        .filter(Boolean); // Remove any undefined entries

      return {
        room: room.room,
        count: assignedCourses.length,
        courses: assignedCourses,
      };
    });

    setFixedRoomAllocation(newRoomAllocation);

    return roomAssignments;
  };

  // Function to update room assignment for a specific course
  const updateCourseRoomAssignment = (course, newRoomName) => {
    if (newRoomName) {
      const isScheduled = sessionalSchedule.some((sched) => {
        return (
          sched.course_id === course.course_id &&
          sched.section === course.section
        );
      });

      if (!isScheduled) {
        toast.error(
          `${course.course_id} for Section ${course.section} is not scheduled. Schedule before assigning rooms.`
        );
        return;
      }

      // determine course schedule from sessionalSchedule
      const sched = sessionalSchedule.find(
        (item) =>
          item.course_id === course.course_id && item.section === course.section
      );

      const sameSlotCourses = sessionalSchedule
        .filter((item) => item.day === sched.day && item.time === sched.time)
        .map((item) => ({
          course_id: item.course_id,
          section: item.section,
        }))
        .filter(
          (item) =>
            item.course_id !== course.course_id ||
            item.section !== course.section
        );

      const roomCourses = fixedRoomAllocation.find(
        (roomAlloc) => roomAlloc.room === newRoomName
      ).courses;

      const conflictingCourses = roomCourses.filter((roomCourse) => {
        return sameSlotCourses.some(
          (slotCourse) =>
            slotCourse.course_id === roomCourse.course_id &&
            slotCourse.section === roomCourse.section
        );
      });

      if (conflictingCourses.length > 0) {
        toast.error(
          `Cannot assign ${course.course_id} (${
            course.section
          }) to ${newRoomName}. Conflicts with: ${conflictingCourses
            .map((c) => `${c.course_id} (${c.section})`)
            .join(", ")}`
        );
        return;
      }
    }

    // First remove this course from any room allocations it might be in
    const updatedAllocation = fixedRoomAllocation.map((roomAlloc) => {
      const filteredCourses = roomAlloc.courses.filter(
        (c) =>
          !(
            c.course_id === course.course_id &&
            c.level_term === course.level_term &&
            c.section === course.section
          )
      );

      // Return the room with updated courses
      return {
        ...roomAlloc,
        courses: filteredCourses,
        count: filteredCourses.length,
      };
    });

    // Now add the course to the newly selected room
    const targetRoomIndex = updatedAllocation.findIndex(
      (r) => r.room === newRoomName
    );

    if (targetRoomIndex !== -1) {
      updatedAllocation[targetRoomIndex] = {
        ...updatedAllocation[targetRoomIndex],
        courses: [...updatedAllocation[targetRoomIndex].courses, course],
        count: updatedAllocation[targetRoomIndex].count + 1,
      };
    }

    // Update the fixedRoomAllocation state
    setFixedRoomAllocation(() => updatedAllocation);
    const data = [
      {
        course_id: course.course_id,
        batch: course.batch,
        section: course.section,
        room: newRoomName,
      },
    ];

    setRoomAssign(data)
      .then((res) => {
        if (newRoomName) {
          toast.success(
            `${course.course_id} (Section ${course.section}) assigned to ${newRoomName}`
          );
        } else {
          toast.error(
            `Room assignment cleared for ${course.course_id} (Section ${course.section})`
          );
        }
      })
      .catch((error) => {
        toast.error("Failed to update lab room assignment");
      });
  };

  // Block in-app route changes if there are unsaved changes
  useEffect(() => {
    if (alreadySaved) return;
    const unblock = history.block((location, action) => {
      return "You have unsaved changes. Are you sure you want to leave?";
    });
    return () => {
      unblock();
    };
  }, [alreadySaved, history]);

  return (
    <div>
      {/* Modern Page Header */}
      <div className="page-header">
        <h3 className="page-title">
          <div className="page-title-icon-container">
            <i className="mdi mdi-lock-check" />
          </div>
          Departmental Lab Room Assignment
        </h3>
      </div>
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-view">
              <div className="card-control-container">
                <h4 className="card-name">
                  <i className="card-icon mdi mdi-domain"></i>Lab Room
                  Assignment
                </h4>
              </div>
              <div
                className="card-inner-table-container"
                style={{ boxShadow: "none", backgroundColor: "transparent" }}
              >
                {courseRoom.length <= 0 ? (
                  sessionalSchedule.length === 0 ? (
                    <div
                      className="alert"
                      role="alert"
                      style={{
                        marginTop: "16px",
                        backgroundColor: "rgba(255, 193, 7, 0.1)",
                        border: "1px solid rgba(255, 193, 7, 0.2)",
                        borderRadius: "12px",
                        padding: "16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "18px",
                        boxShadow: "0 8px 20px rgba(255, 193, 7, 0.08)",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          right: 0,
                          width: "150px",
                          height: "150px",
                          background:
                            "radial-gradient(circle at top right, rgba(255, 193, 7, 0.1), transparent 70%)",
                          zIndex: 0,
                        }}
                      ></div>
                      <div
                        style={{
                          minWidth: "45px",
                          height: "45px",
                          borderRadius: "12px",
                          background:
                            "linear-gradient(45deg, #FFC107, #FFDB58)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 4px 12px rgba(255, 193, 7, 0.3)",
                          zIndex: 1,
                        }}
                      >
                        <Icon
                          path={mdiAlertCircleOutline}
                          size={1}
                          color="white"
                        />
                      </div>
                      <div style={{ zIndex: 1 }}>
                        <h5
                          style={{
                            margin: "0 0 5px 0",
                            color: "#664d03",
                            fontWeight: "600",
                          }}
                        >
                          Schedule Not Found
                        </h5>
                        <span
                          style={{
                            color: "#664d03",
                            fontWeight: "400",
                            opacity: 0.9,
                          }}
                        >
                          Please create a sessional schedule before assigning
                          lab rooms.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="alert"
                      role="alert"
                      style={{
                        marginTop: "16px",
                        backgroundColor: "rgba(13, 202, 240, 0.08)",
                        border: "1px solid rgba(13, 202, 240, 0.2)",
                        borderRadius: "12px",
                        padding: "16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        boxShadow: "0 8px 20px rgba(13, 202, 240, 0.08)",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          minWidth: "45px",
                          height: "45px",
                          borderRadius: "12px",
                          background:
                            "linear-gradient(45deg, #0dcaf0, #79E2F2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 4px 12px rgba(13, 202, 240, 0.3)",
                          zIndex: 1,
                        }}
                      >
                        <Icon
                          path={mdiAlertCircleOutline}
                          size={1}
                          color="white"
                        />
                      </div>
                      <div style={{ zIndex: 1 }}>
                        <h5
                          style={{
                            margin: "0 0 5px 0",
                            color: "#055160",
                            fontWeight: "600",
                            textAlign: "left",
                          }}
                        >
                          Automatic Assignment
                        </h5>
                        <span
                          style={{
                            color: "#055160",
                            fontWeight: "400",
                            opacity: 0.9,
                          }}
                        >
                          The system will automatically assign lab rooms based
                          on the sessional schedule. Fixed room constraints
                          (added with "MUST USE" button) will be respected when
                          possible.
                        </span>
                      </div>
                    </div>
                  )
                ) : (
                  <div
                    className="mb-4"
                    style={{
                      display: courseRoom.length > 0 ? "block" : "none",
                      animation:
                        courseRoom.length > 0 ? "fadeIn 0.5s ease-out" : "none",
                    }}
                  >
                    <div
                      className="p-4 mt-4"
                      style={{
                        backgroundColor: "rgba(194, 137, 248, 0.04)",
                        border: "1px solid rgba(194, 137, 248, 0.15)",
                        borderRadius: "15px",
                        boxShadow: "0 6px 20px rgba(194, 137, 248, 0.08)",
                      }}
                    >
                      <div className="d-flex align-items-center mb-3">
                        <div
                          style={{
                            width: "38px",
                            height: "38px",
                            borderRadius: "12px",
                            background:
                              "linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(154, 77, 226) 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 6px 16px rgba(154, 77, 226, 0.2)",
                            marginRight: "14px",
                          }}
                        >
                          <i
                            className="mdi mdi-lock-check"
                            style={{ color: "white", fontSize: "20px" }}
                          ></i>
                        </div>
                        <h5
                          style={{
                            margin: 0,
                            fontWeight: "700",
                            color: "#333",
                            display: "flex",
                            alignItems: "center",
                            fontSize: "18px",
                          }}
                        >
                          Fixed Room Constraints
                          <span
                            className="ms-2 badge"
                            style={{
                              backgroundColor: "rgba(194, 137, 248, 0.1)",
                              color: "rgb(154, 77, 226)",
                              fontSize: "0.7rem",
                              padding: "5px 8px",
                              borderRadius: "20px",
                              fontWeight: "500",
                            }}
                          >
                            {courseRoom.length}{" "}
                            {courseRoom.length === 1 ? "course" : "courses"}
                          </span>
                        </h5>
                      </div>
                      <div className="d-flex flex-wrap">
                        {courseRoom.map((item, index) => (
                          <div
                            className="m-2"
                            style={{
                              backgroundColor: "#fff",
                              borderRadius: "12px",
                              boxShadow: "0 4px 15px rgba(194, 137, 248, 0.12)",
                              border: "1px solid rgba(194, 137, 248, 0.1)",
                              transition: "all 0.3s ease",
                              padding: "12px 16px",
                              position: "relative",
                              overflow: "hidden",
                            }}
                            key={index}
                          >
                            <div
                              style={{
                                position: "absolute",
                                top: 0,
                                right: 0,
                                width: "80px",
                                height: "80px",
                                background:
                                  "radial-gradient(circle at top right, rgba(194, 137, 248, 0.03), transparent 70%)",
                              }}
                            ></div>

                            <div className="d-flex flex-column">
                              <div className="mb-2">
                                <Badge
                                  bg="info"
                                  text="light"
                                  style={{
                                    fontSize: "0.95rem",
                                    padding: "7px 12px",
                                    borderRadius: "8px",
                                    background:
                                      "linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(174, 117, 228) 100%)",
                                    boxShadow:
                                      "0 3px 8px rgba(154, 77, 226, 0.2)",
                                    fontWeight: "600",
                                    letterSpacing: "0.3px",
                                  }}
                                >
                                  {item.course_id}
                                </Badge>
                              </div>

                              <div className="mt-1">
                                <small
                                  style={{
                                    color: "#555",
                                    fontWeight: "500",
                                    fontSize: "0.8rem",
                                    display: "block",
                                    marginBottom: "5px",
                                  }}
                                >
                                  Must use rooms:
                                </small>
                                <div
                                  className="d-flex flex-wrap align-items-center"
                                  style={{ gap: "4px" }}
                                >
                                  {item.rooms.map((room, roomIndex) => (
                                    <span
                                      key={roomIndex}
                                      className="d-flex align-items-center"
                                    >
                                      <Badge
                                        bg="primary"
                                        text="light"
                                        style={{
                                          fontSize: "0.85rem",
                                          borderRadius: "6px",
                                          background: "#6c7ae0",
                                          boxShadow:
                                            "0 2px 6px rgba(108, 122, 224, 0.2)",
                                          border: "none",
                                          fontWeight: "500",
                                        }}
                                      >
                                        {room}
                                        <button
                                          style={{
                                            borderRadius: "6px",
                                            border: "none",
                                            color: "red",
                                            transition: "all 0.2s ease",
                                            marginLeft: "8px",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            width: "26px",
                                            height: "26px",
                                          }}
                                          onClick={() => {
                                            const updatedRoom =
                                              item.rooms.filter(
                                                (r) => r !== room
                                              );
                                            if (updatedRoom.length === 0) {
                                              setCourseRoom((prevCourseRoom) =>
                                                prevCourseRoom.filter(
                                                  (course) =>
                                                    course.course_id !==
                                                    item.course_id
                                                )
                                              );

                                              setUniqueNamedCourses(
                                                (prevCourses) => [
                                                  ...prevCourses,
                                                  offeredCourse.find(
                                                    (course) =>
                                                      course.course_id ===
                                                      item.course_id
                                                  ),
                                                ]
                                              );
                                            } else {
                                              setCourseRoom(
                                                (prevCourseRoom) => {
                                                  const index =
                                                    prevCourseRoom.findIndex(
                                                      (course) =>
                                                        course.course_id ===
                                                        item.course_id
                                                    );
                                                  const updatedCourseRoom = [
                                                    ...prevCourseRoom,
                                                  ];
                                                  updatedCourseRoom[
                                                    index
                                                  ].rooms = updatedRoom;
                                                  return updatedCourseRoom;
                                                }
                                              );
                                            }
                                            toast.success(
                                              `Room ${room} removed from ${item.course_id}`
                                            );
                                          }}
                                        >
                                          <i
                                            className="mdi mdi-delete-outline"
                                            style={{ fontSize: "14px" }}
                                          ></i>
                                        </button>
                                      </Badge>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <form className="mt-4">
                  <div className="row g-4">
                    {/* First Column */}
                    <div className="col-12 col-md-5">
                      <div
                        style={{
                          backgroundColor: "rgba(194, 137, 248, 0.04)",
                          borderRadius: "15px",
                          padding: "24px",
                          height: "100%",
                          border: "1px solid rgba(194, 137, 248, 0.15)",
                          boxShadow: "0 8px 25px rgba(0, 0, 0, 0.03)",
                        }}
                      >
                        <label
                          htmlFor="courseSelect"
                          className="form-label mb-3"
                          style={{
                            fontWeight: "700",
                            color: "#333",
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            fontSize: "16px",
                          }}
                        >
                          <div
                            style={{
                              background:
                                "linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(174, 117, 228) 100%)",
                              width: "35px",
                              height: "35px",
                              borderRadius: "10px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              boxShadow: "0 4px 10px rgba(174, 117, 228, 0.2)",
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
                                stroke="white"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M5 11.5V17L12 21L19 17V11.5"
                                stroke="white"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                          Fixed Room Constraints (Optional)
                        </label>
                        <select
                          id="courseSelect"
                          className="form-select text-dark"
                          multiple
                          aria-label="multiple select example"
                          style={{
                            height: 200,
                            width: "100%",
                            borderRadius: "12px",
                            border: "1px solid rgba(194, 137, 248, 0.3)",
                            boxShadow: "0 8px 20px rgba(194, 137, 248, 0.08)",
                            padding: "12px",
                            background:
                              "linear-gradient(to bottom, #ffffff, #fdfaff)",
                            transition: "all 0.3s ease",
                            fontWeight: "500",
                            color: "#333",
                            scrollbarWidth: "thin",
                            scrollbarColor:
                              "rgba(194, 137, 248, 0.3) rgba(194, 137, 248, 0.1)",
                          }}
                          ref={selectedCourseRef}
                        >
                          {uniqueNamedCourses.map((course, index) => (
                            <option
                              key={`${course.course_id}-${index}`}
                              className="p-2"
                              value={course.course_id}
                            >
                              {course.course_id} - {course.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Middle Column */}
                    <div className="col-12 col-md-2 d-flex justify-content-center align-items-center">
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          height: "100%",
                          padding: "20px 0",
                        }}
                      >
                        <button
                          className="card-control-button"
                          onClick={(e) => {
                            e.preventDefault();
                            const courseId = selectedCourseRef.current.value;
                            const newRooms = Array.from(
                              selectedRoomRef.current.selectedOptions
                            ).map((o) => o.value);

                            if (!courseId || newRooms.length === 0) {
                              toast.error(
                                "Please select a course and at least one room."
                              );
                              return;
                            }

                            setCourseRoom((prev) => {
                              const existing = prev.find(
                                (item) => item.course_id === courseId
                              );

                              if (existing) {
                                // Merge and deduplicate rooms
                                const mergedRooms = Array.from(
                                  new Set([...existing.rooms, ...newRooms])
                                );
                                return prev.map((item) =>
                                  item.course_id === courseId
                                    ? { ...item, rooms: mergedRooms }
                                    : item
                                );
                              } else {
                                return [
                                  ...prev,
                                  { course_id: courseId, rooms: newRooms },
                                ];
                              }
                            });

                            toast.success(
                              `Fixed room constraints added for ${courseId}.`
                            );
                            selectedCourseRef.current.value = "";
                            selectedRoomRef.current.selectedIndex = -1;
                          }}
                        >
                          <i className="mdi mdi-lock-check" />
                          MUST USE
                        </button>
                        <button
                          className="card-control-button"
                          style={{ marginTop: "24px" }}
                          onClick={(e) => {
                            e.preventDefault();
                            setCourseRoom(() => []);
                            toast.success(
                              "All constraints cleared successfully."
                            );
                          }}
                        >
                          <i className="mdi mdi-delete"></i>
                          Clear All Constrains
                        </button>
                      </div>
                    </div>

                    {/* Third Column */}
                    <div className="col-12 col-md-5">
                      <div
                        style={{
                          backgroundColor: "rgba(194, 137, 248, 0.04)",
                          borderRadius: "15px",
                          padding: "24px",
                          height: "100%",
                          border: "1px solid rgba(194, 137, 248, 0.15)",
                          boxShadow: "0 8px 25px rgba(0, 0, 0, 0.03)",
                        }}
                      >
                        <label
                          htmlFor="roomSelect"
                          className="form-label mb-3"
                          style={{
                            fontWeight: "700",
                            color: "#333",
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            fontSize: "16px",
                          }}
                        >
                          <div className="colored-icon-container">
                            <i className="mdi mdi-door" />
                          </div>
                          Available Rooms
                        </label>
                        <select
                          id="roomSelect"
                          className="form-select text-dark"
                          multiple
                          aria-label="multiple select example"
                          style={{
                            height: 200,
                            width: "100%",
                            borderRadius: "12px",
                            border: "1px solid rgba(194, 137, 248, 0.3)",
                            boxShadow: "0 8px 20px rgba(194, 137, 248, 0.08)",
                            padding: "12px",
                            background:
                              "linear-gradient(to bottom, #ffffff, #fdfaff)",
                            transition: "all 0.3s ease",
                            fontWeight: "500",
                            color: "#333",
                            scrollbarWidth: "thin",
                            scrollbarColor:
                              "rgba(194, 137, 248, 0.3) rgba(194, 137, 248, 0.1)",
                          }}
                          ref={selectedRoomRef}
                        >
                          {rooms.map((room, index) => (
                            <option
                              key={room.room || index}
                              className="p-2"
                              value={room.room}
                            >
                              {room.room}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
            <div
              className="d-flex justify-content-center p-4"
              style={{
                borderTop: "1px solid rgba(194, 137, 248, 0.2)",
                gap: "20px",
              }}
            >
              <button
                className="card-control-button"
                onClick={(e) => {
                  e.preventDefault();
                  generateRoomAssignments();
                  setAlreadySaved(() => false);
                  toast.success("Lab room assignments generated successfully.");
                }}
              >
                <i className="mdi mdi-refresh"></i>
                Generate Assignments
              </button>

              <button
                className="card-control-button"
                onClick={(e) => {
                  e.preventDefault();
                  setViewCourseAssignment(() => true);
                  setViewLevelTermAssignment(() => false);
                  setViewRoomAssignment(() => false);
                  setAlreadySaved(() => false);
                  // Clear all assignments
                  setFixedRoomAllocation((prev) => {
                    const newRoomAllocation = prev.map((room) => ({
                      ...room,
                      courses: [],
                    }));
                    toast.success(`All assignments cleared successfully.`);
                    return newRoomAllocation;
                  });
                }}
              >
                <i className="mdi mdi-refresh"></i>
                Clear Assignments
              </button>
              <button
                className="card-control-button"
                onClick={(e) => {
                  e.preventDefault();
                  let data = [];
                  fixedRoomAllocation.forEach((room) => {
                    room.courses.forEach((course) => {
                      data.push({
                        course_id: course.course_id,
                        batch: course.batch,
                        section: course.section,
                        room: room.room,
                      });
                    });
                  });
                  setRoomAssign(data).then((res) => {
                    toast.success("Lab Room Assignment Saved Successfully");
                    setAlreadySaved(() => true);
                    setViewCourseAssignment(() => true);
                    setViewLevelTermAssignment(() => false);
                    setViewRoomAssignment(() => false);
                  });
                }}
              >
                <i className="mdi mdi-content-save"></i>
                Save Assignment
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div
          className="card-header"
          style={{
            background:
              "linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(174, 117, 228) 100%)",
            color: "white",
            padding: "0",
          }}
        >
          <ul
            className="nav nav-tabs w-100"
            style={{
              margin: "0",
              borderBottom: "none",
            }}
          >
            <li className="nav-item">
              <button
                className={`header-tab-button ${
                  viewCourseAssignment ? "selected" : "unselected"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  setViewCourseAssignment(() => true);
                  setViewRoomAssignment(() => false);
                  setViewLevelTermAssignment(() => false);
                }}
              >
                <i className="mdi mdi-book-open-variant mr-2"></i>
                Course Assignment
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`header-tab-button ${
                  !viewCourseAssignment &&
                  !viewRoomAssignment &&
                  !viewLevelTermAssignment
                    ? "selected"
                    : "unselected"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  setViewCourseAssignment(() => false);
                  setViewRoomAssignment(() => false);
                  setViewLevelTermAssignment(() => false);
                }}
              >
                <i className="mdi mdi-chart-bar mr-2"></i>
                Statistics
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`header-tab-button ${
                  viewRoomAssignment ? "selected" : "unselected"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  setViewRoomAssignment(() => true);
                  setViewCourseAssignment(() => false);
                  setViewLevelTermAssignment(() => false);
                }}
              >
                <i className="mdi mdi-door mr-2"></i>
                Room Assignment
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`header-tab-button ${
                  viewLevelTermAssignment ? "selected" : "unselected"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  setViewLevelTermAssignment(() => true);
                  setViewCourseAssignment(() => false);
                  setViewRoomAssignment(() => false);
                }}
              >
                <i className="mdi mdi-school mr-2"></i>
                Level-Term Assignment
              </button>
            </li>
          </ul>
        </div>
        <div className="card-view">
          <div className="card-inner-table-container table-responsive">
            {fixedRoomAllocation.length === 0 ? (
              <div className="text-center py-4">
                <div className="mb-3">
                  <i
                    className="mdi mdi-flask-off-outline"
                    style={{
                      fontSize: "3rem",
                      color: "#6c757d",
                      opacity: 0.5,
                    }}
                  ></i>
                </div>
                <h6 className="text-muted mb-2">No Sessional Courses</h6>
                <p className="text-muted mb-0" style={{ fontSize: "0.9rem" }}>
                  No sessional courses have been distributed yet.
                </p>
              </div>
            ) : (
              <>
                {/* Statistics Tab */}
                {!viewLevelTermAssignment &&
                  !viewRoomAssignment &&
                  !viewCourseAssignment && (
                    <table className="card-inner-table table">
                      <thead className="card-inner-tabale-header">
                        <tr>
                          <th> Lab Room </th>
                          <th> Number of courses </th>
                        </tr>
                      </thead>
                      <tbody>
                        {fixedRoomAllocation
                          .sort((a, b) => a.room.localeCompare(b.room))
                          .map((room, index) => (
                            <tr key={index}>
                              <td>
                                <div className="d-flex flex-column align-items-center">
                                  <div className="colored-icon-container">
                                    <i className="mdi mdi-door"></i>
                                  </div>
                                  <span className="bold-text">{room.room}</span>
                                </div>
                              </td>
                              <td>
                                <div
                                  className={`status-container ${
                                    room.count > 0 ? "green" : "gray"
                                  }`}
                                >
                                  {room.count}
                                </div>
                                <div className="dimmed-text">
                                  {room.count === 1 ? "course" : "courses"}
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}

                {/* Room Assignment Tab */}
                {!viewLevelTermAssignment &&
                  viewRoomAssignment &&
                  !viewCourseAssignment && (
                    <table className="card-inner-table table">
                      <thead className="card-inner-tabale-header">
                        <tr>
                          <th> Lab Room </th>
                          <th> Assigned Courses </th>
                        </tr>
                      </thead>
                      <tbody>
                        {fixedRoomAllocation.map((room, index) => (
                          <tr key={index}>
                            <td>
                              <div className="d-flex flex-column align-items-center">
                                <div className="colored-icon-container">
                                  <i className="mdi mdi-door"></i>
                                </div>
                                <span className="bold-text">{room.room}</span>
                                <div className="colored-badge-light">
                                  {room.count}{" "}
                                  {room.count === 1 ? "course" : "courses"}
                                </div>
                              </div>
                            </td>
                            {room.courses.length === 0 ? (
                              <td>
                                <div className="dotted-border-div">
                                  <i
                                    className="mdi mdi-information-outline"
                                    style={{ color: "rgb(174, 117, 228)" }}
                                  ></i>
                                  No courses assigned
                                </div>
                              </td>
                            ) : (
                              <td>
                                <div className="d-flex flex-column align-items-center gap-4">
                                  {room.courses.map((course, index) => (
                                    <div key={index} className="animated-div">
                                      <div className="d-flex align-items-center justify-content-center gap-4 flex-column">
                                        <Badge className="colored-badge-dark">
                                          {course.course_id}
                                        </Badge>
                                        <span
                                          style={{
                                            fontWeight: "500",
                                            padding: "8px",
                                          }}
                                        >
                                          {course.name}
                                        </span>
                                        <Badge bg="secondary">
                                          Section {course.section}
                                        </Badge>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                {/* Course Assignment Tab */}
                {!viewLevelTermAssignment &&
                  viewCourseAssignment &&
                  !viewRoomAssignment && (
                    <table className="card-inner-table table">
                      <thead className="card-inner-tabale-header">
                        <tr>
                          <th> Course ID </th>
                          <th> Course Name </th>
                          <th> Level-Term </th>
                          <th> Section </th>
                          <th> Assigned Room </th>
                        </tr>
                      </thead>
                      <tbody>
                        {offeredCourse.map((course, index) => {
                          // Find the current room assignment for this course
                          const currentRoom = fixedRoomAllocation.find((room) =>
                            room.courses.some(
                              (c) =>
                                c.course_id === course.course_id &&
                                c.section === course.section
                            )
                          );
                          return (
                            <tr key={index}>
                              <td>{course.course_id}</td>
                              <td>{course.name}</td>
                              <td>{course.level_term}</td>
                              <td>{course.section}</td>
                              <td>
                                <select
                                  className="form-select"
                                  value={currentRoom ? currentRoom.room : ""}
                                  onChange={(e) =>
                                    updateCourseRoomAssignment(
                                      course,
                                      e.target.value
                                    )
                                  }
                                >
                                  <option value="">Select a room</option>
                                  {rooms.map((room) => (
                                    <option key={room.room} value={room.room}>
                                      {room.room}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                {/* Level-Term Assignment Tab */}
                {viewLevelTermAssignment && (
                  <table className="card-inner-table table">
                    <thead className="card-inner-tabale-header">
                      <tr>
                        <th> Level-Term </th>
                        <th> Used Labs </th>
                      </tr>
                    </thead>
                    <tbody>
                      {levelTermAllocationArray.map((lt, index) => (
                        <tr key={index}>
                          <td>
                            <div className="d-flex flex-column align-items-center">
                              <div className="colored-icon-container">
                                <i className="mdi mdi-school"></i>
                              </div>
                              {lt.level_term}
                            </div>
                          </td>
                          {lt.rooms.length === 0 ? (
                            <td>
                              <div className="dotted-border-div">
                                <i
                                  className="mdi mdi-information-outline"
                                  style={{ color: "rgb(174, 117, 228)" }}
                                ></i>
                                No rooms assigned
                              </div>
                            </td>
                          ) : (
                            <td>
                              <div className="d-flex flex-wrap justify-content-center">
                                {lt.rooms.map((room, index) => (
                                  <span
                                    key={index}
                                    className="colored-badge-light"
                                  >
                                    <i className="mdi mdi-door"></i>
                                    {room}
                                  </span>
                                ))}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
