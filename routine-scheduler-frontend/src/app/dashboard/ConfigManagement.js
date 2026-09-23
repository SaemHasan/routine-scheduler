import React, { useState, useEffect } from "react";
import { Form, Row, Col } from "react-bootstrap";
import {
  getAllConfigurations,
  setConfiguration,
  initializeConfigurations,
} from "../api/config";
import { toast } from "react-hot-toast";
import {
  mdiCalendarCheck,
  mdiClockOutline,
  mdiCalendarWeek,
  mdiSchool,
} from "@mdi/js";
import { useConfig } from "../shared/ConfigContext";
import Icon from "@mdi/react";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import ConfirmationModal from "../shared/ConfirmationModal";

const ConfigManagement = () => {
  const { refreshConfigs } = useConfig();
  // Define state for the specific config values we're interested in
  const [currentSession, setCurrentSession] = useState("");
  const [times, setTimes] = useState([8, 9, 10, 11, 12, 1, 2, 3, 4]);
  const [days, setDays] = useState([
    "Saturday",
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
  ]);
  const [possibleLabTimes, setPossibleLabTimes] = useState([8, 11, 2]);
  const [loading, setLoading] = useState(true);

  // Options for selects
  const [sessionOptions, setSessionOptions] = useState([]);
  const timeOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: `${i + 1}:00`,
  }));

  const dayOptions = [
    { value: "Saturday", label: "Saturday" },
    { value: "Sunday", label: "Sunday" },
    { value: "Monday", label: "Monday" },
    { value: "Tuesday", label: "Tuesday" },
    { value: "Wednesday", label: "Wednesday" },
    { value: "Thursday", label: "Thursday" },
    { value: "Friday", label: "Friday" },
  ];

  // Load focused configurations
  const loadConfigurations = async () => {
    try {
      setLoading(true);
      const data = await getAllConfigurations();

      // Create a config object from the array of key-value pairs
      const configMap = {};
      data.forEach((item) => {
        configMap[item.key] = item.value;
      });

      // Update state with the values we're interested in
      if (configMap.CURRENT_SESSION) {
        setCurrentSession(configMap.CURRENT_SESSION);
        // Add current session to options if not already present
        setSessionOptions((prev) => {
          const option = {
            value: configMap.CURRENT_SESSION,
            label: configMap.CURRENT_SESSION,
          };
          return prev.some((opt) => opt.value === option.value)
            ? prev
            : [...prev, option];
        });
      }

      if (configMap.times) setTimes(configMap.times);
      if (configMap.days) setDays(configMap.days);
      if (configMap.possibleLabTimes)
        setPossibleLabTimes(configMap.possibleLabTimes);
    } catch (err) {
      console.error("Error loading configurations:", err);
      toast.error("Failed to load configurations");
    } finally {
      setLoading(false);
    }
  };

  // Initialize default configurations
  const handleInitializeConfigs = async () => {
    try {
      setLoading(true);
      await initializeConfigurations();
      toast.success("Configurations initialized successfully");
      await loadConfigurations(); // Reload configs after initialization
    } catch (err) {
      console.error("Error initializing configurations:", err);
      toast.error("Failed to initialize configurations");
    } finally {
      setLoading(false);
    }
  };

  // Save configurations
  const handleSaveConfigs = async () => {
    try {
      setLoading(true);

      // Save each configuration
      await setConfiguration("CURRENT_SESSION", currentSession);
      await setConfiguration("times", times);
      await setConfiguration("days", days);
      await setConfiguration("possibleLabTimes", possibleLabTimes);

      // Refresh configs after saving
      refreshConfigs();
      toast.success("Configurations saved successfully");
    } catch (err) {
      console.error("Error saving configurations:", err);
      toast.error("Failed to save configurations");
    } finally {
      setLoading(false);
    }
  };

  // Generate session options for the last 5 years and next 5 years
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    const sessionOpts = [];

    // Generate January and July sessions for past 5 and future 5 years
    for (let year = currentYear - 5; year <= currentYear + 5; year++) {
      sessionOpts.push({ value: `January ${year}`, label: `January ${year}` });
      sessionOpts.push({ value: `July ${year}`, label: `July ${year}` });
    }

    setSessionOptions(sessionOpts);
  }, []);

  // Load configurations on mount
  useEffect(() => {
    loadConfigurations();
  }, []);

  // Custom styles for react-select
  const customStyles = {
    control: (provided) => ({
      ...provided,
      borderRadius: "0.5rem",
      padding: "0.5rem",
      borderColor: "#CBD5E1",
      boxShadow: "none",
      "&:hover": {
        borderColor: "rgb(154, 77, 226)",
      },
    }),
    multiValue: (provided) => ({
      ...provided,
      background: "rgba(154, 77, 226, 0.15)",
      border: "1px solid rgba(154, 77, 226, 0.3)",
      color: "rgb(154, 77, 226)",
      fontSize: "0.95rem",
      fontWeight: "500",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginRight: "0.5rem",
      padding: "6px 16px 6px 6px",
      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.25)",
      cursor: "pointer",
      borderRadius: "6px",
    }),
    multiValueLabel: (provided) => ({
      ...provided,
      color: "rgb(154, 77, 226)",
      fontSize: "0.95rem",
      fontWeight: "500",
    }),
    multiValueRemove: (provided) => ({
      ...provided,
      color: "white",
      backgroundColor: "#DC2626",
      borderRadius: "50%",
      width: "20px",
      height: "20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      margin: "-8px -8px -8px 5px",
      "&:hover": {
        backgroundColor: "#B91C1C",
      },
    }),
  };

  // Handle select changes
  const handleSessionChange = (selectedOption) => {
    if (selectedOption) {
      setCurrentSession(selectedOption.value);
      // Add to options if custom
      setSessionOptions((prev) => {
        return prev.some((opt) => opt.value === selectedOption.value)
          ? prev
          : [...prev, selectedOption];
      });
    } else {
      setCurrentSession("");
    }
  };

  const handleTimesChange = (selectedOptions) => {
    setTimes(
      selectedOptions ? selectedOptions.map((option) => option.value) : []
    );
  };

  const handleDaysChange = (selectedOptions) => {
    setDays(
      selectedOptions ? selectedOptions.map((option) => option.value) : []
    );
  };

  const handleLabTimesChange = (selectedOptions) => {
    setPossibleLabTimes(
      selectedOptions ? selectedOptions.map((option) => option.value) : []
    );
  };

  // Format the selected values for the multi-selects
  const getSelectedTimeOptions = () =>
    times.map((time) => ({ value: time, label: `${time}:00`, isTime: true }));

  const getSelectedDayOptions = () =>
    days.map((day) => ({ value: day, label: day, isDay: true }));

  const getSelectedLabTimeOptions = () =>
    possibleLabTimes.map((time) => ({
      value: time,
      label: `${time}:00`,
      isLabTime: true,
    }));

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationDetails, setConfirmationDetails] = useState({
    title: "",
    body: "",
    confirmText: "",
    cancelText: "",
    onConfirm: () => {},
    onCancel: () => {},
    confirmIcon: "",
    red: 40,
    green: 167,
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

  // Example usage for Save Configurations
  const handleSaveConfigsWithConfirmation = () => {
    handleShowConfirmation(
      "Save Configurations",
      "Are you sure you want to save the current configurations?",
      "Save",
      "Cancel",
      handleSaveConfigs,
      "mdi-content-save",
      40,
      167,
      69
    );
  };

  // Example usage for Reset Configurations
  const handleResetConfigsWithConfirmation = () => {
    handleShowConfirmation(
      "Reset Configurations",
      "Are you sure you want to reset configurations to default?",
      "Reset",
      "Cancel",
      handleInitializeConfigs,
      "mdi-refresh",
      220,
      53,
      69
    );
  };

  return (
    <div className="card">
      <div className="card-view">
        <div className="card-control-container">
          <h4 className="card-name">
            <i className="card-icon mdi mdi-calendar-multiple-check"></i>
            Schedule Configuration
          </h4>
          <div className="card-control-button-container">
            <button
              className="card-control-button mdi mdi-refresh"
              onClick={handleResetConfigsWithConfirmation}
              disabled={loading}
            >
              Reset to Defaults
            </button>
            <button
              onClick={handleSaveConfigsWithConfirmation}
              disabled={loading}
              className="card-control-button mdi mdi-content-save"
            >
              Save Configuration
            </button>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3 text-muted">Loading configurations...</p>
          </div>
        ) : (
          <div style={{ maxHeight: "600px", overflowY: "auto" }}>
            <Form className="p-4">
              <Row className="mb-4">
                <Col md={12}>
                  <Form.Group>
                    <Form.Label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        color: "rgb(154, 77, 226)",
                        fontWeight: "500",
                      }}
                    >
                      <Icon
                        path={mdiCalendarCheck}
                        size={1}
                        color="rgb(154, 77, 226)"
                        style={{ marginRight: "8px" }}
                      />
                      Current Session
                    </Form.Label>
                    <CreatableSelect
                      value={
                        currentSession
                          ? { value: currentSession, label: currentSession }
                          : null
                      }
                      onChange={handleSessionChange}
                      options={sessionOptions}
                      placeholder="Select or create a session (e.g., January 2025)"
                      isClearable
                      styles={customStyles}
                      formatCreateLabel={(inputValue) =>
                        `Create "${inputValue}"`
                      }
                    />
                    <Form.Text className="text-muted mt-2">
                      Select or type to create a new academic session
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-4">
                <Col md={12}>
                  <Form.Group>
                    <Form.Label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        color: "rgb(154, 77, 226)",
                        fontWeight: "500",
                      }}
                    >
                      <Icon
                        path={mdiCalendarWeek}
                        size={1}
                        color="rgb(154, 77, 226)"
                        style={{ marginRight: "8px" }}
                      />
                      Working Days
                    </Form.Label>
                    <CreatableSelect
                      isMulti
                      value={getSelectedDayOptions()}
                      onChange={handleDaysChange}
                      options={dayOptions}
                      placeholder="Select working days"
                      styles={customStyles}
                      closeMenuOnSelect={false}
                      formatCreateLabel={(inputValue) =>
                        `Add "${inputValue}" as a day`
                      }
                    />
                    <Form.Text className="text-muted mt-2">
                      Select days or type to add custom days
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <Row className="mb-4">
                <Col md={12}>
                  <Form.Group>
                    <Form.Label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        color: "rgb(154, 77, 226)",
                        fontWeight: "500",
                      }}
                    >
                      <Icon
                        path={mdiClockOutline}
                        size={1}
                        color="rgb(154, 77, 226)"
                        style={{ marginRight: "8px" }}
                      />
                      Class Times
                    </Form.Label>
                    <Select
                      isMulti
                      value={getSelectedTimeOptions()}
                      onChange={handleTimesChange}
                      options={timeOptions}
                      placeholder="Select class times"
                      styles={customStyles}
                      closeMenuOnSelect={false}
                    />
                    <Form.Text className="text-muted mt-2">
                      Select one or more class starting times
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={12}>
                  <Form.Group>
                    <Form.Label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        color: "rgb(154, 77, 226)",
                        fontWeight: "500",
                      }}
                    >
                      <Icon
                        path={mdiSchool}
                        size={1}
                        color="rgb(154, 77, 226)"
                        style={{ marginRight: "8px" }}
                      />
                      Lab Times
                    </Form.Label>
                    <Select
                      isMulti
                      value={getSelectedLabTimeOptions()}
                      onChange={handleLabTimesChange}
                      options={timeOptions}
                      placeholder="Select lab times"
                      styles={customStyles}
                      closeMenuOnSelect={false}
                    />
                    <Form.Text className="text-muted mt-2">
                      Select one or more lab starting times
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>
            </Form>
          </div>
        )}
      </div>
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
};

export default ConfigManagement;
