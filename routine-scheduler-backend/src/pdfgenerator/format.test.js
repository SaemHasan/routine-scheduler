import assert from "node:assert/strict";
import test from "node:test";
import { downloadName } from "./format.js";

test("a downloaded file is named by its type, the term and the day in Dhaka", () => {
  // 18:30 UTC on 28 October is already 29 October in Dhaka
  const evening = new Date("2026-10-28T18:30:00Z");
  assert.equal(downloadName("Level_Term", "July-26", "pdf", evening), "Level_Term_July_2026_29_October_2026.pdf");
  assert.equal(downloadName("Teacher KRV", "July-26", "pdf", evening), "Teacher_KRV_July_2026_29_October_2026.pdf");
  assert.equal(downloadName("Course_Load", "July 2026", "xlsx", new Date("2026-01-05T03:00:00Z")),
    "Course_Load_July_2026_5_January_2026.xlsx");
  assert.equal(downloadName("Level_Term L-4 T-2", "January-27", "pdf", evening),
    "Level_Term_L-4_T-2_January_2027_29_October_2026.pdf");
});
