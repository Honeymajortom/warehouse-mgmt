import { useState, useEffect, useCallback } from "react";
import {
  onAuth,
  logoutAdmin,
  getUserProfile,
  loginUser,      // NEW
  requestAccess,  // NEW
} from "./services/authService";

// Pages
import AuthPage from "./pages/AuthPage";
import Sidebar from "./components/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import CustomersPage from "./pages/CustomersPage";
import VendorsPage from "./pages/VendorsPage";
import ProductsPage from "./pages/ProductsPage";
import PurchasePage from "./pages/PurchasePage";
import GRNPage from "./pages/GRNPage";
import PutAwayPage from "./pages/PutAwayPage";
import InventoryPage from "./pages/InventoryPage";
import PickingPage from "./pages/PickingPage";
import PackingPage from "./pages/PackingPage";
import ReturnsPage from "./pages/ReturnsPage";
import ReportsPage from "./pages/ReportsPage";
import ProfilePage from "./pages/ProfilePage";
import UserManagementPage from "./pages/UserManagementPage";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import AccessDeniedPage from "./pages/AccessDeniedPage";

const PAGE_TITLES = {
  dashboard: "Dashboard",
  customers: "Customers",
  vendors: "Vendors",
  products: "Products",
  purchase: "Purchase",
  grn: "GRN Process",
  putaway: "Put-Away",
  inventory: "Inventory",
  picking: "Picking",
  packing: "Packing",
  returns: "Returns",
  reports: "Reports",
  profile: "My Profile",
  users: "User Management",
};

const PAGE_PERMISSIONS = {
  dashboard: null,
  customers: "customers:view",
  vendors: "vendors:view",
  products: "products:view",
  purchase: "purchase:view",
  grn: "grn:view",
  putaway: "putaway:view",
  inventory: "inventory:view",
  picking: "picking:view",
  packing: "packing:view",
  returns: "returns:view",
  reports: "reports:view",
  profile: null,
  users: "users:manage",
};

export default function App() {
  const [active, setActive] = useState("dashboard");
  const [isDark, setIsDark] = useState(true);
  const [user, setUser] = useState(undefined); // undefined = loading, null = not logged in
  const [packOrder, setPackOrder] = useState(null);
  const [shippedOrder, setShippedOrder] = useState(null);
  const [signingOut, setSigningOut] = useState(false);

  // Theme
  useEffect(() => {
    document.documentElement.classList.toggle("light", !isDark);
  }, [isDark]);

  // Auth listener — fetches full profile from Firestore
  useEffect(() => {
    const unsub = onAuth(async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        return;
      }

      try {
        const profile = await getUserProfile(firebaseUser.uid);
        if (profile) {
          setUser(profile);
        } else {
          // User authenticated but no profile in Firestore
          setUser({
            id: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
            email: firebaseUser.email,
            role: "operator",
            status: "approved",
            permissions: [],
          });
        }
      } catch (err) {
        console.error("Failed to load user profile:", err);
        setUser(null);
      }
    });

    return () => unsub();
  }, []);

  // Permission helpers
  const hasPermission = useCallback(
    (perm) => {
      if (!user) return false;
      if (user.role === "admin" || user.permissions?.includes("*")) return true;
      if (!perm) return true;
      return user.permissions?.includes(perm);
    },
    [user]
  );

  const canAccessPage = useCallback(
    (page) => {
      const required = PAGE_PERMISSIONS[page];
      return hasPermission(required);
    },
    [hasPermission]
  );

  const navigateTo = useCallback(
    (page) => {
      if (!canAccessPage(page)) return;
      setActive(page);
    },
    [canAccessPage]
  );

  const goToPack = (order) => {
    if (!canAccessPage("packing")) return;
    setPackOrder(order);
    setActive("packing");
  };

  const goToReturns = (order) => {
    if (!canAccessPage("returns")) return;
    setShippedOrder(order);
    setActive("returns");
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await logoutAdmin();
    setSigningOut(false);
    setUser(null);
    setActive("dashboard");
  };

  // Render page based on user status and permissions
  const renderPage = () => {
    if (user?.status === "pending") return <PendingApprovalPage />;
    if (user?.status === "rejected") return <AccessDeniedPage />;

    const required = PAGE_PERMISSIONS[active];
    if (required && !hasPermission(required)) {
      return (
        <div
          style={{
            minHeight: "60vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ fontSize: 48 }}>🔒</div>
          <h2 style={{ color: "var(--text-primary)", margin: 0 }}>Access Restricted</h2>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: 14,
              textAlign: "center",
              maxWidth: 400,
            }}
          >
            You don't have permission to access <strong>{PAGE_TITLES[active]}</strong>.
          </p>
          <button
            onClick={() => setActive("dashboard")}
            className="ims-btn ims-btn-primary"
            style={{ padding: "10px 20px", fontSize: 13 }}
          >
            Back to Dashboard
          </button>
        </div>
      );
    }

    switch (active) {
      case "dashboard":
        return <DashboardPage />;
      case "customers":
        return <CustomersPage />;
      case "vendors":
        return <VendorsPage />;
      case "products":
        return <ProductsPage />;
      case "purchase":
        return <PurchasePage />;
      case "grn":
        return <GRNPage />;
      case "putaway":
        return <PutAwayPage />;
      case "inventory":
        return <InventoryPage />;
      case "picking":
        return <PickingPage goToPack={goToPack} />;
      case "packing":
        return (
          <PackingPage
            packOrder={packOrder}
            clearPackOrder={() => setPackOrder(null)}
            goToReturns={goToReturns}
          />
        );
      case "returns":
        return (
          <ReturnsPage
            shippedOrder={shippedOrder}
            clearShipped={() => setShippedOrder(null)}
          />
        );
      case "reports":
        return <ReportsPage />;
      case "profile":
        return <ProfilePage user={user} />;
      case "users":
        return <UserManagementPage currentUser={user} />;
      default:
        return <DashboardPage />;
    }
  };

  // Loading state
  if (user === undefined) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-base)",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: "linear-gradient(135deg,var(--accent),var(--accent2))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
          }}
        >
          📦
        </div>
        <div
          className="spin"
          style={{
            width: 24,
            height: 24,
            border: "2px solid var(--border)",
            borderTopColor: "var(--accent)",
            borderRadius: "50%",
          }}
        />
        <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0 }}>
          Loading 3APJ WMS…
        </p>
      </div>
    );
  }

  // Not logged in — show auth page
  if (!user) {
    return <AuthPage isDark={isDark} setIsDark={setIsDark} />;
  }

  // Logged in — full app
  return (
    <div className="ims-app-shell">
      <Sidebar
        active={active}
        setActive={navigateTo}
        user={user}
        hasPermission={hasPermission}
      />

      <div className="ims-main-col">
        {/* Topbar */}
        <div className="ims-topbar">
          <span className="t-muted" style={{ fontSize: 12 }}>
            3APJ WMS
          </span>
          <span className="t-muted" style={{ fontSize: 12 }}>
            ›
          </span>
          <span
            className="t-primary"
            style={{
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "'Syne',sans-serif",
            }}
          >
            {PAGE_TITLES[active]}
          </span>

          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {/* Role Badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                background:
                  user.role === "admin"
                    ? "var(--badge-purple-bg)"
                    : user.role === "operator"
                    ? "var(--badge-blue-bg)"
                    : "var(--badge-gray-bg)",
                color:
                  user.role === "admin"
                    ? "var(--badge-purple-fg)"
                    : user.role === "operator"
                    ? "var(--badge-blue-fg)"
                    : "var(--badge-gray-fg)",
                border: `1px solid ${
                  user.role === "admin"
                    ? "var(--badge-purple-br)"
                    : user.role === "operator"
                    ? "var(--badge-blue-br)"
                    : "var(--badge-gray-br)"
                }`,
              }}
            >
              {user.role === "admin" && "🔒"}
              {user.role === "operator" && "⚙️"}
              {user.role === "viewer" && "👁️"} {user.role}
            </div>

            <div className="ims-topbar-badge">
              <div className="ims-dot-green" />
              Firebase
            </div>

            <button
              className="ims-topbar-btn-accent"
              onClick={() => navigateTo("reports")}
              disabled={!canAccessPage("reports")}
              style={{
                opacity: canAccessPage("reports") ? 1 : 0.4,
                cursor: canAccessPage("reports") ? "pointer" : "not-allowed",
              }}
            >
              ⬇ Reports
            </button>

            {/* Profile Button */}
            <button
              onClick={() => navigateTo("profile")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background:
                  active === "profile"
                    ? "var(--accent-bg)"
                    : "var(--bg-elevated)",
                border: `1px solid ${
                  active === "profile"
                    ? "var(--accent-br)"
                    : "var(--border)"
                }`,
                borderRadius: 10,
                padding: "4px 12px 4px 6px",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg,var(--accent),var(--accent2))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {(user.name || user.email || "A")[0].toUpperCase()}
              </div>
              <span
                className="t-primary"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  maxWidth: 120,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user.name || user.email}
              </span>
            </button>

            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="ims-btn ims-btn-ghost"
              style={{
                padding: "5px 12px",
                fontSize: 12,
                opacity: signingOut ? 0.6 : 1,
              }}
            >
              {signingOut ? "…" : "Sign Out"}
            </button>

            <div className="ims-theme-toggle">
              <button
                className={`ims-theme-btn${isDark ? " active" : ""}`}
                onClick={() => setIsDark(true)}
              >
                🌙 Dark
              </button>
              <button
                className={`ims-theme-btn${!isDark ? " active" : ""}`}
                onClick={() => setIsDark(false)}
              >
                ☀️ Light
              </button>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="ims-page-content" key={isDark ? "dark" : "light"}>
          {renderPage()}
        </main>
      </div>
    </div>
  );
}