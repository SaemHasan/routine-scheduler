import React from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Form, InputGroup, Modal } from "react-bootstrap";
import { getTheoryEmail,getScheduleEmail,getSessionalEmail } from "../api/dashboard";
import Emailtemplate from "./Emailtemplate";
import ConfigManagement from "./ConfigManagement";
import themeImg from '../../assets/images/dashboard/theme.png';

function App() {
  const [theoryEmail, setTheoryEmail] = useState("");
  const [scheduleEmail, setScheduleEmail] = useState("");
  const [sessionalEmail, setSessionalEmail] = useState("");

  useEffect(() => {
    getTheoryEmail().then((res) => setTheoryEmail(res.email));
    getScheduleEmail().then((res) => setScheduleEmail(res.email));
    getSessionalEmail().then((res) => setSessionalEmail(res.email));
  }
  , []);

  return (
    <div>
      {/* Theme image at the top */}
      <div style={{ width: '100%', marginBottom: '1.5rem' }}>
        <img src={themeImg} alt="Theme" style={{ width: '100%', height: 'auto', maxHeight: '1000px', objectFit: 'cover', borderRadius: '12px', boxShadow: '0 4px 16px rgba(154,77,226,0.08)' }} />
      </div>

      {/* System Configuration Management Section */}
      <div className="row mt-4 mb-4">
        <div className="col-12">
          <ConfigManagement />
        </div>
      </div>

      {/* Academic Configuration now lives under Information */}
      <div className="row mt-4 mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-view">
              <div className="card-control-container">
                <h4 className="card-name">
                  <div className="card-icon mdi mdi-tune-variant"></div>
                  Academic Configuration
                </h4>
                <div className="card-control-button-container">
                  <Link
                    className="card-control-button mdi mdi-arrow-right-circle"
                    to="/information/academic-config"
                    style={{ textDecoration: "none" }}
                  >
                    Open
                  </Link>
                </div>
              </div>
              <div className="card-section-note">
                Batches, departments, section and subsection counts, level-term
                structure and offering departments are managed under
                Information &rarr; Academic Config.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Email Templates Section */}
      <Emailtemplate theoryEmail={theoryEmail} scheduleEmail={scheduleEmail} sessionalEmail={sessionalEmail}/>

      <Modal show={false} onHide={() => {}}>
        <Modal.Header closeButton>
          <Modal.Title>Theory Course Preference</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <textarea
            className="form-control"
            rows="10"
            value={`Hello {teacher_name}! <br />;
I would like to request you to
fill up the form attached to this email for giving your preferred
theory course. <br />
{link} <br />
Thank you.`}
          ></textarea>
          <Alert variant="info" className="mt-3">
            Available Variables: <br /> <br />
            <code> teacher_name </code> <code> link </code>
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary">Close</Button>
          <Button variant="primary">Save changes</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default App;
