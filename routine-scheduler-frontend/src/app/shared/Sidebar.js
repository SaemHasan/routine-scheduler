import { Component } from 'react';
import { Link, withRouter } from 'react-router-dom';
import { Collapse } from 'react-bootstrap';

class Sidebar extends Component {

  state = {};

  toggleMenuState(menuState) {
    if (this.state[menuState]) {
      this.setState({ [menuState]: false });
    } else if (Object.keys(this.state).length === 0) {
      this.setState({ [menuState]: true });
    } else {
      Object.keys(this.state).forEach(i => {
        this.setState({ [i]: false });
      });
      this.setState({ [menuState]: true });
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.location !== prevProps.location) {
      this.onRouteChanged();
    }
  }

  onRouteChanged() {
    document.querySelector('#sidebar').classList.remove('active');
    Object.keys(this.state).forEach(i => {
      this.setState({ [i]: false });
    });
  }

  render() {
    return (
      <nav className="sidebar sidebar-offcanvas" id="sidebar" style={{
        background: '#fff',
        borderRadius: '0 16px 16px 0',
        boxShadow: '0 6px 24px 0 rgba(154, 77, 226, 0.10)',
        border: 'none',
        minHeight: '100vh',
        paddingTop: 16,
        paddingBottom: 16,
        transition: 'background 0.3s, box-shadow 0.3s',
      }}>
        <style>{`
          .sidebar .nav-item {
            position: relative;
          }
          .sidebar .nav-item.active::before {
            content: '';
            position: absolute;
            left: 0; top: 8px; bottom: 8px;
            width: 4px;
            border-radius: 4px;
            background: linear-gradient(180deg, #c289f8 0%, #ae75e4 100%);
            z-index: 2;
            display: block;
          }
        `}</style>
        <ul className="nav">
          <li className={this.isPathActive('/dashboard') ? 'nav-item active' : 'nav-item'}>
            <Link className="nav-link" to="/dashboard">
              <span className="menu-title">Dashboard</span>
              <i className="mdi mdi-home menu-icon"></i>
            </Link>
          </li>
          <li className={this.isPathActive('/database') ? 'nav-item active' : 'nav-item'}>
            <div className={this.state.dbUiMenuOpen ? 'nav-link menu-expanded' : 'nav-link'} onClick={() => this.toggleMenuState('dbUiMenuOpen')} data-toggle="collapse">
              <span className="menu-title">Database</span>
              <i className={this.state.dbUiMenuOpen ? 'mdi mdi-chevron-down menu-icon' : 'mdi mdi-chevron-right menu-icon'}></i>
              <i className="mdi mdi-database menu-icon"></i>
            </div>
            <Collapse in={this.state.dbUiMenuOpen}>
              <ul className="nav flex-column sub-menu">
                <li className={this.isPathActive('/database/initialize') ? 'nav-item active' : 'nav-item'}>
                  <Link className="nav-link" to="/database/initialize">
                    <span className="menu-title">Initialize</span>
                    <i className="mdi mdi-database-plus menu-icon"></i>
                  </Link>
                </li>
                <li className={this.isPathActive('/database/backup') ? 'nav-item active' : 'nav-item'}>
                  <Link className="nav-link" to="/database/backup">
                    <span className="menu-title">Backup</span>
                    <i className="mdi mdi-database-export menu-icon"></i>
                  </Link>
                </li>
              </ul>
            </Collapse>
          </li>
          <li className={this.isPathActive('/information') ? 'nav-item active' : 'nav-item'}>
            <div className={this.state.infoUiMenuOpen ? 'nav-link menu-expanded' : 'nav-link'} onClick={() => this.toggleMenuState('infoUiMenuOpen')} data-toggle="collapse">
              <span className="menu-title">Information</span>
              <i className={this.state.infoUiMenuOpen ? 'mdi mdi-chevron-down menu-icon' : 'mdi mdi-chevron-right menu-icon'}></i>
              <i className="mdi mdi-information-outline menu-icon"></i>
            </div>
            <Collapse in={this.state.infoUiMenuOpen}>
              <ul className="nav flex-column sub-menu">
                <li className={this.isPathActive('/information/teachers') ? 'nav-item active' : 'nav-item'}>
                  <Link className="nav-link" to="/information/teachers">
                    <span className="menu-title">Teachers</span>
                    <i className="mdi mdi-account-multiple menu-icon"></i>
                  </Link>
                </li>
                <li className={this.isPathActive('/information/rooms') ? 'nav-item active' : 'nav-item'}>
                  <Link className="nav-link" to="/information/rooms">
                    <span className="menu-title">Rooms</span>
                    <i className="mdi mdi-home-modern menu-icon"></i>
                  </Link>
                </li>
                <li className={this.isPathActive('/information/courses') ? 'nav-item active' : 'nav-item'}>
                  <Link className="nav-link" to="/information/courses">
                    <span className="menu-title">Courses</span>
                    <i className="mdi mdi-book-open-page-variant menu-icon"></i>
                  </Link>
                </li>
                <li className={this.isPathActive('/information/academic-config') ? 'nav-item active' : 'nav-item'}>
                  <Link className="nav-link" to="/information/academic-config">
                    <span className="menu-title">Academic Config</span>
                    <i className="mdi mdi-tune-variant menu-icon"></i>
                  </Link>
                </li>
              </ul>
            </Collapse>
          </li>
          <li className={this.isPathActive('/theory-assign') ? 'nav-item active' : 'nav-item'}>
            <Link className="nav-link" to="/theory-assign">
              <span className="menu-title">Theory Assign</span>
              <i className="mdi mdi-clipboard-check menu-icon"></i>
            </Link>
          </li>
          <li className={this.isPathActive('/sessional-distribution') ? 'nav-item active' : 'nav-item'}>
            <Link className="nav-link" to="/sessional-distribution">
              <span className="menu-title">Sessional Distribution</span>
              <i className="mdi mdi-file-check menu-icon"></i>
            </Link>
          </li>
          <li className={this.isPathActive('/lab-schedule') ? 'nav-item active' : 'nav-item'}>
            <Link className="nav-link" to="/lab-schedule">
              <span className="menu-title">Sessional Schedule</span>
              <i className="mdi mdi-timer-edit-outline menu-icon"></i>
            </Link>
          </li>
          <li className={this.isPathActive('/theory-schedule') ? 'nav-item active' : 'nav-item'}>
            <Link className="nav-link" to="/theory-schedule">
              <span className="menu-title">Theory Schedule</span>
              <i className="mdi mdi-table-clock menu-icon"></i>
            </Link>
          </li>
          <li className={this.isPathActive('/lab-assign') ? 'nav-item active' : 'nav-item'}>
            <Link className="nav-link" to="/lab-assign">
              <span className="menu-title">Sessional Assign</span>
              <i className="mdi mdi-format-list-text menu-icon"></i>
            </Link>
          </li>
          <li className={this.isPathActive('/theory-room-assign') ? 'nav-item active' : 'nav-item'}>
            <Link className="nav-link" to="/theory-room-assign">
              <span className="menu-title">Theory Room Assign</span>
              <i className="mdi mdi-door menu-icon"></i>
            </Link>
          </li>
          <li className={this.isPathActive('/room-assign') ? 'nav-item active' : 'nav-item'}>
            <div className={this.state.roomAssignMenuOpen ? 'nav-link menu-expanded' : 'nav-link'} onClick={() => this.toggleMenuState('roomAssignMenuOpen')} data-toggle="collapse">
              <span className="menu-title">Lab Room Assign</span>
              <i className={this.state.roomAssignMenuOpen ? 'mdi mdi-chevron-down menu-icon' : 'mdi mdi-chevron-right menu-icon'}></i>
              <i className="mdi mdi-lightbulb-variant-outline menu-icon"></i>
            </div>
            <Collapse in={this.state.roomAssignMenuOpen}>
              <ul className="nav flex-column sub-menu">
                <li className={this.isPathActive('/room-assign/non-departmental') ? 'nav-item active' : 'nav-item'}>
                  <Link className="nav-link" to="/room-assign/non-departmental">
                    <span className="menu-title">Non-Departmental</span>
                    <i className="mdi mdi-account-multiple-outline menu-icon"></i>
                  </Link>
                </li>
              </ul>
            </Collapse>
          </li>
          <li className={this.isPathActive('/load-distribution') ? 'nav-item active' : 'nav-item'}>
            <Link className="nav-link" to="/load-distribution">
              <span className="menu-title">Load Distribution</span>
              <i className="mdi mdi-account-group menu-icon"></i>
            </Link>
          </li>
          <li className={this.isPathActive('/pdf') ? 'nav-item active' : 'nav-item'}>
            <Link className="nav-link" to="/pdf">
              <span className="menu-title">Generate Routine</span>
              <i className="mdi mdi-file-pdf-box menu-icon"></i>
            </Link>
          </li>
        </ul>
      </nav>
    );
  }

  isPathActive(path) {
    return this.props.location.pathname.startsWith(path);
  }

  componentDidMount() {
    this.onRouteChanged();
    // add class 'hover-open' to sidebar navitem while hover in sidebar-icon-only menu
    const body = document.querySelector('body');
    document.querySelectorAll('.sidebar .nav-item').forEach((el) => {

      el.addEventListener('mouseover', function () {
        if (body.classList.contains('sidebar-icon-only')) {
          el.classList.add('hover-open');
        }
      });
      el.addEventListener('mouseout', function () {
        if (body.classList.contains('sidebar-icon-only')) {
          el.classList.remove('hover-open');
        }
      });
    });
  }

}

export default withRouter(Sidebar);