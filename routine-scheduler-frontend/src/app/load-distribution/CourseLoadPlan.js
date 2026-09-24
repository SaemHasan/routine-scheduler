import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { getCourseLoadPlan, getCourseLoadWorkbook } from "../api/pdf";

const hours = (n) => (Math.round(Number(n || 0) * 100) / 100).toString();
const levelTermShort = (levelTerm) => String(levelTerm || "").replace(/L-(\d+) T-(\d+)/, "$1-$2");
const labCode = {
  DEPT_SW: "D-S/W",
  DEPT_HW: "D-H/W",
  DEPT_PRESENTATION: "D-PL",
  NON_DEPT: "ND",
};

const SHEETS = [
  { id: "input", label: "Input", icon: "mdi-tune-variant" },
  { id: "total", label: "Total Load", icon: "mdi-scale-balance" },
  { id: "theory", label: "Theory", icon: "mdi-book-open-variant" },
  { id: "sessional", label: "Sessional", icon: "mdi-flask-outline" },
];

function SheetTable({ columns, rows, footer }) {
  return (
    <div className="load-plan-table-wrap">
      <table className="card-table table load-plan-table">
        <thead className="card-table-header">
          <tr>
            {columns.map((column) => <th key={column.key}>{column.label}</th>)}
          </tr>
        </thead>
        <tbody className="card-table-body">
          {rows.map((row, index) => (
            <tr key={row.key || index}>
              {columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>)}
            </tr>
          ))}
        </tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  );
}

function MetricTable({ rows, highlightLast = false }) {
  return (
    <table className="table load-plan-metric-table mb-0">
      <tbody>
        {rows.map(([label, value], index) => (
          <tr className={highlightLast && index === rows.length - 1 ? "load-plan-highlight" : ""} key={label}>
            <td>{label}</td>
            <td>{hours(value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InputSheet({ plan }) {
  const ft = plan.fullTime;
  const remainingRows = [
    ["Total Sessional Load Remaining", plan.remaining.sessional],
    ["Total Theory Load Remaining", plan.remaining.theory],
    ["Extra Load", plan.remaining.extra],
    ["Total Load Remaining", plan.remaining.total],
    ["Total Theory Course Sections", plan.theorySections],
    ["Total Theory Course Sections Taken", plan.theorySectionsTaken],
    ["Total Theory Course Sections Remaining", plan.theorySections - plan.theorySectionsTaken],
    ["Load per Part-time Lecturer", plan.loadPerPartTimer],
    ["Total Part-time Lecturer Needed", plan.partTimersNeeded],
  ];
  const teacherRows = [
    ["Professor and Associate Professor", plan.teacherCounts.P],
    ["Assistant Professor", plan.teacherCounts.AP],
    ["Lecturer", plan.teacherCounts.L],
  ];
  const fullTimeRows = [
    ["Total Load Available", ft.load],
    ["Thesis Load", ft.thesis],
    ["MSc Load", ft.msc],
    ["UG Theory Load", ft.theory],
    ["Sessional Load of FT Teachers", ft.lab],
  ];
  const totalRows = [
    ["Total Theory Load", plan.theoryHours],
    ["Total Sessional Load", plan.sessionalHours],
    ["Total Load", plan.theoryHours + plan.sessionalHours],
  ];

  return (
    <div className="load-plan-section-grid">
      <section className="load-plan-section">
        <h5>Designation loads</h5>
        <SheetTable
          columns={[
            { key: "name", label: "Designation" },
            { key: "code", label: "Code" },
            { key: "load", label: "Load (credits)" },
          ]}
          rows={plan.designationLoads || []}
        />
        <h5 className="mt-4">Lab types</h5>
        <SheetTable
          columns={[
            { key: "name", label: "Lab Type" },
            { key: "code", label: "Code", render: (row) => labCode[row.code] || row.code },
            { key: "teacher_count", label: "Teacher Count" },
          ]}
          rows={plan.labTypes || []}
        />
      </section>
      <section className="load-plan-section">
        <h5>Remaining load</h5>
        <MetricTable rows={remainingRows} highlightLast />
      </section>
      <section className="load-plan-section">
        <h5>Teacher count</h5>
        <MetricTable rows={teacherRows} />
        <h5 className="mt-4">Full-time teacher load</h5>
        <MetricTable rows={fullTimeRows} />
        <h5 className="mt-4">Required load</h5>
        <MetricTable rows={totalRows} />
      </section>
    </div>
  );
}

function TotalLoadSheet({ plan }) {
  const ft = plan.fullTime;
  const rows = (plan.loads || []).map((row, index) => ({
    ...row,
    key: `${row.name}-${index}`,
    lab: row.load - row.thesis - row.msc - row.theory,
    assigned: row.load,
  }));
  return (
    <>
      <SheetTable
        columns={[
          { key: "name", label: "Teacher Name" },
          { key: "code", label: "Code" },
          { key: "theory", label: "UG Theory", render: (row) => hours(row.theory) },
          { key: "msc", label: "MSc Theory*", render: (row) => hours(row.msc) },
          { key: "thesis", label: "Thesis Load", render: (row) => hours(row.thesis) },
          { key: "lab", label: "Lab Hrs", render: (row) => hours(row.lab) },
          { key: "assigned", label: "Total Load Assigned", render: (row) => hours(row.assigned) },
          { key: "load", label: "Total Load", render: (row) => hours(row.load) },
          { key: "remarks", label: "Remarks" },
        ]}
        rows={rows}
        footer={
          <tr>
            <th colSpan="2">Total</th>
            <th>{hours(ft.theory)}</th>
            <th>{hours(ft.msc)}</th>
            <th>{hours(ft.thesis)}</th>
            <th>{hours(ft.lab)}</th>
            <th>{hours(ft.load)}</th>
            <th>{hours(ft.load)}</th>
            <th></th>
          </tr>
        }
      />
      <div className="field-hint mt-3">* Subject to BPGS meeting resolution on next semester&apos;s MSc course list.</div>
      <div className="load-plan-summary-box mt-3">
        <MetricTable
          highlightLast
          rows={[
            ["Total Sessional Load Remaining", plan.remaining.sessional],
            ["Total Theory Load Remaining", plan.remaining.theory],
            ["Extra Load", plan.remaining.extra],
            ["Total Load Remaining", plan.remaining.total],
            ["Total Theory Course Sections", plan.theorySections],
            ["Total Theory Course Sections Taken", plan.theorySectionsTaken],
            ["Total Theory Course Sections Remaining", plan.theorySections - plan.theorySectionsTaken],
            ["Load per Part-time Lecturer", plan.loadPerPartTimer],
            ["Total Part-time Lecturer Needed", plan.partTimersNeeded],
          ]}
        />
      </div>
    </>
  );
}

function TheorySheet({ plan }) {
  const rows = (plan.theory || []).map((row, index) => ({ ...row, key: `${row.course}-${index}` }));
  const courseCounts = [3, 2, 1].map((count) => [
    `Courses with ${count} teacher${count > 1 ? "s" : ""}`,
    rows.filter((row) => Number(row.sections) === count).length,
  ]);
  return (
    <>
      <SheetTable
        columns={[
          { key: "department", label: "Department" },
          { key: "level_term", label: "Level-Term", render: (row) => levelTermShort(row.level_term) },
          { key: "batch", label: "Batch" },
          { key: "course", label: "Course" },
          { key: "credit", label: "Credit", render: (row) => hours(row.credit) },
          { key: "sections", label: "Sections" },
          { key: "teacherCount", label: "Teacher Count", render: (row) => row.sections },
          { key: "total", label: "Total Credit Hours", render: (row) => hours(row.credit * row.sections) },
        ]}
        rows={rows}
        footer={
          <tr>
            <th colSpan="4"></th>
            <th>Total Theory Teachers</th>
            <th>{hours(plan.theorySections)}</th>
            <th>{hours(plan.theorySections)}</th>
            <th>{hours(plan.theoryHours)}</th>
          </tr>
        }
      />
      <div className="load-plan-summary-box mt-3"><MetricTable rows={courseCounts} /></div>
    </>
  );
}

function SessionalSheet({ plan }) {
  const rows = (plan.sessional || []).map((row, index) => ({ ...row, key: `${row.course}-${index}` }));
  const sum = (fn) => rows.reduce((total, row) => total + fn(row), 0);
  return (
    <SheetTable
      columns={[
        { key: "department", label: "Department" },
        { key: "level_term", label: "Level-Term", render: (row) => levelTermShort(row.level_term) },
        { key: "batch", label: "Batch" },
        { key: "course", label: "Course" },
        { key: "title", label: "Title" },
        { key: "type", label: "Type" },
        { key: "credit", label: "Credit", render: (row) => hours(row.credit) },
        { key: "sections", label: "Lab Sections" },
        { key: "creditHours", label: "Total Credit Hours", render: (row) => hours(row.credit * row.sections) },
        { key: "teachers", label: "Teacher Count" },
        { key: "teacherHours", label: "Total Teacher Hours", render: (row) => hours(row.credit * row.sections * row.teachers) },
        { key: "roomSlots", label: "Lab Room Slot", render: (row) => hours((row.sections * row.credit) / 3) },
      ]}
      rows={rows}
      footer={
        <tr>
          <th colSpan="7"></th>
          <th>{hours(sum((row) => row.sections))}</th>
          <th>{hours(sum((row) => row.credit * row.sections))}</th>
          <th>Total Sessional Load</th>
          <th>{hours(plan.sessionalHours)}</th>
          <th>{hours(sum((row) => (row.sections * row.credit) / 3))}</th>
        </tr>
      }
    />
  );
}

/** Shows the same four views used by the downloadable Course Load workbook. */
export default function CourseLoadPlan() {
  const [plan, setPlan] = useState(null);
  const [activeSheet, setActiveSheet] = useState("total");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    getCourseLoadPlan()
      .then(setPlan)
      .catch(() => toast.error("Failed to work out the load plan"));
  }, []);

  const download = async () => {
    setDownloading(true);
    try {
      const { blob, filename } = await getCourseLoadWorkbook();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to create the workbook");
    } finally {
      setDownloading(false);
    }
  };

  if (!plan) {
    return (
      <div className="empty-state">
        <i className="mdi mdi-loading mdi-spin"></i>
        <div className="empty-state-title">Working out the load…</div>
      </div>
    );
  }

  const tiles = [
    { icon: "mdi-account-plus", label: "Part-time lecturers needed", value: plan.partTimersNeeded, strong: true },
    { icon: "mdi-scale-balance", label: "Load still to cover", value: hours(plan.remaining.total) },
    { icon: "mdi-flask-outline", label: "Sessional load remaining", value: hours(plan.remaining.sessional) },
    { icon: "mdi-book-open-variant", label: "Theory load remaining", value: hours(plan.remaining.theory) },
  ];

  return (
    <div className="p-3 load-plan">
      <div className="d-flex justify-content-between align-items-center mb-3" style={{ gap: "12px", flexWrap: "wrap" }}>
        <div className="field-hint">
          Course Load workbook for {plan.term}. Select a sheet below to inspect the same data in the browser.
        </div>
        <button className="card-control-button mdi mdi-microsoft-excel" disabled={downloading} onClick={download}>
          {downloading ? "Creating…" : "Download workbook"}
        </button>
      </div>

      <div className="stat-tile-grid">
        {tiles.map((tile) => (
          <div className="stat-tile" key={tile.label}>
            <div className={`stat-tile-icon mdi ${tile.icon}`}></div>
            <div>
              <div className="stat-tile-value" style={tile.strong ? { color: "rgb(154, 77, 226)" } : undefined}>{tile.value}</div>
              <div className="stat-tile-label">{tile.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="load-plan-sheet-tabs" role="tablist" aria-label="Course Load workbook sheets">
        {SHEETS.map((sheet) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeSheet === sheet.id}
            className={activeSheet === sheet.id ? "active" : ""}
            key={sheet.id}
            onClick={() => setActiveSheet(sheet.id)}
          >
            <i className={`mdi ${sheet.icon}`}></i>{sheet.label}
          </button>
        ))}
      </div>

      <div className="load-plan-sheet" role="tabpanel">
        {activeSheet === "input" && <InputSheet plan={plan} />}
        {activeSheet === "total" && <TotalLoadSheet plan={plan} />}
        {activeSheet === "theory" && <TheorySheet plan={plan} />}
        {activeSheet === "sessional" && <SessionalSheet plan={plan} />}
      </div>
    </div>
  );
}
