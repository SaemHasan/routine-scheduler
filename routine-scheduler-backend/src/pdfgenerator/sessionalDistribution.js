import { sessionalDistributionBook } from "./routineBook.js";
import { termTitle, teacherLine } from "./format.js";
import { getCurrentSession } from "./repository.js";

/*
 * The sessional distribution as a PDF, laid out like the department's
 * printed one: one block of rows per day, each lab a three-hour cell with
 * "CSE216(A1), DBL" and its teachers "[ KRV, FRA, IAH/STP ]".
 */
export async function sessionalDistributionPDF(req, res, next) {
  try {
    const buffer = await sessionalDistributionBook();
    const name = `Sessional_Distribution_${termTitle(await getCurrentSession()).replace(/\s+/g, "_")}.pdf`;
    res
      .status(200)
      .set("Content-Type", "application/pdf")
      .set("Content-Disposition", `attachment; filename="${name}"`)
      .send(buffer);
  } catch (err) {
    next(err);
  }
}

export { sessionalDistributionBook, termTitle, teacherLine };
