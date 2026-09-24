import React, { useMemo, useCallback } from "react";
import Select, { components } from "react-select";
import Icon from "@mdi/react";
import { mdiDoor } from "@mdi/js";
import { useConfig } from "../shared/ConfigContext";
import { MultiSet } from "mnemonist";

// A class in a cell shows its course code; the name is in the tooltip
const CodeLabel = (props) => (
  <div title={props.data.name ? `${props.data.value} — ${props.data.name}` : props.data.value}>
    <components.MultiValueLabel {...props} />
  </div>
);
const SELECT_COMPONENTS = { MultiValueLabel: CodeLabel };
// Codes in the cell, "code — name" in the menu
const formatCourse = (option, { context }) => (context === "value" ? option.value : option.label);

/**
 * Custom component for displaying a theory schedule table with single dropdown per cell
 * Styles and structure match SectionScheduleTable.js exactly
 */
const TheoryScheduleTable = React.memo(function TheoryScheduleTable(props) {
  const {
    filled = [],
    selected = [],
    onChange = () => {},
    allTheoryCourses = [],
    theorySchedules = {},
    sectionName = "Section",
    isDisabledTimeSlot = () => false,
    readOnly = false,
    suggestedSlots = {},
    ctAvailableDays = [],
    // slot → course ids placed by the last applied suggestion (not fixed)
    generatedSlots = {},
    // Rooms: the room list, the section's usual room, and a handler that
    // moves one saved class to another room for its day and time
    rooms = [],
    sectionRoom = null,
    onRoomChange = null,
  } = props;

  // Memoized values for configuration settings
  const { days, times } = useConfig();

  // Convert arrays to MultiSets for efficient lookup
  const filledSet = useMemo(() => MultiSet.from(filled), [filled]);
  const selectedSet = useMemo(() => MultiSet.from(selected), [selected]);

  // Prepare filtered courses - memoized to prevent unnecessary filtering
  const filteredCourses = useMemo(() => {
    return Array.isArray(allTheoryCourses) ? allTheoryCourses : [];
  }, [allTheoryCourses]);

  // Helper to get courses for a slot
  const getCourses = useCallback(
    (slotKey) => {
      if (!theorySchedules) return [];

      // Extract day and time from slot key
      const [day, time] = slotKey.split(" ");

      // Get courses from theorySchedules
      let courses = [];

      // Check if the slot exists in theorySchedules
      if (theorySchedules[slotKey]) {
        // Extract course_ids safely, handling both array and single course_id formats
        const courseIds = Array.isArray(theorySchedules[slotKey].course_ids)
          ? theorySchedules[slotKey].course_ids
          : theorySchedules[slotKey].course_id
          ? [theorySchedules[slotKey].course_id]
          : [];

        // Map course IDs to select options
        if (courseIds.length > 0) {
          courses = courseIds
            .map((id) => {
              if (!id) return null; // Skip empty IDs

              const courseObj = filteredCourses.find((c) => c.course_id === id);
              const result = {
                value: id,
                label: courseObj?.name ? `${id} — ${courseObj.name}` : id,
                name: courseObj?.name,
                generated: (generatedSlots[slotKey] || []).includes(id),
              };
              return result;
            })
            .filter(Boolean); // Remove null entries
        }
      }

      // If no courses in schedules, check filled and selected
      if (courses.length === 0) {
        const filledObj = filled.find((f) => f.day === day && f.time === time);
        if (filledObj && filledObj.course_id) {
          const courseObj = filteredCourses.find(
            (c) => c.course_id === filledObj.course_id
          );
          courses.push({
            value: filledObj.course_id,
            label: `${filledObj.course_id} - ${courseObj?.name || "Unknown"}`,
          });
        }

        const selectedObj = selected.find(
          (f) => f.day === day && f.time === time
        );
        if (selectedObj && selectedObj.course_id) {
          const courseObj = filteredCourses.find(
            (c) => c.course_id === selectedObj.course_id
          );
          courses.push({
            value: selectedObj.course_id,
            label: `${selectedObj.course_id} - ${courseObj?.name || "Unknown"}`,
          });
        }
      }

      return courses;
    },
    [theorySchedules, filled, selected, filteredCourses, generatedSlots]
  );

  // Saved theory classes in a cell with their rooms (unsaved ones have none yet)
  const roomsAt = useCallback(
    (slotKey) => {
      const cell = theorySchedules?.[slotKey];
      const ids = cell?.course_ids || [];
      return ids
        .filter((id) => cell.rooms && Object.prototype.hasOwnProperty.call(cell.rooms, id))
        .map((id) => ({ courseId: id, room: cell.rooms[id] }));
    },
    [theorySchedules]
  );

  const roomGroups = useMemo(
    () =>
      [
        { label: "Theory rooms", list: rooms.filter((r) => r.type === 0) },
        { label: "Theory & lab rooms", list: rooms.filter((r) => r.type === 2) },
        { label: "Lab rooms", list: rooms.filter((r) => r.type === 1) },
      ].filter((g) => g.list.length),
    [rooms]
  );

  // Cell style calculation
  const getCellStyle = useCallback(
    (day, time) => {
      const key = `${day} ${time}`;
      if (selectedSet.has(key)) return "selected-upper";
      if (filledSet.has(key)) return "filled-upper";
      return "";
    },
    [selectedSet, filledSet]
  );

  // Event handler for multi-select
  const handleCourseChange = useCallback(
    (day, time, selectedOptions) => {
      // Extract course IDs from selected options
      const courseIds = selectedOptions
        ? selectedOptions.map((option) => option.value)
        : [];

      // Call the parent component's onChange handler with the day, time, and selected course IDs
      onChange(day, time, courseIds);
    },
    [onChange]
  );

  // Memoized table style for consistent rendering with improved appearance
  const tableStyle = useMemo(
    () => ({
      borderCollapse: "separate",
      borderSpacing: "0",
      textAlign: "center",
      backgroundColor: "#f8f9fa",
      boxShadow:
        "0 5px 20px rgba(0,0,0,0.15), 0 0 0 1px rgba(194, 137, 248, 0.1)",
      borderRadius: "10px",
      overflow: "visible",
      width: "100%",
      margin: "0 auto",
      transition: "all 0.3s ease",
    }),
    []
  );

  return (
    <div>
      <style jsx="true">{`
        .routine-table {
          border-spacing: 0;
          border-collapse: separate;
          overflow: visible;
          font-family: "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
        }

        .routine-table td {
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          position: relative;
          z-index: 1;
          border: 1px solid rgba(222, 226, 230, 0.8);
          padding: 0 !important;
          height: 60px !important;
          width: 120px !important;
          min-width: 120px !important;
          max-width: 120px !important;
        }

        .routine-table td:hover {
          background-color: #f0e9ff !important;
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 8px 16px rgba(154, 77, 226, 0.2);
          z-index: 3;
          border-color: rgba(194, 137, 248, 0.4);
        }

        .routine-table td,
        .routine-table th {
          border: 1px solid rgba(222, 226, 238, 0.7);
          text-align: center;
          vertical-align: middle;
          background-color: #f8f9fa;
          position: relative;
          transition: all 0.3s ease;
        }

        .routine-table thead th {
          background: linear-gradient(
            135deg,
            rgb(194, 137, 248) 0%,
            rgb(174, 117, 228) 100%
          );
          color: white;
          font-weight: 600;
          padding: 12px 8px;
          letter-spacing: 0.5px;
          text-shadow: 0px 1px 1px rgba(0, 0, 0, 0.1);
          border: none;
          position: relative;
          overflow: hidden;
          z-index: 1;
          width: 120px !important;
          min-width: 120px !important;
          max-width: 120px !important;
        }

        .routine-table thead th:first-child {
          width: 100px !important;
          min-width: 100px !important;
          max-width: 100px !important;
        }

        .routine-table tbody th {
          background: linear-gradient(
            135deg,
            rgb(194, 137, 248) 0%,
            rgb(174, 117, 228) 100%
          );
          color: white;
          font-weight: 600;
          padding: 8px;
          text-shadow: 0px 1px 1px rgba(0, 0, 0, 0.1);
          border: none;
          transition: all 0.3s ease;
          width: 100px !important;
          min-width: 100px !important;
          max-width: 100px !important;
        }

        .routine-table tbody th:hover {
          transform: translateX(2px);
          box-shadow: -2px 0 8px rgba(154, 77, 226, 0.2);
        }

        .selected-upper {
          font-weight: bold;
          border-color: rgb(194, 137, 248) !important;
          background-color: rgba(233, 245, 255, 0.8);
          box-shadow: 0 0 0 2px rgba(194, 137, 248, 0.3);
          animation: selected-pulse 2s infinite ease-in-out;
          position: relative;
          z-index: 2;
        }

        .selected-upper:hover {
          transform: translateY(-4px) scale(1.04);
          box-shadow: 0 10px 20px rgba(154, 77, 226, 0.25);
          z-index: 4;
        }

        @keyframes selected-pulse {
          0% {
            box-shadow: 0 0 0 2px rgba(194, 137, 248, 0.3);
          }
          50% {
            box-shadow: 0 0 0 4px rgba(194, 137, 248, 0.2),
              0 5px 15px rgba(154, 77, 226, 0.1);
          }
          100% {
            box-shadow: 0 0 0 2px rgba(194, 137, 248, 0.3);
          }
        }

        .filled-upper {
          color: #495057;
          font-style: italic;
          background-color: #f7f5fa;
          position: relative;
          transition: all 0.3s ease;
        }

        .filled-upper:hover {
          color: #333;
          background-color: #f0ebf7;
          box-shadow: 0 4px 12px rgba(154, 77, 226, 0.12);
        }

        .disabled-time-slot {
          background-color: rgba(249, 230, 244, 0.6) !important;
          position: relative;
          pointer-events: none !important;
        }

        .disabled-time-slot::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: repeating-linear-gradient(
            45deg,
            rgba(255, 105, 180, 0.05),
            rgba(255, 105, 180, 0.05) 10px,
            rgba(255, 192, 203, 0.1) 10px,
            rgba(255, 192, 203, 0.1) 20px
          );
          z-index: 1;
        }

        .disabled-time-slot:hover {
          transform: none !important;
          box-shadow: none !important;
        }

        .thesis-time-slot {
          background-color: #ebe5f8 !important;
          color: #533778;
          pointer-events: none !important;
        }

        .thesis-time-slot:hover {
          transform: none !important;
          box-shadow: none !important;
        }

        .theory-cell {
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-height: 64px;
          padding: 2px 0;
        }

        .cell-rooms {
          display: flex;
          flex-wrap: wrap;
          gap: 2px 8px;
          justify-content: center;
          padding: 0 4px 2px;
          line-height: 1.2;
        }

        .cell-rooms label {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          margin: 0;
          color: #8a94a3;
          font-size: 0.72rem;
        }

        .cell-rooms .room-course {
          font-weight: 600;
          margin-right: 1px;
        }

        /* Reads as text; opens the room list when clicked */
        .room-chip {
          appearance: none;
          -webkit-appearance: none;
          border: none;
          border-bottom: 1px dotted transparent;
          background: transparent;
          color: #5f6b7a;
          font-size: 0.72rem;
          font-weight: 600;
          padding: 0 1px;
          cursor: pointer;
          text-align: center;
        }

        .room-chip:hover,
        .room-chip:focus {
          border-bottom-color: currentColor;
          outline: none;
        }

        .room-chip.moved {
          color: #b35c00;
        }

        .room-chip.none {
          color: #c0392b;
        }

        .table-scroll-x {
          width: 100%;
          overflow-x: auto;
          overflow-y: auto;
        }

        .table-scroll-x::-webkit-scrollbar {
          height: 8px;
        }

        .table-scroll-x::-webkit-scrollbar-thumb {
          background: rgba(194, 137, 248, 0.18);
          border-radius: 4px;
        }

        /* Multi-select styles */
        .multi-select-cell {
          width: 100%;
        }

        .multi-select-cell .react-select__control {
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        }

        .multi-select-cell .react-select__control:hover {
          border-color: rgba(194, 137, 248, 0.5) !important;
          background-color: rgba(194, 137, 248, 0.03) !important;
        }

        .multi-select-cell .react-select__control--is-focused {
          border-color: rgb(194, 137, 248) !important;
          box-shadow: 0 0 0 1px rgba(194, 137, 248, 0.5) !important;
          background-color: rgba(194, 137, 248, 0.05) !important;
        }

        .multi-select-cell .react-select__menu {
          border-radius: 8px;
          border: 1px solid rgba(194, 137, 248, 0.2);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
        }

        .multi-select-cell .react-select__option {
          cursor: pointer;
          padding: 8px 12px;
        }

        .multi-select-cell .react-select__option--is-focused {
          background-color: rgba(194, 137, 248, 0.1) !important;
          color: rgb(94, 37, 126) !important;
        }

        .multi-select-cell .react-select__option--is-selected {
          background-color: rgb(194, 137, 248) !important;
          color: white !important;
        }

        @media (max-width: 900px) {
          .routine-table {
            min-width: 600px;
          }
        }

        @media (max-width: 600px) {
          .routine-table {
            min-width: 480px;
          }
        }

        @media (max-width: 420px) {
          .routine-table {
            min-width: 340px;
          }
        }
      `}</style>
      <div className="table-scroll-x">
        <table className="table routine-table" style={tableStyle}>
          <thead>
            <tr>
              <th scope="col" className="col-2">
                Day \ Time
              </th>
              {times.map((time) => (
                <th key={time} scope="col">
                  {time}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day}>
                <th key={`${day}-header`} scope="row" className="col-2">
                  {day}
                </th>
                {times.map((time) => {
                  const slotKey = `${day} ${time}`;
                  const cellClassName = getCellStyle(day, time);
                  const isDisabled = isDisabledTimeSlot(day, time) || { isDisabled: false };
                  const disabledClass = isDisabled.isDisabled
                    ? isDisabled.kind === "thesis" ? "thesis-time-slot" : "disabled-time-slot"
                    : "";

                  if (isDisabled.isDisabled && !isDisabled.isStart) return null;

                  return (
                    <td
                      key={`${day}-${time}`}
                      className={`${cellClassName} ${disabledClass}`}
                      style={{
                        padding: 0,
                        position: "relative",
                        textAlign: "center",
                      }}
                      colSpan={isDisabled.isDisabled ? isDisabled.span : 1}
                    >
                      {isDisabled.kind === "thesis" ? (
                        <div className="thesis-assignment" style={{ padding: 8 }}>
                          <div style={{ fontWeight: 700 }}>{isDisabled.label}</div>
                          <div style={{ fontSize: "0.8rem" }}>Thesis · {isDisabled.span} hours</div>
                        </div>
                      ) : isDisabled.isDisabled ? (
                        <div className="sessional-assignment">
                          {[...new Set(isDisabled.sessionalAssignment || [])].map((label) => (
                            <div key={label} style={{ fontWeight: "bold", marginBottom: 2 }}>
                              {label}
                            </div>
                          ))}
                          <div style={{ fontSize: "0.7rem", opacity: 0.8 }}>
                            <i className="mdi mdi-flask"></i> Lab
                          </div>
                        </div>
                      ) : readOnly ? (
                        <div style={{ minHeight: 60, padding: 4, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 3 }}>
                          {getCourses(slotKey).map((course) => {
                            const proposed = (suggestedSlots[slotKey] || []).includes(course.value);
                            return <span key={course.value} title={course.label}
                              style={{ background: proposed ? "#e9d8fd" : "#eceff2", color: proposed ? "#6535a4" : "#495057", borderRadius: 6, padding: "3px 5px", fontSize: "0.8rem", fontWeight: proposed ? 700 : 500 }}>
                              {course.value}
                            </span>;
                          })}
                          {time === 8 && !getCourses(slotKey).length && ctAvailableDays.includes(day) && (
                            <span style={{ color: "#46715b", fontSize: "0.75rem" }}>CT available</span>
                          )}
                        </div>
                      ) : (
                        <div className="theory-cell">
                        <Select
                          isMulti
                          className={`multi-select-cell ${cellClassName}`}
                          classNamePrefix="react-select"
                          value={getCourses(slotKey)}
                          key={`select-${slotKey}-${JSON.stringify(
                            getCourses(slotKey)
                          )}`}
                          onChange={(selectedOptions) =>
                            handleCourseChange(day, time, selectedOptions)
                          }
                          options={filteredCourses.map((course) => ({
                            value: course.course_id,
                            label: course.name ? `${course.course_id} — ${course.name}` : course.course_id,
                            name: course.name,
                          }))}
                          formatOptionLabel={formatCourse}
                          components={SELECT_COMPONENTS}
                          placeholder=""
                          noOptionsMessage={() => "No courses available"}
                          isClearable={true}
                          isSearchable={true}
                          title={`${sectionName} - ${day} ${time}`}
                          menuPortalTarget={
                            typeof window !== "undefined" ? document.body : null
                          }
                          menuPosition="fixed"
                          styles={{
                            menuPortal: (base) => ({
                              ...base,
                              zIndex: 9999,
                            }),
                            control: (base) => ({
                              ...base,
                              minWidth: "110px",
                              width: "100%",
                              borderRadius: "0",
                              border: "none",
                              boxShadow: "none",
                              minHeight: "40px",
                              background: "transparent",
                              cursor: "pointer",
                            }),
                            // Generated classes are dashed: the next
                            // generation replaces them unless they are fixed
                            multiValue: (base, { data }) => ({
                              ...base,
                              background: data.generated ? "#ffffff" : "#efe4ff",
                              border: data.generated ? "1px dashed #b9a6d6" : "1px solid #d9c2f7",
                              borderRadius: "6px",
                              margin: "2px",
                              alignItems: "center",
                            }),
                            multiValueLabel: (base, { data }) => ({
                              ...base,
                              color: data.generated ? "#5f6b7a" : "#5b2a9e",
                              fontWeight: 700,
                              fontSize: "0.82rem",
                              letterSpacing: "0.3px",
                              padding: "2px 2px 2px 7px",
                              paddingLeft: "7px",
                            }),
                            multiValueRemove: (base, { data }) => ({
                              ...base,
                              color: data.generated ? "#8a94a3" : "#8c5bd1",
                              opacity: 0.6,
                              padding: "0 4px",
                              borderRadius: "0 5px 5px 0",
                              ":hover": {
                                background: "#c289f8",
                                color: "white",
                                opacity: 1,
                              },
                            }),
                            placeholder: (base) => ({
                              ...base,
                              color: "#b39ddb",
                            }),
                            menu: (base) => ({
                              ...base,
                              width: "auto",
                              minWidth: "220px",
                              zIndex: 9999,
                              borderRadius: "8px",
                              border: "1px solid rgba(194, 137, 248, 0.2)",
                              boxShadow:
                                "0 8px 20px rgba(154, 77, 226, 0.15), 0 0 0 1px rgba(194, 137, 248, 0.2)",
                            }),
                            menuList: (base) => ({
                              ...base,
                              padding: "6px",
                              overflowY: "auto",
                            }),
                            valueContainer: (base) => ({
                              ...base,
                              padding: "2px 4px",
                              justifyContent: "center",
                            }),
                            input: (base) => ({
                              ...base,
                              margin: 0,
                              padding: 0,
                            }),
                            dropdownIndicator: () => ({
                              display: "none",
                            }),
                            clearIndicator: () => ({
                              display: "none",
                            }),
                            indicatorSeparator: () => ({
                              display: "none",
                            }),
                          }}
                        />
                      {onRoomChange && roomsAt(slotKey).length > 0 && (
                        <div className="cell-rooms">
                          {roomsAt(slotKey).map(({ courseId, room }, _, all) => (
                            <label key={courseId} title={`Room of ${courseId} on ${day} at ${time}:00` +
                              (sectionRoom ? ` (section room ${sectionRoom})` : "") + ". Click to change."}>
                              <Icon path={mdiDoor} size={0.5} />
                              {all.length > 1 && <span className="room-course">{courseId}</span>}
                              <select
                                className={`room-chip ${!room ? "none" : sectionRoom && room !== sectionRoom ? "moved" : ""}`}
                                value={room || ""}
                                onChange={(e) => onRoomChange(day, time, courseId, e.target.value || null)}
                              >
                                <option value="">{sectionRoom ? `Section room (${sectionRoom})` : "No room"}</option>
                                {room && !rooms.some((r) => r.room === room) && <option value={room}>{room}</option>}
                                {roomGroups.map((g) => (
                                  <optgroup key={g.label} label={g.label}>
                                    {g.list.map((r) => <option key={r.room} value={r.room}>{r.room}</option>)}
                                  </optgroup>
                                ))}
                              </select>
                            </label>
                          ))}
                        </div>
                      )}
                        </div>
                      )}
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

export default TheoryScheduleTable;
