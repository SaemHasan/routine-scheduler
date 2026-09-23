import React, { useMemo, useCallback } from "react";
import { Form } from "react-bootstrap";
import { useConfig } from '../shared/ConfigContext';
import { MultiSet } from "mnemonist";

/**
 * Custom component for displaying a table with divided cells for multiple subsections
 * This component handles the display of sessional schedules with any number of subsections
 */
const SectionScheduleTable = React.memo(function SectionScheduleTable({
  filled = [],
  subsections = [], // Array of subsection objects: { key, name, selected, onChange }
  labTimes = [],
  allSessionalCourses = [],
  labSchedulesBySection = {}
}) {
  // Memoized values for configuration settings
  const { days, times, possibleLabTimes } = useConfig();

  // Extended blocked slots calculation from theory slots
  const extendedBlockedSlots = useMemo(() => {
    if (!Array.isArray(filled.mainSection)) return [];
    
    // Create a map of all blocked slots by day
    const blockedSlotsByDay = {};
    
    // First, identify all theory classes
    filled.mainSection.forEach(course => {
      const { day, time } = course;
      
      // Convert time to number if it's not already
      const timeNum = parseInt(time);
      
      // Initialize the day if not already present
      if (!blockedSlotsByDay[day]) {
        blockedSlotsByDay[day] = new Set();
      }
      
      // Add the original slot to the blocked set
      blockedSlotsByDay[day].add(timeNum);
    });
    
    // Build final list of blocked slots
    const blockedSlots = [];
    
    // For each day with theory classes
    Object.entries(blockedSlotsByDay).forEach(([day, timeSet]) => {
      // For each hour of the day
      for (let h of possibleLabTimes) {        
        // If this slot should be blocked, add it to our results
        if (timeSet.has(h) || timeSet.has((h % 12) + 1) || timeSet.has(((h + 1) % 12) + 1)) {
          blockedSlots.push(`${day} ${h}`);
        }
      }
    });
    
    return blockedSlots;
  }, [filled]);
  
  // Convert arrays to MultiSets for efficient lookup
  const extendedBlockedSet = useMemo(() => MultiSet.from(extendedBlockedSlots), [extendedBlockedSlots]);
  
  // Create a map of selected sets for each subsection
  const selectedSets = useMemo(() => {
    const sets = {};
    subsections.forEach(subsection => {
      sets[subsection.key] = MultiSet.from(subsection.selected || []);
    });
    return sets;
  }, [subsections]);
  
  const labTimesSet = useMemo(() => 
    MultiSet.from(labTimes.length ? labTimes : days.map((day) => `${day} 2`)),
    [labTimes, days]
  );
  
  // Check if a slot is blocked (filled by any theory course or within 2 slots of a theory course)
  const isSlotBlocked = useCallback((day, time) => {
    const key = `${day} ${time}`;
    return extendedBlockedSet.has(key);
  }, [extendedBlockedSet]);
  
  // Prepare filtered courses - memoized to prevent unnecessary filtering
  const filteredCourses = useMemo(() => {
    return Array.isArray(allSessionalCourses) ? allSessionalCourses : [];
  }, [allSessionalCourses]);
  
  // Generic helper function to get course ID for a specific slot in any section
  const getSectionCourse = useCallback((sectionKey, slotKey) => {
    if (!labSchedulesBySection[sectionKey]) return null;
    const slot = labSchedulesBySection[sectionKey].find(
      slot => `${slot.day} ${slot.time}` === slotKey
    );
    return slot ? slot.course_id : null;
  }, [labSchedulesBySection]);
  
  // Helper function to get section course for any subsection
  const getSubsectionCourse = useCallback((subsectionKey, slotKey) => {
    return getSectionCourse(subsectionKey, slotKey);
  }, [getSectionCourse]);
  
  // Cell style calculation - memoized to prevent recalculation
  const getCellStyle = useCallback((subsectionKey, day, time) => {
    const key = `${day} ${time}`;
    if (extendedBlockedSet.has(key)) return "filled-section blocked-cell";
    if (selectedSets[subsectionKey] && selectedSets[subsectionKey].has(key)) return "selected-section";
    return "";
  }, [selectedSets, extendedBlockedSet]);
  
  // Event handler for course changes
  const handleCourseChange = useCallback((subsectionKey, day, time, courseId) => {
    const subsection = subsections.find(s => s.key === subsectionKey);
    if (subsection && subsection.onChange) {
      subsection.onChange(day, time, courseId);
    }
  }, [subsections]);

  // Memoized table style for consistent rendering with improved appearance
  const tableStyle = useMemo(() => ({
    borderCollapse: "separate", 
    borderSpacing: "0", 
    textAlign: "center",
    backgroundColor: "#f8f9fa",
    boxShadow: "0 5px 20px rgba(0,0,0,0.15), 0 0 0 1px rgba(194, 137, 248, 0.1)",
    borderRadius: "10px",
    overflow: "hidden",
    width: "100%",
    margin: "0 auto",
    transition: "all 0.3s ease"
  }), []);

  return (
    <div>
      <style jsx="true">{`
        .cell-container {
          display: flex;
          flex-direction: column;
          width: auto;
          overflow: hidden;
          padding: 0;
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          position: relative;
          border-radius: 6px;
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.05);
        }

        td:hover .cell-container {
          transform: scale(1.03);
          box-shadow: inset 0 0 0 1px rgba(194, 137, 248, 0.3);
        }
        
        /* Ensure cell container in blocked cells doesn't transform */
        td:has(.blocked-cell):hover .cell-container {
          transform: none !important;
          box-shadow: none !important;
        }
        .form-control {
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          position: relative;
          z-index: 1;
        }
        .form-control:hover {
          border-color: rgb(194, 137, 248) !important;
          box-shadow: 0 0 0 3px rgba(194, 137, 248, 0.1), 0 1px 3px rgba(16, 24, 40, 0.1) !important;
          transform: translateY(-1px);
        }
        .form-control:focus {
          border-color: rgb(194, 137, 248) !important;
          box-shadow: 0 0 0 4px rgba(194, 137, 248, 0.15), 0 1px 3px rgba(16, 24, 40, 0.1) !important;
          transform: translateY(-1px);
          background: linear-gradient(to bottom, #ffffff, #fcf9ff) !important;
          color: rgb(94, 37, 126) !important;
        }
        .form-control::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 5px;
          height: 5px;
          background: rgba(194, 137, 248, 0.3);
          opacity: 0;
          border-radius: 100%;
          transform: translate(-50%, -50%);
          z-index: 0;
          pointer-events: none;
        }
        .form-control:focus::after {
          animation: form-ripple 1s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
        }
        @keyframes form-ripple {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0.4;
          }
          40% {
            opacity: 0.2;
            transform: translate(-50%, -50%) scale(30);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(40);
          }
        }
        .form-label {
          position: relative;
          z-index: 1;
          transition: all 0.3s ease;
        }
        .form-label:hover {
          color: rgb(154, 77, 226) !important;
          transform: translateX(2px);
        }
        .form-label svg {
          transition: all 0.3s ease;
        }
        .form-label:hover svg {
          transform: scale(1.1);
        }
        .routine-table {
          border-spacing: 0;
          border-collapse: separate;
          overflow: hidden;
          font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
        }
        .routine-table td {
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          position: relative;
          z-index: 1;
          border: 1px solid rgba(222, 226, 230, 0.8);
          min-width: 120px;
          max-width: 200px;
          width: auto;
          vertical-align: top;
          padding: 4px;
        }
        
        .routine-table td:hover {
          background-color: #f0e9ff !important;
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 8px 16px rgba(154, 77, 226, 0.2);
          z-index: 3;
          border-color: rgba(194, 137, 248, 0.4);
        }
        .routine-table td:has(.blocked-cell):hover,
        .routine-table td:has(.blocked-cell):focus,
        .routine-table td:has(.blocked-cell):active {
          background-color: #f8f9fa !important;
          transform: none !important;
          box-shadow: none !important;
          z-index: 1;
          border-color: rgba(222, 226, 230, 0.8) !important;
          transition: none !important;
          animation: none !important;
        }
        .routine-table td:before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(194, 137, 248, 0.05);
          opacity: 0;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          pointer-events: none;
          z-index: -1;
          border-radius: inherit;
          transform: scale(0.97);
        }
        .routine-table td:hover:before {
          opacity: 1;
          transform: scale(1);
        }
        .section-cell {
          flex: 1;
          position: relative;
          font-size: 0.85rem;
          border: none;
          border-radius: 0;
          padding: 0.3rem 0.5rem;
          text-align: center;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 1px solid #dee2e6;
        }
        
        .section-cell:last-child {
          border-bottom: none;
        }
        .dropdown-cell {
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          background-position: right 0.5rem center;
          background-size: 0.75em;
          background-image: none;
          background-repeat: no-repeat;
          color: #333;
          text-align-last: center;
          background-color: #ffffff;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transform-origin: center;
        }
        .dropdown-cell:focus, .dropdown-cell:hover {
          border-color: rgb(194, 137, 248) !important;
          outline: 0;
          box-shadow: 0 0 0 2px rgba(194, 137, 248, 0.25), 0 4px 8px rgba(194, 137, 248, 0.15);
          color: rgb(94, 37, 126);
          background-image: none;
          background-color: rgba(246, 235, 255, 1);
          transform: translateY(-1px);
          letter-spacing: 0.01em;
        }
        .dropdown-cell:after {
          content: "";
          position: absolute;
          top: 50%;
          left: 50%;
          width: 5px;
          height: 5px;
          background: rgba(194, 137, 248, 0.3);
          opacity: 0;
          border-radius: 100%;
          transform: scale(1, 1) translate(-50%);
          transform-origin: 50% 50%;
          pointer-events: none;
        }        
        .dropdown-cell:focus:after {
          animation: ripple 1.2s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
        }        
        .dropdown-cell:hover:after {
          animation: micro-ripple 0.8s cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .dropdown-cell option {
          font-size: 0.9rem;
          padding: 8px;
        }
        .section-cell:first-child {
          border-top-left-radius: 4px;
          border-top-right-radius: 4px;
        }
        .section-cell:last-child {
          border-bottom-left-radius: 4px;
          border-bottom-right-radius: 4px;
        }
        .section-labels {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-start;
          gap: 10px;
          margin-bottom: 15px;
        }
        .section-label {
          font-weight: bold;
          padding: 7px 14px;
          border-radius: 8px;
          background: linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(174, 117, 228) 100%);
          color: white;
          box-shadow: 0 4px 8px rgba(154, 77, 226, 0.3);
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .section-label:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(154, 77, 226, 0.4);
        }
        .section-label:after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(45deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0) 70%);
          z-index: 1;
          transition: all 0.6s ease;
          transform: translateX(-100%);
        }
        .section-label:hover:after {
          transform: translateX(100%);
        }
        .selected-section {
          font-weight: bold;
          border-color: rgb(194, 137, 248) !important;
          background-color: rgba(194, 137, 248, 0.3);
          box-shadow: 0 0 0 2px rgba(194, 137, 248, 0.3);
          animation: selected-pulse 2s infinite ease-in-out;
          position: relative;
          z-index: 2;
        }
        .selected-section:hover {
          transform: translateY(-4px) scale(1.04);
          box-shadow: 0 10px 20px rgba(154, 77, 226, 0.25);
          z-index: 4;
        }
        @keyframes selected-pulse {
          0% {
            box-shadow: 0 0 0 2px rgba(194, 137, 248, 0.3);
          }
          50% {
            box-shadow: 0 0 0 4px rgba(194, 137, 248, 0.2), 0 5px 15px rgba(154, 77, 226, 0.1);
          }
          100% {
            box-shadow: 0 0 0 2px rgba(194, 137, 248, 0.3);
          }
        }
        .filled-section {
          color: #495057;
          font-style: italic;
          background-color: #f7f5fa;
          position: relative;
          transition: all 0.3s ease;
        }
        .filled-section:hover {
          color: #333;
          background-color: #f0ebf7;
          box-shadow: 0 4px 12px rgba(154, 77, 226, 0.12);
        }
        .blocked-cell {
          background-color: #ffe0e0 !important;
          color: #6c757d !important;
          cursor: not-allowed !important;
          opacity: 0.8;
          pointer-events: none;
          border: 1px solid rgba(220, 53, 69, 0.3) !important;
          box-shadow: inset 0 0 4px rgba(220, 53, 69, 0.2) !important;
          position: relative;
          overflow: hidden;
          transform: none !important;
          transition: none !important;
          animation: none !important;
        }
        
        /* Completely disable all hover effects on blocked cells */
        .blocked-cell:hover, 
        .blocked-cell:focus, 
        .blocked-cell:active,
        td:hover .blocked-cell,
        td:focus .blocked-cell,
        td:active .blocked-cell {
          transform: none !important;
          box-shadow: inset 0 0 4px rgba(220, 53, 69, 0.2) !important;
          animation: none !important;
          background-color: #ffe0e0 !important;
          border-color: rgba(220, 53, 69, 0.3) !important;
          color: #6c757d !important;
          opacity: 0.8 !important;
          transition: none !important;
        }
        .blocked-cell::before {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: repeating-linear-gradient(
            45deg,
            transparent,
            transparent 5px,
            rgba(220, 53, 69, 0.05) 5px,
            rgba(220, 53, 69, 0.05) 10px
          );
          pointer-events: none;
          z-index: 1;
        }
        .blocked-cell {
          position: relative;
        }
        .blocked-cell-content {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 0.7rem;
          color: #dc3545;
          text-shadow: 0px 0px 2px rgba(255, 255, 255, 0.8);
          font-weight: bold;
          white-space: nowrap;
          z-index: 2;
          background-color: rgba(255, 255, 255, 0.8);
          padding: 2px 6px;
          border-radius: 4px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.15);
          pointer-events: none;
        }
        .filled-upper:after, .filled-lower:after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: repeating-linear-gradient(
            45deg,
            transparent,
            transparent 5px,
            rgba(194, 137, 248, 0.05) 5px,
            rgba(194, 137, 248, 0.05) 10px
          );
          transition: opacity 0.3s ease, transform 0.3s ease;
          transform-origin: center;
          pointer-events: none;
        }
        .routine-table td, .routine-table th {
          border: 1px solid rgba(222, 226, 238, 0.7);
          text-align: center;
          vertical-align: middle;
          background-color: #f8f9fa;
          position: relative;
          transition: all 0.3s ease;
        }
        .routine-table thead th {
          background: linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(174, 117, 228) 100%);
          color: white;
          font-weight: 600;
          padding: 12px 8px;
          letter-spacing: 0.5px;
          text-shadow: 0px 1px 1px rgba(0, 0, 0, 0.1);
          border: none;
          position: relative;
          overflow: hidden;
          z-index: 1;
        }
        .routine-table thead th:after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(45deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0) 70%);
          z-index: -1;
          transition: all 0.6s ease;
          transform: translateX(-100%);
        }
        .routine-table thead tr:hover th:after {
          transform: translateX(100%);
        }
        .routine-table tbody th {
          background: linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(174, 117, 228) 100%);
          color: white;
          font-weight: 600;
          padding: 8px;
          text-shadow: 0px 1px 1px rgba(0, 0, 0, 0.1);
          border: none;
          transition: all 0.3s ease;
        }
        .routine-table tbody th:hover {
          transform: translateX(2px);
          box-shadow: -2px 0 8px rgba(154, 77, 226, 0.2);
        }
        .routine-table thead tr:hover th {
          box-shadow: 0 4px 6px -2px rgba(154, 77, 226, 0.2);
        }
        .lab-time-cell {
          background-color: rgba(233, 245, 255, 0.3) !important;
          transition: background-color 0.3s ease;
        }
        .lab-time-cell:hover {
          background-color: rgba(233, 245, 255, 0.6) !important;
        }
        .table-scroll-x {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          position: relative;
        }
        .table-scroll-x::-webkit-scrollbar {
          height: 8px;
        }
        .table-scroll-x::-webkit-scrollbar-thumb {
          background: rgba(194, 137, 248, 0.18);
          border-radius: 4px;
        }
      `}</style>
      <div className="table-scroll-x">
        <table className="table routine-table" style={tableStyle}>
          <thead>
            <tr>
              <th scope="col" className="col-2">Day \ Time</th>
              {times.map((time) => (
                <th key={time} scope="col">{time}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day}>
                <th key={`${day}-header`} scope="row" className="col-2">{day}</th>
                {times
                  .filter((time) =>
                    !labTimesSet.has(`${day} ${(time - 1 + 12) % 12}`) &&
                    !labTimesSet.has(`${day} ${(time - 2 + 12) % 12}`)
                  )
                  .map((time) => {
                    const isLabTime = labTimesSet.has(`${day} ${time}`);
                    const cellClassName = isLabTime ? "lab-time-cell" : "";
                    const slotKey = `${day} ${time}`;
                    
                    return (
                      <td 
                        key={`${day}-${time}`} 
                        colSpan={isLabTime ? 3 : 1}
                        className={cellClassName}
                        style={{
                          padding: "0",
                          position: "relative",
                          textAlign: "center"
                        }}
                      >
                        <div className="cell-container" style={{ 
                          height: `${subsections.length * 50}px`,
                          maxHeight: `${subsections.length * 60}px`
                        }}>
                          {isSlotBlocked(day, time) && (
                            <div className="blocked-cell-content">
                              ⚠️ {`Slot filled by theory class`}
                            </div>
                          )}
                          
                          {subsections.map((subsection, index) => (
                            <Form.Select
                              key={`${subsection.key}-${day}-${time}`}
                              className={`section-cell dropdown-cell section-${index} ${getCellStyle(subsection.key, day, time)}`}
                              value={getSubsectionCourse(subsection.key, slotKey) || ''}
                              onChange={(e) => handleCourseChange(subsection.key, day, time, e.target.value)}
                              title={isSlotBlocked(day, time) 
                                ? `Slot filled by theory class` 
                                : `${subsection.name} - ${day} ${time}`}
                              style={{ 
                                color: (getSubsectionCourse(subsection.key, slotKey) || "") === "" || isSlotBlocked(day, time) ? 'transparent' : undefined,
                                flex: 1,
                                Height: `${50 * subsections.length}px`
                              }}
                              disabled={isSlotBlocked(day, time)}
                            >
                              <option value="">{isSlotBlocked(day, time) ? "" : "None"}</option>
                              {filteredCourses.map(course => (
                                <option 
                                  key={`${subsection.key}-${day}-${time}-${course.course_id}`}
                                  value={course.course_id}
                                >
                                  {course.course_id} - {course.name || 'Unknown'}
                                </option>
                              ))}
                            </Form.Select>
                          ))}
                        </div>
                      </td>
                    );
                  })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default SectionScheduleTable;
