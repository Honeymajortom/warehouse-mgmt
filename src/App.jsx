import { useState, useEffect } from "react";
import { onAuth, logoutAdmin } from "./services/authService";
import AuthPage     from "./pages/AuthPage";
import Sidebar       from "./components/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import CustomersPage from "./pages/CustomersPage";
import VendorsPage   from "./pages/VendorsPage";
import ProductsPage  from "./pages/ProductsPage";
import PurchasePage  from "./pages/PurchasePage";
import GRNPage       from "./pages/GRNPage";
import PutAwayPage   from "./pages/PutAwayPage";
import InventoryPage from "./pages/InventoryPage";
import PickingPage   from "./pages/PickingPage";
import PackingPage   from "./pages/PackingPage";
import ReturnsPage   from "./pages/ReturnsPage";
import ReportsPage   from "./pages/ReportsPage";

const PAGE_TITLES = {
  dashboard:"Dashboard", customers:"Customers", vendors:"Vendors",   products:"Products",
  purchase:"Purchase",   grn:"GRN Process",     putaway:"Put-Away",  inventory:"Inventory",
  picking:"Picking",     packing:"Packing",     returns:"Returns",   reports:"Reports",
};

export default function App() {
  const [active, setActive]             = useState("dashboard");
  const [isDark, setIsDark]             = useState(true);
  const [user, setUser]                 = useState(undefined); // undefined = loading, null = signed out
  const [packOrder, setPackOrder]       = useState(null);
  const [shippedOrder, setShippedOrder] = useState(null);
  const [signingOut, setSigningOut]     = useState(false);

  // Apply theme
  useEffect(() => {
    document.documentElement.classList.toggle("light", !isDark);
  }, [isDark]);

  // Auth state listener — fires once on mount, then on any auth change
  useEffect(() => {
    const unsub = onAuth(u => setUser(u));
    return () => unsub();
  }, []);

  const goToPack = (order) => {
    setPackOrder(order);
    setActive("packing");
  };
  const goToReturns = (order) => {
    setShippedOrder(order);
    setActive("returns");
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await logoutAdmin();
    setSigningOut(false);
    setActive("dashboard");
  };

  const renderPage = () => {
    switch(active) {
      case "dashboard":  return <DashboardPage/>;
      case "customers":  return <CustomersPage/>;
      case "vendors":    return <VendorsPage/>;
      case "products":   return <ProductsPage/>;
      case "purchase":   return <PurchasePage/>;
      case "grn":        return <GRNPage/>;
      case "putaway":    return <PutAwayPage/>;
      case "inventory":  return <InventoryPage/>;
      case "picking":    return <PickingPage goToPack={goToPack}/>;
      case "packing":    return <PackingPage packOrder={packOrder} clearPackOrder={()=>setPackOrder(null)} goToReturns={goToReturns}/>;
      case "returns":    return <ReturnsPage shippedOrder={shippedOrder} clearShipped={()=>setShippedOrder(null)}/>;
      case "reports":    return <ReportsPage/>;
      default:           return <DashboardPage/>;
    }
  };

  // ── Loading splash (waiting for Firebase onAuthStateChanged) ──
  if (user === undefined) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center", background:"var(--bg-base)", gap:16 }}>
        <div style={{
          width:52, height:52, borderRadius:14,
          background:"linear-gradient(135deg,var(--accent),var(--accent2))",
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:22,
        }}>📦</div>
        <div className="spin" style={{ width:24, height:24,
          border:"2px solid var(--border)", borderTopColor:"var(--accent)", borderRadius:"50%" }}/>
        <p style={{ color:"var(--text-secondary)", fontSize:13, margin:0 }}>Loading MIDC IMS…</p>
      </div>
    );
  }

  // ── Not signed in → show Auth page ───────────────────────────
  if (!user) {
    return <AuthPage isDark={isDark} setIsDark={setIsDark}/>;
  }

  // ── Signed in → full app ──────────────────────────────────────
  return (
    <div className="ims-app-shell">
      <Sidebar active={active} setActive={setActive}/>

      <div className="ims-main-col">
        {/* Topbar */}
        <div className="ims-topbar">
          <span className="t-muted"    style={{fontSize:12}}>MIDC IMS</span>
          <span className="t-muted"    style={{fontSize:12}}>›</span>
          <span className="t-primary"  style={{fontSize:13,fontWeight:600,fontFamily:"'Syne',sans-serif"}}>
            {PAGE_TITLES[active]}
          </span>

          <div style={{marginLeft:"auto", display:"flex", alignItems:"center", gap:10}}>
            {/* Firebase indicator */}
            <div className="ims-topbar-badge"><div className="ims-dot-green"/>Firebase</div>

            {/* Reports */}
            <button className="ims-topbar-btn-accent" onClick={()=>setActive("reports")}>⬇ Reports</button>

            {/* Signed-in user */}
            <div style={{
              display:"flex", alignItems:"center", gap:8,
              background:"var(--bg-elevated)", border:"1px solid var(--border)",
              borderRadius:10, padding:"4px 12px 4px 6px",
            }}>
              <div style={{
                width:26, height:26, borderRadius:"50%",
                background:"linear-gradient(135deg,var(--accent),var(--accent2))",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:12, fontWeight:700, color:"#fff", flexShrink:0,
              }}>
                {(user.displayName || user.email || "A")[0].toUpperCase()}
              </div>
              <span className="t-primary" style={{fontSize:12, fontWeight:600, maxWidth:120,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                {user.displayName || user.email}
              </span>
            </div>

            {/* Sign out */}
            <button onClick={handleSignOut} disabled={signingOut}
              className="ims-btn ims-btn-ghost"
              style={{padding:"5px 12px", fontSize:12, opacity:signingOut?0.6:1}}>
              {signingOut ? "…" : "Sign Out"}
            </button>

            {/* Theme toggle */}
            <div className="ims-theme-toggle">
              <button className={`ims-theme-btn${isDark?" active":""}`} onClick={()=>setIsDark(true)}>🌙 Dark</button>
              <button className={`ims-theme-btn${!isDark?" active":""}`} onClick={()=>setIsDark(false)}>☀️ Light</button>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="ims-page-content" key={isDark?"dark":"light"}>
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
