import React from "react";
import { Modal, Button, Form } from "react-bootstrap";

const EditEmailModal = ({ showModal, handleClose, handleSave, editedEmail, setEditedEmail, mask }) => {
  return (
    <Modal show={showModal} onHide={handleClose} size="lg">
      <Modal.Header closeButton style={{
        background: "linear-gradient(135deg, #c289f8, #ae75e4)",
        color: "white",
        borderBottom: "none",
        borderRadius: "16px 16px 0 0"
      }}>
        <Modal.Title style={{
          fontWeight: "700",
          fontSize: "1.3rem",
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M18.5 2.49998C18.8978 2.10216 19.4374 1.87866 20 1.87866C20.5626 1.87866 21.1022 2.10216 21.5 2.49998C21.8978 2.89781 22.1213 3.43737 22.1213 3.99998C22.1213 4.56259 21.8978 5.10216 21.5 5.49998L12 15L8 16L9 12L18.5 2.49998Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Edit {
          mask === "THEORY" ? "Theory" :
          mask === "SCHEDULE" ? "Schedule" :
          mask === "SESSIONAL" && "Sessional"
          } Email Template
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ padding: "2rem" }}>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{
            fontWeight: "600",
            color: "#444",
            marginBottom: "8px",
            display: "block",
            fontSize: "1rem"
          }}>
            Email Content
          </label>
        <Form.Control
            as="textarea" 
            rows={8}
          value={editedEmail}
          onChange={(e) => setEditedEmail(e.target.value)}
            style={{
              borderRadius: "12px",
              border: "2px solid #e1e5e9",
              boxShadow: "0 2px 8px rgba(16, 24, 40, 0.06)",
              fontWeight: "500",
              color: "#333",
              background: "#ffffff",
              fontSize: "1rem",
              transition: "all 0.3s ease",
              resize: "vertical"
            }}
            placeholder="Enter your email template content here..."
          />
        </div>
        <div style={{
          background: "rgba(174, 117, 228, 0.08)",
          padding: "16px",
          borderRadius: "12px",
          border: "1px solid rgba(174, 117, 228, 0.1)"
        }}>
          <h6 style={{
            color: "rgb(174, 117, 228)",
            fontWeight: "600",
            marginBottom: "8px",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="rgb(174, 117, 228)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 8V12" stroke="rgb(174, 117, 228)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 16H12.01" stroke="rgb(174, 117, 228)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Available Variables
          </h6>
          <div style={{ fontSize: "0.9rem", color: "#666" }}>
            <code style={{
              background: "rgba(174, 117, 228, 0.1)",
              padding: "4px 8px",
              borderRadius: "6px",
              color: "rgb(174, 117, 228)",
              fontWeight: "600",
              marginRight: "8px"
            }}>teacher_name</code>
            <code style={{
              background: "rgba(174, 117, 228, 0.1)",
              padding: "4px 8px",
              borderRadius: "6px",
              color: "rgb(174, 117, 228)",
              fontWeight: "600"
            }}>link</code>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer style={{
        borderTop: "1px solid #e1e5e9",
        padding: "1.5rem 2rem",
        background: "#f8f9fa"
      }}>
        <Button 
          variant="outline-secondary" 
          onClick={handleClose}
          style={{
            borderRadius: "10px",
            padding: "10px 20px",
            fontWeight: "600",
            border: "2px solid #6c757d",
            color: "#6c757d",
            transition: "all 0.3s ease"
          }}
        >
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleSave}
          style={{
            borderRadius: "10px",
            padding: "10px 24px",
            fontWeight: "600",
            background: "linear-gradient(135deg, #c289f8, #ae75e4)",
            border: "none",
            boxShadow: "0 4px 12px rgba(174, 117, 228, 0.25)",
            transition: "all 0.3s ease",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V19C21 20.1046 20.1046 21 19 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8.5 10.5L12 14L15.5 10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Save Changes
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default EditEmailModal;
