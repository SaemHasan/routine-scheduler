import { Suspense, lazy } from "react";
import { Switch, Route, Redirect } from "react-router-dom";

import Spinner from "../app/shared/Spinner";
import { useContext } from "react";
import { UserContext } from "./App";

const Login = lazy(() => import("./user-pages/Login"));
const ForgetPassword = lazy(() => import("./user-pages/ForgetPassword"));
const ChangePassword = lazy(() => import("./user-pages/ChangePassword"));
const Account = lazy(() => import("./user-pages/Account"));

const Dashboard = lazy(() => import("./dashboard/Dashboard"));

const Initialize = lazy(() => import("./database/Initialize"));
const Backup = lazy(() => import("./database/Backup"));
const Restore = lazy(() => import("./database/Restore"));
const Clear = lazy(() => import("./database/Clear"));

const Teachers = lazy(() => import("./information/Teachers"));
const Rooms = lazy(() => import("./information/Rooms"));
const Courses = lazy(() => import("./information/Courses"));
const AcademicConfig = lazy(() => import("./information/AcademicConfig"));

const TheoryPreference = lazy(() => import("./theory-pref/TheoryPreference"));
const TheorySelect = lazy(() => import("./forms/TheorySelect"));
const SessionalSelect = lazy(() => import("./forms/SessionalSelect"));
const NonDepartmentalLabRoomAssign = lazy(() => import("./lab-room-assign/NonDepartmental"));
const TheoryRoomAssign = lazy(() => import("./theory-room-assign/TheoryRoomAssign"));
const SessionalSchedule = lazy(() => import("./sessional-schedule/SessionalSchedule"));

const TeachersList = lazy(() => import("./sessional-pref//TeachersList"));
const TeacherDetails = lazy(() => import("./sessional-pref//TeacherDetails"));


const pdfPage = lazy(() => import("./pdf/ShowPdf"));
const TheorySchedule = lazy(() => import("./theory-schedule/TheorySchedule"));

const SessionalDistribution = lazy(() => import("./sessional-distribution/showSessionalDistribution"));
const OptionalCourses = lazy(() => import("./optional-courses/OptionalCourses"));
const LoadDistribution = lazy(() => import("./load-distribution/LoadDistribution"));

export default function AppRoutes() {
  const { user } = useContext(UserContext);

  return (
    <Suspense fallback={<Spinner />}>
      <Switch>
        <Route exact path="/form/theory-pref/:initial" component={TheorySelect} />
        <Route exact path="/form/sessional-pref/:initial" component={SessionalSelect} />
        {user.loggedIn ? (
          <Switch>
            <Route exact path="/dashboard" component={Dashboard} />
            <Route path="/database/initialize" component={Initialize} />
            <Route path="/database/backup" component={Backup} />
            <Route path="/database/restore" component={Restore} />
            <Route path="/database/clear" component={Clear} />
            <Route path="/information/teachers" component={Teachers} />
            <Route path="/information/rooms" component={Rooms} />
            <Route path="/information/courses" component={Courses} />
            <Route
              path="/information/academic-config"
              component={AcademicConfig}
            />
            <Route path="/theory-assign" component={TheoryPreference} />
            <Route path="/room-assign/non-departmental" component={ NonDepartmentalLabRoomAssign } />
            <Route path="/theory-room-assign" component={ TheoryRoomAssign } />
            <Route path="/lab-assign" component={ TeachersList } />
            <Route path="/lab-assign/:teacherId" component={TeacherDetails} />
            <Route path="/lab-schedule" component={ SessionalSchedule } />
            <Route path="/pdf" component={pdfPage} />
            <Route path="/theory-schedule" component={TheorySchedule} />
            <Route path="/optional-courses" component={OptionalCourses} />
            <Route path="/sessional-distribution" component={SessionalDistribution} />
            <Route path="/load-distribution" component={LoadDistribution} />
            <Route path="/auth/change-password" component={ChangePassword} />
            <Route path="/account" component={Account} />
            <Redirect to="/dashboard" />
          </Switch>
        ) : (
          <Switch>
            <Route path="/auth/login" component={Login} />
            <Route path="/auth/forgot-password" component={ForgetPassword} />
            <Redirect to="/auth/login" />
          </Switch>
        )}
      </Switch>
    </Suspense>
  );
}
