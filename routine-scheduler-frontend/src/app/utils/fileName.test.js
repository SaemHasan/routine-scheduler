import { downloadName, termTitle } from "./fileName";

test("a term reads as its month and year", () => {
  expect(termTitle("July-26")).toBe("July 2026");
  expect(termTitle("January 2027")).toBe("January 2027");
});

test("a downloaded file is named by its type, the term and the day", () => {
  expect(downloadName("Theory_Distribution", "July-26", "csv", new Date(2026, 9, 29)))
    .toBe("Theory_Distribution_July_2026_29_October_2026.csv");
});
