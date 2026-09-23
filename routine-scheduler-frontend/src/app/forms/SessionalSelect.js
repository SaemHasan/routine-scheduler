import { useEffect } from "react";
import { useRef } from "react";
import { useState } from "react";
import { Button } from "react-bootstrap";
import { toast } from "react-hot-toast";
import { useParams } from "react-router-dom";
import { getSessionalPreferencesForm, submitSessionalPreferencesForm } from "../api/form";

export default function SessionalSelect() {
  const { initial } = useParams();

  const [teacher, setTeacher] = useState({
    initial: "...",
    name: "Loading...",
  });
  const [offeredCourse, setOfferedCourse] = useState([]);

  const [selectedCourse, setSelectedCourse] = useState([]);

  const offeredCourseRef = useRef();
  const selectedCourseRef = useRef();

  useEffect(() => {
    getSessionalPreferencesForm(initial).then((form) => {
      setTeacher(form.teacher);
      setOfferedCourse(form.courses);
      setSelectedCourse([])
    });
  }, [initial]);

  return (
    <div>
      <div className="d-flex align-items-center auth px-0">
        <div className="row w-100 mx-0">
          <div className="col-lg-8 mx-auto">
            <div className="auth-form-light text-left py-5 px-4 px-sm-5">
              <div className="brand-logo">
                <img
                  src={require("../../assets/images/logo.svg").default}
                  alt="logo"
                />
              </div>
              <h4>Sessional Course Preference</h4>
              <h6 className="font-weight-light">
                {teacher.name} ({teacher.initial})
              </h6>
              <form>
                <div className="row">
                  <div className="col-5" style={{ padding: 10 }}>
                    <select
                      class="form-select text-dark"
                      multiple
                      aria-label="multiple select example"
                      style={{ height: 400, width: "100%" }}
                      ref={offeredCourseRef}
                    >
                      {offeredCourse.map((course) => (
                        <option value={course.course_id}>
                          {course.course_id} - {course.name}
                        </option>
                      ))}
                    </select>

                    <h5 className="text-end m-2">Offered Courses</h5>
                  </div>
                  <div
                    className="col-2 d-flex flex-column justify-content-between"
                    style={{ padding: 10 }}
                  >
                    <div className="d-grid gap-2">
                      <Button
                        style={{
                          borderRadius: "6px",
                          padding: "7px 14px",
                          fontWeight: "500",
                          background: "rgba(154, 77, 226, 0.15)",
                          border: "1px solid rgba(154, 77, 226, 0.5)",
                          color: "rgb(154, 77, 226)",
                          transition: "all 0.3s ease",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "0.9rem"
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = "rgb(154, 77, 226)";
                          e.target.style.color = "white";
                          e.target.style.borderColor = "rgb(154, 77, 226)";
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = "rgba(154, 77, 226, 0.15)";
                          e.target.style.color = "rgb(154, 77, 226)";
                          e.target.style.borderColor = "rgba(154, 77, 226, 0.5)";
                        }}
                        className="mb-2 btn-block"
                        onClick={(e) => {
                          const selectedOptions = Array.from(
                            offeredCourseRef.current.selectedOptions
                          )
                            .map((option) => option.value)
                            .map((course_id) =>
                              offeredCourse.find(
                                (course) => course.course_id === course_id
                              )
                            );
                          setOfferedCourse(
                            offeredCourse.filter(
                              (course) => !selectedOptions.includes(course)
                            )
                          );
                          setSelectedCourse([
                            ...selectedCourse,
                            ...selectedOptions,
                          ]);
                          offeredCourseRef.current.selectedIndex = -1;
                        }}
                      >
                        Move Right
                      </Button>
                      <Button
                        style={{
                          borderRadius: "6px",
                          padding: "7px 14px",
                          fontWeight: "500",
                          background: "rgba(220, 53, 69, 0.15)",
                          border: "1px solid rgba(220, 53, 69, 0.5)",
                          color: "#dc3545",
                          transition: "all 0.3s ease",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "0.9rem"
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = "#dc3545";
                          e.target.style.color = "white";
                          e.target.style.borderColor = "#dc3545";
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = "rgba(220, 53, 69, 0.15)";
                          e.target.style.color = "#dc3545";
                          e.target.style.borderColor = "rgba(220, 53, 69, 0.5)";
                        }}
                        className="btn-block"
                        onClick={(e) => {
                          const selectedOptions = Array.from(
                            selectedCourseRef.current.selectedOptions
                          )
                            .map((option) => option.value)
                            .map((course_id) =>
                              selectedCourse.find(
                                (course) => course.course_id === course_id
                              )
                            );
                          setSelectedCourse(
                            selectedCourse.filter(
                              (course) => !selectedOptions.includes(course)
                            )
                          );
                          setOfferedCourse([
                            ...offeredCourse,
                            ...selectedOptions,
                          ]);
                          selectedCourseRef.current.selectedIndex = -1;
                        }}
                      >
                        Move Left
                      </Button>
                    </div>
                    <div className="d-grid gap-2  mb-5">
                      <Button
                        style={{
                          borderRadius: "6px",
                          padding: "7px 14px",
                          fontWeight: "500",
                          background: "rgba(154, 77, 226, 0.15)",
                          border: "1px solid rgba(154, 77, 226, 0.5)",
                          color: "rgb(154, 77, 226)",
                          transition: "all 0.3s ease",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "0.9rem"
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = "rgb(154, 77, 226)";
                          e.target.style.color = "white";
                          e.target.style.borderColor = "rgb(154, 77, 226)";
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = "rgba(154, 77, 226, 0.15)";
                          e.target.style.color = "rgb(154, 77, 226)";
                          e.target.style.borderColor = "rgba(154, 77, 226, 0.5)";
                        }}
                        className="mb-2 btn-block"
                        onClick={(e) => {
                          const selectedOptions = Array.from(
                            selectedCourseRef.current.selectedOptions
                          )
                            .map((option) => option.value)
                            .map((course_id) =>
                              selectedCourse.find(
                                (course) => course.course_id === course_id
                              )
                            );
                          setSelectedCourse(
                            selectedCourse.filter(
                              (course) => !selectedOptions.includes(course)
                            )
                          );
                          setSelectedCourse([
                            ...selectedOptions,
                            ...selectedCourse.filter(
                              (course) => !selectedOptions.includes(course)
                            ),
                          ]);
                          selectedCourseRef.current.selectedIndex = -1;
                        }}
                      >
                        Move Top
                      </Button>
                      <Button
                        style={{
                          borderRadius: "6px",
                          padding: "7px 14px",
                          fontWeight: "500",
                          background: "rgba(154, 77, 226, 0.15)",
                          border: "1px solid rgba(154, 77, 226, 0.5)",
                          color: "rgb(154, 77, 226)",
                          transition: "all 0.3s ease",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "0.9rem"
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = "rgb(154, 77, 226)";
                          e.target.style.color = "white";
                          e.target.style.borderColor = "rgb(154, 77, 226)";
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = "rgba(154, 77, 226, 0.15)";
                          e.target.style.color = "rgb(154, 77, 226)";
                          e.target.style.borderColor = "rgba(154, 77, 226, 0.5)";
                        }}
                        className="mb-2 btn-block"
                        onClick={(e) => {
                          const selectedOptions = Array.from(
                            selectedCourseRef.current.selectedOptions
                          ).map((option) => option.value);
                          const reorderedCourses = [...selectedCourse];
                          for (let i = 0; i < selectedOptions.length; i++) {
                            const index = reorderedCourses.findIndex(
                              (course) =>
                                course.course_id === selectedOptions[i]
                            );
                            if (index === 0) continue;
                            const temp = reorderedCourses[index];
                            reorderedCourses[index] =
                              reorderedCourses[index - 1];
                            reorderedCourses[index - 1] = temp;
                          }
                          setSelectedCourse(reorderedCourses);
                          selectedCourseRef.current.selectedIndex = Math.max(
                            0,
                            selectedCourseRef.current.selectedIndex - 1
                          );
                        }}
                      >
                        Move Up
                      </Button>
                      <Button
                        style={{
                          borderRadius: "6px",
                          padding: "7px 14px",
                          fontWeight: "500",
                          background: "rgba(154, 77, 226, 0.15)",
                          border: "1px solid rgba(154, 77, 226, 0.5)",
                          color: "rgb(154, 77, 226)",
                          transition: "all 0.3s ease",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "0.9rem"
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = "rgb(154, 77, 226)";
                          e.target.style.color = "white";
                          e.target.style.borderColor = "rgb(154, 77, 226)";
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = "rgba(154, 77, 226, 0.15)";
                          e.target.style.color = "rgb(154, 77, 226)";
                          e.target.style.borderColor = "rgba(154, 77, 226, 0.5)";
                        }}
                        className="mb-2 btn-block"
                        onClick={(e) => {
                          const selectedOptions = Array.from(
                            selectedCourseRef.current.selectedOptions
                          ).map((option) => option.value);
                          const reorderedCourses = [...selectedCourse];
                          for (
                            let i = selectedOptions.length - 1;
                            i >= 0;
                            i--
                          ) {
                            const index = reorderedCourses.findIndex(
                              (course) =>
                                course.course_id === selectedOptions[i]
                            );
                            if (index === reorderedCourses.length - 1) continue;
                            const temp = reorderedCourses[index];
                            reorderedCourses[index] =
                              reorderedCourses[index + 1];
                            reorderedCourses[index + 1] = temp;
                          }
                          setSelectedCourse(reorderedCourses);
                          selectedCourseRef.current.selectedIndex = Math.min(
                            selectedCourseRef.current.options.length - 1,
                            selectedCourseRef.current.selectedIndex + 1
                          );
                        }}
                      >
                        Move Down
                      </Button>
                      <Button
                        style={{
                          borderRadius: "6px",
                          padding: "7px 14px",
                          fontWeight: "500",
                          background: "rgba(154, 77, 226, 0.15)",
                          border: "1px solid rgba(154, 77, 226, 0.5)",
                          color: "rgb(154, 77, 226)",
                          transition: "all 0.3s ease",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "0.9rem"
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = "rgb(154, 77, 226)";
                          e.target.style.color = "white";
                          e.target.style.borderColor = "rgb(154, 77, 226)";
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = "rgba(154, 77, 226, 0.15)";
                          e.target.style.color = "rgb(154, 77, 226)";
                          e.target.style.borderColor = "rgba(154, 77, 226, 0.5)";
                        }}
                        className="mb-2 btn-block"
                        onClick={(e) => {
                          const selectedOptions = Array.from(
                            selectedCourseRef.current.selectedOptions
                          ).map((option) => option.value);
                          const reorderedCourses = [...selectedCourse];
                          for (let i = 0; i < selectedOptions.length; i++) {
                            const index = reorderedCourses.findIndex(
                              (course) =>
                                course.course_id === selectedOptions[i]
                            );
                            if (index === reorderedCourses.length - 1) continue;
                            const temp = reorderedCourses[index];
                            reorderedCourses[index] =
                              reorderedCourses[reorderedCourses.length - 1];
                            reorderedCourses[reorderedCourses.length - 1] =
                              temp;
                          }
                          setSelectedCourse(reorderedCourses);
                          selectedCourseRef.current.selectedIndex = Math.min(
                            selectedCourseRef.current.options.length - 1,
                            selectedCourseRef.current.selectedIndex + 1
                          );
                        }}
                      >
                        Move Bottom
                      </Button>
                    </div>
                  </div>
                  <div className="col-5" style={{ padding: 10 }}>
                    <select
                      class="form-select text-dark"
                      multiple
                      aria-label="multiple select example"
                      style={{ height: 400, width: "100%" }}
                      ref={selectedCourseRef}
                    >
                      {selectedCourse.map((course) => (
                        <option value={course.course_id}>
                          {course.course_id} - {course.name}
                        </option>
                      ))}
                    </select>
                    <h5 className="text-start m-2">Your Preference</h5>
                  </div>
                </div>
                <div className="mt-3 pb-5">
                  <Button
                    className="btn btn-primary btn-lg font-weight-medium auth-form-btn float-right"
                    onClick={(e) => {
                      e.preventDefault();
                      if (offeredCourse.length !== 0) {
                        setSelectedCourse([
                          ...selectedCourse,
                          ...offeredCourse,
                        ]);
                        setOfferedCourse([]);
                      } else {
                        const preferences = selectedCourse.map(
                          (course) => course.course_id
                        );
                        submitSessionalPreferencesForm(initial, preferences)
                        .then((res) => {
                          toast.success("Preferences saved successfully");
                        }).catch(console.log)
                      }
                    }}
                  >
                    {offeredCourse.length !== 0 ? "Confirm" : "SUBMIT"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
