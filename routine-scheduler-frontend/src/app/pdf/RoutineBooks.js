import { useState } from "react";
import { toast } from "react-hot-toast";
import { getRoutineBook } from "../api/pdf";

// The books the department prints each term, as its routine workbook made them
const BOOKS = [
  { kind: "levelTerm", icon: "mdi-school", name: "Level-Term Routine", about: "Every section's week" },
  { kind: "teacher", icon: "mdi-account-tie", name: "Teacher Routine", about: "Every teacher's week, thesis included" },
  { kind: "partTimeTeacher", icon: "mdi-account-clock", name: "PT Teacher Routine", about: "Part-time (adjunct) teachers only" },
  { kind: "room", icon: "mdi-door", name: "Room Routine", about: "Every room in use, in room order" },
  { kind: "department", icon: "mdi-domain", name: "Departmental Routine", about: "Courses taken from and given to other departments" },
  { kind: "sessionalDistribution", icon: "mdi-flask-outline", name: "Sessional Distribution", about: "All CSE labs of the week" },
  { kind: "courseTeacher", icon: "mdi-format-list-bulleted", name: "Course Teacher", about: "Theory and sessional courses with their teachers" },
  { kind: "courseLoad", icon: "mdi-scale-balance", name: "Load Calculation", about: "Each teacher's courses and load" },
];

export default function RoutineBooks() {
  const [busy, setBusy] = useState("");

  const download = async (book) => {
    setBusy(book.kind);
    try {
      const { blob, filename } = await getRoutineBook(book.kind);
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error creating PDF:", error);
      toast.error(`Failed to create the ${book.name}`);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="row mb-4">
      <div className="col-12">
        <div className="card">
          <div className="card-view">
            <div className="card-control-container">
              <h4 className="card-name">
                <div className="card-icon mdi mdi-book-open-page-variant"></div>
                Routine Books
              </h4>
            </div>
            <div className="field-hint mb-3">
              The whole term in the layout of the department's printed routines.
            </div>
            <div className="stat-tile-grid">
              {BOOKS.map((book) => (
                <button
                  key={book.kind}
                  className="stat-tile text-start"
                  style={{ border: "none", cursor: busy ? "wait" : "pointer" }}
                  disabled={Boolean(busy)}
                  onClick={() => download(book)}
                  title={`Download the ${book.name}`}
                >
                  <div className={`stat-tile-icon mdi ${busy === book.kind ? "mdi-loading mdi-spin" : book.icon}`}></div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{book.name}</div>
                    <div className="stat-tile-label">{book.about}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
