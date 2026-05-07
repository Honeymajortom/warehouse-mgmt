export default function PendingApprovalPage() {
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
          background: "var(--badge-amber-bg)",
          border: "1px solid var(--badge-amber-br)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
        }}
      >
        ⏳
      </div>
      <div style={{ textAlign: "center" }}>
        <h2 style={{ color: "var(--text-primary)", margin: "0 0 8px", fontSize: 22 }}>Pending Approval</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, maxWidth: 400, margin: 0 }}>
          Your account request has been submitted and is currently under review. An administrator will approve or reject your access shortly.
        </p>
      </div>
      <div
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "16px 24px",
          minWidth: 280,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Status</span>
          <span style={{ color: "var(--warning)", fontWeight: 700, fontSize: 13 }}>⏳ PENDING</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Next Step</span>
          <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Wait for admin review</span>
        </div>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 12, margin: 0 }}>
        Contact your administrator if this takes longer than 24 hours.
      </p>
    </div>
  );
}