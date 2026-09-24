import { useMemo } from "react";
import TheoryScheduleTable from "./TheoryScheduleTable";
import { useConfig } from "../shared/ConfigContext";
import { getTheoryRoutineBlock } from "./theoryRoutineBlocks";

const mainSection = (section) => String(section).replace(/[0-9]+$/, "");

export default function TheoryRoutinePreview({ suggestion, allTheoryCourses }) {
  const { times } = useConfig();
  const previews = useMemo(() => (suggestion.sectionNames || []).map((section) => {
    const fixedRows = (suggestion.fixedRows || []).filter((row) =>
      mainSection(row.section) === section ||
      (row.type === 1 && row.optional && row.optional_section_count <= 1));
    const cells = {};
    const suggestedSlots = {};
    const add = (day, time, courseId, suggested, type = 0, label = null) => {
      const key = `${day} ${time}`;
      if (!cells[key]) cells[key] = { course_ids: [] };
      if (!cells[key].course_ids.includes(courseId)) cells[key].course_ids.push(courseId);
      if (!cells[key].course_types) cells[key].course_types = {};
      cells[key].course_types[courseId] = type;
      if (label) {
        if (!cells[key].course_labels) cells[key].course_labels = {};
        cells[key].course_labels[courseId] = label;
      }
      if (suggested) {
        if (!suggestedSlots[key]) suggestedSlots[key] = [];
        if (!suggestedSlots[key].includes(courseId)) suggestedSlots[key].push(courseId);
      }
    };
    fixedRows.forEach((row) => add(
      row.day, row.time, row.course_id, false, row.type,
      row.type === 1 && row.optional && row.optional_section_count <= 1
        ? `${row.course_id} (all sections)` : null
    ));
    (suggestion.assignments || []).forEach((assignment) => {
      if (assignment.sections.includes(section)) {
        add(assignment.day, assignment.time, assignment.course_id, true);
      }
    });
    const isDisabledTimeSlot = (day, time) =>
      getTheoryRoutineBlock(cells, times, day, time);
    return { section, cells, suggestedSlots, isDisabledTimeSlot };
  }), [suggestion, times]);

  const ctAvailableDays = (suggestion.ctSlots || [])
    .filter((slot) => slot.available).map((slot) => slot.day);
  const preferred = (suggestion.ctSlots || [])
    .filter((slot) => slot.priority === "preferred" && slot.available)
    .map((slot) => slot.day);
  const fallback = (suggestion.ctSlots || [])
    .filter((slot) => slot.priority === "fallback" && slot.available)
    .map((slot) => slot.day);
  const availableCT = preferred.length + fallback.length;

  return <div className="mt-3">
    <div className="d-flex flex-wrap align-items-center mb-2" style={{ gap: 12 }}>
      <span><span style={{ background: "#e9d8fd", padding: "2px 7px", borderRadius: 5 }}>Suggested</span></span>
      <span><span style={{ background: "#eceff2", padding: "2px 7px", borderRadius: 5 }}>Fixed</span></span>
      <span className="text-muted">All sections below show the routine as it would look after applying.</span>
    </div>
    {(suggestion.ctSlots || []).length > 0 && <p className="mb-3 small">
      Common 8 AM CT slots: {availableCT} free across every section
      (at least {suggestion.ctRequired} required). Preferred: {preferred.join(", ") || "none"};
      fallback: {fallback.join(", ") || "none"}.
    </p>}
    {previews.map(({ section, cells, suggestedSlots, isDisabledTimeSlot }) =>
      <div key={section} className="mb-4">
        <h5>Section {section}</h5>
        <TheoryScheduleTable
          sectionName={`Section ${section}`}
          allTheoryCourses={allTheoryCourses}
          theorySchedules={cells}
          suggestedSlots={suggestedSlots}
          ctAvailableDays={ctAvailableDays}
          isDisabledTimeSlot={isDisabledTimeSlot}
          readOnly
        />
      </div>)}
  </div>;
}
