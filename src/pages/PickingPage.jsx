import { useState, useEffect } from "react";
import { getAll, searchByField, updateItem, addItem } from "../services/firestoreService";
import { Badge, Table, Td, Button, SectionHeader, Toast } from "../components/ui/index.jsx";

export default function PickingPage({ goToPack }) {
  const [tab, setTab]           = useState("Pick Orders");
  const [orders, setOrders]     = useState([]);
  const [pickingData, setPickingData] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [scanLocs, setScanLocs] = useState({});
  const [toast, setToast]       = useState(null);

  const load = async () => {
    setLoading(true);
    const [customers, inventory, picked] = await Promise.all([
      getAll("customers"), getAll("inventory"), getAll("pickingdata"),
    ]);
    const list = customers.filter(c => c.status === "Pick" || !c.status).map(c => {
      const inv = inventory.find(i => i.skuId === c.skuId);
      return { ...c, availableStock: inv?.availableStock||0, location: inv?.location||"—", inventoryId: inv?.id||null, soldUnits: inv?.soldUnits||0, cost: inv?.cost||0 };
    });
    setOrders(list); setPickingData(picked); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = orders.filter(o => !search ||
    o.orderId?.toLowerCase().includes(search.toLowerCase()) ||
    o.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.skuId?.toLowerCase().includes(search.toLowerCase()));

  const handlePick = async (order) => {
    const qty = Number(order.quantity || 1);
    if (Number(order.availableStock) < qty)
      return setToast({ msg: `Insufficient stock for ${order.productName}`, type: "error" });
    const loc = scanLocs[order.id] || order.location;
    if (order.inventoryId) {
      const na = Number(order.availableStock) - qty;
      await updateItem("inventory", order.inventoryId, { availableStock: na, soldUnits: Number(order.soldUnits)+qty, stockAmount: na*Number(order.cost||0) });
    }
    await addItem("pickingdata", { orderId: order.orderId, customerName: order.name, skuId: order.skuId, productName: order.productName, orderedQty: qty, pickedQty: qty, location: loc, pickedAt: new Date().toISOString(), status: "Picked" });
    await updateItem("customers", order.id, { status: "Pack" });
    setToast({ msg: `${order.productName} picked for ${order.name}`, type: "success" });
    load();
  };

  const handleGoToPack = (order) => {
    goToPack({
      orderId: order.orderId, customerName: order.name, skuId: order.skuId,
      productName: order.productName, orderedQty: order.orderedQty||order.quantity||1, pickedQty: order.pickedQty||order.quantity||1,
    });
  };

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}
      <SectionHeader title="Picking" subtitle="Pick items from warehouse for orders"/>
      <div className="ims-tab-bar">
        {["Pick Orders","Picking Data"].map(t => (
          <button key={t} className={`ims-tab${tab===t?" active":""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === "Pick Orders" && (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <input className="ims-input" style={{width:280}} placeholder="Order ID, customer, SKU…" value={search} onChange={e=>setSearch(e.target.value)}/>
            {search && <Button variant="ghost" onClick={()=>setSearch("")}>Clear</Button>}
            <Button variant="ghost" onClick={load}>↻ Refresh</Button>
          </div>
          {loading
            ? <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:64}}><div className="spin" style={{width:24,height:24,border:"2px solid var(--border)",borderTopColor:"var(--accent)",borderRadius:"50%"}}/></div>
            : (
              <div className="ims-table-wrap">
                <table className="ims-table">
                  <thead><tr>{["Order ID","Customer","SKU","Product","Ord Qty","Available","Location","Scan Location","Pick","→ Pack"].map(c=><th key={c}>{c}</th>)}</tr></thead>
                  <tbody>
                    {filtered.length === 0
                      ? <tr><td colSpan={10} className="t-muted" style={{padding:"48px 16px",textAlign:"center"}}>No pending orders</td></tr>
                      : filtered.map((r) => {
                        const enough = Number(r.availableStock) >= Number(r.quantity||1);
                        return (
                          <tr key={r.id}>
                            <td className="mono"><span className="t-accent">{r.orderId}</span></td>
                            <td><span style={{fontWeight:600}}>{r.name}</span></td>
                            <td className="mono">{r.skuId}</td>
                            <td>{r.productName}</td>
                            <td>{r.quantity||1}</td>
                            <td><span style={{fontWeight:700}} className={enough?"t-success":"t-danger"}>{r.availableStock}</span></td>
                            <td><span className="ims-badge ims-badge-amber" style={{fontFamily:"monospace"}}>{r.location}</span></td>
                            <td><input type="text" placeholder="Scan…" value={scanLocs[r.id]||""} onChange={e=>setScanLocs(p=>({...p,[r.id]:e.target.value}))} className="ims-input ims-input-sm" style={{width:120}}/></td>
                            <td>{enough ? <Button variant="success" onClick={()=>handlePick(r)}>Pick ✓</Button> : <Button variant="danger" disabled>No Stock</Button>}</td>
                            <td><Button variant="outline" onClick={()=>handleGoToPack(r)}>Go to Pack →</Button></td>
                          </tr>
                        );
                      })
                    }
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      )}

      {tab === "Picking Data" && (
        <Table loading={loading}
          cols={["Order ID","Customer","SKU ID","Product","Ordered","Picked","Location","Picked At","Status"]}
          rows={pickingData}
          renderRow={r => (<>
            <Td mono><span className="t-accent">{r.orderId}</span></Td>
            <Td><span style={{fontWeight:600}}>{r.customerName}</span></Td>
            <Td mono>{r.skuId}</Td><Td>{r.productName}</Td>
            <Td>{r.orderedQty}</Td>
            <Td><span className="t-success" style={{fontWeight:700}}>{r.pickedQty}</span></Td>
            <Td><span className="ims-badge ims-badge-amber" style={{fontFamily:"monospace"}}>{r.location}</span></Td>
            <Td>{r.pickedAt ? new Date(r.pickedAt).toLocaleString() : "—"}</Td>
            <Td><Badge color="green">Picked</Badge></Td>
          </>)}
        />
      )}
    </div>
  );
}
