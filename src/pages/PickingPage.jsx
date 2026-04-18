import { useState, useEffect } from "react";
import { getAll, searchByField, updateItem, addItem } from "../services/firestoreService";
import { getAuditFields } from "../services/authService";
import { Badge, Table, Td, Button, SectionHeader, Toast } from "../components/ui/index.jsx";

export default function PickingPage({ goToPack }) {
  const [tab, setTab]           = useState("Assigned Pick");
  const [inTransit, setInTransit] = useState([]);   // status = In Transit
  const [orders, setOrders]     = useState([]);      // status = Pick (enriched with inventory)
  const [pickingData, setPickingData] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [assignSearch, setAssignSearch] = useState("");
  const [scanLocs, setScanLocs] = useState({});      // orderId → scanned location
  const [selected, setSelected] = useState({});      // id → bool (Assigned Pick checkboxes)
  const [toast, setToast]       = useState(null);
  const [assigning, setAssigning] = useState(false);

  const load = async () => {
    setLoading(true);
    const [customers, inventory, picked] = await Promise.all([
      getAll("customers"), getAll("inventory"), getAll("pickingdata"),
    ]);

    // Assigned Pick: In Transit orders
    const transit = customers.filter(c => c.status === "In Transit").map(c => {
      const inv = inventory.find(i => i.skuId === c.skuId);
      const prod = { imageBase64: inv?.imageBase64 || "", imageUrl: inv?.imageUrl || "" };
      return { ...c, availableStock: inv?.availableStock||0, location: inv?.location||"—",
               pickZone: inv?.pickZone||"—", inventoryId: inv?.id||null,
               soldUnits: inv?.soldUnits||0, cost: inv?.cost||0, ...prod };
    });

    // Pick Orders: status = Pick
    const pickList = customers.filter(c => c.status === "Pick").map(c => {
      const inv = inventory.find(i => i.skuId === c.skuId);
      return { ...c, availableStock: inv?.availableStock||0, location: inv?.location||"—",
               pickZone: inv?.pickZone||"—", inventoryId: inv?.id||null,
               soldUnits: inv?.soldUnits||0, cost: inv?.cost||0,
               imageBase64: inv?.imageBase64||"", imageUrl: inv?.imageUrl||"" };
    });

    setInTransit(transit);
    setOrders(pickList);
    setPickingData(picked);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // ── Select all / individual ───────────────────────────────
  const allIds       = inTransit.map(o => o.id);
  const allSelected  = allIds.length > 0 && allIds.every(id => selected[id]);
  const someSelected = allIds.some(id => selected[id]);

  const toggleAll = () => {
    if (allSelected) setSelected({});
    else setSelected(Object.fromEntries(allIds.map(id => [id, true])));
  };
  const toggleOne = id => setSelected(p => ({ ...p, [id]: !p[id] }));

  // ── Assign selected → status Pick ────────────────────────
  const handleAssign = async () => {
    const ids = allIds.filter(id => selected[id]);
    if (!ids.length) return setToast({ msg: "Select at least one order", type: "error" });
    setAssigning(true);
    const audit = getAuditFields();
    for (const id of ids) await updateItem("customers", id, { status: "Pick", ...audit });
    setSelected({});
    setToast({ msg: `${ids.length} order(s) moved to Pick Orders`, type: "success" });
    setAssigning(false);
    load();
  };

  // ── Pick action ───────────────────────────────────────────
  const handlePick = async (order) => {
    const qty = Number(order.quantity || 1);
    const loc = scanLocs[order.id] || "";
    if (!loc) return setToast({ msg: "Scan a location before picking", type: "error" });
    if (Number(order.availableStock) < qty)
      return setToast({ msg: `Insufficient stock for ${order.productName}`, type: "error" });

    const audit = getAuditFields();
    if (order.inventoryId) {
      const na = Number(order.availableStock) - qty;
      await updateItem("inventory", order.inventoryId, {
        availableStock: na, soldUnits: Number(order.soldUnits)+qty,
        stockAmount: na * Number(order.cost||0),
      });
    }
    await addItem("pickingdata", {
      orderId: order.orderId, customerName: order.name,
      skuId: order.skuId, productName: order.productName,
      orderedQty: qty, pickedQty: qty,
      location: loc, pickZone: order.pickZone||"—",
      pickedAt: new Date().toISOString(), status: "Picked", ...audit,
    });
    await updateItem("customers", order.id, { status: "Pack", ...audit });
    setToast({ msg: `${order.productName} picked for ${order.name}`, type: "success" });
    load();
  };

  const filteredTransit = inTransit.filter(o => !assignSearch ||
    o.orderId?.toLowerCase().includes(assignSearch.toLowerCase()) ||
    o.name?.toLowerCase().includes(assignSearch.toLowerCase()) ||
    o.skuId?.toLowerCase().includes(assignSearch.toLowerCase()));

  const filteredOrders = orders.filter(o => !search ||
    o.orderId?.toLowerCase().includes(search.toLowerCase()) ||
    o.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.skuId?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}
      <SectionHeader title="Picking" subtitle="Assign → Pick → Dispatch"/>
      <div className="ims-tab-bar">
        {["Assigned Pick","Pick Orders","Picking Data"].map(t => (
          <button key={t} className={`ims-tab${tab===t?" active":""}`} onClick={() => setTab(t)}>
            {t}
            {t==="Assigned Pick" && inTransit.length>0 &&
              <span className="ims-badge ims-badge-violet" style={{marginLeft:6,fontSize:10,padding:"1px 6px"}}>{inTransit.length}</span>}
            {t==="Pick Orders" && orders.length>0 &&
              <span className="ims-badge ims-badge-cyan" style={{marginLeft:6,fontSize:10,padding:"1px 6px"}}>{orders.length}</span>}
          </button>
        ))}
      </div>

      {/* ══ Tab 1: Assigned Pick ══ */}
      {tab === "Assigned Pick" && (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {/* Toolbar */}
          <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
            <input className="ims-input" style={{width:280}} placeholder="Search order, customer, SKU…"
              value={assignSearch} onChange={e=>setAssignSearch(e.target.value)}/>
            {assignSearch && <Button variant="ghost" onClick={()=>setAssignSearch("")}>Clear</Button>}
            <Button variant="ghost" onClick={load}>↻ Refresh</Button>
            {someSelected && (
              <Button variant="primary" onClick={handleAssign} disabled={assigning}>
                {assigning ? "Assigning…" : `Assign ${Object.values(selected).filter(Boolean).length} to Pick →`}
              </Button>
            )}
          </div>

          {/* Info box */}
          <div className="ims-accent-box">
            <p className="t-secondary" style={{margin:0,fontSize:12}}>
              Orders with status <strong>In Transit</strong>. Select entries and click <strong>Assign</strong> to move them to Pick Orders.
            </p>
          </div>

          {loading
            ? <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:64}}>
                <div className="spin" style={{width:24,height:24,border:"2px solid var(--border)",borderTopColor:"var(--accent)",borderRadius:"50%"}}/>
              </div>
            : <div className="ims-table-wrap">
                <table className="ims-table">
                  <thead>
                    <tr>
                      <th style={{width:44}}>
                        <input type="checkbox" checked={allSelected} onChange={toggleAll}
                          style={{width:16,height:16,cursor:"pointer",accentColor:"var(--accent)"}}/>
                      </th>
                      {["Order ID","Customer","Contact","Address","SKU","Product","Qty","Status"].map(c=><th key={c}>{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransit.length === 0
                      ? <tr><td colSpan={9} className="t-muted" style={{padding:"48px 16px",textAlign:"center"}}>No In Transit orders</td></tr>
                      : filteredTransit.map(r => (
                        <tr key={r.id} style={{background:selected[r.id]?"var(--accent-dim)":"transparent",transition:"background 0.15s"}}>
                          <td style={{padding:"12px 16px"}}>
                            <input type="checkbox" checked={!!selected[r.id]} onChange={()=>toggleOne(r.id)}
                              style={{width:16,height:16,cursor:"pointer",accentColor:"var(--accent)"}}/>
                          </td>
                          <td className="mono" style={{padding:"12px 16px"}}><span className="t-accent">{r.orderId}</span></td>
                          <td style={{padding:"12px 16px",fontWeight:600}}>{r.name}</td>
                          <td style={{padding:"12px 16px"}}>{r.contact||"—"}</td>
                          <td style={{padding:"12px 16px"}}>{r.address||"—"}</td>
                          <td className="mono" style={{padding:"12px 16px"}}>{r.skuId}</td>
                          <td style={{padding:"12px 16px"}}>{r.productName}</td>
                          <td style={{padding:"12px 16px"}}>{r.quantity||1}</td>
                          <td style={{padding:"12px 16px"}}><Badge color="violet">In Transit</Badge></td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
          }
        </div>
      )}

      {/* ══ Tab 2: Pick Orders ══ */}
      {tab === "Pick Orders" && (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <input className="ims-input" style={{width:280}} placeholder="Order ID, customer, SKU…"
              value={search} onChange={e=>setSearch(e.target.value)}/>
            {search && <Button variant="ghost" onClick={()=>setSearch("")}>Clear</Button>}
            <Button variant="ghost" onClick={load}>↻ Refresh</Button>
          </div>

          <div className="ims-elevated" style={{padding:"8px 14px",borderRadius:8,width:"fit-content"}}>
            <p className="t-muted" style={{margin:0,fontSize:12}}>
              <strong>Scan Location</strong> is required before Pick is enabled
            </p>
          </div>

          {loading
            ? <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:64}}>
                <div className="spin" style={{width:24,height:24,border:"2px solid var(--border)",borderTopColor:"var(--accent)",borderRadius:"50%"}}/>
              </div>
            : filteredOrders.length === 0
              ? <div className="ims-panel" style={{textAlign:"center"}}>
                  <p className="t-muted">No orders in Pick status</p>
                </div>
              : <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {filteredOrders.map(r => {
                    const enough  = Number(r.availableStock) >= Number(r.quantity||1);
                    const locFilled = (scanLocs[r.id]||"").trim().length > 0;
                    const canPick  = enough && locFilled;
                    const preview  = r.imageBase64 || r.imageUrl;
                    return (
                      <div key={r.id} className="ims-panel" style={{display:"flex",gap:16,alignItems:"flex-start"}}>
                        {/* Product Image */}
                        <div style={{width:72,height:72,borderRadius:10,border:"1px solid var(--border)",overflow:"hidden",background:"var(--bg-elevated)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:28}}>
                          {preview
                            ? <img src={preview} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>
                            : "📦"}
                        </div>

                        {/* Order details */}
                        <div style={{flex:1,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                          {[
                            ["Order ID",  r.orderId,      true],
                            ["Customer",  r.name,         false],
                            ["SKU ID",    r.skuId,        true],
                            ["Product",   r.productName,  false],
                            ["Qty",       r.quantity||1,  false],
                            ["Available", r.availableStock, false],
                            ["Pick Zone", r.pickZone,     false],
                            ["Location",  r.location,     true],
                          ].map(([l,v,mono])=>(
                            <div key={l}>
                              <p className="t-muted" style={{margin:"0 0 2px",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>{l}</p>
                              <p className={`t-primary${mono?" mono":""}`} style={{margin:0,fontSize:13,fontWeight:600,
                                color: l==="Available"?(enough?"var(--success-text)":"var(--danger-text)"):undefined}}>
                                {v||"—"}
                              </p>
                            </div>
                          ))}
                        </div>

                        {/* Scan + Pick action */}
                        <div style={{display:"flex",flexDirection:"column",gap:10,alignItems:"flex-end",flexShrink:0,minWidth:200}}>
                          <div style={{display:"flex",flexDirection:"column",gap:5,width:"100%"}}>
                            <label className="ims-label">
                              Scan Location *
                              {!locFilled && <span className="t-danger"> (required to pick)</span>}
                            </label>
                            <input type="text" placeholder="e.g. A-01-R3"
                              value={scanLocs[r.id]||""}
                              onChange={e=>setScanLocs(p=>({...p,[r.id]:e.target.value}))}
                              className="ims-input"
                              style={{borderColor: locFilled?"var(--success)":"var(--input-border)"}}/>
                          </div>
                          {!enough
                            ? <Button variant="danger" disabled>No Stock</Button>
                            : <Button
                                variant={canPick?"success":"ghost"}
                                disabled={!canPick}
                                onClick={()=>handlePick(r)}>
                                {canPick ? "Pick ✓" : "Enter Location First"}
                              </Button>
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
          }
        </div>
      )}

      {/* ══ Tab 3: Picking Data ══ */}
      {tab === "Picking Data" && (
        <Table loading={loading}
          cols={["Order ID","Customer","SKU","Product","Ordered","Picked","Location","Pick Zone","By","Picked At","Status"]}
          rows={pickingData}
          renderRow={r => (<>
            <Td mono><span className="t-accent">{r.orderId}</span></Td>
            <Td><span style={{fontWeight:600}}>{r.customerName}</span></Td>
            <Td mono>{r.skuId}</Td>
            <Td>{r.productName}</Td>
            <Td>{r.orderedQty}</Td>
            <Td><span className="t-success" style={{fontWeight:700}}>{r.pickedQty}</span></Td>
            <Td><span className="ims-badge ims-badge-amber" style={{fontFamily:"monospace"}}>{r.location}</span></Td>
            <Td><Badge color="violet">{r.pickZone||"—"}</Badge></Td>
            <Td><span className="t-muted" style={{fontSize:11}}>{r.createdBy||"—"}</span></Td>
            <Td>{r.pickedAt ? new Date(r.pickedAt).toLocaleString() : "—"}</Td>
            <Td><Badge color="green">Picked</Badge></Td>
          </>)}
        />
      )}
    </div>
  );
}
