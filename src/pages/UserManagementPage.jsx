import { useState, useEffect } from "react";
import { getAllUsers, approveUser, rejectUser, updateUser, updateUserPermissions, deleteUser } from "../services/authService";

function StatusBadge({ status }) {
  const colors = {
    approved: { bg: "var(--badge-green-bg)", text: "var(--badge-green-fg)", border: "var(--badge-green-br)" },
    pending: { bg: "var(--badge-amber-bg)", text: "var(--badge-amber-fg)", border: "var(--badge-amber-br)" },
    rejected: { bg: "var(--badge-red-bg)", text: "var(--badge-red-fg)", border: "var(--badge-red-br)" },
  };
  const c = colors[status] || colors.pending;
  return (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: "uppercase", background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {status === "approved" && "✓"} {status === "pending" && "⏳"} {status === "rejected" && "✕"} {status}
    </span>
  );
}

function RoleBadge({ role }) {
  const colors = {
    admin: { bg: "var(--badge-purple-bg)", text: "var(--badge-purple-fg)", border: "var(--badge-purple-br)" },
    operator: { bg: "var(--badge-blue-bg)", text: "var(--badge-blue-fg)", border: "var(--badge-blue-br)" },
    viewer: { bg: "var(--badge-gray-bg)", text: "var(--badge-gray-fg)", border: "var(--badge-gray-br)" },
  };
  const c = colors[role] || colors.viewer;
  return (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: "uppercase", background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {role === "admin" && "🔒"} {role === "operator" && "⚙️"} {role === "viewer" && "👁️"} {role}
    </span>
  );
}

function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText, confirmColor }) {
  if (!isOpen) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 400 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "var(--text-primary)" }}>{title}</h3>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: confirmColor || "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function PermissionMatrix({ user, onSave, onCancel }) {
  const MODULES = [
    { key: "dashboard", label: "Dashboard" },
    { key: "customers", label: "Customers" },
    { key: "vendors", label: "Vendors" },
    { key: "products", label: "Products" },
    { key: "purchase", label: "Purchase" },
    { key: "grn", label: "GRN" },
    { key: "putaway", label: "Put-Away" },
    { key: "inventory", label: "Inventory" },
    { key: "picking", label: "Picking" },
    { key: "packing", label: "Packing" },
    { key: "returns", label: "Returns" },
    { key: "reports", label: "Reports" },
  ];

  const ACTIONS = ["view", "create", "edit", "execute", "approve", "export"];

  const [perms, setPerms] = useState(() => {
    if (user.permissions?.includes("*")) {
      return MODULES.flatMap((m) => ACTIONS.map((a) => `${m.key}:${a}`));
    }
    return user.permissions || [];
  });

  const [activeModule, setActiveModule] = useState(MODULES[0].key);

  const togglePerm = (perm) => {
    setPerms((prev) => (prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]));
  };

  const toggleModule = (modKey, checked) => {
    const modulePerms = ACTIONS.map((a) => `${modKey}:${a}`);
    if (checked) {
      setPerms((prev) => [...new Set([...prev, ...modulePerms])]);
    } else {
      setPerms((prev) => prev.filter((p) => !modulePerms.includes(p)));
    }
  };

  const isModuleChecked = (modKey) => ACTIONS.every((a) => perms.includes(`${modKey}:${a}`));
  const isModuleIndeterminate = (modKey) => {
    const hasSome = ACTIONS.some((a) => perms.includes(`${modKey}:${a}`));
    return hasSome && !isModuleChecked(modKey);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 20, width: "100%", maxWidth: 720, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px 28px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h3 style={{ margin: "0 0 4px", fontSize: 18, color: "var(--text-primary)" }}>Assign Permissions</h3>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>Configuring access for <strong>{user.name}</strong></p>
            </div>
            <button onClick={onCancel} style={{ background: "none", border: "none", fontSize: 20, color: "var(--text-muted)", cursor: "pointer" }}>✕</button>
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 400 }}>
          <div style={{ width: 200, borderRight: "1px solid var(--border)", overflowY: "auto", padding: "12px 8px" }}>
            {MODULES.map((mod) => {
              const count = ACTIONS.filter((a) => perms.includes(`${mod.key}:${a}`)).length;
              const active = activeModule === mod.key;
              return (
                <button key={mod.key} onClick={() => setActiveModule(mod.key)} style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 10, marginBottom: 4, border: "none", background: active ? "var(--accent-bg)" : "transparent", cursor: "pointer", fontFamily: "inherit" }}>
                  <div style={{ fontSize: 13, fontWeight: active ? 700 : 600, color: active ? "var(--accent-text)" : "var(--text-primary)" }}>{mod.label}</div>
                  {count > 0 && <div style={{ fontSize: 10, color: active ? "var(--accent-text)" : "var(--text-muted)", marginTop: 2 }}>{count} permission{count !== 1 ? "s" : ""}</div>}
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
            {MODULES.filter((m) => m.key === activeModule).map((mod) => (
              <div key={mod.key}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <h4 style={{ margin: 0, fontSize: 16, color: "var(--text-primary)" }}>{mod.label}</h4>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", userSelect: "none" }}>
                    <input type="checkbox" checked={isModuleChecked(mod.key)} ref={(el) => { if (el) el.indeterminate = isModuleIndeterminate(mod.key); }} onChange={(e) => toggleModule(mod.key, e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--accent)", cursor: "pointer" }} />
                    Grant All
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 }}>
                  {ACTIONS.map((action) => {
                    const permKey = `${mod.key}:${action}`;
                    const checked = perms.includes(permKey);
                    return (
                      <label key={action} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: checked ? "var(--accent-bg)" : "var(--bg-base)", border: `1px solid ${checked ? "var(--accent-br)" : "var(--border)"}`, borderRadius: 12, cursor: "pointer", userSelect: "none" }}>
                        <input type="checkbox" checked={checked} onChange={() => togglePerm(permKey)} style={{ width: 18, height: 18, accentColor: "var(--accent)", cursor: "pointer", flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: checked ? "var(--accent-text)" : "var(--text-primary)", textTransform: "capitalize" }}>{action}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "16px 28px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{perms.length} total permission{perms.length !== 1 ? "s" : ""} selected</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onCancel} style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button onClick={() => onSave(perms)} style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Update Permissions</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UserManagementPage({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [toast, setToast] = useState(null);

  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleApprove = async () => {
    if (!modal?.user) return;
    try {
      await approveUser(modal.user.id, currentUser?.id);
      showToast(`${modal.user.name} has been approved.`);
      setModal(null);
      loadUsers();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleReject = async () => {
    if (!modal?.user) return;
    try {
      await rejectUser(modal.user.id, currentUser?.id);
      showToast(`${modal.user.name} has been rejected.`);
      setModal(null);
      loadUsers();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleSaveEdit = async () => {
    if (!modal?.user) return;
    try {
      await updateUser(modal.user.id, {
        name: editForm.name,
        role: editForm.role,
        status: editForm.status,
      });
      showToast("User updated successfully.");
      setModal(null);
      loadUsers();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleSavePermissions = async (permissions) => {
    if (!modal?.user) return;
    try {
      await updateUserPermissions(modal.user.id, permissions);
      showToast(`Permissions updated for ${modal.user.name}.`);
      setModal(null);
      loadUsers();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleDelete = async () => {
    if (!modal?.user) return;
    try {
      await deleteUser(modal.user.id);
      showToast(`${modal.user.name} has been deleted.`);
      setModal(null);
      loadUsers();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const filtered = users.filter((u) => {
    if (filter !== "all" && u.status !== filter) return false;
    if (search && !u.name?.toLowerCase().includes(search.toLowerCase()) && !u.email?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spin" style={{ width: 24, height: 24, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%" }} />
      </div>
    );
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 80, right: 24, zIndex: 1000, padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: toast.type === "success" ? "var(--badge-green-bg)" : "var(--badge-red-bg)", color: toast.type === "success" ? "var(--badge-green-fg)" : "var(--badge-red-fg)", border: `1px solid ${toast.type === "success" ? "var(--badge-green-br)" : "var(--badge-red-br)"}`, boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
          {toast.message}
        </div>
      )}

      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, color: "var(--text-primary)" }}>User Management</h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>Manage access requests, roles, and permissions.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["all", "pending", "approved", "rejected"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: filter === f ? "var(--accent)" : "var(--bg-elevated)", color: filter === f ? "#fff" : "var(--text-secondary)", fontSize: 12, fontWeight: 700, textTransform: "capitalize", cursor: "pointer", fontFamily: "inherit" }}>
              {f} ({f === "all" ? users.length : users.filter((u) => u.status === f).length})
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input type="text" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", maxWidth: 320, padding: "9px 14px", borderRadius: 10, border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--input-color)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
      </div>

      <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-base)" }}>
              {["Name", "Email", "Role", "Status", "Permissions", "Actions"].map((h) => (
                <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,var(--accent),var(--accent2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                      {(u.name || u.email || "U")[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{u.name || "Unknown"}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>ID: {u.id.slice(-6)}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "14px 16px", color: "var(--text-secondary)" }}>{u.email}</td>
                <td style={{ padding: "14px 16px" }}><RoleBadge role={u.role} /></td>
                <td style={{ padding: "14px 16px" }}><StatusBadge status={u.status} /></td>
                <td style={{ padding: "14px 16px" }}>
                  {u.role === "admin" ? (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>All access</span>
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{u.permissions?.length || 0} permissions</span>
                  )}
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {u.status === "pending" && (
                      <>
                        <button onClick={() => setModal({ type: "approve", user: u })} style={{ padding: "5px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, color: "#fff", background: "var(--success)", cursor: "pointer", fontFamily: "inherit" }}>✓ Approve</button>
                        <button onClick={() => setModal({ type: "reject", user: u })} style={{ padding: "5px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, color: "#fff", background: "var(--danger)", cursor: "pointer", fontFamily: "inherit" }}>✕ Reject</button>
                      </>
                    )}
                    <button onClick={() => { setEditForm({ name: u.name, role: u.role, status: u.status }); setModal({ type: "edit", user: u }); }} style={{ padding: "5px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, color: "#fff", background: "var(--accent)", cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
                    {u.role !== "admin" && (
                      <button onClick={() => setModal({ type: "permissions", user: u })} style={{ padding: "5px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, color: "#fff", background: "var(--accent2)", cursor: "pointer", fontFamily: "inherit" }}>Permissions</button>
                    )}
                    {/* DELETE BUTTON — Admin only, cannot delete self or other admins */}
                    {isAdmin && u.role !== "admin" && u.id !== currentUser?.id && (
                      <button onClick={() => setModal({ type: "delete", user: u })} style={{ padding: "5px 10px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, color: "#fff", background: "var(--danger)", cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>No users found matching your criteria.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Confirm Modals */}
      <ConfirmModal isOpen={modal?.type === "approve"} title="Approve User" message={`Are you sure you want to approve ${modal?.user?.name}? They will gain access based on their assigned role.`} confirmText="Approve Access" confirmColor="var(--success)" onConfirm={handleApprove} onCancel={() => setModal(null)} />
      <ConfirmModal isOpen={modal?.type === "reject"} title="Reject User" message={`Are you sure you want to reject ${modal?.user?.name}? They will be denied access.`} confirmText="Reject Access" confirmColor="var(--danger)" onConfirm={handleReject} onCancel={() => setModal(null)} />
      
      {/* DELETE CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={modal?.type === "delete"}
        title="Delete User"
        message={`Are you sure you want to permanently delete ${modal?.user?.name}? This action cannot be undone.`}
        confirmText="Delete User"
        confirmColor="var(--danger)"
        onConfirm={handleDelete}
        onCancel={() => setModal(null)}
      />

      {/* Edit Modal */}
      {modal?.type === "edit" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 420 }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 18, color: "var(--text-primary)" }}>Edit User</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6, display: "block" }}>Full Name</label>
                <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--input-color)", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6, display: "block" }}>Role</label>
                <select value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--input-color)", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}>
                  <option value="operator">Operator</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6, display: "block" }}>Status</label>
                <select value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--input-border)", background: "var(--input-bg)", color: "var(--input-color)", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button onClick={() => setModal(null)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                <button onClick={handleSaveEdit} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {modal?.type === "permissions" && <PermissionMatrix user={modal.user} onSave={handleSavePermissions} onCancel={() => setModal(null)} />}
    </div>
  );
}