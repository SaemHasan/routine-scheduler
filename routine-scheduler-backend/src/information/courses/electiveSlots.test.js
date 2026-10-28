import assert from "node:assert/strict";
import test from "node:test";
import { assignSlotLetters, slotLabel, slotMoves } from "./electiveSlots.js";

const course = (course_id, option_group, type = 0) => ({ course_id, option_group, type });

test("the courses of an option are lettered X, Y, Z in course order, each option apart", () => {
  const letters = assignSlotLetters([
    course("CSE463", 1), course("CSE461", 1), course("CSE465", 1),
    course("CSE471", 2), course("CSE473", 2),
    course("CSE462", 1, 1), course("CSE464", 1, 1),
  ]);
  assert.deepEqual(letters, {
    CSE461: "X", CSE463: "Y", CSE465: "Z",
    CSE471: "X", CSE473: "Y",
    CSE462: "X", CSE464: "Y",
  });
});

test("stored slots are kept, and a course joining takes the first free letter", () => {
  const stored = { CSE461: "1Z", CSE463: "1X", CSE499: "1Y" }; // CSE499 left the option
  assert.deepEqual(assignSlotLetters([course("CSE461", 1), course("CSE463", 1), course("CSE465", 1)], stored),
    { CSE461: "Z", CSE463: "X", CSE465: "Y" });
  // A slot two courses claim stays with the first; the other takes a free one
  assert.deepEqual(assignSlotLetters([course("CSE461", 1), course("CSE463", 1)], { CSE461: "1X", CSE463: "1X" }),
    { CSE461: "X", CSE463: "Y" });
  // A course moved to another option joins it like a new one
  assert.deepEqual(assignSlotLetters([course("CSE461", 2), course("CSE471", 2), course("CSE473", 2)],
    { CSE461: "1Z", CSE471: "2X", CSE473: "2Y" }), { CSE461: "Z", CSE471: "X", CSE473: "Y" });
  assert.deepEqual(assignSlotLetters([course("CSE461", 2), course("CSE471", 2)], { CSE461: "1Y", CSE471: "2Y" }),
    { CSE461: "X", CSE471: "Y" });
});

test("a slot is labelled by its option and letter", () => {
  assert.equal(slotLabel(course("CSE461", 1), "X"), "Option 1X");
  assert.equal(slotLabel(course("CSE462", 2, 1), "Z"), "Option 2Z");
});

test("each slot's classes go to the course now holding it", () => {
  // Two courses trade slots
  assert.deepEqual(slotMoves({ CSE461: "X", CSE463: "Y", CSE465: "Z" }, { CSE461: "Y", CSE463: "X", CSE465: "Z" }),
    [["CSE461", "CSE463"], ["CSE463", "CSE461"]]);
  // Three in a cycle: 1X's classes go to CSE465, 1Y's to CSE461, 1Z's to CSE463
  assert.deepEqual(slotMoves({ CSE461: "X", CSE463: "Y", CSE465: "Z" }, { CSE461: "Y", CSE463: "Z", CSE465: "X" }),
    [["CSE461", "CSE465"], ["CSE463", "CSE461"], ["CSE465", "CSE463"]]);
  assert.deepEqual(slotMoves({ CSE461: "X", CSE463: "Y" }, { CSE461: "X", CSE463: "Y" }), []);
});
