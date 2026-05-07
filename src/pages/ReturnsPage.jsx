import { useState, useEffect } from "react";
import { getAll, addItem, updateItem, searchByField, genReturnId, genPvId, genTxnId } from "../services/firestoreService";
import { Badge, Table, Td, Button, SectionHeader, Toast } from "../components/ui/index.jsx";

const REMARKS   = ["Damage","Quality Issue","Minor Scratch","Loss","Fraud"];
const CONDITION = ["Very Good","Good","QC Failed"];
const TABS      = ["Return Customer List","PV","RTO","RPV","Return Table"];

// Return Inventory location prefix map
const LOC_PREFIX = {
  FD:  { code:"FD",  label:"Fraud",               status:"Fraud",            badgeColor:"red"    },
  DM:  { code:"DM",  label:"Damaged",             status:"Damaged",          badgeColor:"red"    },
  QI:  { code:"QI",  label:"Quality Issue",       status:"QC Failed",        badgeColor:"amber"  },
  RB:  { code:"RB",  label:"Refurbishment Bulk",  status:"Refurbishing",     badgeColor:"violet" },
  DIS: { code:"DIS", label:"Disposal",            status:"Pending Disposal", badgeColor:"cyan"   },
};
const parseLocPrefix = (loc = "") => {
  const prefix = (loc.split("-")[0] || "").toUpperCase();
  return LOC_PREFIX[prefix] || null;
};

export default function ReturnsPage({ shippedOrder, clearShipped }) {
  const [tab, setTab]             = useState("Return Customer List");
  const [shipped, setShipped]     = useState([]);   // all shipped customers
  const [pvItems, setPvItems]     = useState([]);   // PV process items
  const [rtoItems, setRtoItems]   = useState([]);   // RTO items
  const [rpvItems, setRpvItems]   = useState([]);   // RPV / Quality Check items
  const [returnTable, setReturnTable] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [scanLocs, setScanLocs]   = useState({});
  const [processQtys, setProcessQtys] = useState({}); // per-row qty to process (partial support)
  const [toast, setToast]         = useState(null);

  const refresh = async () => {
    setLoading(true);
    const [customers, pv, rto, rpv, rt] = await Promise.all([
      getAll("customers"),
      getAll("pvprocess"),
      getAll("rtoprocess"),
      getAll("rpvprocess"),
      getAll("returnstable"),
    ]);
    const doneIds = new Set(rt.map(r => r.orderId));
    const pvIds   = new Set([...pv, ...rto, ...rpv].map(r => r.orderId));
    setShipped(customers.filter(c => c.status === "Shipped" && !doneIds.has(c.orderId) && !pvIds.has(c.orderId)));
    setPvItems(pv.filter(r => r.status === "Pending"));
    const pendingRto = rto.filter(r => r.status !== "Done" && r.status !== "Sent to RPV");
    setRtoItems(pendingRto);
    // Seed processQty defaults for any new items (don't overwrite user edits already in state)
    setProcessQtys(prev => {
      const next = { ...prev };
      pendingRto.forEach(r => { if (next[r.id] === undefined) next[r.id] = r.qty; });
      return next;
    });
    setRpvItems(rpv.filter(r => r.status !== "Done"));
    setReturnTable(rt);
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);
  useEffect(() => { if (shippedOrder) { refresh(); clearShipped(); } }, [shippedOrder]);

  // ── Start Process → PV ──
  const handleStartProcess = async (order) => {
    const pvId = genPvId();
    await addItem("pvprocess", {
      pvId, returnId: genReturnId(), orderId: order.orderId,
      customerName: order.name, skuId: order.skuId,
      skuName: order.productName, qty: order.quantity||1,
      status: "Pending", createdAt: new Date().toISOString(),
    });
    setToast({ msg:`PV ${pvId} started`, type:"success" });
    setTab("PV");
    refresh();
  };

  // ── PV → RTO ──
  const handleRTO = async (item) => {
    await addItem("rtoprocess", {
      returnId: item.returnId, pvId: item.pvId, orderId: item.orderId,
      customerName: item.customerName, skuId: item.skuId,
      skuName: item.skuName, qty: item.qty,
      condition: "", qc: "", status: "Pending", createdAt: new Date().toISOString(),
    });
    await updateItem("pvprocess", item.id, { status:"RTO" });
    setToast({ msg:`RTO initiated — ${item.returnId}`, type:"success" });
    setTab("RTO");
    refresh();
  };

  // ── PV → RPV ──
  const handleRPV = async (item) => {
    await addItem("rpvprocess", {
      returnId: item.returnId, pvId: item.pvId, orderId: item.orderId,
      customerName: item.customerName, skuId: item.skuId,
      skuName: item.skuName, qty: item.qty,
      reason: "", verificationStatus: "Pending", qc: "", remarks: "",
      scanLocation: "", itemType: "Fresh", status: "Pending",
      createdAt: new Date().toISOString(),
    });
    await updateItem("pvprocess", item.id, { status:"RPV" });
    setToast({ msg:`RPV initiated — ${item.returnId}`, type:"success" });
    setTab("RPV");
    refresh();
  };

  // ── RTO: send QC Failed qty → RPV (partial support) ──
  const handleRTOtoRPV = async (item) => {
    const pQty    = Math.min(Number(processQtys[item.id] ?? item.qty), Number(item.qty));
    const remaining = Number(item.qty) - pQty;
    if (pQty <= 0) return setToast({ msg:"Process qty must be > 0", type:"error" });

    // Send pQty to RPV
    await addItem("rpvprocess", {
      returnId: item.returnId, pvId: item.pvId||"", orderId: item.orderId,
      customerName: item.customerName, skuId: item.skuId,
      skuName: item.skuName, qty: pQty,
      reason: "QC Failed from RTO", verificationStatus: "Pending",
      qc: "Fail", remarks: "QC Failed", scanLocation: "",
      itemType: "Return", status: "Pending", createdAt: new Date().toISOString(),
    });

    if (remaining > 0) {
      // Keep item in RTO with reduced qty, reset its processQty
      await updateItem("rtoprocess", item.id, { qty: remaining, qc: "", condition: "" });
      setRtoItems(p => p.map(r => r.id===item.id ? {...r, qty:remaining, qc:"", condition:""} : r));
      setProcessQtys(p => ({...p, [item.id]: remaining}));
      setToast({ msg:`${pQty} unit(s) → RPV · ${remaining} remaining in RTO`, type:"success" });
    } else {
      await updateItem("rtoprocess", item.id, { status:"Sent to RPV" });
      // Remove immediately from local state — don't wait for refresh()
      setRtoItems(p => p.filter(r => r.id !== item.id));
      setScanLocs(p => { const n={...p}; delete n[item.id]; return n; });
      setProcessQtys(p => { const n={...p}; delete n[item.id]; return n; });
      setToast({ msg:`All ${pQty} unit(s) moved to RPV — ${item.returnId}`, type:"success" });
      setTab("RPV");
    }
    refresh();
  };

  // ── RTO: Done / Pass (partial support) ──
  const handleRTODone = async (item) => {
    const loc       = scanLocs[item.id]||"";
    if (!loc) return setToast({ msg:"Scan a location first", type:"error" });
    const pQty      = Math.min(Number(processQtys[item.id] ?? item.qty), Number(item.qty));
    const remaining = Number(item.qty) - pQty;
    if (pQty <= 0) return setToast({ msg:"Process qty must be > 0", type:"error" });

    // Save pQty to returnstable
    await addItem("returnstable", {
      returnId: item.returnId, orderId: item.orderId, customerName: item.customerName,
      skuId: item.skuId, skuName: item.skuName, qty: pQty,
      condition: item.condition||"—", qc: "Pass", location: loc,
      type: "RTO", itemType: "Return", completedAt: new Date().toISOString(),
    });
    // Return pQty to inventory
    await addToInventory(item.skuId, item.skuName, pQty, loc, "Return", item.returnId);

    if (remaining > 0) {
      // Reduce qty in RTO, reset QC + condition for next round
      await updateItem("rtoprocess", item.id, { qty: remaining, qc: "", condition: "" });
      setRtoItems(p => p.map(r => r.id===item.id ? {...r, qty:remaining, qc:"", condition:""} : r));
      setProcessQtys(p => ({...p, [item.id]: remaining}));
      setScanLocs(p => ({...p, [item.id]: ""}));
      setToast({ msg:`${pQty} unit(s) done · ${remaining} remaining in RTO`, type:"success" });
    } else {
      await updateItem("rtoprocess", item.id, { status:"Done", scanLocation:loc });
      setScanLocs(p => { const n={...p}; delete n[item.id]; return n; });
      setProcessQtys(p => { const n={...p}; delete n[item.id]; return n; });
      setToast({ msg:`RTO complete — all ${pQty} unit(s) processed`, type:"success" });
    }
    refresh();
  };

  const updateRTO = async (id, key, value) => {
    setRtoItems(p => p.map(r => r.id===id ? {...r,[key]:value} : r));
    await updateItem("rtoprocess", id, {[key]:value});
  };

  // ── RPV: Put Away ──
  const handlePutAway = async (item) => {
    const loc = scanLocs[item.id]||"";
    if (!loc) return setToast({ msg:"Scan a location first", type:"error" });
    if (!item.qc) return setToast({ msg:"Set QC result before putting away", type:"error" });

    const locMeta = parseLocPrefix(loc); // null if not a return-category location

    // Always save to returnstable
    await addItem("returnstable", {
      returnId: item.returnId, orderId: item.orderId, customerName: item.customerName,
      skuId: item.skuId, skuName: item.skuName, qty: item.qty,
      qc: item.qc, remarks: item.remarks||"—",
      condition: item.qc==="Pass" ? "Good" : "QC Failed",
      location: loc, type: "RPV", itemType: item.itemType||"Fresh",
      returnCategory: locMeta?.code||null,
      completedAt: new Date().toISOString(),
    });

    if (item.qc === "Pass") {
      // Sellable — goes to regular inventory
      await addToInventory(item.skuId, item.skuName, Number(item.qty||1), loc, item.itemType||"Fresh", item.returnId);
      setToast({ msg:`Put away ✓ — ${item.returnId} · Regular inventory updated`, type:"success" });
    } else {
      // QC Failed — must use a return-category location prefix
      if (!locMeta) return setToast({
        msg:`QC Failed needs a return location (FD-/DM-/QI-/RB-/DIS-…). Got: "${loc}"`,
        type:"error",
      });
      await addToReturnInventory(item, loc, locMeta);
      setToast({ msg:`Put away ✓ — [${locMeta.code}] ${locMeta.label} · Return Inventory updated`, type:"success" });
    }

    await updateItem("rpvprocess", item.id, { status:"Done", scanLocation:loc, returnCategory:locMeta?.code||null });
    setScanLocs(p => { const n={...p}; delete n[item.id]; return n; });
    refresh();
  };

  const updateRPV = async (id, key, value) => {
    setRpvItems(p => p.map(r => r.id===id ? {...r,[key]:value} : r));
    await updateItem("rpvprocess", id, {[key]:value});
  };

  // ── Helper: add/update inventory + log transaction ──
  const addToInventory = async (skuId, skuName, qty, location, type, ref) => {
    const existing = await searchByField("inventory","skuId",skuId);
    if (existing.length > 0) {
      const inv = existing[0];
      const newAvail = Number(inv.availableStock||0) + qty;
      await updateItem("inventory", inv.id, {
        availableStock: newAvail,
        soldUnits: Math.max(0, Number(inv.soldUnits||0) - qty),
        stockAmount: newAvail * Number(inv.cost||0),
        location, type, updatedAt: new Date().toISOString(),
      });
    } else {
      await addItem("inventory", {
        skuId, productName: skuName, cost: 0,
        purchaseUnits: qty, soldUnits: 0,
        availableStock: qty, stockAmount: 0,
        location, type, updatedAt: new Date().toISOString(),
      });
    }
    await addItem("transactions", {
      txnId: genTxnId(), type: "IN", subType: type,
      skuId, skuName, qty, location, ref,
      createdAt: new Date().toISOString(),
    });
  };

  // ── Helper: upsert returninventory + log transaction ──
  const addToReturnInventory = async (item, location, locMeta) => {
    const qty  = Number(item.qty||1);
    const existing = await searchByField("returninventory","skuId",item.skuId);
    if (existing.length > 0) {
      const inv = existing[0];
      const newAvail = Number(inv.availableQty||0) + qty;
      await updateItem("returninventory", inv.id, {
        availableQty:   newAvail,
        stockValue:     newAvail * Number(inv.cost||0),
        location, type: locMeta.code, category: locMeta.label,
        status: locMeta.status, updatedAt: new Date().toISOString(),
      });
    } else {
      await addItem("returninventory", {
        skuId: item.skuId, productName: item.skuName,
        type: locMeta.code, category: locMeta.label, status: locMeta.status,
        location, purchasedQty: qty, soldQty: 0, availableQty: qty,
        cost: 0, stockValue: 0,
        returnId: item.returnId, orderId: item.orderId,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    }
    await addItem("transactions", {
      txnId: genTxnId(), type: "IN", subType: locMeta.code,
      skuId: item.skuId, skuName: item.skuName,
      qty, location, ref: item.returnId,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
      <SectionHeader title="Returns" subtitle="Return Customer List → PV → RTO / RPV"/>
      <div className="ims-tab-bar">
        {TABS.map(t=>(
          <button key={t} className={`ims-tab${tab===t?" active":""}`} onClick={()=>setTab(t)}>
            {t}
            {t==="PV"     && pvItems.length>0  && <span className="ims-badge ims-badge-cyan"   style={{marginLeft:6,fontSize:10,padding:"1px 6px"}}>{pvItems.length}</span>}
            {t==="RTO"    && rtoItems.length>0  && <span className="ims-badge ims-badge-red"    style={{marginLeft:6,fontSize:10,padding:"1px 6px"}}>{rtoItems.length}</span>}
            {t==="RPV"    && rpvItems.length>0  && <span className="ims-badge ims-badge-amber"  style={{marginLeft:6,fontSize:10,padding:"1px 6px"}}>{rpvItems.length}</span>}
          </button>
        ))}
      </div>

      {/* ══ TAB 1: Return Customer List ══ */}
      {tab==="Return Customer List" && (
        <div className="ims-table-wrap">
          <table className="ims-table">
            <thead><tr>{["Return ID","Order ID","Customer","SKU ID","SKU Name","Qty","Action"].map(c=><th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {loading
                ? <tr><td colSpan={7} style={{padding:"48px 16px",textAlign:"center"}}>
                    <div className="spin" style={{width:20,height:20,border:"2px solid var(--border)",borderTopColor:"var(--accent)",borderRadius:"50%",margin:"0 auto"}}/>
                  </td></tr>
                : shipped.length===0
                  ? <tr><td colSpan={7} className="t-muted" style={{padding:"48px 16px",textAlign:"center",fontSize:13}}>No shipped orders awaiting return</td></tr>
                  : shipped.map((r,i)=>(
                    <tr key={r.id}>
                      <td className="mono"><span className="t-muted">RET-PENDING-{i+1}</span></td>
                      <td className="mono"><span className="t-accent">{r.orderId}</span></td>
                      <td><span style={{fontWeight:600}}>{r.name}</span></td>
                      <td className="mono">{r.skuId}</td>
                      <td>{r.productName}</td>
                      <td>{r.quantity||1}</td>
                      <td><Button variant="primary" onClick={()=>handleStartProcess(r)}>Start Process</Button></td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* ══ TAB 2: PV ══ */}
      {tab==="PV" && (
        <div className="ims-table-wrap">
          <table className="ims-table">
            <thead><tr>{["PV ID","Return ID","Order ID","Customer","SKU ID","SKU Name","Qty","Action"].map(c=><th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {pvItems.length===0
                ? <tr><td colSpan={8} className="t-muted" style={{padding:"48px 16px",textAlign:"center"}}>No items pending physical verification</td></tr>
                : pvItems.map(r=>(
                  <tr key={r.id}>
                    <td className="mono"><span className="t-accent">{r.pvId}</span></td>
                    <td className="mono">{r.returnId}</td>
                    <td className="mono">{r.orderId}</td>
                    <td><span style={{fontWeight:600}}>{r.customerName}</span></td>
                    <td className="mono">{r.skuId}</td>
                    <td>{r.skuName}</td>
                    <td>{r.qty}</td>
                    <td style={{display:"flex",gap:8,padding:"12px 16px"}}>
                      <Button variant="danger" onClick={()=>handleRTO(r)}>RTO</Button>
                      <Button variant="amber"  onClick={()=>handleRPV(r)}>RTV</Button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* ══ TAB 3: RTO ══ */}
      {tab==="RTO" && (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div className="ims-elevated" style={{padding:"8px 14px",borderRadius:8,width:"fit-content"}}>
            <p className="t-muted" style={{margin:0,fontSize:12}}>
              Enter <strong className="t-primary">Process Qty</strong> to act on part of the total — remaining stays in this list until fully resolved.
            </p>
          </div>
          {rtoItems.length===0
            ? <div className="ims-panel" style={{textAlign:"center"}}><p className="t-muted">No pending RTO items</p></div>
            : <div className="ims-table-wrap">
                <table className="ims-table">
                  <thead><tr>{["Return ID","Customer","SKU","SKU Name","Total Qty","Process Qty","Condition","QC","Scan Location","Action"].map(c=><th key={c}>{c}</th>)}</tr></thead>
                  <tbody>
                    {rtoItems.map(r => {
                      const pQty     = processQtys[r.id] ?? r.qty;
                      const maxQty   = Number(r.qty);
                      const isOver   = Number(pQty) > maxQty;
                      return (
                        <tr key={r.id}>
                          <td className="mono"><span className="t-accent">{r.returnId}</span></td>
                          <td><span style={{fontWeight:600}}>{r.customerName}</span></td>
                          <td className="mono">{r.skuId}</td>
                          <td>{r.skuName}</td>
                          {/* Total remaining — read-only */}
                          <td>
                            <span className="ims-badge ims-badge-cyan" style={{fontSize:13,fontWeight:800,padding:"3px 12px"}}>
                              {r.qty}
                            </span>
                          </td>
                          {/* Process qty — editable, capped at total */}
                          <td>
                            <div style={{display:"flex",flexDirection:"column",gap:3}}>
                              <input
                                type="number" min={1} max={maxQty}
                                value={pQty}
                                onChange={e => setProcessQtys(p => ({...p, [r.id]: e.target.value}))}
                                className="ims-input ims-input-sm"
                                style={{width:72, borderColor: isOver ? "var(--danger)" : undefined}}
                              />
                              {isOver && <span style={{fontSize:10,color:"var(--danger-text)"}}>Max {maxQty}</span>}
                            </div>
                          </td>
                          <td>
                            <select className="ims-input ims-input-sm" style={{width:120}} value={r.condition||""}
                              onChange={e=>updateRTO(r.id,"condition",e.target.value)}>
                              <option value="">Select…</option>
                              {CONDITION.map(c=><option key={c}>{c}</option>)}
                            </select>
                          </td>
                          <td>
                            <div style={{display:"flex",gap:6}}>
                              {["Pass","Fail"].map(v=>(
                                <button key={v} onClick={()=>updateRTO(r.id,"qc",v)}
                                  className={`ims-btn ${r.qc===v?(v==="Pass"?"ims-btn-success":"ims-btn-danger"):"ims-btn-ghost"}`}
                                  style={{padding:"4px 12px",fontSize:12}}>
                                  {v}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td>
                            <input type="text" placeholder="A-01-R1" value={scanLocs[r.id]||""}
                              onChange={e=>setScanLocs(p=>({...p,[r.id]:e.target.value}))}
                              className="ims-input ims-input-sm" style={{width:120}}/>
                          </td>
                          <td>
                            {!r.qc
                              ? <span className="t-muted" style={{fontSize:12}}>Set QC</span>
                              : r.qc==="Fail"
                                ? <Button variant="amber"   onClick={()=>handleRTOtoRPV(r)}>Go to RPV →</Button>
                                : <Button variant="success" onClick={()=>handleRTODone(r)}>Done ✓</Button>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
          }
        </div>
      )}

      {/* ══ TAB 4: RPV (Quality Check) ══ */}
      {tab==="RPV" && (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {rpvItems.length===0
            ? <div className="ims-panel" style={{textAlign:"center"}}><p className="t-muted">No items pending RPV</p></div>
            : rpvItems.map(r=>(
              <div key={r.id} className="ims-panel">
                {/* Card header */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,paddingBottom:14,borderBottom:"1px solid var(--border)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span className="t-accent" style={{fontFamily:"monospace",fontSize:13,fontWeight:700}}>{r.returnId}</span>
                    <span className="t-muted">·</span>
                    <span className="t-secondary">{r.customerName}</span>
                  </div>
                  {r.qc ? <Badge color={r.qc==="Pass"?"green":"red"}>{r.qc}</Badge> : <Badge color="amber">Pending QC</Badge>}
                </div>

                {/* Info grid */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:16}}>
                  {[["Return ID",r.returnId],["SKU ID",r.skuId],["SKU Name",r.skuName],["Order",r.orderId],["Qty",r.qty]].map(([l,v])=>(
                    <div key={l}>
                      <p className="t-muted"   style={{margin:"0 0 3px",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>{l}</p>
                      <p className="t-primary"  style={{margin:0,fontSize:13,fontWeight:600}}>{v}</p>
                    </div>
                  ))}
                </div>

                {/* QC fields */}
                <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:16,marginBottom:16}}>
                  <div>
                    <label className="ims-label">Reason</label>
                    <input className="ims-input" value={r.reason||""} onChange={e=>updateRPV(r.id,"reason",e.target.value)} placeholder="Enter reason…"/>
                  </div>
                  <div>
                    <label className="ims-label">Verification</label>
                    <select className="ims-input" value={r.verificationStatus||"Pending"} onChange={e=>updateRPV(r.id,"verificationStatus",e.target.value)}>
                      <option>Pending</option><option>Verified</option><option>Rejected</option>
                    </select>
                  </div>
                  <div>
                    <label className="ims-label">QC Result</label>
                    <div style={{display:"flex",gap:8}}>
                      {["Pass","Fail"].map(v=>(
                        <button key={v} onClick={()=>updateRPV(r.id,"qc",v)}
                          className={`ims-btn ${r.qc===v?(v==="Pass"?"ims-btn-success":"ims-btn-danger"):"ims-btn-ghost"}`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Remarks */}
                <div style={{marginBottom:16}}>
                  <label className="ims-label">Remarks</label>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {REMARKS.map(rem=>(
                      <button key={rem} onClick={()=>updateRPV(r.id,"remarks",rem)}
                        className={`ims-btn ${r.remarks===rem?"ims-btn-primary":"ims-btn-ghost"}`}
                        style={{borderRadius:99,padding:"5px 14px",fontSize:12}}>
                        {rem}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scan Location + Auto Category + Put Away */}
                <div style={{paddingTop:14,borderTop:"1px solid var(--border)"}}>
                  <div style={{display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap"}}>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      <label className="ims-label">
                        Scan Location
                        {r.qc==="Fail" && <span className="t-warning"> — use return prefix (FD-/DM-/QI-/RB-/DIS-)</span>}
                      </label>
                      <input className="ims-input" style={{width:210}}
                        placeholder={r.qc==="Fail" ? "e.g. QI-L03-02" : "e.g. A-02-R1"}
                        value={scanLocs[r.id]||""}
                        onChange={e=>setScanLocs(p=>({...p,[r.id]:e.target.value}))}/>
                    </div>
                    {(()=>{
                      const meta = parseLocPrefix(scanLocs[r.id]||"");
                      if (!meta) return null;
                      return (
                        <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:2}}>
                          <label className="ims-label">Auto-detected Category</label>
                          <div style={{display:"flex",gap:6,alignItems:"center"}}>
                            <span className={`ims-badge ims-badge-${meta.badgeColor}`} style={{fontSize:12,padding:"4px 12px"}}>{meta.code}</span>
                            <span className="t-secondary" style={{fontSize:12,fontWeight:600}}>{meta.label}</span>
                            <span className="t-muted" style={{fontSize:11}}>· {meta.status}</span>
                          </div>
                        </div>
                      );
                    })()}
                    <Button variant="success" onClick={()=>handlePutAway(r)}>Put Away ✓</Button>
                  </div>
                  <div style={{marginTop:10}}>
                    {r.qc==="Pass"
                      ? <p className="t-success" style={{fontSize:11,margin:0}}>✓ QC Pass — will go to regular inventory</p>
                      : r.qc==="Fail"
                        ? <p className="t-warning" style={{fontSize:11,margin:0}}>
                            ⚠ QC Fail → Return Inventory · Prefix sets category: <strong>FD</strong> Fraud · <strong>DM</strong> Damaged · <strong>QI</strong> Quality Issue · <strong>RB</strong> Refurb Bulk · <strong>DIS</strong> Disposal
                          </p>
                        : <p className="t-muted" style={{fontSize:11,margin:0}}>Set QC result before putting away</p>
                    }
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ══ TAB 5: Return Table ══ */}
      {tab==="Return Table" && (
        <Table loading={loading}
          cols={["Return ID","Order ID","Customer","SKU ID","SKU Name","Qty","Type","Item Type","Condition","QC","Location","Completed At"]}
          rows={returnTable}
          renderRow={r=>(<>
            <Td mono><span className="t-accent">{r.returnId}</span></Td>
            <Td mono>{r.orderId}</Td>
            <Td><span style={{fontWeight:600}}>{r.customerName}</span></Td>
            <Td mono>{r.skuId}</Td>
            <Td>{r.skuName}</Td>
            <Td>{r.qty}</Td>
            <Td><Badge color={r.type==="RTO"?"red":"violet"}>{r.type}</Badge></Td>
            <Td><Badge color={r.itemType==="Return"?"amber":"cyan"}>{r.itemType||"Fresh"}</Badge></Td>
            <Td>{r.condition||"—"}</Td>
            <Td>{r.qc ? <Badge color={r.qc==="Pass"?"green":"red"}>{r.qc}</Badge> : <span className="t-muted">—</span>}</Td>
            <Td><span className="ims-badge ims-badge-teal" style={{fontFamily:"monospace"}}>{r.location||"—"}</span></Td>
            <Td>{r.completedAt ? new Date(r.completedAt).toLocaleString() : "—"}</Td>
          </>)}
        />
      )}
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
