import { useEffect, useMemo, useState } from "react";
import { Form } from "react-bootstrap";
import { toast } from "react-hot-toast";
import { getOptionalOfferings, saveOptionalOfferings } from "../api/db-crud";

const THEORY = 0;
const OPTIONS = [1, 2, 3, 4];

/**
 * How the electives of a level-term run, given what is offered:
 * - two or more courses in one option run side by side in one slot, each as
 *   a single class that every section's students choose from;
 * - a course alone in its option (or in none) runs like any other course,
 *   in every section.
 */
function describeOptions(courses) {
  const offered = courses.filter((c) => c.offered);
  const byOption = new Map();
  for (const c of offered) {
    const k = c.option_group ? Number(c.option_group) : `alone:${c.course_id}`;
    if (!byOption.has(k)) byOption.set(k, []);
    byOption.get(k).push(c);
  }
  return [...byOption.entries()]
    .sort(([a], [b]) => String(a).localeCompare(String(b), undefined, { numeric: true }))
    .map(([k, list]) => ({
      option: typeof k === "number" ? k : null,
      courses: list.map((c) => c.course_id),
      together: list.length > 1,
    }));
}

function ElectiveTable({ title, icon, courses, sectionCount, onChange }) {
  const plans = describeOptions(courses);
  return (
    <div className="mb-4">
      <h6 className="constraint-subhead">
        <i className={`mdi ${icon} me-1`}></i>
        {title}
      </h6>
      {courses.length === 0 ? (
        <div className="field-hint">None in the catalogue for this level-term.</div>
      ) : (
        <div className="card-table-container table-responsive">
          <table className="card-table table">
            <thead className="card-table-header">
              <tr>
                <th><i className="mdi mdi-check-circle"></i>Offered</th>
                <th><i className="mdi mdi-notebook"></i>Course</th>
                <th><i className="mdi mdi-book-open-page-variant"></i>Name</th>
                <th><i className="mdi mdi-counter"></i>Credit</th>
                <th><i className="mdi mdi-format-list-numbered"></i>Option</th>
              </tr>
            </thead>
            <tbody className="card-table-body">
              {courses.map((c) => (
                <tr key={c.course_id} style={{ opacity: c.offered ? 1 : 0.6 }}>
                  <td style={{ textAlign: "center" }}>
                    <Form.Check
                      type="switch"
                      id={`offer-${c.course_id}`}
                      checked={c.offered}
                      onChange={(e) => onChange(c.course_id, { offered: e.target.checked })}
                    />
                  </td>
                  <td style={{ textAlign: "center", fontWeight: 600 }}>{c.course_id}</td>
                  <td>{c.name}</td>
                  <td style={{ textAlign: "center" }}>{c.class_per_week}</td>
                  <td style={{ maxWidth: "150px" }}>
                    <Form.Select
                      className="form-select"
                      value={c.option_group || ""}
                      disabled={!c.offered}
                      onChange={(e) => onChange(c.course_id, { option_group: e.target.value ? Number(e.target.value) : null })}
                    >
                      <option value="">None</option>
                      {OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          Option {n}
                        </option>
                      ))}
                    </Form.Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {plans.length > 0 && (
        <div className="chip-row mt-2" style={{ gap: "8px", flexWrap: "wrap" }}>
          {plans.map((p) => (
            <span key={p.courses.join()} className={`pill ${p.together ? "purple" : "muted"}`}>
              {p.option ? `Option ${p.option}: ` : ""}
              {p.courses.join(", ")} —{" "}
              {p.together
                ? `one slot, one class each, for all ${sectionCount} sections`
                : `a normal course in each of the ${sectionCount} sections`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The electives offered this term, level-term by level-term, and the options
 * they form. Set before the routine is made: the theory routine and the
 * sessional distribution place each option's courses in one slot for every
 * section.
 */
export default function OptionalCourses() {
  const [rows, setRows] = useState([]);
  const [edited, setEdited] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");

  const load = () =>
    getOptionalOfferings()
      .then((data) => {
        setRows(Array.isArray(data) ? data : []);
        setEdited({});
      })
      .catch(() => toast.error("Failed to load the optional courses"))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const k = `${r.department}|${r.level_term}`;
      if (!map.has(k)) map.set(k, { department: r.department, level_term: r.level_term, sectionCount: r.section_count, courses: [] });
      map.get(k).courses.push({ ...r, ...(edited[`${k}|${r.course_id}`] || {}) });
    }
    return [...map.values()];
  }, [rows, edited]);

  const change = (group) => (course_id, patch) =>
    setEdited((e) => {
      const k = `${group.department}|${group.level_term}|${course_id}`;
      const next = { ...(e[k] || {}), ...patch };
      if (patch.offered === false) next.option_group = null;
      return { ...e, [k]: next };
    });

  const isDirty = (group) => group.courses.some((c) => edited[`${group.department}|${group.level_term}|${c.course_id}`]);

  const save = async (group) => {
    const key = `${group.department}|${group.level_term}`;
    setSaving(key);
    try {
      const data = await saveOptionalOfferings({
        level_term: group.level_term,
        department: group.department,
        courses: group.courses.map((c) => ({ course_id: c.course_id, offered: c.offered, option_group: c.offered ? c.option_group || null : null })),
      });
      setRows(Array.isArray(data) ? data : rows);
      setEdited((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith(`${key}|`))));
      toast.success(`Saved the electives of ${group.department} ${group.level_term}`);
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || "Failed to save the electives");
    } finally {
      setSaving("");
    }
  };

  return (
    <div>
      <div className="page-header">
        <h3 className="page-title">
          <div className="page-title-icon-container mdi mdi-format-list-checks"></div>
          Optional Courses
        </h3>
      </div>

      <div className="card mb-4">
        <div className="card-view">
          <div className="field-hint">
            Choose the electives offered this term and group them into options. The courses of an option run side by
            side in one slot, and that slot is kept for every section, since each student takes one of them. A course
            alone in its option runs like any other course, in every section. Theory and sessional electives form their
            options separately. Set these before the theory routine and the sessional distribution.
          </div>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <i className="mdi mdi-loading mdi-spin"></i>
          <div className="empty-state-title">Loading…</div>
        </div>
      ) : groups.length === 0 ? (
        <div className="card">
          <div className="card-view">
            <div className="empty-state">
              <i className="mdi mdi-book-off-outline"></i>
              <div className="empty-state-title">No electives for the running level-terms</div>
              <div className="empty-state-hint">
                Activate the level-terms on the Initialize page; their optional catalogue courses appear here.
              </div>
            </div>
          </div>
        </div>
      ) : (
        groups.map((group) => {
          const key = `${group.department}|${group.level_term}`;
          return (
            <div className="card mb-4" key={key}>
              <div className="card-view">
                <div className="card-control-container">
                  <h4 className="card-name">
                    <div className="card-icon mdi mdi-school"></div>
                    {group.department} {group.level_term}
                    <span className="pill muted ms-2" style={{ fontSize: "0.8rem" }}>
                      {group.sectionCount} section{group.sectionCount === 1 ? "" : "s"}
                    </span>
                  </h4>
                  <div className="card-control-button-container">
                    <button
                      className="card-control-button mdi mdi-content-save"
                      disabled={!isDirty(group) || saving === key}
                      onClick={() => save(group)}
                    >
                      {saving === key ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
                <ElectiveTable
                  title="Theory electives"
                  icon="mdi-book-open-variant"
                  courses={group.courses.filter((c) => Number(c.type) === THEORY)}
                  sectionCount={group.sectionCount}
                  onChange={change(group)}
                />
                <ElectiveTable
                  title="Sessional electives"
                  icon="mdi-flask-outline"
                  courses={group.courses.filter((c) => Number(c.type) !== THEORY)}
                  sectionCount={group.sectionCount}
                  onChange={change(group)}
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
