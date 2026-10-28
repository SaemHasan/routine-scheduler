import { useEffect, useState } from "react";
import { getElectiveLabels } from "../api/db-crud";

/**
 * Until a level-term's electives are activated on the Optional Courses page,
 * the routine names each by its slot: { CSE461: "Option 1X", … }.
 */
export function useElectiveLabels() {
  const [labels, setLabels] = useState({});
  useEffect(() => {
    getElectiveLabels().then((data) => setLabels(data || {})).catch(() => setLabels({}));
  }, []);
  return labels;
}

// A course as the routine names it: its code, or its slot while hidden
export const courseCode = (labels, courseId) => labels?.[courseId] || courseId;

// "CSE461 — Machine Learning", or only "Option 1X" while hidden
export const courseTitle = (labels, courseId, name) =>
  labels?.[courseId] || (name ? `${courseId} — ${name}` : courseId);
