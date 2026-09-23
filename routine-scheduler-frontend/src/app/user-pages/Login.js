import { useContext, useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button, Form } from "react-bootstrap";
import { UserContext } from "../App";
import { login } from "../api/auth";

export default function Login() {
  const { setUser } = useContext(UserContext);
  const username = useRef();
  const password = useRef();
  const [rememberMe, setRememberMe] = useState(false);
  const [isPwdVisible, setIsPwdVisible] = useState(false);

  useEffect(() => {
    const savedUsername = localStorage.getItem('rememberedUsername');
    if (savedUsername) {
      username.current.value = savedUsername;
      setRememberMe(true);
    }
  }, []);

  // Styles
  const styles = {
    card: {
      borderRadius: "20px",
      border: "none",
      boxShadow: "0 10px 30px rgba(0,0,0,0.08), 0 0 0 1px rgba(194, 137, 248, 0.1)",
      overflow: "hidden",
      backgroundColor: "#ffffff",
      transition: "transform 0.3s ease, box-shadow 0.3s ease",
      maxWidth: "450px",
      width: "100%",
      margin: "0 auto"
    },
    cardHeader: {
      background: "linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(174, 117, 228) 100%)",
      color: "white",
      padding: "28px 30px",
      fontWeight: "600",
      borderBottom: "none",
      position: "relative",
      overflow: "hidden"
    },
    button: {
      background: "linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(174, 117, 228) 100%)",
      border: "none",
      padding: "14px 28px",
      borderRadius: "12px",
      fontWeight: "600",
      boxShadow: "0 4px 12px rgba(174, 117, 228, 0.3)",
      transition: "all 0.3s ease",
      width: "100%",
      fontSize: "16px",
      letterSpacing: "0.5px"
    },
    formControl: {
      borderRadius: "12px",
      border: "1.5px solid rgba(194, 137, 248, 0.3)",
      boxShadow: "0 2px 5px rgba(194, 137, 248, 0.05)",
      padding: "14px 18px",
      fontSize: "16px",
      transition: "all 0.3s ease",
      backgroundColor: "#f8faff",
      marginBottom: "5px",
      height: "auto"
    },
    eyeIcon: {
      position: "absolute",
      right: "18px",
      top: "50%",
      transform: "translateY(-50%)",
      color: "rgb(174, 117, 228)",
      cursor: "pointer",
      fontSize: "18px",
      transition: "color 0.2s ease"
    }
  };

  const handleLogin = async () => {
    const usernameValue = username.current.value;
    const passwordValue = password.current.value;
    
    try {
      const res = await login(usernameValue, passwordValue);
      
      // Handle remember me functionality
      if (rememberMe) {
        localStorage.setItem('rememberedUsername', usernameValue);
      } else {
        localStorage.removeItem('rememberedUsername');
      }
      
      localStorage.setItem('token', res.token);
      setUser({ loggedIn: true, user: res.user });
    } catch (error) {
      console.log(error);
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

  const handleEyeIconHover = (e, isHover) => {
    e.target.style.color = isHover ? "rgb(154, 77, 226)" : "rgb(174, 117, 228)";
  };

  return (
    <div className="d-flex align-items-center auth px-0" style={{ minHeight: "100vh", background: "#f8faff" }}>
      <div className="row w-100 mx-0">
        <div className="col-lg-5 col-md-7 col-sm-9 mx-auto">
          <div style={styles.card} className="auth-form-light text-left py-0">
            
            {/* Header */}
            <div style={styles.cardHeader}>
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage: "url('data:image/svg+xml,%3Csvg width=\"100\" height=\"100\" viewBox=\"0 0 100 100\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cpath fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M11 100H89V0H11V100ZM0 0V100H100V0H0Z\" fill=\"white\" fill-opacity=\"0.05\"/%3E%3C/svg%3E'), url('data:image/svg+xml,%3Csvg width=\"20\" height=\"20\" viewBox=\"0 0 20 20\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Ccircle cx=\"10\" cy=\"10\" r=\"2\" fill=\"white\" fill-opacity=\"0.08\"/%3E%3C/svg%3E')",
                backgroundSize: "80px 80px, 20px 20px",
                opacity: 0.15
              }}></div>
              
              <div className="brand-logo d-flex align-items-center mb-3">
                <div style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: "15px",
                  boxShadow: "0 4px 10px rgba(0, 0, 0, 0.1)",
                  zIndex: 1
                }}>
                  <img
                    src={require("../../assets/images/logo.svg").default}
                    alt="logo"
                    style={{ width: "28px", height: "28px" }}
                  />
                </div>
                <h3 style={{ margin: 0, fontWeight: "700", fontSize: "22px", letterSpacing: "0.5px" }}>
                  Routine Scheduler
                </h3>
              </div>
              
              <h4 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "8px", position: "relative", zIndex: 1 }}>
                Welcome back!
              </h4>
              <h6 style={{ fontWeight: "400", opacity: "0.85", fontSize: "16px", position: "relative", zIndex: 1 }}>
                Sign in to continue to your account
              </h6>
            </div>

            {/* Form */}
            <div style={{ padding: "30px" }}>
              <Form className="pt-2">
                
                {/* Username Field */}
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontWeight: "500", color: "#444", marginBottom: "8px", display: "flex", alignItems: "center" }}>
                    <i className="mdi mdi-account-circle" style={{ color: "rgb(174, 117, 228)", marginRight: "8px" }}></i>
                    Username
                  </Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter your username"
                    style={styles.formControl}
                    ref={username}
                    className="custom-form-control"
                  />
                </Form.Group>

                {/* Password Field */}
                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: "500", color: "#444", marginBottom: "8px", display: "flex", alignItems: "center" }}>
                    <i className="mdi mdi-lock" style={{ color: "rgb(174, 117, 228)", marginRight: "8px" }}></i>
                    Password
                  </Form.Label>
                  <div style={{ position: "relative" }}>
                    <Form.Control
                      type={isPwdVisible ? "text" : "password"}
                      placeholder="Enter your password"
                      style={styles.formControl}
                      ref={password}
                      className="custom-form-control"
                    />
                    <i
                      className={`mdi ${isPwdVisible ? 'mdi-eye-off' : 'mdi-eye'}`}
                      style={styles.eyeIcon}
                      onClick={() => setIsPwdVisible(!isPwdVisible)}
                      onMouseOver={(e) => handleEyeIconHover(e, true)}
                      onMouseOut={(e) => handleEyeIconHover(e, false)}
                    />
                  </div>
                </Form.Group>

                {/* Remember Me Checkbox */}
                <Form.Group className="mb-4">
                  <div 
                    className="custom-checkbox-wrapper d-flex align-items-center"
                    style={{
                      background: "linear-gradient(135deg, rgba(194, 137, 248, 0.05) 0%, rgba(174, 117, 228, 0.05) 100%)",
                      border: "1.5px solid rgba(194, 137, 248, 0.2)",
                      borderRadius: "12px",
                      padding: "12px 16px",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      position: "relative",
                      overflow: "hidden"
                    }}
                    onClick={() => setRememberMe(!rememberMe)}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = "rgba(194, 137, 248, 0.4)";
                      e.currentTarget.style.background = "linear-gradient(135deg, rgba(194, 137, 248, 0.08) 0%, rgba(174, 117, 228, 0.08) 100%)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(194, 137, 248, 0.15)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = "rgba(194, 137, 248, 0.2)";
                      e.currentTarget.style.background = "linear-gradient(135deg, rgba(194, 137, 248, 0.05) 0%, rgba(174, 117, 228, 0.05) 100%)";
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    {/* Custom Checkbox */}
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "6px",
                        border: rememberMe ? "2px solid rgb(174, 117, 228)" : "2px solid rgba(194, 137, 248, 0.4)",
                        background: rememberMe 
                          ? "linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(174, 117, 228) 100%)" 
                          : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: "12px",
                        transition: "all 0.3s ease",
                        boxShadow: rememberMe ? "0 2px 8px rgba(174, 117, 228, 0.3)" : "none",
                        position: "relative"
                      }}
                    >
                      {rememberMe && (
                        <i 
                          className="mdi mdi-check"
                          style={{
                            color: "white",
                            fontSize: "14px",
                            fontWeight: "bold",
                            animation: "checkboxPulse 0.3s ease"
                          }}
                        />
                      )}
                    </div>
                    
                    {/* Label */}
                    <div className="d-flex align-items-center">
                      <i 
                        className="mdi mdi-account-check" 
                        style={{ 
                          color: rememberMe ? "rgb(174, 117, 228)" : "rgba(174, 117, 228, 0.7)",
                          fontSize: "16px",
                          transition: "color 0.3s ease",
                          marginRight: "8px"
                        }}
                      />
                      <span 
                        style={{ 
                          fontWeight: "500", 
                          color: rememberMe ? "#333" : "#666", 
                          fontSize: "14px",
                          transition: "color 0.3s ease",
                          userSelect: "none"
                        }}
                      >
                        Remember me
                      </span>
                    </div>
                    
                    {/* Ripple effect background */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundImage: rememberMe 
                          ? "linear-gradient(45deg, rgba(194, 137, 248, 0.02) 25%, transparent 25%, transparent 75%, rgba(194, 137, 248, 0.02) 75%)"
                          : "none",
                        backgroundSize: "20px 20px",
                        opacity: 0.3,
                        borderRadius: "12px",
                        pointerEvents: "none"
                      }}
                    />
                  </div>
                </Form.Group>

                {/* Login Button */}
                <div className="mt-4 mb-3">
                  <Button
                    style={styles.button}
                    className="d-flex align-items-center justify-content-center"
                    onClick={handleLogin}
                    onMouseOver={(e) => handleButtonHover(e, true)}
                    onMouseOut={(e) => handleButtonHover(e, false)}
                  >
                    <i className="mdi mdi-login me-2"></i>
                    SIGN IN
                  </Button>
                </div>

                {/* Forgot Password Link */}
                <div className="d-flex justify-content-center align-items-center">
                  <Link
                    to="/auth/forgot-password"
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
                    <i className="mdi mdi-lock-question" style={{ marginRight: "4px" }}></i>
                    Forgot password?
                  </Link>
                </div>
              </Form>
            </div>
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
        .form-check-input:checked {
          background-color: rgb(174, 117, 228) !important;
          border-color: rgb(174, 117, 228) !important;
        }
        .form-check-input:focus {
          border-color: rgb(194, 137, 248) !important;
          box-shadow: 0 0 0 0.25rem rgba(194, 137, 248, 0.25) !important;
        }
        .form-check-label {
          cursor: pointer !important;
        }
        
        /* Custom checkbox animations */
        @keyframes checkboxPulse {
          0% {
            transform: scale(0) rotate(-45deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.2) rotate(-45deg);
            opacity: 0.8;
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
        
        .custom-checkbox-wrapper {
          position: relative;
        }
        
        .custom-checkbox-wrapper::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.05) 100%);
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
        }
        
        .custom-checkbox-wrapper:hover::before {
          opacity: 1;
        }
        
        .custom-checkbox-wrapper:active {
          transform: translateY(0px) !important;
        }
      `}</style>
    </div>
  );
}
