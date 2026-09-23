import React, { useState } from "react";
import { Alert, Button, Col, Form, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { changePassword } from "../api/auth";

const ChangePassword = () => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear specific error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }

    if (!formData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (formData.newPassword.length < 6) {
      newErrors.newPassword = 'New password must be at least 6 characters long';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (formData.currentPassword && formData.newPassword && 
        formData.currentPassword === formData.newPassword) {
      newErrors.newPassword = 'New password must be different from current password';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const data = await changePassword(
        formData.currentPassword,
        formData.newPassword
      );

      Swal.fire({
        title: 'Success!',
        text: 'Password changed successfully',
        icon: 'success',
        confirmButtonColor: 'rgb(174, 117, 228)',
        confirmButtonText: 'OK'
      }).then(() => {
        // Clear form
        setFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      });
    } catch (error) {
      console.error('Password change error:', error);
      Swal.fire({
        title: 'Error!',
        text: error.message || 'Failed to change password',
        icon: 'error',
        confirmButtonColor: 'rgb(174, 117, 228)',
        confirmButtonText: 'OK'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="d-flex align-items-center auth px-0" style={{ minHeight: "100vh" }}>
      <div className="row w-100 mx-0">
        <div className="col-lg-4 mx-auto">
          <div className="card text-left py-5 px-4 px-sm-5">
            <div className="brand-logo text-center mb-4">
              <img 
                src={require("../../assets/images/logo.svg").default} 
                alt="logo" 
                style={{ width: "80px", height: "80px" }}
              />
              <h4 className="mt-3" style={{ color: "rgb(174, 117, 228)", fontWeight: "600" }}>
                Change Password
              </h4>
              <p className="text-muted">Update your account password</p>
            </div>
            
            <Form className="pt-3" onSubmit={handleSubmit}>
              {/* Current Password */}
              <div className="form-group mb-3">
                <label style={{ fontWeight: "500", color: "#333" }}>
                  <i className="mdi mdi-lock" style={{ marginRight: "8px", color: "rgb(174, 117, 228)" }}></i>
                  Current Password
                </label>
                <Form.Control
                  type="password"
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleChange}
                  className={`form-control form-control-lg custom-form-control ${errors.currentPassword ? 'is-invalid' : ''}`}
                  placeholder="Enter current password"
                  style={{
                    padding: "12px 16px",
                    fontSize: "14px",
                    border: "2px solid #e1e5e9",
                    borderRadius: "8px",
                    transition: "all 0.2s ease"
                  }}
                />
                {errors.currentPassword && (
                  <div className="invalid-feedback d-block" style={{ fontSize: "12px", color: "#dc3545" }}>
                    {errors.currentPassword}
                  </div>
                )}
              </div>

              {/* New Password */}
              <div className="form-group mb-3">
                <label style={{ fontWeight: "500", color: "#333" }}>
                  <i className="mdi mdi-lock-plus" style={{ marginRight: "8px", color: "rgb(174, 117, 228)" }}></i>
                  New Password
                </label>
                <Form.Control
                  type="password"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  className={`form-control form-control-lg custom-form-control ${errors.newPassword ? 'is-invalid' : ''}`}
                  placeholder="Enter new password"
                  style={{
                    padding: "12px 16px",
                    fontSize: "14px",
                    border: "2px solid #e1e5e9",
                    borderRadius: "8px",
                    transition: "all 0.2s ease"
                  }}
                />
                {errors.newPassword && (
                  <div className="invalid-feedback d-block" style={{ fontSize: "12px", color: "#dc3545" }}>
                    {errors.newPassword}
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="form-group mb-4">
                <label style={{ fontWeight: "500", color: "#333" }}>
                  <i className="mdi mdi-lock-check" style={{ marginRight: "8px", color: "rgb(174, 117, 228)" }}></i>
                  Confirm New Password
                </label>
                <Form.Control
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`form-control form-control-lg custom-form-control ${errors.confirmPassword ? 'is-invalid' : ''}`}
                  placeholder="Confirm new password"
                  style={{
                    padding: "12px 16px",
                    fontSize: "14px",
                    border: "2px solid #e1e5e9",
                    borderRadius: "8px",
                    transition: "all 0.2s ease"
                  }}
                />
                {errors.confirmPassword && (
                  <div className="invalid-feedback d-block" style={{ fontSize: "12px", color: "#dc3545" }}>
                    {errors.confirmPassword}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="mt-3">
                <Button 
                  type="submit"
                  disabled={isLoading}
                  className="btn btn-block btn-primary btn-lg font-weight-medium auth-form-btn"
                  style={{
                    background: "linear-gradient(135deg, rgb(174, 117, 228), rgb(194, 137, 248))",
                    border: "none",
                    borderRadius: "8px",
                    padding: "12px 24px",
                    fontSize: "14px",
                    fontWeight: "600",
                    width: "100%",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    transition: "all 0.3s ease",
                    boxShadow: "0 4px 15px rgba(174, 117, 228, 0.3)"
                  }}
                  onMouseOver={(e) => {
                    e.target.style.transform = "translateY(-1px)";
                    e.target.style.boxShadow = "0 6px 20px rgba(174, 117, 228, 0.4)";
                  }}
                  onMouseOut={(e) => {
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "0 4px 15px rgba(174, 117, 228, 0.3)";
                  }}
                >
                  {isLoading ? (
                    <>
                      <i className="mdi mdi-loading mdi-spin me-2"></i>
                      UPDATING...
                    </>
                  ) : (
                    <>
                      <i className="mdi mdi-check me-2"></i>
                      UPDATE PASSWORD
                    </>
                  )}
                </Button>
              </div>

              {/* Back to Dashboard Link */}
              <div className="text-center mt-4">
                <Link
                  to="/dashboard"
                  style={{ 
                    color: "rgb(174, 117, 228)", 
                    textDecoration: "none", 
                    fontWeight: "500",
                    transition: "all 0.2s ease",
                    fontSize: "14px"
                  }}
                  onMouseOver={(e) => {
                    e.target.style.color = "rgb(154, 77, 226)";
                    e.target.style.textDecoration = "underline";
                  }}
                  onMouseOut={(e) => {
                    e.target.style.color = "rgb(174, 117, 228)";
                    e.target.style.textDecoration = "none";
                  }}
                >
                  <i className="mdi mdi-arrow-left" style={{ marginRight: "4px" }}></i>
                  Back to Dashboard
                </Link>
              </div>
            </Form>
          </div>
        </div>
      </div>

      {/* Custom Styles */}
      <style jsx="true">{`
        .custom-form-control:focus {
          border-color: rgb(194, 137, 248) !important;
          box-shadow: 0 0 0 3px rgba(194, 137, 248, 0.15), 0 1px 3px rgba(16, 24, 40, 0.1) !important;
          background: linear-gradient(to bottom, #ffffff, #fcf9ff) !important;
        }
        .custom-form-control:hover {
          border-color: rgb(194, 137, 248) !important;
          box-shadow: 0 0 0 3px rgba(194, 137, 248, 0.1), 0 1px 3px rgba(16, 24, 40, 0.1) !important;
        }
        .auth {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
        }
        .card {
          border: none;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
        }
      `}</style>
    </div>
  );
};

export default ChangePassword;
