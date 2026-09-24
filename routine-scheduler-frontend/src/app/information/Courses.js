import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Form, Row, Col, FormControl, FormGroup } from "react-bootstrap";
import { toast } from "react-hot-toast";

import {
  addCourse,
  deleteCourse,
  editCourse,
  getCourses,
  getActiveCourseIds,
  getLevelTerms,
  getSections,
  getSessionalTypes,
  setCourseActive,
  updateSessionalType,
} from "../api/db-crud";
import {
  getDepartments,
  getAllLevelTermsName,
  getHostedDepartments,
} from "../api/academic-config";
import { getThesisSetup } from "../api/thesis";
import ConfirmationModal from "../shared/ConfirmationModal";

const THEORY = 0;
const SESSIONAL = 1;
// Thesis is not scheduled in sections. Which thesis (1 or 2) a level-term
// takes is set for the active level-terms (Database → Thesis); supervisors
// come from each teacher's Thesis 1/2 settings.
const THESIS = 2;

const TYPE_LABELS = { [THEORY]: "Theory", [SESSIONAL]: "Sessional", [THESIS]: "Thesis" };

// A course belongs to the level-term of the department it is offered to
const levelTermKey = (department, levelTerm) => `${department}|${levelTerm}`;

const typeLabel = (course, levelTerms) => {
  if (course.type !== THESIS) return TYPE_LABELS[course.type] || "Unknown";
  const lt = levelTerms.get(levelTermKey(course.to, course.level_term));
  return lt && lt.active && lt.thesis ? `Thesis ${lt.thesis}` : "Thesis";
};

const emptyCourse = {
  course_id: "",
  name: "",
  type: THEORY,
  class_per_week: 3,
  from: "",
  to: "",
  level_term: "",
  optional: 0,
  optional_section_count: 1,
  option_group: "",
  sessional_type: "",
};

const LAB_TYPE_LABELS = { SW: "Software Lab", HW: "Hardware Lab" };

const validateCourse = (course) => {
  const errors = {};
  if (!course.course_id || course.course_id.trim() === "") {
    errors.course_id = "Course ID is required";
  } else if (!/^[A-Za-z0-9-]+$/.test(course.course_id.trim())) {
    errors.course_id = "Use letters, digits and hyphens only";
  }
  if (!course.name || course.name.trim() === "") {
    errors.name = "Course name is required";
  }
  if (course.class_per_week === "" || course.class_per_week === null) {
    errors.class_per_week = "Credit is required";
  } else if (!(course.class_per_week > 0)) {
    errors.class_per_week = "Credit must be greater than 0";
  }
  if (!course.level_term) {
    errors.level_term = "Level-Term is required";
  }
  if (!course.from) {
    errors.from = "Offering department is required";
  }
  if (!course.to) {
    errors.to = "Receiving department is required";
  }
  if (course.from && course.to && course.from !== "CSE" && course.to !== "CSE") {
    errors.to = "Either the offering or the receiving department must be CSE";
  }
  // CSE assigns teachers only to the sessionals it runs itself; a lab it runs
  // for another department is simply Non-Departmental.
  if (course.type === SESSIONAL && course.from === "CSE" && course.to === "CSE" && !course.sessional_type) {
    errors.sessional_type = "Choose what kind of sessional this is";
  }
  return errors;
};

/** all_courses is keyed by (course_id, level_term) — both are needed to address a row. */
const courseKey = (course) => `${course.course_id}::${course.level_term}`;

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [activeCourseIds, setActiveCourseIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const [allHostedDepartments, setAllHostedDepartments] = useState([]);
  const [allDepartmentNames, setAllDepartmentNames] = useState([]);
  const [allLevelTermNames, setAllLevelTermNames] = useState([]);
  const [allSections, setAllSections] = useState([]);
  const [sessionalTypes, setSessionalTypes] = useState([]);

  // Toolbar state
  const [search, setSearch] = useState("");
  const [levelTermFilter, setLevelTermFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  // Courses running this session are shown first
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  // Courses of inactive level-terms stay in the catalogue, out of sight
  const [showAllLevelTerms, setShowAllLevelTerms] = useState(false);
  const [levelTerms, setLevelTerms] = useState(new Map());
  const [sort, setSort] = useState({ key: "course_id", direction: "asc" });

  const [selectedCourse, setSelectedCourse] = useState(null);
  const [addNewCourse, setAddNewCourse] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationDetails, setConfirmationDetails] = useState({
    title: "",
    body: "",
    confirmText: "Delete",
    cancelText: "Cancel",
    onConfirm: () => {},
    confirmIcon: "mdi-delete",
    red: 220,
    green: 53,
    blue: 69,
  });

  /* ----------------------------------------------------------------- data */

  const reloadCourseData = useCallback(async () => {
    try {
      const [coursesRes, activeCoursesRes] = await Promise.all([
        getCourses(),
        getActiveCourseIds(),
      ]);
      setCourses(Array.isArray(coursesRes) ? coursesRes : []);
      setActiveCourseIds(
        new Set((activeCoursesRes || []).map((course) => course.course_id))
      );
    } catch (error) {
      console.error("Error reloading course data:", error);
      toast.error("Failed to load courses");
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await reloadCourseData();
      try {
        const [hosted, depts, levelTermNames, sections, types, lts, thesis] = await Promise.all([
          getHostedDepartments(),
          getDepartments(),
          getAllLevelTermsName(),
          getSections(),
          getSessionalTypes(),
          getLevelTerms(),
          getThesisSetup().catch(() => ({ levelTerms: [] })),
        ]);
        const thesisOf = new Map(
          (thesis.levelTerms || []).map((lt) => [levelTermKey(lt.department, lt.level_term), lt.thesis])
        );
        // /level_terms answers { message, data: [...] }
        const levelTermRows = Array.isArray(lts) ? lts : lts?.data || [];
        setLevelTerms(
          new Map(
            levelTermRows.map((lt) => {
              const key = levelTermKey(lt.department, lt.level_term);
              return [key, { ...lt, thesis: thesisOf.get(key) || null }];
            })
          )
        );
        setAllHostedDepartments(hosted || []);
        setAllDepartmentNames(depts || []);
        setAllLevelTermNames(levelTermNames || []);
        setAllSections(sections || []);
        setSessionalTypes(types || []);
      } catch (error) {
        console.error("Error loading reference data:", error);
        toast.error("Failed to load departments and level-terms");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [reloadCourseData]);

  /* ------------------------------------------------------------- derived */

  // With no level-term active yet (a fresh start), every course shows
  const anyActiveLevelTerm = [...levelTerms.values()].some((lt) => lt.active);
  const scopeToActive = !showAllLevelTerms && anyActiveLevelTerm;
  const scopedCourses = useMemo(
    () =>
      scopeToActive
        ? courses.filter(
            (course) => levelTerms.get(levelTermKey(course.to, course.level_term))?.active
          )
        : courses,
    [courses, levelTerms, scopeToActive]
  );
  const levelTermOptions = useMemo(
    () =>
      scopeToActive
        ? allLevelTermNames.filter((name) => scopedCourses.some((c) => c.level_term === name))
        : allLevelTermNames,
    [allLevelTermNames, scopedCourses, scopeToActive]
  );

  const visibleCourses = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = scopedCourses.filter((course) => {
      if (showActiveOnly && !activeCourseIds.has(course.course_id)) {
        return false;
      }
      if (levelTermFilter && course.level_term !== levelTermFilter) {
        return false;
      }
      if (typeFilter !== "" && String(course.type) !== typeFilter) {
        return false;
      }
      if (fromFilter && course.from !== fromFilter) {
        return false;
      }
      if (term === "") return true;
      return (
        (course.course_id || "").toLowerCase().includes(term) ||
        (course.name || "").toLowerCase().includes(term)
      );
    });

    const { key, direction } = sort;
    const factor = direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const left = a[key];
      const right = b[key];
      if (typeof left === "number" && typeof right === "number") {
        return (left - right) * factor;
      }
      return String(left ?? "").localeCompare(String(right ?? "")) * factor;
    });
  }, [
    scopedCourses,
    activeCourseIds,
    showActiveOnly,
    levelTermFilter,
    typeFilter,
    fromFilter,
    search,
    sort,
  ]);

  const stats = useMemo(
    () => ({
      total: scopedCourses.length,
      theory: scopedCourses.filter((c) => c.type === THEORY).length,
      sessional: scopedCourses.filter((c) => c.type === SESSIONAL).length,
      active: scopedCourses.filter((c) => activeCourseIds.has(c.course_id)).length,
    }),
    [scopedCourses, activeCourseIds]
  );

  const filtersActive =
    search !== "" ||
    levelTermFilter !== "" ||
    typeFilter !== "" ||
    fromFilter !== "";

  const clearFilters = () => {
    setSearch("");
    setLevelTermFilter("");
    setTypeFilter("");
    setFromFilter("");
  };

  const toggleSort = (key) =>
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );

  const sortIcon = (key) => {
    if (sort.key !== key) return "mdi mdi-unfold-more-horizontal";
    return sort.direction === "asc" ? "mdi mdi-arrow-up" : "mdi mdi-arrow-down";
  };

  /**
   * Sections that can host the course currently being edited. Theory courses run
   * in the main sections (type 0, e.g. A), sessionals in the subsections
   * (type 1, e.g. A1) — except 0.75-credit sessionals, which the scheduler
   * places in the main sections.
   */
  const eligibleSections = useMemo(() => {
    if (!selectedCourse) return [];
    const sectionType =
      selectedCourse.type === SESSIONAL &&
      Number(selectedCourse.class_per_week) === 0.75
        ? THEORY
        : selectedCourse.type;
    return allSections
      .filter(
        (section) =>
          section.level_term === selectedCourse.level_term &&
          section.department === selectedCourse.to &&
          section.type === sectionType
      )
      .sort(
        (a, b) =>
          a.batch - b.batch || String(a.section).localeCompare(String(b.section))
      );
  }, [allSections, selectedCourse]);

  /* ------------------------------------------------------------- actions */

  const handleDelete = (course) => {
    setConfirmationDetails({
      title: "Delete Course",
      body: `Delete ${course.course_id} (${course.level_term})? This removes the course from the syllabus and from any schedule it is part of.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      confirmIcon: "mdi-delete",
      red: 220,
      green: 53,
      blue: 69,
      onConfirm: async () => {
        try {
          await deleteCourse(course.course_id, course.level_term);
          toast.success(`${course.course_id} deleted`);
          await reloadCourseData();
        } catch (error) {
          console.error("Error deleting course:", error);
          toast.error(`Failed to delete ${course.course_id}`);
        }
      },
    });
    setShowConfirmation(true);
  };

  const openAddModal = () => {
    setAddNewCourse(true);
    setFormErrors({});
    setSelectedCourse({
      ...emptyCourse,
      from: "CSE",
      to: "CSE",
      level_term: levelTermFilter || "",
    });
  };

  const openEditModal = (course) => {
    setAddNewCourse(false);
    setFormErrors({});
    setSelectedCourse({
      ...course,
      optional: course.optional ? 1 : 0,
      optional_section_count: course.optional_section_count || 1,
      option_group: course.option_group || "",
      sessional_type: course.sessional_type || "",
      course_id_old: course.course_id,
      level_term_old: course.level_term,
    });
  };

  const handleToggleActive = (course) => {
    const activating = !activeCourseIds.has(course.course_id);
    setConfirmationDetails({
      title: activating ? "Activate Course" : "Deactivate Course",
      body: activating
        ? `Run ${course.course_id} this session? It will take a slot in every section of ${course.to} ${course.level_term}, with room for ${course.optional_section_count} section-sized group(s).`
        : `Stop running ${course.course_id} this session? It stays in the catalogue and can be activated again later.`,
      confirmText: activating ? "Activate" : "Deactivate",
      cancelText: "Cancel",
      confirmIcon: activating ? "mdi-play-circle" : "mdi-pause-circle",
      red: activating ? 25 : 240,
      green: activating ? 135 : 163,
      blue: activating ? 84 : 36,
      onConfirm: async () => {
        try {
          await setCourseActive(course.course_id, {
            level_term: course.level_term,
            active: activating,
          });
          toast.success(
            `${course.course_id} ${activating ? "activated" : "deactivated"}`
          );
          await reloadCourseData();
        } catch (error) {
          console.error("Error changing course activation:", error);
          toast.error(
            error?.response?.data?.message ||
              `Failed to ${activating ? "activate" : "deactivate"} ${course.course_id}`
          );
        }
      },
    });
    setShowConfirmation(true);
  };

  // The kind of a departmental sessional, changed from the list
  const changeSessionalKind = async (course, code) => {
    try {
      await editCourse(course.course_id, {
        ...course,
        level_term_old: course.level_term,
        sessional_type: code || null,
      });
      toast.success(`${course.course_id} is now ${sessionalTypeName(code) || "without a kind"}`);
      await reloadCourseData();
    } catch (error) {
      toast.error(error?.response?.data?.error?.message || `Failed to update ${course.course_id}`);
    }
  };

  const handleSave = async () => {
    const errors = validateCourse(selectedCourse);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    const duplicate = courses.some(
      (course) =>
        course.course_id === selectedCourse.course_id.trim() &&
        course.level_term === selectedCourse.level_term &&
        courseKey(course) !==
          `${selectedCourse.course_id_old}::${selectedCourse.level_term_old}`
    );
    if (duplicate) {
      setFormErrors({
        course_id: `${selectedCourse.course_id} already exists for ${selectedCourse.level_term}`,
      });
      toast.error("A course with this ID already exists for that level-term");
      return;
    }

    const payload = {
      ...selectedCourse,
      course_id: selectedCourse.course_id.trim(),
      name: selectedCourse.name.trim(),
    };

    setSaving(true);
    try {
      const res = addNewCourse
        ? await addCourse(payload)
        : await editCourse(payload.course_id_old, payload);

      const succeeded =
        res.message &&
        (res.message.includes("Successfully Saved") ||
          res.message.includes("Successfully Updated"));

      if (succeeded) {
        toast.success(
          addNewCourse ? "Course added successfully" : "Course updated successfully"
        );
        setSelectedCourse(null);
        setAddNewCourse(false);
        await reloadCourseData();
      } else {
        toast.error(
          `Failed to ${addNewCourse ? "add" : "update"} course: ${res.message}`
        );
      }
    } catch (error) {
      console.error("Error saving course:", error);
      toast.error(
        error?.response?.data?.message ||
          "An error occurred while saving the course"
      );
    } finally {
      setSaving(false);
    }
  };

  const sessionalTypeName = (code) =>
    sessionalTypes.find((t) => t.code === code)?.name;

  const handleSessionalTypeChange = async (code, changes) => {
    const current = sessionalTypes.find((t) => t.code === code);
    const next = { ...current, ...changes };
    if (!Number.isInteger(next.teacher_count) || next.teacher_count < 1) {
      toast.error("Teacher count must be a whole number of at least 1");
      return;
    }
    try {
      const saved = await updateSessionalType(code, next);
      setSessionalTypes((prev) =>
        prev.map((t) => (t.code === code ? saved : t))
      );
      toast.success(`${saved.name} updated`);
    } catch (error) {
      console.error("Error updating sessional type:", error);
      toast.error("Failed to update sessional type");
    }
  };

  /* -------------------------------------------------------------- render */

  return (
    <div>
      <div className="page-header">
        <h3 className="page-title">
          <div className="page-title-icon-container mdi mdi-book-open-page-variant"></div>
          Course Information
        </h3>
        <nav aria-label="breadcrumb">
          <ol
            className="breadcrumb"
            style={{ marginBottom: 0, background: "transparent" }}
          >
            <li
              className="breadcrumb-item"
              style={{ color: "rgba(255,255,255,0.8)" }}
            >
              <a
                href="!#"
                onClick={(event) => event.preventDefault()}
                style={{
                  color: "rgba(255,255,255,0.8)",
                  textDecoration: "none",
                }}
              >
                Information
              </a>
            </li>
            <li
              className="breadcrumb-item active"
              aria-current="page"
              style={{ color: "rgba(255,255,255,0.9)", fontWeight: 500 }}
            >
              Courses
            </li>
          </ol>
        </nav>
      </div>

      <div className="stat-tile-grid">
        <div className="stat-tile">
          <div className="stat-tile-icon mdi mdi-book-multiple"></div>
          <div>
            <div className="stat-tile-value">{stats.total}</div>
            <div className="stat-tile-label">Total Courses</div>
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-icon blue mdi mdi-book-open-variant"></div>
          <div>
            <div className="stat-tile-value">{stats.theory}</div>
            <div className="stat-tile-label">Theory</div>
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-icon teal mdi mdi-flask-outline"></div>
          <div>
            <div className="stat-tile-value">{stats.sessional}</div>
            <div className="stat-tile-label">Sessional</div>
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-icon amber mdi mdi-check-decagram"></div>
          <div>
            <div className="stat-tile-value">{stats.active}</div>
            <div className="stat-tile-label">Active This Session</div>
          </div>
        </div>
      </div>

      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-view">
              <div className="card-control-container">
                <h4 className="card-name">
                  <div className="card-icon mdi mdi-book-open-page-variant"></div>
                  Course Management
                </h4>
                <div className="card-control-button-container">
                  <div className="segmented-toggle">
                    <button
                      className={!showActiveOnly && !showAllLevelTerms ? "active" : ""}
                      title="Courses of the active level-terms"
                      onClick={() => {
                        setShowActiveOnly(false);
                        setShowAllLevelTerms(false);
                      }}
                    >
                      Active Level-Terms
                    </button>
                    <button
                      className={showActiveOnly ? "active" : ""}
                      title="Courses running this session"
                      onClick={() => {
                        setShowActiveOnly(true);
                        setShowAllLevelTerms(false);
                      }}
                    >
                      Running Only
                    </button>
                    <button
                      className={!showActiveOnly && showAllLevelTerms ? "active" : ""}
                      title="The whole catalogue, every level-term"
                      onClick={() => {
                        setShowActiveOnly(false);
                        setShowAllLevelTerms(true);
                      }}
                    >
                      All Courses
                    </button>
                  </div>
                  <button
                    className="card-control-button mdi mdi-plus-circle"
                    onClick={openAddModal}
                  >
                    Add New Course
                  </button>
                </div>
              </div>

              <div className="card-toolbar">
                <div className="card-toolbar-field grow">
                  <label className="card-toolbar-label">Search</label>
                  <div className="card-search-box">
                    <i className="mdi mdi-magnify"></i>
                    <input
                      type="text"
                      placeholder="Search by course ID or name…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {search !== "" && (
                      <button
                        className="card-search-clear mdi mdi-close-circle"
                        title="Clear search"
                        onClick={() => setSearch("")}
                      ></button>
                    )}
                  </div>
                </div>
                <div className="card-toolbar-field">
                  <label className="card-toolbar-label">Level-Term</label>
                  <Form.Select
                    className="form-select"
                    value={levelTermFilter}
                    onChange={(e) => setLevelTermFilter(e.target.value)}
                  >
                    <option value="">All</option>
                    {levelTermOptions.map((levelTerm) => (
                      <option key={levelTerm} value={levelTerm}>
                        {levelTerm}
                      </option>
                    ))}
                  </Form.Select>
                </div>
                <div className="card-toolbar-field">
                  <label className="card-toolbar-label">Type</label>
                  <Form.Select
                    className="form-select"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="0">Theory</option>
                    <option value="1">Sessional</option>
                    <option value="2">Thesis</option>
                  </Form.Select>
                </div>
                <div className="card-toolbar-field">
                  <label className="card-toolbar-label">Offered By</label>
                  <Form.Select
                    className="form-select"
                    value={fromFilter}
                    onChange={(e) => setFromFilter(e.target.value)}
                  >
                    <option value="">All</option>
                    {allHostedDepartments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </Form.Select>
                </div>
                {filtersActive && (
                  <div className="card-toolbar-field">
                    <label className="card-toolbar-label">&nbsp;</label>
                    <button
                      className="card-control-button mdi mdi-filter-remove-outline"
                      onClick={clearFilters}
                    >
                      Clear
                    </button>
                  </div>
                )}
                <div className="card-toolbar-result">
                  Showing {visibleCourses.length} of {courses.length}
                </div>
              </div>

              <div className="card-table-container table-responsive mt-3">
                <table className="card-table table">
                  <thead className="card-table-header">
                    <tr>
                      <th
                        className={`sticky-col sortable${
                          sort.key === "course_id" ? " sorted" : ""
                        }`}
                        onClick={() => toggleSort("course_id")}
                      >
                        <i className="mdi mdi-notebook"></i>
                        Course ID
                        <i className={`sort-indicator ${sortIcon("course_id")}`}></i>
                      </th>
                      <th
                        className={`sortable${
                          sort.key === "name" ? " sorted" : ""
                        }`}
                        onClick={() => toggleSort("name")}
                      >
                        <i className="mdi mdi-book-open-page-variant"></i>
                        Course Name
                        <i className={`sort-indicator ${sortIcon("name")}`}></i>
                      </th>
                      <th
                        className={`sortable${
                          sort.key === "type" ? " sorted" : ""
                        }`}
                        onClick={() => toggleSort("type")}
                      >
                        <i className="mdi mdi-format-list-bulleted-type"></i>
                        Type
                        <i className={`sort-indicator ${sortIcon("type")}`}></i>
                      </th>
                      <th
                        className={`sortable${
                          sort.key === "level_term" ? " sorted" : ""
                        }`}
                        onClick={() => toggleSort("level_term")}
                      >
                        <i className="mdi mdi-school"></i>
                        Level/Term
                        <i
                          className={`sort-indicator ${sortIcon("level_term")}`}
                        ></i>
                      </th>
                      <th
                        className={`sortable${
                          sort.key === "from" ? " sorted" : ""
                        }`}
                        onClick={() => toggleSort("from")}
                      >
                        <i className="mdi mdi-office-building"></i>
                        Offered By
                        <i className={`sort-indicator ${sortIcon("from")}`}></i>
                      </th>
                      <th
                        className={`sortable${
                          sort.key === "to" ? " sorted" : ""
                        }`}
                        onClick={() => toggleSort("to")}
                      >
                        <i className="mdi mdi-office-building-outline"></i>
                        Offered To
                        <i className={`sort-indicator ${sortIcon("to")}`}></i>
                      </th>
                      <th
                        className={`sortable${
                          sort.key === "class_per_week" ? " sorted" : ""
                        }`}
                        onClick={() => toggleSort("class_per_week")}
                      >
                        <i className="mdi mdi-clock"></i>
                        Credit
                        <i
                          className={`sort-indicator ${sortIcon(
                            "class_per_week"
                          )}`}
                        ></i>
                      </th>
                      <th>
                        <i className="mdi mdi-cog"></i>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="card-table-body">
                    {loading ? (
                      <tr>
                        <td colSpan={8}>
                          <div className="empty-state">
                            <i className="mdi mdi-loading mdi-spin"></i>
                            <div className="empty-state-title">
                              Loading courses…
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : visibleCourses.length === 0 ? (
                      <tr>
                        <td colSpan={8}>
                          <div className="empty-state">
                            <i className="mdi mdi-book-search-outline"></i>
                            <div className="empty-state-title">
                              {courses.length === 0
                                ? "No courses yet"
                                : "No courses match your filters"}
                            </div>
                            <div className="empty-state-hint">
                              {courses.length === 0
                                ? "Add your first course to build the syllabus."
                                : "Try a different search term or clear the filters."}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      visibleCourses.map((course) => (
                        <tr key={courseKey(course)}>
                          <td
                            className="sticky-col"
                            style={{ textAlign: "center", fontWeight: 600 }}
                          >
                            {course.course_id}
                          </td>
                          <td>
                            {course.name}
                            {course.optional ? (
                              <span
                                className="pill optional ms-2"
                                title={`Room for ${course.optional_section_count} section-sized group(s); students enrol from every section`}
                              >
                                <i className="mdi mdi-star-outline"></i>
                                Optional · {course.optional_section_count}{" "}
                                section(s)
                                {course.option_group ? ` · Option ${course.option_group}` : ""}
                              </span>
                            ) : null}
                            {activeCourseIds.has(course.course_id) && (
                              <span className="pill purple ms-2">
                                <i className="mdi mdi-check-circle-outline"></i>
                                Active
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span
                              className={`pill ${
                                course.type === THEORY
                                  ? "theory"
                                  : course.type === THESIS
                                  ? "purple"
                                  : "sessional"
                              }`}
                            >
                              <i
                                className={`mdi ${
                                  course.type === THEORY
                                    ? "mdi-book-open-variant"
                                    : course.type === THESIS
                                    ? "mdi-school-outline"
                                    : "mdi-flask-outline"
                                }`}
                              ></i>
                              {typeLabel(course, levelTerms)}
                            </span>
                            {course.type === SESSIONAL && course.from === "CSE" && course.to !== "CSE" && (
                              <div className="mt-1" style={{ fontSize: "12px", opacity: 0.75 }}>
                                Non-Departmental
                              </div>
                            )}
                            {course.type === SESSIONAL && course.from === "CSE" && course.to === "CSE" && (
                              <Form.Select
                                size="sm"
                                className="form-select mt-1"
                                style={{ fontSize: "12px", minWidth: "170px" }}
                                value={course.sessional_type || ""}
                                title="Kind of sessional: sets how many teachers each section gets"
                                onChange={(e) => changeSessionalKind(course, e.target.value)}
                              >
                                <option value="">Kind not set</option>
                                {sessionalTypes
                                  .filter((t) => t.code !== "NON_DEPT")
                                  .map((t) => (
                                    <option key={t.code} value={t.code}>
                                      {t.name}
                                    </option>
                                  ))}
                              </Form.Select>
                            )}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {course.level_term}
                          </td>
                          <td style={{ textAlign: "center" }}>{course.from}</td>
                          <td style={{ textAlign: "center" }}>{course.to}</td>
                          <td style={{ textAlign: "center" }}>
                            {course.class_per_week}
                          </td>
                          <td>
                            <div className="d-flex">
                              {course.optional ? (
                                <button
                                  className={`edit mdi ${
                                    activeCourseIds.has(course.course_id)
                                      ? "mdi-pause-circle-outline"
                                      : "mdi-play-circle-outline"
                                  }`}
                                  title={
                                    activeCourseIds.has(course.course_id)
                                      ? "Stop running this session"
                                      : "Run this session"
                                  }
                                  onClick={() => handleToggleActive(course)}
                                ></button>
                              ) : null}
                              <button
                                className="edit mdi mdi-pencil"
                                title="Edit course"
                                onClick={() => openEditModal(course)}
                              ></button>
                              <button
                                className="delete mdi mdi-delete-outline"
                                title="Delete course"
                                onClick={() => handleDelete(course)}
                              ></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-view">
              <div className="card-control-container">
                <h4 className="card-name">
                  <div className="card-icon mdi mdi-flask-outline"></div>
                  Sessional Kinds
                </h4>
              </div>
              <div className="card-table-container table-responsive">
                <table className="card-table table">
                  <thead className="card-table-header">
                    <tr>
                      <th>
                        <i className="mdi mdi-format-list-bulleted-type"></i>
                        Kind
                      </th>
                      <th>
                        <i className="mdi mdi-account-multiple"></i>
                        Teachers per Section
                      </th>
                      <th>
                        <i className="mdi mdi-desktop-classic"></i>
                        Lab Type
                      </th>
                    </tr>
                  </thead>
                  <tbody className="card-table-body">
                    {sessionalTypes.map((t) => (
                      <tr key={t.code}>
                        <td>{t.name}</td>
                        <td style={{ textAlign: "center" }}>
                          <input
                            key={`${t.code}-${t.teacher_count}`}
                            type="number"
                            min="1"
                            step="1"
                            className="form-input"
                            style={{ maxWidth: "100px" }}
                            defaultValue={t.teacher_count}
                            title="Press Enter or leave the field to save"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.target.blur();
                            }}
                            onBlur={(e) => {
                              const count = Number(e.target.value);
                              if (count !== t.teacher_count) {
                                handleSessionalTypeChange(t.code, {
                                  teacher_count: count,
                                });
                              }
                            }}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <Form.Select
                            className="form-select"
                            value={t.lab_type || ""}
                            onChange={(e) =>
                              handleSessionalTypeChange(t.code, {
                                lab_type: e.target.value || null,
                              })
                            }
                          >
                            <option value="">Any lab</option>
                            <option value="SW">{LAB_TYPE_LABELS.SW}</option>
                            <option value="HW">{LAB_TYPE_LABELS.HW}</option>
                          </Form.Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedCourse !== null && (
        <Modal
          show
          onHide={() => setSelectedCourse(null)}
          size="lg"
          centered
          contentClassName="modal-content"
          backdrop="static"
        >
          <Modal.Header className="modal-header">
            <Modal.Title className="modal-header-content">
              <div className="modal-header-icon">
                <i className="mdi mdi-book-open-page-variant"></i>
              </div>
              <h4 className="modal-title">
                {addNewCourse ? "Add" : "Edit"} Course
              </h4>
            </Modal.Title>
            <button
              className="modal-header-close-button mdi mdi-close"
              onClick={() => setSelectedCourse(null)}
            ></button>
          </Modal.Header>
          <Modal.Body className="modal-body">
            <div className="modal-body-content-container">
              <Form className="px-2 py-1">
                <Row>
                  <Col md={4} className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">Course ID</Form.Label>
                      <FormControl
                        type="text"
                        className={`form-control${
                          formErrors.course_id ? " error" : ""
                        }`}
                        placeholder="e.g. CSE101"
                        value={selectedCourse.course_id}
                        autoFocus={addNewCourse}
                        onChange={(e) =>
                          setSelectedCourse({
                            ...selectedCourse,
                            course_id: e.target.value.toUpperCase(),
                          })
                        }
                      />
                      {formErrors.course_id && (
                        <div className="field-error">
                          {formErrors.course_id}
                        </div>
                      )}
                    </FormGroup>
                  </Col>
                  <Col md={8} className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">
                        Course Name
                      </Form.Label>
                      <FormControl
                        type="text"
                        className={`form-control${
                          formErrors.name ? " error" : ""
                        }`}
                        placeholder="e.g. Structured Programming Language"
                        value={selectedCourse.name}
                        onChange={(e) =>
                          setSelectedCourse({
                            ...selectedCourse,
                            name: e.target.value,
                          })
                        }
                      />
                      {formErrors.name && (
                        <div className="field-error">{formErrors.name}</div>
                      )}
                    </FormGroup>
                  </Col>
                </Row>

                <Row>
                  <Col md={4} className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">Type</Form.Label>
                      <Form.Select
                        className="form-select"
                        value={selectedCourse.type}
                        onChange={(e) =>
                          setSelectedCourse({
                            ...selectedCourse,
                            type: Number(e.target.value),
                          })
                        }
                      >
                        <option value="0">Theory</option>
                        <option value="1">Sessional</option>
                        <option value="2">Thesis</option>
                      </Form.Select>
                    </FormGroup>
                  </Col>
                  <Col md={4} className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">Credit</Form.Label>
                      <FormControl
                        type="number"
                        step="0.25"
                        min="0"
                        className={`form-control${
                          formErrors.class_per_week ? " error" : ""
                        }`}
                        placeholder="e.g. 1.5"
                        value={selectedCourse.class_per_week}
                        onChange={(e) =>
                          setSelectedCourse({
                            ...selectedCourse,
                            class_per_week: Number.parseFloat(
                              e.target.value || "0"
                            ),
                          })
                        }
                      />
                      {formErrors.class_per_week && (
                        <div className="field-error">
                          {formErrors.class_per_week}
                        </div>
                      )}
                    </FormGroup>
                  </Col>
                  <Col md={4} className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">Level-Term</Form.Label>
                      <Form.Select
                        className="form-select"
                        value={selectedCourse.level_term}
                        onChange={(e) =>
                          setSelectedCourse({
                            ...selectedCourse,
                            level_term: e.target.value,
                          })
                        }
                      >
                        <option value="">Select Level-Term</option>
                        {allLevelTermNames.map((levelTerm) => (
                          <option key={levelTerm} value={levelTerm}>
                            {levelTerm}
                          </option>
                        ))}
                      </Form.Select>
                      {formErrors.level_term && (
                        <div className="field-error">
                          {formErrors.level_term}
                        </div>
                      )}
                    </FormGroup>
                  </Col>
                </Row>

                {selectedCourse.type === SESSIONAL && selectedCourse.to && selectedCourse.to !== "CSE" && (
                  <Row>
                    <Col className="px-2 py-1">
                      <div className="field-hint">
                        A lab for another department is Non-Departmental: two teachers, no lab type.
                      </div>
                    </Col>
                  </Row>
                )}

                {selectedCourse.type === SESSIONAL && (!selectedCourse.to || selectedCourse.to === "CSE") && (
                  <Row>
                    <Col md={8} className="px-2 py-1">
                      <FormGroup>
                        <Form.Label className="form-label">
                          Sessional Kind
                        </Form.Label>
                        <Form.Select
                          className={`form-select${
                            formErrors.sessional_type ? " error" : ""
                          }`}
                          value={selectedCourse.sessional_type}
                          onChange={(e) =>
                            setSelectedCourse({
                              ...selectedCourse,
                              sessional_type: e.target.value,
                            })
                          }
                        >
                          <option value="">Select kind of sessional</option>
                          {sessionalTypes.map((t) => (
                            <option key={t.code} value={t.code}>
                              {t.name} ({t.teacher_count} teachers)
                            </option>
                          ))}
                        </Form.Select>
                        {formErrors.sessional_type && (
                          <div className="field-error">
                            {formErrors.sessional_type}
                          </div>
                        )}
                      </FormGroup>
                    </Col>
                  </Row>
                )}

                <Row>
                  <Col md={4} className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">
                        Offering From
                      </Form.Label>
                      <Form.Select
                        className="form-select"
                        value={selectedCourse.from}
                        onChange={(e) =>
                          setSelectedCourse({
                            ...selectedCourse,
                            from: e.target.value,
                          })
                        }
                      >
                        <option value="">Select Department</option>
                        {allHostedDepartments.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </Form.Select>
                      {formErrors.from && (
                        <div className="field-error">{formErrors.from}</div>
                      )}
                    </FormGroup>
                  </Col>
                  <Col md={4} className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">
                        Offering To
                      </Form.Label>
                      <Form.Select
                        className="form-select"
                        value={selectedCourse.to}
                        onChange={(e) =>
                          setSelectedCourse({
                            ...selectedCourse,
                            to: e.target.value,
                          })
                        }
                      >
                        <option value="">Select Department</option>
                        {allDepartmentNames.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </Form.Select>
                      {formErrors.to && (
                        <div className="field-error">{formErrors.to}</div>
                      )}
                    </FormGroup>
                  </Col>
                  <Col md={4} className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">
                        Course Nature
                      </Form.Label>
                      <div
                        className="custom-checkbox-wrapper d-flex align-items-center"
                        onClick={() =>
                          setSelectedCourse({
                            ...selectedCourse,
                            optional: selectedCourse.optional ? 0 : 1,
                          })
                        }
                      >
                        <div
                          className={`custom-checkbox ${
                            selectedCourse.optional ? "checked" : "unchecked"
                          }`}
                        >
                          {selectedCourse.optional ? (
                            <i
                              className="mdi mdi-check"
                              style={{ color: "white", fontSize: "14px" }}
                            ></i>
                          ) : null}
                        </div>
                        <span className="custom-checkbox-label">
                          Optional course
                        </span>
                      </div>
                      <div className="field-hint">
                        {selectedCourse.optional
                          ? "Open to students from every section. Stays out of the session until you activate it."
                          : "Taken by every student, and runs automatically."}
                      </div>
                    </FormGroup>
                  </Col>
                </Row>

                {selectedCourse.optional === 1 && (
                  <Row>
                    <Col className="px-2 py-1">
                      <div className="field-hint">
                        Whether it is offered this term, and its option, are set on the{" "}
                        <a href="/optional-courses">Optional Courses</a> page.
                      </div>
                    </Col>
                  </Row>
                )}

                <Row>
                  <Col className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">
                        Runs in Sections
                      </Form.Label>
                      {selectedCourse.type === THESIS ? (
                        <div className="dotted-border-div">
                          Thesis is not scheduled in sections. Supervisors come
                          from each teacher's Thesis 1 / Thesis 2 setting.
                        </div>
                      ) : !selectedCourse.level_term || !selectedCourse.to ? (
                        <div className="dotted-border-div">
                          Pick a level-term and a receiving department to see
                          the sections this course runs in.
                        </div>
                      ) : eligibleSections.length === 0 ? (
                        <div className="dotted-border-div">
                          No{" "}
                          {selectedCourse.type === THEORY
                            ? "sections"
                            : "subsections"}{" "}
                          exist for {selectedCourse.to}{" "}
                          {selectedCourse.level_term}. Create them under
                          Database → Initialize first.
                        </div>
                      ) : (
                        <>
                          <div className="chip-row">
                            {eligibleSections.map((section) => (
                              <span
                                key={`${section.batch}-${section.section}`}
                                className="pill purple"
                              >
                                <i className="mdi mdi-check-circle"></i>
                                Batch {section.batch} · Section{" "}
                                {section.section}
                              </span>
                            ))}
                          </div>
                          <div className="field-hint">
                            {selectedCourse.optional
                              ? `Takes a slot in all ${eligibleSections.length} section(s) so anyone can enrol. Kept in step with the sections automatically.`
                              : `Offered to all ${eligibleSections.length} section(s) of ${selectedCourse.to} ${selectedCourse.level_term}. Kept in step with the sections automatically.`}
                          </div>
                        </>
                      )}
                    </FormGroup>
                  </Col>
                </Row>
              </Form>
            </div>
            <div className="modal-divider"></div>
          </Modal.Body>
          <Modal.Footer className="modal-footer">
            <button
              className="card-control-button mdi mdi-close"
              onClick={() => setSelectedCourse(null)}
            >
              Close
            </button>
            <button
              className="card-control-button mdi mdi-content-save"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </Modal.Footer>
        </Modal>
      )}

      <ConfirmationModal
        show={showConfirmation}
        onHide={() => setShowConfirmation(false)}
        title={confirmationDetails.title}
        body={confirmationDetails.body}
        confirmText={confirmationDetails.confirmText}
        cancelText={confirmationDetails.cancelText}
        onConfirm={() => {
          confirmationDetails.onConfirm();
          setShowConfirmation(false);
        }}
        onCancel={() => setShowConfirmation(false)}
        confirmIcon={confirmationDetails.confirmIcon}
        red={confirmationDetails.red}
        green={confirmationDetails.green}
        blue={confirmationDetails.blue}
      />
    </div>
  );
}
