import axios from "axios";
import { useEffect, useState, createContext } from "react";
import { withRouter } from "react-router-dom";
import "./App.scss";
import AppRoutes from "./AppRoutes";
import Navbar from "./shared/Navbar";
import Sidebar from "./shared/Sidebar";
import SettingsPanel from "./shared/SettingsPanel";
import Footer from "./shared/Footer";
import "./App.css";
import { useLocation } from "react-router-dom/cjs/react-router-dom.min";
import { FORBIDDEN, UNAUTHORIZED } from "./api";
import { toast } from "react-hot-toast";
import { ConfigProvider } from "./shared/ConfigContext";

export const UserContext = createContext({
  user: undefined,
  setUser: (u) => {},
});
export const UserProvider = UserContext.Provider;

function App(props) {
  const location = useLocation();
  const [isFullPageLayout, setIsFullPageLayout] = useState(false);

  const [user, setUser] = useState({
    loggedIn: Boolean(localStorage.getItem("token")),
  });

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      console.log(error);

      // Check if error.response exists before accessing its properties
      if (error.response) {
        const status = error.response.status;

        if (status === UNAUTHORIZED || status === FORBIDDEN) {
          localStorage.removeItem("token");
          setUser({ loggedIn: false });
          return Promise.reject(error);
        } else {
          const message =
            error.response.data?.message || "Something went wrong...";
          toast.error(message);
          return Promise.reject(error);
        }
      } else {
        // Handle network errors or other errors without response
        const message =
          error.message || "Network error or server is unreachable";
        toast.error(message);
        return Promise.reject(error);
      }
    }
  );

  useEffect(() => {
    onRouteChanged(location);
  }, [location]);

  function onRouteChanged(location) {
    window.scrollTo(0, 0);
    const fullPageLayoutRoutes = [
      "/auth/login",
      "/auth/forgot-password",
      "/auth/change-password",
      "/form/",
    ];
    const isFullPageLayout = fullPageLayoutRoutes.some((l) =>
      location.pathname.startsWith(l)
    );
    setIsFullPageLayout(isFullPageLayout);

    if (isFullPageLayout) {
      document
        .querySelector(".page-body-wrapper")
        .classList.add("full-page-wrapper");
    } else {
      document
        .querySelector(".page-body-wrapper")
        .classList.remove("full-page-wrapper");
    }
  }

  let navbarComponent = !isFullPageLayout ? <Navbar /> : "";
  let sidebarComponent = !isFullPageLayout ? <Sidebar /> : "";
  let SettingsPanelComponent = !isFullPageLayout ? <SettingsPanel /> : "";
  let footerComponent = !isFullPageLayout ? <Footer /> : "";

  return (
    <UserProvider value={{ user: user, setUser }}>
      {user && user.loggedIn ? (
        <ConfigProvider>
          <div className="container-scroller">
            {navbarComponent}
            <div className={"container-fluid page-body-wrapper"}>
              {sidebarComponent}
              <div className="main-panel">
                <div className="content-wrapper">
                  <AppRoutes />
                  {SettingsPanelComponent}
                </div>
                {footerComponent}
              </div>
            </div>
          </div>
        </ConfigProvider>
      ) : (
        <div className="container-scroller">
          {navbarComponent}
          <div className={"container-fluid page-body-wrapper"}>
            {sidebarComponent}
            <div className="main-panel">
              <div className="content-wrapper">
                <AppRoutes />
                {SettingsPanelComponent}
              </div>
              {footerComponent}
            </div>
          </div>
        </div>
      )}
    </UserProvider>
  );
}

export default withRouter(App);
