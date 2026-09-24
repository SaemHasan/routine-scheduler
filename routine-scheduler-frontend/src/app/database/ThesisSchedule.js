import { useCallback, useEffect, useState } from "react";
import { Form } from "react-bootstrap";
import { toast } from "react-hot-toast";
import { useConfig } from "../shared/ConfigContext";
import { getThesisSetup, setLevelTermThesis, setThesisSlot } from "../api/thesis";

// Periods run 8 … 4; anything below 8 is in the afternoon.
const formatHour = (t) => {
  const h = Number(t);
  if (h === 12) return "12 PM";
  return h >= 8 ? `${h} AM` : `${h} PM`;
};
// A period starting at 4 ends at 5
const endOf = (t) => formatHour(Number(t) === 12 ? 1 : Number(t) + 1);

/**
 * When Thesis 1 and Thesis 2 run, and which level-term takes which. All
 * sections of a level-term have its thesis in the same slot; it needs no room.
 */
export default function ThesisSchedule({ reloadKey }) {
  const { days, times } = useConfig();
  const [setup, setSetup] = useState(null);
  const [drafts, setDrafts] = useState({});

  const load = useCallback(
    () =>
      getThesisSetup()
        .then((res) => {
          setSetup(res);
          setDrafts(Object.fromEntries(res.slots.map((s) => [s.thesis, { ...s }])));
        })
        .catch(() => toast.error("Failed to load the thesis schedule")),
    []
  );

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const saveSlot = async (thesis) => {
    try {
      const res = await setThesisSlot(thesis, drafts[thesis]);
      setSetup(res);
      toast.success(`Thesis ${thesis} time saved`);
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || "Failed to save the thesis time");
    }
  };

  const assign = async (lt, thesis) => {
    try {
      const res = await setLevelTermThesis({
        level_term: lt.level_term,
        department: lt.department,
        thesis: thesis === "" ? null : Number(thesis),
      });
      setSetup(res);
      toast.success(`${lt.level_term}: ${thesis ? `Thesis ${thesis}` : "no thesis"}`);
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || "Failed to update the level-term");
    }
  };

  if (!setup) return null;
  const active = setup.levelTerms.filter((lt) => lt.active);
  const changed = (s) =>
    setup.slots.some(
      (o) =>
        o.thesis === s.thesis &&
        (o.day !== s.day ||
          Number(o.start_time) !== Number(s.start_time) ||
          Number(o.end_time) !== Number(s.end_time))
    );

  return (
    <div className="row mb-4">
      <div className="col-12">
        <div className="card">
          <div className="card-view">
            <div className="card-control-container">
              <h4 className="card-name">
                <div className="card-icon mdi mdi-school-outline"></div>
                Thesis Schedule
              </h4>
            </div>
            <div className="field-hint mb-3">
              Every section of a level-term has its thesis at the same time, and thesis
              needs no room. After initialization, one Level 4 batch takes Thesis 1; with
              two, L-4 T-2 takes Thesis 1 and L-4 T-1 takes Thesis 2. The thesis shows in
              class and teacher routines (for teachers who offer that thesis).
            </div>

            <div className="thesis-grid">
              {Object.values(drafts).map((s) => (
                <div key={s.thesis} className="thesis-slot">
                  <strong>Thesis {s.thesis}</strong>
                  <Form.Select
                    className="form-select"
                    value={s.day}
                    onChange={(e) =>
                      setDrafts({ ...drafts, [s.thesis]: { ...s, day: e.target.value } })
                    }
                  >
                    {days.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Select
                    className="form-select"
                    value={s.start_time}
                    title="From"
                    onChange={(e) =>
                      setDrafts({
                        ...drafts,
                        [s.thesis]: { ...s, start_time: Number(e.target.value) },
                      })
                    }
                  >
                    {times.map((t) => (
                      <option key={t} value={t}>
                        {formatHour(t)}
                      </option>
                    ))}
                  </Form.Select>
                  <span>to</span>
                  <Form.Select
                    className="form-select"
                    value={s.end_time}
                    title="Until the end of this period"
                    onChange={(e) =>
                      setDrafts({
                        ...drafts,
                        [s.thesis]: { ...s, end_time: Number(e.target.value) },
                      })
                    }
                  >
                    {times.map((t) => (
                      <option key={t} value={t}>
                        {endOf(t)}
                      </option>
                    ))}
                  </Form.Select>
                  <button
                    className="card-control-button mdi mdi-content-save-outline"
                    disabled={!changed(s)}
                    onClick={() => saveSlot(s.thesis)}
                  >
                    Save
                  </button>
                </div>
              ))}
            </div>

            <div className="thesis-levels">
              {active.length === 0 ? (
                <div className="field-hint">Initialize the level-terms to assign thesis.</div>
              ) : (
                active.map((lt) => (
                  <div key={lt.level_term} className="thesis-level">
                    <span>
                      <strong>{lt.level_term}</strong>{" "}
                      <span className="field-hint">batch {lt.batch}</span>
                    </span>
                    <Form.Select
                      className="form-select"
                      value={lt.thesis || ""}
                      onChange={(e) => assign(lt, e.target.value)}
                    >
                      <option value="">No thesis</option>
                      <option value="1">Thesis 1</option>
                      <option value="2">Thesis 2</option>
                    </Form.Select>
                  </div>
                ))
              )}
            </div>

            {setup.conflicts.length > 0 && (
              <div className="auto-scheduler-issues">
                {setup.conflicts.map((c) => (
                  <div key={c} className="issue bad">
                    <i className="mdi mdi-alert-circle-outline"></i>
                    {c}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
