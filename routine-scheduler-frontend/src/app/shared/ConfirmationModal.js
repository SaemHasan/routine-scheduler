import { Modal, Button } from "react-bootstrap";

const ConfirmationModal = ({
  show,
  onHide,
  title,
  body,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  confirmIcon = "mdi-check-circle-outline",
  red = 40,
  green = 167,
  blue = 69, // Default green color RGB values
}) => {
  const confirmColor = `rgb(${red}, ${green}, ${blue})`;
  const confirmColorLight = `rgba(${red}, ${green}, ${blue}, 0.1)`;
  const confirmColorLighter = `rgba(${red}, ${green}, ${blue}, 0.05)`;
  const confirmColorBorder = `rgba(${red}, ${green}, ${blue}, 0.3)`;

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="md"
      centered
      contentClassName="border-0 shadow"
      backdrop="static"
    >
      <Modal.Header
        style={{
          background: `linear-gradient(135deg, ${confirmColorLighter} 0%, ${confirmColorLight} 100%)`,
          borderBottom: `1px solid ${confirmColorBorder}`,
          paddingTop: "16px",
          paddingBottom: "16px",
        }}
      >
        <div className="d-flex align-items-center">
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              backgroundColor: confirmColorLight,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: "10px",
            }}
          >
            <i
              className="mdi mdi-information-outline"
              style={{ fontSize: "18px", color: confirmColor }}
            ></i>
          </div>
          <Modal.Title
            style={{ fontSize: "18px", fontWeight: "600", color: confirmColor }}
          >
            {title}
          </Modal.Title>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div style={{ paddingBottom: "2rem" }}>{body}</div>
      </Modal.Body>
      <Modal.Footer
        style={{
          borderTop: `1px solid ${confirmColorBorder}`,
          padding: "16px",
        }}
      >
        <Button
          style={{
            background: "rgba(154, 77, 226, 0.15)",
            color: "rgb(154, 77, 226)",
            border: "1.5px solid rgba(154, 77, 226, 0.5)",
            borderRadius: "8px",
            padding: "8px 20px",
            fontWeight: "500",
            fontSize: "1rem",
            marginRight: "10px",
            transition: "all 0.3s ease",
          }}
          onClick={onCancel}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "rgb(154, 77, 226)";
            e.currentTarget.style.color = "white";
            e.currentTarget.style.borderColor = "rgb(154, 77, 226)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "rgba(154, 77, 226, 0.15)";
            e.currentTarget.style.color = "rgb(154, 77, 226)";
            e.currentTarget.style.borderColor = "rgba(154, 77, 226, 0.5)";
          }}
        >
          <i className="mdi mdi-close mr-1"></i>
          {cancelText}
        </Button>
        <Button
          style={{
            background: confirmColorLight,
            color: confirmColor,
            border: `1.5px solid ${confirmColorBorder}`,
            borderRadius: "8px",
            padding: "8px 20px",
            fontWeight: "500",
            marginLeft: "10px",
            transition: "all 0.3s ease",
          }}
          onClick={onConfirm}
          onMouseOver={(e) => {
            e.currentTarget.style.background = confirmColor;
            e.currentTarget.style.color = "white";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = confirmColorLight;
            e.currentTarget.style.color = confirmColor;
          }}
        >
          <i className={`mdi ${confirmIcon} mr-1`}></i>
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConfirmationModal;
