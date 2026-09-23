import { useState, useEffect } from "react";
import { Modal } from "react-bootstrap";
import { Form, Row, Col, FormControl, FormGroup } from "react-bootstrap";
import { toast } from "react-hot-toast";
import { getRooms, createRoom, updateRoom, deleteRoom } from "../api/db-crud";
import ConfirmationModal from "../shared/ConfirmationModal";

const validateRoom = (room) => {
  if (room.room === "" || room.room === undefined || room.room === null) {
    return "Room cannot be empty";
  }
  if (room.type === "" || room.type === undefined || room.type === null) {
    return "Type cannot be empty";
  }
  if (room.type !== 0 && room.type !== 1 && room.type !== 2) {
    return "Type must be Theory (0), Sessional (1) or Theory & Sessional (2)";
  }
  if (room.active === "" || room.active === undefined || room.active === null) {
    return "Active status cannot be empty";
  }
  if (typeof room.active !== "boolean") {
    return "Active status must be a boolean value";
  }
  return null;
};

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationDetails, setConfirmationDetails] = useState({
    title: "",
    body: "",
    confirmText: "",
    cancelText: "",
    onConfirm: () => {},
    onCancel: () => {},
    confirmIcon: "mdi-delete",
    red: 220,
    green: 53,
    blue: 69,
  });

  const handleShowConfirmation = (
    title,
    body,
    confirmText,
    cancelText,
    onConfirm,
    confirmIcon,
    red,
    green,
    blue
  ) => {
    setConfirmationDetails({
      title,
      body,
      confirmText,
      cancelText,
      onConfirm,
      confirmIcon,
      red,
      green,
      blue,
    });
    setShowConfirmation(true);
  };

  const handleHideConfirmation = () => {
    setShowConfirmation(false);
  };

  const handleDelete = (room) => {
    handleShowConfirmation(
      "Delete Room",
      `Are you sure you want to delete ${room}?`,
      "Delete",
      "Cancel",
      async () => {
        try {
          deleteRoom(room).then((res) => {
            setRooms(rooms.filter((r) => r.room !== room));
            toast.success("Room deleted successfully");
          });
        } catch (error) {
          console.error("Error deleting level term:", error);
          toast.error(`Failed to delete ${room}`);
        }
      },
      "mdi-delete",
      220,
      53,
      69
    );
  };

  useEffect(() => {
    getRooms().then((res) => {
      setRooms(res);
    });
  }, []);

  return (
    <div>
      {/* Modern Page Header */}
      <div className="page-header">
        <h3 className="page-title">
          <div className="page-title-icon-container">
            <i className="mdi mdi-domain"></i>
          </div>
          Room Information
        </h3>
        <nav aria-label="breadcrumb">
          <ol
            className="breadcrumb"
            style={{ marginBottom: "0", background: "transparent" }}
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
              style={{ color: "rgba(255,255,255,0.9)", fontWeight: "500" }}
            >
              Rooms
            </li>
          </ol>
        </nav>
      </div>
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-view">
              <div className="card-control-container">
                <h4 className="card-name">
                  <i className="card-icon mdi mdi-domain"></i>
                  Room Management
                </h4>
                <div className="card-control-button-container">
                  <button
                    className="card-control-button mdi mdi-plus-circle"
                    onClick={(e) => {
                      setSelectedRoom({
                        room: "",
                        type: 0,
                        lab_type: "",
                        active: false,
                        prev_room: "",
                      });
                    }}
                  >
                    Add New Room
                  </button>
                </div>
              </div>
              <div className="card-table-container table-responsive">
                <table className="card-table table">
                  <thead className="card-table-header">
                    <tr>
                      <th>
                        <i className="mdi mdi-door"></i>
                        Room
                      </th>
                      <th>
                        <i className="mdi mdi-format-list-bulleted-type"></i>
                        Type
                      </th>
                      <th>
                        <i className="mdi mdi-desktop-classic"></i>
                        Lab Type
                      </th>
                      <th>
                        <i className="mdi mdi-check-circle"></i>
                        Active
                      </th>
                      <th>
                        <i className="mdi mdi-cog"></i>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="card-table-body">
                    {rooms.map((room, index) => (
                      <tr key={index}>
                        <td>{room.room}</td>
                        <td>
                          <select
                            className="form-select"
                            value={room.type}
                            onChange={(e) => {
                              const newRooms = [...rooms];
                              newRooms[index].type = Number(e.target.value);
                              updateRoom(room.room, newRooms[index])
                                .then((res) => {
                                  setRooms(newRooms);
                                  toast.success("Room updated successfully");
                                })
                                .catch((e) => {
                                  toast.error("Failed to update room");
                                });
                            }}
                          >
                            <option value={0}>Theory</option>
                            <option value={1}>Sessional</option>
                            <option value={2}>Theory &amp; Sessional</option>
                          </select>
                        </td>
                        <td>
                          {room.type === 0 ? (
                            <span style={{ opacity: 0.6 }}>—</span>
                          ) : (
                            <select
                              className="form-select"
                              value={room.lab_type || ""}
                              onChange={(e) => {
                                const newRooms = [...rooms];
                                newRooms[index].lab_type =
                                  e.target.value || null;
                                updateRoom(room.room, newRooms[index])
                                  .then((res) => {
                                    setRooms(newRooms);
                                    toast.success("Room updated successfully");
                                  })
                                  .catch((e) => {
                                    toast.error("Failed to update room");
                                  });
                              }}
                            >
                              <option value="">Not set</option>
                              <option value="SW">Software Lab</option>
                              <option value="HW">Hardware Lab</option>
                            </select>
                          )}
                        </td>
                        <td>
                          <div
                            className={`custom-checkbox ${
                              room.active === true
                                ? "checked mdi mdi-check"
                                : "unchecked"
                            }`}
                            onClick={(e) => {
                              const newChecked = !(room.active === true);
                              const newRooms = [...rooms];
                              newRooms[index].active = newChecked;
                              updateRoom(room.room, newRooms[index])
                                .then((res) => {
                                  setRooms(newRooms);
                                  toast.success("Room updated successfully");
                                })
                                .catch((e) => {
                                  toast.error("Failed to update room");
                                });
                            }}
                          ></div>
                        </td>
                        <td>
                          <button
                            className="delete mdi mdi-delete-outline"
                            onClick={() => handleDelete(room.room)}
                          >
                            Delete
                          </button>
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
      {selectedRoom !== null && (
        <Modal
          show={true}
          onHide={() => setSelectedRoom(null)}
          size="md"
          centered
          contentClassName="modal-content"
          backdrop="static"
        >
          <Modal.Header className="modal-header">
            <Modal.Title className="modal-header-content">
              <div className="modal-header-icon">
                <i className="mdi mdi-domain"></i>
              </div>
              <h4 className="modal-title">
                {selectedRoom.prev_room === "" ? "Add" : "Edit"} Room
              </h4>
            </Modal.Title>
            <button
              className="modal-header-close-button mdi mdi-close"
              onClick={() => setSelectedRoom(null)}
            ></button>
          </Modal.Header>
          <Modal.Body className="modal-body">
            <div className="modal-body-content-container">
              <Form>
                <Row>
                  <Col className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">
                        Room Number
                      </Form.Label>
                      <FormControl
                        type="text"
                        className="form-control"
                        placeholder="Enter Room Number"
                        value={selectedRoom.room}
                        onChange={(e) =>
                          setSelectedRoom({
                            ...selectedRoom,
                            room: e.target.value,
                          })
                        }
                      />
                    </FormGroup>
                  </Col>
                </Row>
                <Row>
                  <Col className="px-2 py-1">
                    <FormGroup>
                      <Form.Label className="form-label">Room Type</Form.Label>
                      <Form.Select
                        className="form-select"
                        value={selectedRoom.type}
                        onChange={(e) =>
                          setSelectedRoom({
                            ...selectedRoom,
                            type: Number.parseInt(e.target.value),
                          })
                        }
                      >
                        <option value="0">Theory</option>
                        <option value="1">Sessional</option>
                        <option value="2">Theory &amp; Sessional</option>
                      </Form.Select>
                    </FormGroup>
                  </Col>
                </Row>
                {selectedRoom.type !== 0 && (
                  <Row>
                    <Col className="px-2 py-1">
                      <FormGroup>
                        <Form.Label className="form-label">Lab Type</Form.Label>
                        <Form.Select
                          className="form-select"
                          value={selectedRoom.lab_type || ""}
                          onChange={(e) =>
                            setSelectedRoom({
                              ...selectedRoom,
                              lab_type: e.target.value,
                            })
                          }
                        >
                          <option value="">Not set</option>
                          <option value="SW">Software Lab</option>
                          <option value="HW">Hardware Lab</option>
                        </Form.Select>
                      </FormGroup>
                    </Col>
                  </Row>
                )}
                <Row>
                  <Col className="px-2 py-1 d-flex align-items-center">
                    <div
                      className={`custom-checkbox ${
                        selectedRoom.active
                          ? "checked mdi mdi-check"
                          : "unchecked"
                      }`}
                      onClick={() =>
                        setSelectedRoom({
                          ...selectedRoom,
                          active: !selectedRoom.active,
                        })
                      }
                    ></div>
                    <span className="custom-checkbox-label">
                      {selectedRoom.active ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </Col>
                </Row>
              </Form>
            </div>
            <div className="modal-divider"></div>
          </Modal.Body>
          <Modal.Footer className="modal-footer">
            <button
              className="card-control-button mdi mdi-close"
              onClick={() => setSelectedRoom(null)}
            >
              Close
            </button>
            <button
              className="card-control-button mdi mdi-content-save"
              onClick={(e) => {
                e.preventDefault();
                const result = validateRoom(selectedRoom);
                if (result === null) {
                  createRoom(selectedRoom)
                    .then((res) => {
                      setRooms(
                        [...rooms, selectedRoom].sort((a, b) =>
                          a.room.localeCompare(b.room)
                        )
                      );
                      toast.success("Room added successfully");
                    })
                    .catch((error) => {
                      console.error("Error adding room:", error);
                      toast.error("Failed to add room");
                    });
                  setSelectedRoom(null);
                } else {
                  toast.error(result);
                }
              }}
            >
              Save
            </button>
          </Modal.Footer>
        </Modal>
      )}
      <ConfirmationModal
        show={showConfirmation}
        onHide={handleHideConfirmation}
        title={confirmationDetails.title}
        body={confirmationDetails.body}
        confirmText={confirmationDetails.confirmText}
        cancelText={confirmationDetails.cancelText}
        onConfirm={() => {
          confirmationDetails.onConfirm();
          handleHideConfirmation();
        }}
        onCancel={handleHideConfirmation}
        confirmIcon={confirmationDetails.confirmIcon}
        red={confirmationDetails.red}
        green={confirmationDetails.green}
        blue={confirmationDetails.blue}
      />
    </div>
  );
}
