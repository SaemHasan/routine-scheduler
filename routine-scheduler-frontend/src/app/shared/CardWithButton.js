export default function CardWithButton(
  { bgColor, disabled, icon, title, subtitle, status, onClick } = {
    bgColor: "info",
    disabled: false,
    icon: " mdi-autorenew",
    title: "Title",
    subtitle: "Subtitle",
    status: "Status",
    onClick: () => {},
  }
) {
  return (
    <div className="row mb-4">
      <div className="col-12">
        <div
          className="card"
          style={{
            borderRadius: "16px",
            boxShadow: "0 8px 32px rgba(174, 117, 228, 0.15)",
            border: "2px solid rgb(194, 137, 248)",
            background: "white",
            color: "#5e257e",
            padding: 0,
            overflow: "hidden",
            position: "relative",
            transition: "all 0.3s ease"
          }}
        >
          <div className="card-body" style={{ padding: "2rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.2rem" }}>
              <h4 className="font-weight-normal mb-0" style={{ fontWeight: 700, fontSize: "1.3rem", letterSpacing: ".2px" }}>{title}</h4>
              <button
                disabled={disabled}
                type="button"
                className="btn btn-rounded d-flex align-items-center justify-content-center"
                style={{
                  background: disabled ? "#eee" : "linear-gradient(135deg, rgb(194, 137, 248) 0%, rgb(154, 77, 226) 100%)",
                  color: disabled ? "#aaa" : "white",
                  border: "none",
                  boxShadow: disabled ? "none" : "0 4px 10px rgba(154, 77, 226, 0.15)",
                  borderRadius: "50%",
                  width: 44,
                  height: 44,
                  fontSize: 22,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s"
                }}
                onClick={onClick}
                title={title}
              >
                <i className={`mdi ${icon}`} style={{ fontSize: 28 }}></i>
              </button>
            </div>
            <h2 className="mb-3" style={{ fontWeight: 700, color: "rgb(154, 77, 226)", fontSize: "2rem" }}>{subtitle}</h2>
            <h6 className="card-text" style={{ fontWeight: 500, color: "#5e257e", opacity: 0.85 }}>{status}</h6>
          </div>
        </div>
      </div>
    </div>
  );
}
