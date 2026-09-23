import { useContext } from "react";
import { Dropdown } from "react-bootstrap";
import { Link } from "react-router-dom";
import { UserContext } from "../App";

function Navbar() {
  const { setUser } = useContext(UserContext);
  const name = localStorage.getItem("rememberedUsername");

  return (
    <nav
      className="navbar default-layout-navbar col-lg-12 col-12 p-0 fixed-top d-flex flex-row navbar-sessional-consistent"
      style={{
        boxShadow: "0 10px 30px rgba(194, 137, 248, 0.18)",
        border: "none",
        background:
          "linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(174, 117, 228) 100%)",
        minHeight: "64px",
        zIndex: 1050,
      }}
    >
      <style>{`
        .navbar-sessional-consistent {
          background: linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(174, 117, 228) 100%) !important;
          box-shadow: 0 10px 30px rgba(194, 137, 248, 0.18);
          transition: background 0.3s ease;
        }
        .navbar-brand img {
          filter: drop-shadow(0 4px 14px rgba(154, 77, 226, 0.12));
          transition: transform 0.3s ease;
        }
        .navbar-brand img:hover {
          transform: rotate(-2deg) scale(1.02);
        }
        .navbar-nav .nav-link, .navbar-nav .dropdown-toggle {
          color: #fff !important;
          font-weight: 700;
          letter-spacing: 0.03em;
          border-radius: 12px;
          transition: background 0.25s ease, color 0.25s ease, box-shadow 0.25s;
          box-shadow: none;
        }
        .navbar-nav .nav-link:hover, .navbar-nav .dropdown-toggle:hover {
          background: rgba(255, 255, 255, 0.18);
          color: #e6d6fa !important;
          box-shadow: 0 4px 12px rgba(174, 117, 228, 0.18);
        }
        .navbar-nav .dropdown-menu {
          border-radius: 15px;
          box-shadow: 0 10px 30px rgba(154, 77, 226, 0.18);
          animation: fadeInScale 0.25s ease forwards;
          border: none;
          backdrop-filter: blur(8px);
          background: rgba(255, 255, 255, 0.95);
          min-width: 220px;
        }
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .navbar-toggler {
          background: rgba(194, 137, 248, 0.25);
          color: #fff;
          border-radius: 12px;
          transition: background 0.25s ease;
          display: block !important;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .navbar-toggler:hover {
          background: rgba(194, 137, 248, 0.4);
        }
        .nav-profile-img {
          border-radius: 12px;
          background: rgba(255,255,255,0.18);
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .nav-profile-img i {
          font-size: 32px;
          color: #fff;
        }
        .nav-profile-text p {
          color: #fff !important;
          font-weight: 700;
          margin-bottom: 0;
        }
        .navbar-nav .dropdown-item {
          border-radius: 10px;
          font-weight: 500;
          color: #5e257e;
          transition: background 0.2s ease, color 0.2s ease;
        }
        .navbar-nav .dropdown-item:hover {
          background: linear-gradient(90deg, #f3e6ff 0%, #e3d5f7 100%);
          color: #9a4de2;
        }
        .count-symbol {
          display: inline-block;
          min-width: 18px;
          height: 18px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          background: linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(174, 117, 228) 100%);
          color: #fff;
          text-align: center;
          line-height: 18px;
          box-shadow: 0 2px 8px rgba(154, 77, 226, 0.15);
          margin-left: 4px;
        }
        .navbar-menu-wrapper {
          flex: 1;
        }
        @media (max-width: 991px) {
          .navbar-brand-wrapper {
            display: none;
          }
          .navbar-menu-wrapper {
            justify-content: flex-start !important;
          }
          .navbar-toggler {
            margin-left: 15px;
          }
          .navbar-nav-right {
            margin-left: auto;
          }
        }
        @media (max-width: 575px) {
          .navbar-toggler {
            margin-left: 10px;
          }
        }
      `}</style>
      <div className="text-center navbar-brand-wrapper d-flex align-items-center justify-content-center">
        <Link className="navbar-brand brand-logo" to="/">
          <img
            src={require("../../assets/images/logo.svg").default}
            alt="logo"
          />
        </Link>
        <Link className="navbar-brand brand-logo-mini" to="/">
          <img
            src={require("../../assets/images/logo-mini.svg").default}
            alt="logo"
          />
        </Link>
      </div>
      <div className="navbar-menu-wrapper d-flex align-items-stretch">
        <button
          className="navbar-toggler navbar-toggler align-self-center"
          type="button"
          onClick={() => {
            const sidebar = document.querySelector("#sidebar");
            const body = document.body;

            // For mobile and tablet screens, toggle sidebar active class
            if (window.innerWidth <= 991) {
              if (sidebar) {
                sidebar.classList.toggle("active");
              }
            }

            // For all screen sizes, toggle sidebar-icon-only for desktop collapse behavior
            body.classList.toggle("sidebar-icon-only");
          }}
          style={{ color: "#fff" }}
        >
          <span className="mdi mdi-menu"></span>
        </button>
        <ul
          className="navbar-nav navbar-nav-right"
          style={{ alignItems: "center" }}
        >
          <li className="nav-item nav-profile">
            <Dropdown align="end">
              <Dropdown.Toggle className="nav-link">
                <div className="nav-profile-img d-flex align-items-center justify-content-center">
                  <i
                    className="mdi mdi-account-circle"
                    style={{ fontSize: 32, color: "#fff" }}
                  ></i>
                  <span className="availability-status online"></span>
                </div>
                <div className="nav-profile-text">
                  <p className="mb-1 text-black">
                    <b>{name}</b>
                  </p>
                </div>
              </Dropdown.Toggle>
              <Dropdown.Menu className="navbar-dropdown">
                <Dropdown.Item as={Link} to="/account">
                  <i className="mdi mdi-account mr-2 text-primary"></i>
                  Account
                </Dropdown.Item>
                <Dropdown.Item as={Link} to="/auth/change-password">
                  <i className="mdi mdi-lock-reset mr-2 text-primary"></i>
                  Change Password
                </Dropdown.Item>
                <Dropdown.Item
                  href="!#"
                  onClick={(evt) => {
                    evt.preventDefault();
                    localStorage.removeItem("token");
                    setUser({ loggedIn: false });
                  }}
                >
                  <i className="mdi mdi-logout mr-2 text-primary"></i>
                  Signout
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </li>
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;
