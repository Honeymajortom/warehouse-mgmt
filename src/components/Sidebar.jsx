import { useState } from "react";
import {
  Dashboard,
  People,
  LocalShipping,
  Inventory2,
  ShoppingCart,
  FactCheck,
  MoveToInbox,
  Warehouse,
  Checklist,
  AllInbox,
  AssignmentReturn,
  BarChart,
  Shield,
  AccountCircle
} from "@mui/icons-material";

const NAV = [
  { id: "dashboard", label: "Dashboard",   icon: Dashboard,  perm: null },
  { id: "customers", label: "Customers",   icon: People,     perm: "customers:view" },
  { id: "vendors",   label: "Vendors",     icon: LocalShipping, perm: "vendors:view" },
  { id: "products",  label: "Products",    icon: Inventory2, perm: "products:view" },
  { id: "purchase",  label: "Purchase",    icon: ShoppingCart, perm: "purchase:view" },
  { id: "grn",       label: "GRN Process", icon: FactCheck,  perm: "grn:view" },
  { id: "putaway",   label: "Put-Away",    icon: MoveToInbox, perm: "putaway:view" },
  { id: "inventory", label: "Inventory",   icon: Warehouse,  perm: "inventory:view" },
  { id: "picking",   label: "Picking",     icon: Checklist,  perm: "picking:view" },
  { id: "packing",   label: "Packing",     icon: AllInbox,   perm: "packing:view" },
  { id: "returns",   label: "Returns",     icon: AssignmentReturn, perm: "returns:view" },
  { id: "reports",   label: "Reports",     icon: BarChart,   perm: "reports:view" },
];

const ADMIN_NAV = [
  { id: "users", label: "User Management", icon: Shield, perm: "users:manage" },
];

const PROFILE_NAV = [
  { id: "profile", label: "My Profile", icon: AccountCircle, perm: null },
];

export default function Sidebar({ active, setActive, user, hasPermission }) {
  const [collapsed, setCollapsed] = useState(false);

  // Filter visible items based on permissions
  const visibleNav = NAV.filter(item => {
    if (!item.perm) return true;
    if (user?.role === 'admin') return true;
    return hasPermission?.(item.perm);
  });

  const isAdmin = user?.role === 'admin';

  return (
    <aside className="ims-sidebar" style={{ width: collapsed ? 60 : 220, minWidth: collapsed ? 60 : 220 }}>
      <div className="ims-sidebar-logo">
        {!collapsed && (
          <div>
            <div className="gradient-text" style={{ fontSize: 16, fontWeight: 600, letterSpacing: "0.12em", fontFamily: "'Syne',sans-serif" }}>3APJ WMS</div>
            <div className="t-muted" style={{ fontSize: 11, marginTop: 2 }}>Advanced Warehouse Management System</div>
          </div>
        )}
        <button className="ims-btn ims-btn-ghost" onClick={() => setCollapsed(p => !p)}
          style={{ width: 28, height: 28, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: collapsed ? "auto" : 0, fontSize: 13 }}>
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "6px 0" }}>
        {/* Main Navigation */}
        {visibleNav.map(item => {
          const Icon = item.icon;
          const isActive = active === item.id;

          return (
            <button
              key={item.id}
              className={`ims-nav-btn${isActive ? " active" : ""}`}
              onClick={() => setActive(item.id)}
              title={collapsed ? item.label : ""}
              style={{
                padding: collapsed ? "11px 0" : "11px 16px",
                justifyContent: collapsed ? "center" : "flex-start"
              }}
            >
              <span style={{ width: 20, display: "flex", justifyContent: "center" }}>
                <Icon fontSize="small" />
              </span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}

        {/* Admin Section */}
        {isAdmin && (
          <>
            {!collapsed && (
              <div className="ims-sidebar-divider" style={{ 
                margin: "12px 16px 8px", 
                paddingTop: 12, 
                borderTop: "1px solid var(--border)",
                fontSize: 10, 
                fontWeight: 700, 
                textTransform: "uppercase", 
                letterSpacing: "0.1em", 
                color: "var(--text-muted)" 
              }}>
                Administration
              </div>
            )}
            {ADMIN_NAV.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={`ims-nav-btn${active === item.id ? " active" : ""}`}
                  onClick={() => setActive(item.id)}
                  title={collapsed ? item.label : ""}
                  style={{
                    padding: collapsed ? "11px 0" : "11px 16px",
                    justifyContent: collapsed ? "center" : "flex-start"
                  }}
                >
                  <span style={{ width: 20, display: "flex", justifyContent: "center" }}>
                    <Icon fontSize="small" />
                  </span>
                  {!collapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </>
        )}

        {/* Profile Section */}
        {!collapsed && (
          <div className="ims-sidebar-divider" style={{ 
            margin: "12px 16px 8px", 
            paddingTop: 12, 
            borderTop: "1px solid var(--border)",
            fontSize: 10, 
            fontWeight: 700, 
            textTransform: "uppercase", 
            letterSpacing: "0.1em", 
            color: "var(--text-muted)" 
          }}>
            Account
          </div>
        )}
        {PROFILE_NAV.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`ims-nav-btn${active === item.id ? " active" : ""}`}
              onClick={() => setActive(item.id)}
              title={collapsed ? item.label : ""}
              style={{
                padding: collapsed ? "11px 0" : "11px 16px",
                justifyContent: collapsed ? "center" : "flex-start"
              }}
            >
              <span style={{ width: 20, display: "flex", justifyContent: "center" }}>
                <Icon fontSize="small" />
              </span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer - Dynamic User Info */}
      {!collapsed && (
        <div className="ims-sidebar-footer">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ 
              width: 30, 
              height: 30, 
              borderRadius: "50%", 
              background: "linear-gradient(135deg,var(--grad-text-from),var(--grad-text-to))", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              fontSize: 12, 
              fontWeight: 700, 
              color: "#fff", 
              flexShrink: 0 
            }}>
              {(user?.name || user?.email || "A")[0].toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p className="t-primary" style={{ margin: 0, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name || user?.email || "Admin"}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ 
                  fontSize: 10, 
                  fontWeight: 700, 
                  textTransform: 'uppercase',
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: user?.role === 'admin' ? 'var(--badge-purple-bg)' : 
                             user?.role === 'operator' ? 'var(--badge-blue-bg)' : 'var(--badge-gray-bg)',
                  color: user?.role === 'admin' ? 'var(--badge-purple-fg)' : 
                         user?.role === 'operator' ? 'var(--badge-blue-fg)' : 'var(--badge-gray-fg)',
                  border: `1px solid ${user?.role === 'admin' ? 'var(--badge-purple-br)' : 
                          user?.role === 'operator' ? 'var(--badge-blue-br)' : 'var(--badge-gray-br)'}`,
                }}>
                  {user?.role || "admin"}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {user?.status === 'approved' ? '● Active' : user?.status === 'pending' ? '⏳ Pending' : '✕ Rejected'}
                </span>
              </div>
            </div>
            <div className="ims-dot-green" style={{ marginLeft: "auto" }} />
          </div>
        </div>
      )}
    </aside>
  );
}