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
    BarChart
  } from "@mui/icons-material";

  const NAV = [
    { id:"dashboard", label:"Dashboard",   icon: Dashboard },
    { id:"customers", label:"Customers",   icon: People },
    { id:"vendors",   label:"Vendors",     icon: LocalShipping },
    { id:"products",  label:"Products",    icon: Inventory2 },
    { id:"purchase",  label:"Purchase",    icon: ShoppingCart },
    { id:"grn",       label:"GRN Process", icon: FactCheck },
    { id:"putaway",   label:"Put-Away",    icon: MoveToInbox },
    { id:"inventory", label:"Inventory",   icon: Warehouse },
    { id:"picking",   label:"Picking",     icon: Checklist },
    { id:"packing",   label:"Packing",     icon: AllInbox },
    { id:"returns",   label:"Returns",     icon: AssignmentReturn },
    { id:"reports",   label:"Reports",     icon: BarChart },
  ];

  export default function Sidebar({ active, setActive }) {
    const [collapsed, setCollapsed] = useState(false);
    return (
      <aside className="ims-sidebar" style={{ width:collapsed?60:220, minWidth:collapsed?60:220 }}>
        <div className="ims-sidebar-logo">
          {!collapsed && (
            <div>
              <div className="gradient-text" style={{ fontSize:16, fontWeight:600, letterSpacing:"0.12em", fontFamily:"'Syne',sans-serif" }}>3APJ WMS</div>
              <div className="t-muted" style={{ fontSize:11, marginTop:2 }}>Advanced Warehouse Management System</div>
            </div>
          )}
          <button className="ims-btn ims-btn-ghost" onClick={() => setCollapsed(p=>!p)}
            style={{ width:28, height:28, padding:0, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginLeft:collapsed?"auto":0, fontSize:13 }}>
            {collapsed?"›":"‹"}
          </button>
        </div>

        <nav style={{ flex:1, overflowY:"auto", overflowX:"hidden", padding:"6px 0" }}>
          {NAV.map(item => {
    const Icon = item.icon;

    return (
      <button
        key={item.id}
        className={`ims-nav-btn${active===item.id?" active":""}`}
        onClick={() => setActive(item.id)}
        title={collapsed ? item.label : ""}
        style={{
          padding:collapsed?"11px 0":"11px 16px",
          justifyContent:collapsed?"center":"flex-start"
        }}
      >
        <span style={{ width:20, display:"flex", justifyContent:"center" }}>
          <Icon fontSize="small" />
        </span>

        {!collapsed && <span>{item.label}</span>}
      </button>
    );
  })}
        </nav>

        {!collapsed && (
          <div className="ims-sidebar-footer">
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:30, height:30, borderRadius:"50%", background:"linear-gradient(135deg,var(--grad-text-from),var(--grad-text-to))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#fff", flexShrink:0 }}>A</div>
              <div>
                <p className="t-primary" style={{ margin:0, fontSize:12, fontWeight:600 }}>Admin</p>
                <p className="t-muted"   style={{ margin:0, fontSize:11 }}>Warehouse Mgr</p>
              </div>
              <div className="ims-dot-green" style={{ marginLeft:"auto" }}/>
            </div>
          </div>
        )}
      </aside>
    );
  }
    