import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { getSessionalDistribution } from '../api/theory-assign';

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

export default function SessionalDistribution() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSessionalDistribution();
  }, []);

  const fetchSessionalDistribution = async () => {
    setLoading(true);
    try {
      const response = await getSessionalDistribution();
      console.log(response);
      setCourses(response || []);
    } catch (error) {
      console.error("Error fetching sessional distribution:", error);
      toast.error("Failed to load sessional distribution data");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time) => {
    if (!time) return "Not scheduled";
    return time;
  };

  if (loading) {
    return (
      <div className="page-content">
        <div className="text-center py-4">
          <div className="spinner-border text-info" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p className="mt-2 text-muted">Loading sessional distribution...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {courses.length === 0 ? (
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
        <table className="card-inner-table table">
          <thead className="card-inner-tabale-header">
            <tr>
              <th>Course ID</th>
              <th>Course Name</th>
              <th>Section</th>
              <th>Day</th>
              <th>Time</th>
              <th>Assigned Teachers</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course, index) => (
              <tr key={index}>
                <td>{course.course_id}</td>
                <td>{course.course_name || course.course_id}</td>
                <td>{course.section}</td>
                <td>{course.day || "Not scheduled"}</td>
                <td>{formatTime(course.time)}</td>
                <td>
                  {course.teachers_details &&
                  course.teachers_details.length > 0 ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      {course.teachers_details.map((teacher, idx) => (
                        <div
                          key={idx}
                          className="colored-badge-light"
                          title={`${teacher.name} (${teacher.initial})`}
                        >
                          {teacher.surname}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span
                      style={{
                        color: "#6c757d",
                        fontStyle: "italic",
                        fontSize: "0.85rem",
                      }}
                    >
                      No teachers assigned
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
