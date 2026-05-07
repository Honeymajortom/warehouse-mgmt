export default function AccessDeniedPage() {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: "var(--badge-red-bg)",
          border: "1px solid var(--badge-red-br)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
        }}
      >
        🚫
      </div>
      <div style={{ textAlign: "center" }}>
        <h2 style={{ color: "var(--text-primary)", margin: "0 0 8px", fontSize: 22 }}>Access Denied</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, maxWidth: 400, margin: 0 }}>
          Your account request has been rejected by the administrator. Contact your system admin if you believe this is an error.
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: "10px 24px",
          background: "var(--danger)",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Return to Login
      </button>
    </div>
  );
}