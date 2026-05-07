import { useState } from "react";

function Section({ title, children }) {
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 24,
        marginBottom: 20,
      }}
    >
      <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "var(--text-primary)", fontWeight: 700 }}>{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export default function ProfilePage({ user }) {
  const [activeTab, setActiveTab] = useState("info");

  if (!user) return null;

  const roleColors = {
    admin: { bg: "var(--badge-purple-bg)", text: "var(--badge-purple-fg)", border: "var(--badge-purple-br)" },
    operator: { bg: "var(--badge-blue-bg)", text: "var(--badge-blue-fg)", border: "var(--badge-blue-br)" },
    viewer: { bg: "var(--badge-gray-bg)", text: "var(--badge-gray-fg)", border: "var(--badge-gray-br)" },
  };

  const statusColors = {
    approved: { bg: "var(--badge-green-bg)", text: "var(--badge-green-fg)", border: "var(--badge-green-br)" },
    pending: { bg: "var(--badge-amber-bg)", text: "var(--badge-amber-fg)", border: "var(--badge-amber-br)" },
    rejected: { bg: "var(--badge-red-bg)", text: "var(--badge-red-fg)", border: "var(--badge-red-br)" },
  };

  const rc = roleColors[user.role] || roleColors.viewer;
  const sc = statusColors[user.status] || statusColors.pending;

  const formatDate = (d) => (d ? new Date(d).toLocaleString() : "—");

  // Parse permissions into modules
  const modulePermissions = {};
  user.permissions?.forEach((perm) => {
    const [mod, action] = perm.split(":");
    if (!modulePermissions[mod]) modulePermissions[mod] = [];
    modulePermissions[mod].push(action);
  });

  const moduleNames = {
    dashboard: "Dashboard",
    customers: "Customers",
    vendors: "Vendors",
    products: "Products",
    purchase: "Purchase",
    grn: "GRN",
    putaway: "Put-Away",
    inventory: "Inventory",
    picking: "Picking",
    packing: "Packing",
    returns: "Returns",
    reports: "Reports",
    users: "User Management",
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 22, color: "var(--text-primary)" }}>My Profile</h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>View your account details and permissions.</p>
      </div>

      {/* Header Card */}
      <div
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 24,
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            background: "linear-gradient(135deg, var(--accent), var(--accent2))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            fontWeight: 800,
            color: "#fff",
            flexShrink: 0,
          }}
        >
          {(user.name || user.email || "U")[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 20, color: "var(--text-primary)" }}>{user.name || "User"}</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                padding: "3px 10px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                background: rc.bg,
                color: rc.text,
                border: `1px solid ${rc.border}`,
              }}
            >
              {user.role === "admin" && "🔒"} {user.role === "operator" && "⚙️"} {user.role === "viewer" && "👁️"} {user.role}
            </span>
            <span
              style={{
                padding: "3px 10px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                background: sc.bg,
                color: sc.text,
                border: `1px solid ${sc.border}`,
              }}
            >
              {user.status === "approved" && "✓"} {user.status === "pending" && "⏳"} {user.status === "rejected" && "✕"} {user.status}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 1 }}>
        {[
          { id: "info", label: "Account Info" },
          { id: "permissions", label: "Permissions" },
          { id: "activity", label: "Activity" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "8px 16px",
              borderRadius: "8px 8px 0 0",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
              background: "transparent",
              color: activeTab === tab.id ? "var(--accent-text)" : "var(--text-muted)",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "info" && (
        <Section title="Account Information">
          <InfoRow label="Full Name" value={user.name || "—"} />
          <InfoRow label="Email" value={user.email || "—"} />
          <InfoRow label="Account ID" value={user.id || "—"} />
          <InfoRow label="Role" value={user.role?.toUpperCase() || "—"} />
          <InfoRow label="Status" value={user.status?.toUpperCase() || "—"} />
          <InfoRow label="Member Since" value={formatDate(user.createdAt || user.requestedAt)} />
          <InfoRow label="Last Login" value={formatDate(user.lastLogin)} />
          {user.approvedAt && <InfoRow label="Approved On" value={formatDate(user.approvedAt)} />}
        </Section>
      )}

      {activeTab === "permissions" && (
        <Section title="My Permissions">
          {user.role === "admin" || user.permissions?.includes("*") ? (
            <div
              style={{
                padding: "16px 20px",
                background: "var(--badge-purple-bg)",
                border: "1px solid var(--badge-purple-br)",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span style={{ fontSize: 24 }}>🔐</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--badge-purple-fg)" }}>Super Administrator</div>
                <div style={{ fontSize: 12, color: "var(--badge-purple-fg)", opacity: 0.8, marginTop: 2 }}>
                  You have unrestricted access to all modules and operations.
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Object.entries(modulePermissions).map(([mod, actions]) => (
                <div
                  key={mod}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    background: "var(--bg-base)",
                    borderRadius: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ width: 140, flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{moduleNames[mod] || mod}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {actions.map((a) => (
                      <span
                        key={a}
                        style={{
                          padding: "3px 10px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          background: "var(--accent-bg)",
                          color: "var(--accent-text)",
                          border: "1px solid var(--accent-br)",
                        }}
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {Object.keys(modulePermissions).length === 0 && (
                <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 20 }}>No specific permissions assigned yet.</p>
              )}
            </div>
          )}
        </Section>
      )}

      {activeTab === "activity" && (
        <Section title="Recent Activity">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(user.activity || []).slice().reverse().slice(0, 20).map((act, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  background: "var(--bg-base)",
                  borderRadius: 10,
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "var(--text-secondary)", flex: 1 }}>{act.action}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{formatDate(act.timestamp)}</span>
              </div>
            ))}
            {(!user.activity || user.activity.length === 0) && (
              <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 20 }}>No activity recorded yet.</p>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}