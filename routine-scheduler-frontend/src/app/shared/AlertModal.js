import { Modal, Button } from 'react-bootstrap';

/**
 * A reusable styled Alert Modal component
 * 
 * @param {Object} props
 * @param {boolean} props.show - Controls the visibility of the modal
 * @param {function} props.onHide - Function to call when closing the modal
 * @param {string} props.title - Title to display in the modal header
 * @param {string|JSX.Element} props.message - Message or content to display in the modal body
 * @param {string} props.buttonText - Text for the action button (defaults to "Understood")
 * @param {string} props.icon - MDI icon class (defaults to "mdi-information-outline")
 */
const AlertModal = ({ 
  show, 
  onHide, 
  title = "Attention Required", 
  message, 
  buttonText = "Understood",
  icon = "mdi-information-outline"
}) => {
  const styles = {
    modal: {
      borderRadius: "20px",
      overflow: "hidden",
      boxShadow: "0 10px 30px rgba(0,0,0,0.08), 0 0 0 1px rgba(194, 137, 248, 0.1)",
    },
    modalHeader: {
      background: "linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(174, 117, 228) 100%)",
      color: "white",
      border: "none",
      padding: "28px 30px",
      fontWeight: "600",
      position: "relative"
    },
    title: {
      fontWeight: "600", 
      fontSize: "18px"
    },
    modalBody: {
      padding: "28px 30px", 
      fontSize: "16px",
      backgroundColor: "#ffffff"
    },
    iconContainer: {
      width: "44px",
      height: "44px",
      borderRadius: "50%",
      background: "rgba(174, 117, 228, 0.1)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginRight: "20px"
    },
    icon: {
      fontSize: "24px", 
      color: "rgb(174, 117, 228)"
    },
    modalFooter: {
      border: "none", 
      padding: "0 30px 28px 30px",
      backgroundColor: "#ffffff"
    },
    button: {
      background: "linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(174, 117, 228) 100%)",
      border: "none",
      padding: "14px 28px",
      borderRadius: "12px",
      fontWeight: "600",
      boxShadow: "0 4px 12px rgba(174, 117, 228, 0.3)",
      transition: "all 0.3s ease",
      fontSize: "16px",
      letterSpacing: "0.5px"
    },
    closeButton: {
      position: "absolute",
      top: "20px",
      right: "20px",
      background: "rgba(255, 255, 255, 0.2)",
      border: "none",
      borderRadius: "4px",
      width: "30px",
      height: "30px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "white",
      fontSize: "20px",
      padding: 0,
      transition: "all 0.2s ease",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)"
    }
  };

  const handleButtonHover = (e, isHover) => {
    if (isHover) {
      e.currentTarget.style.transform = "translateY(-2px)";
      e.currentTarget.style.boxShadow = "0 6px 15px rgba(174, 117, 228, 0.4)";
    } else {
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = "0 4px 12px rgba(174, 117, 228, 0.3)";
    }
  };

  const handleCloseButtonHover = (e, isHover) => {
    if (isHover) {
      e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
      e.currentTarget.style.transform = "scale(1.05)";
    } else {
      e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
      e.currentTarget.style.transform = "scale(1)";
    }
  };

  return (
    <Modal 
      show={show} 
      onHide={onHide} 
      centered
      backdrop="static"
      contentClassName="border-0"
      dialogClassName="modal-dialog-centered"
      style={styles.modal}
    >
      <Modal.Header 
        style={styles.modalHeader}
        closeButton={false}
      >
        <Modal.Title style={styles.title}>
          <i className={`mdi ${icon} me-2`}></i>
          {title}
        </Modal.Title>
        <button 
          type="button" 
          style={styles.closeButton} 
          onClick={onHide}
          onMouseOver={(e) => handleCloseButtonHover(e, true)}
          onMouseOut={(e) => handleCloseButtonHover(e, false)}
          aria-label="Close"
        >
          <i className="mdi mdi-close"></i>
        </button>
      </Modal.Header>
      <Modal.Body style={styles.modalBody}>
        <div className="d-flex align-items-center">
          <div style={styles.iconContainer}>
            <i className={`mdi ${icon}`} style={styles.icon}></i>
          </div>
          <div style={{ fontSize: "16px" }}>{message}</div>
        </div>
      </Modal.Body>
      <Modal.Footer style={styles.modalFooter}>
        <Button 
          style={styles.button}
          onClick={onHide}
          onMouseOver={(e) => handleButtonHover(e, true)}
          onMouseOut={(e) => handleButtonHover(e, false)}
          className="d-flex align-items-center justify-content-center"
        >
          <i className="mdi mdi-check-circle me-2"></i>
          {buttonText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AlertModal;
