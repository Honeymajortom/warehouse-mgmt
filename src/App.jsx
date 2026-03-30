import { useState, useEffect } from "react";
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
  const [active, setActive]           = useState("dashboard");
  const [isDark, setIsDark]           = useState(true);
  // Shared state: Picking → Packing
  const [packOrder, setPackOrder]     = useState(null); // { orderId, customerName, skuId, productName, orderedQty, pickedQty }
  // Shared state: Packing → Returns (shipped orders)
  const [shippedOrder, setShippedOrder] = useState(null);

  useEffect(() => {
    document.documentElement.classList.toggle("light", !isDark);
  }, [isDark]);

  // Navigate to packing with prefilled order
  const goToPack = (order) => {
    setPackOrder(order);
    setActive("packing");
  };

  // Navigate to returns with shipped order
  const goToReturns = (order) => {
    setShippedOrder(order);
    setActive("returns");
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

  return (
    <div className="ims-app-shell">
      <Sidebar active={active} setActive={setActive}/>
      <div className="ims-main-col">
        <div className="ims-topbar">
          <span className="t-muted" style={{fontSize:12}}>MIDC IMS</span>
          <span className="t-muted" style={{fontSize:12}}>›</span>
          <span className="t-primary" style={{fontSize:13,fontWeight:200,fontFamily:"'Syne',sans-serif"}}>{PAGE_TITLES[active]}</span>
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
            <div className="ims-topbar-badge"><div className="ims-dot-green"/>Firebase</div>
            <button className="ims-topbar-btn-accent" onClick={()=>setActive("reports")}>⬇ Reports</button>
            <div className="ims-theme-toggle">
              <button className={`ims-theme-btn${isDark?" active":""}`} onClick={()=>setIsDark(true)}>🌙 Dark</button>
              <button className={`ims-theme-btn${!isDark?" active":""}`} onClick={()=>setIsDark(false)}>☀️ Light</button>
            </div>
          </div>
        </div>
        <main className="ims-page-content" key={isDark?"dark":"light"}>
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
