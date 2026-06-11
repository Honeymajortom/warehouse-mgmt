  import { useState, useEffect } from "react";
  import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
  import { getDashboardStats, getRecent } from "../services/firestoreService";
  import { cacheManager, cacheKeys, CACHE_TTL } from "../services/cacheManager";
  import {
  People,
  Inventory2,
  CurrencyRupee,
  Warehouse,
  Warning,
  FactCheck
} from "@mui/icons-material";

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active||!payload?.length) return null;
    return (
      <div className="ims-elevated" style={{ padding:"8px 12px", fontSize:12 }}>
        <p className="t-accent" style={{ fontWeight:600, marginBottom:4 }}>{label}</p>
        {payload.map((p,i)=><p key={i} className="t-primary">{p.name}: {p.value}</p>)}
      </div>
    );
  };

  export default function DashboardPage() {
    const [stats,setStats] = useState(null);
    const [chartData,setChartData] = useState({ purchases:[], inventory:[], returns:0 });
    const [loading,setL] = useState(true);
    const [cacheStatus, setCacheStatus] = useState(null);

    useEffect(()=>{
      const loadDashboard = async () => {
        try {
          // Load stats from cache or fetch fresh
          const statsResult = await cacheManager.getOrFetch(
            cacheKeys.dashboardStats(),
            () => getDashboardStats(),
            CACHE_TTL.LONG  // 15 min cache
          );

          // Load chart data from cache or fetch fresh
          const chartsResult = await cacheManager.getOrFetch(
            cacheKeys.dashboardCharts(),
            () => Promise.all([
              getRecent("purchases", 50),
              getRecent("inventory", 50)
            ]),
            CACHE_TTL.MEDIUM  // 5 min cache
          );

          setStats(statsResult.data);
          const [recentPurchases, recentInventory] = chartsResult.data;
          setChartData({ 
            purchases: recentPurchases, 
            inventory: recentInventory, 
            returns: statsResult.data.returnCount 
          });
          
          // Show cache status
          setCacheStatus({
            stats: statsResult.source,
            charts: chartsResult.source
          });
          
          setL(false); 
        } catch (error) {
          console.error("Dashboard load error:", error);
          setL(false);
        }
      };

      loadDashboard();
    },[]);

    const totalCost = stats?.totalCost || 0;
    const totalStock = stats?.totalStock || 0;
    const lowStock = stats?.lowStock || 0;
    const pendingGrn = stats?.pendingGrn || 0;

  const kpis = [
    {
      label:"Customers",
      value:stats?.customerCount || 0,
      iconBg:"var(--badge-cyan-bg)",
      iconColor:"var(--badge-cyan-fg)",
      icon: People
    },
    {
      label:"Products",
      value:stats?.productCount || 0,
      iconBg:"var(--badge-tel-bg)",
      iconColor:"var(--badge-tel-fg)",
      icon: Inventory2
    },
    {
      label:"Purchase Amt",
      value:`₹${(totalCost || 0).toLocaleString()}`,
      iconBg:"var(--badge-vio-bg)",
      iconColor:"var(--badge-vio-fg)",
      icon: CurrencyRupee
    },
    {
      label:"Stock Value",
      value:`₹${(totalStock || 0).toLocaleString()}`,
      iconBg:"var(--badge-amb-bg)",
      iconColor:"var(--badge-amb-fg)",
      icon: Warehouse
    },
    {
      label:"Low Stock",
      value:lowStock || 0,
      iconBg:(lowStock || 0)>0?"var(--badge-red-bg)":"var(--badge-grn-bg)",
      iconColor:(lowStock || 0)>0?"var(--badge-red-fg)":"var(--badge-grn-fg)",
      icon: Warning
    },
    {
      label:"Pending GRN",
      value:pendingGrn || 0,
      iconBg:"var(--badge-cyan-bg)",
      iconColor:"var(--badge-cyan-fg)",
      icon: FactCheck
    },
  ];

    const productUnits={};
    chartData.purchases.forEach(p=>{productUnits[p.productName]=(productUnits[p.productName]||0)+Number(p.units||0);});
    const topProducts=Object.entries(productUnits).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,units])=>({name:name.length>8?name.slice(0,8)+"…":name,units}));
    const stockData=chartData.inventory.slice(0,6).map(i=>({name:(i.productName||"").length>8?(i.productName||"").slice(0,8)+"…":(i.productName||""),stock:Number(i.availableStock||0)}));
    const notifications=[
      {msg:"Firebase connected ✓",                      colorClass:"t-success"},
      {msg:`${lowStock || 0} product(s) low on stock`,        colorClass:(lowStock || 0)>0?"t-danger":"t-success"},
      {msg:`${pendingGrn || 0} GRN entries pending put-away`, colorClass:(pendingGrn || 0)>0?"t-warning":"t-success"},
      {msg:`${chartData.returns} return(s) logged`,       colorClass:"t-accent"},
      ...(cacheStatus ? [{msg:`✓ Loaded from cache`, colorClass:"t-success"}] : []),
    ];

    if(loading) return(
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:300}}>
        <div className="spin" style={{width:24,height:24,border:"2px solid var(--border)",borderTopColor:"var(--accent)",borderRadius:"50%"}}/>
        <span className="t-secondary" style={{marginLeft:12}}>Loading…</span>
      </div>
    );

    return (
      <div style={{display:"flex",flexDirection:"column",gap:24}}>
        <div>
          <h1 className="gradient-text" style={{fontSize:30,fontWeight:600,margin:0,fontFamily:"'Syne',sans-serif"}}>Dashboard</h1>
          <p className="t-secondary" style={{fontSize:13,marginTop:6}}>3APJ Warehouse Management System</p>
        </div>

        <div className="ims-kpi-grid">
    {kpis.map((k,i)=> {
    const Icon = k.icon;

    return (
      <div key={k.label} className="ims-kpi-card fade-up" style={{animationDelay:`${i*50}ms`}}>
        <div
          style={{
            width:34,
            height:34,
            borderRadius:10,
            background:k.iconBg,
            color:k.iconColor,
            display:"flex",
            alignItems:"center",
            justifyContent:"center",
            marginBottom:10
          }}
        >
          <Icon fontSize="small" />
        </div>

        <div className="t-primary" style={{fontSize:20,fontWeight:600,fontFamily:"'Syne',sans-serif"}}>
          {k.value}
        </div>

        <div className="t-secondary" style={{fontSize:11,fontWeight:500,marginTop:4}}>
          {k.label}
        </div>
      </div>
    );
  })}
        </div>

        <div className="ims-chart-grid">
          <div className="ims-chart-card">
            <p className="ims-section-title">Top Purchased Products</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={topProducts} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                <XAxis dataKey="name" tick={{fontSize:11,fill:"var(--text-secondary)"}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:11,fill:"var(--text-secondary)"}} axisLine={false} tickLine={false}/>
                <Tooltip content={<CustomTooltip/>}/>
                <defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)"/><stop offset="100%" stopColor="var(--accent-dim)"/></linearGradient></defs>
                <Bar dataKey="units" fill="url(#barGrad)" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="ims-chart-card">
            <p className="ims-section-title">Available Stock</p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={stockData}>
                <defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent2)" stopOpacity={0.35}/><stop offset="100%" stopColor="var(--accent2)" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                <XAxis dataKey="name" tick={{fontSize:11,fill:"var(--text-secondary)"}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:11,fill:"var(--text-secondary)"}} axisLine={false} tickLine={false}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Area type="monotone" dataKey="stock" stroke="var(--accent2)" strokeWidth={2} fill="url(#areaGrad)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="ims-chart-card">
            <p className="ims-section-title">System Status</p>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {notifications.map((n,i)=>(
                <div key={i} className="ims-info-row">
                  <div style={{width:7,height:7,borderRadius:"50%",background:"currentColor",flexShrink:0,marginTop:4}} className={n.colorClass}/>
                  <span className="t-secondary" style={{fontSize:12,lineHeight:1.5}}>{n.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Footer Credit */}
  <div style={{
    textAlign: "center",
    padding: "16px 0",
    fontSize: "14px",
    color: "var(--text-primary)",
    borderTop: "1px solid var(--border)",
    marginTop: "30px",
    opacity: 0.8
  }}>
    © {new Date().getFullYear()} 3APJ WMS · Engineered by Amit Waghmare & Ajay Rathod · Powered by Firebase
  </div>
      </div>
    );
  }
