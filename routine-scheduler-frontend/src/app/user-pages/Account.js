export default function Account() {
  const storedName = localStorage.getItem('rememberedUsername');
  const user = {
    name: storedName,
    role: 'Administrator',
    department: 'Computer Science and Engineering',
  };

  return (
    <div>
      <div className="row">
        <div className="col-12 grid-margin">
          <div className="card" style={{
            borderRadius: "12px",
            boxShadow: "0 6px 16px rgba(0,0,0,0.1)",
            border: "none",
            transition: "all 0.3s ease",
            overflow: "hidden"
          }}>
            <div className="card-header" style={{
              background: "linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(154, 77, 226) 100%)",
              height: "75px",
              display: "flex",
              alignItems: "center",
              position: "relative",
              padding: "0 30px",
              boxShadow: "0 4px 20px rgba(154, 77, 226, 0.2)"
            }}>
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
                <i className="mdi mdi-account" style={{ fontSize: "24px", color: "white" }}></i>
              </div>
              <span style={{
                fontSize: "19px",
                fontWeight: "700",
                letterSpacing: "0.5px",
                zIndex: 1,
                color: "white",
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.1)"
              }}>Account Details</span>
            </div>
            <div className="card-body" style={{
              padding: "30px",
              position: "relative",
              backgroundColor: "rgba(255, 255, 255, 0.97)"
            }}>
              <div className="row align-items-center">
                <div className="col-md-2 text-center mb-4 mb-md-0">
                  <div style={{
                    width: 90,
                    height: 90,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(174, 117, 228) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto',
                    boxShadow: '0 4px 16px rgba(154, 77, 226, 0.15)'
                  }}>
                    <i className="mdi mdi-account" style={{ fontSize: 48, color: '#fff' }}></i>
                  </div>
                </div>
                <div className="col-md-10">
                  <h4 style={{ color: '#6f42c1', fontWeight: 700 }}>{user.name}</h4>
                  <p style={{ color: '#555', marginBottom: 4 }}><i className="mdi mdi-briefcase-outline mr-2"></i> {user.role}</p>
                  <p style={{ color: '#555', marginBottom: 12 }}><i className="mdi mdi-domain mr-2"></i> {user.department}</p>
                  <button className="btn btn-gradient-primary" style={{ borderRadius: 8, fontWeight: 600, padding: '10px 28px' }} disabled>
                    <i className="mdi mdi-account-edit mr-2"></i>
                    Edit Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 