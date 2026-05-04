import { useState, useEffect } from "react";
import { getAll, searchByField, updateItem, addItem, deleteItem, genTxnId } from "../services/firestoreService";
import { getAuditFields } from "../services/authService";
import { Badge, Table, Td, Button, SectionHeader, Toast } from "../components/ui/index.jsx";
import { CATEGORY_LIST, PICK_ZONES, DEFAULT_ZONE_MAP, CATEGORIES } from "../data/categories.js";

const TABS = ["Put-Away Queue","Put-Away Data","Inventory Mapping"];

export default function PutAwayPage() {
  const [tab, setTab]           = useState("Put-Away Queue");
  const [queue, setQueue]       = useState([]);
  const [doneList, setDoneList] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [scanLocs, setScanLocs] = useState({});
  const [pickZones, setPickZones] = useState({});
  const [shownLocs, setShownLocs] = useState({});
  const [toast, setToast]       = useState(null);

  // Inventory Mapping state
  const [zoneMap, setZoneMap]   = useState({});
  const [mappingSaving, setMappingSaving] = useState(false);

  // ── Put-Away Queue: Edit state ────────────────────────────
  const [editQueue, setEditQueue]     = useState(null);  // record being edited
  const [editQueueForm, setEditQueueForm] = useState({});
  const [editQueueSaving, setEditQueueSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [q, done, mapping] = await Promise.all([
      getAll("putawayqueue"),
      getAll("putawaydata"),
      getAll("pickzonemapping"),
    ]);
    setQueue(q.filter(r => r.putAwayStatus === "Pending"));
    setDoneList(done);

    const map = {};
    mapping.forEach(m => { map[m.category] = m.pickZone; });
    Object.entries(DEFAULT_ZONE_MAP).forEach(([zone, cats]) => {
      cats.forEach(cat => { if (!map[cat]) map[cat] = zone; });
    });
    setZoneMap(map);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = queue.filter(r =>
    !search ||
    r.skuId?.toLowerCase().includes(search.toLowerCase()) ||
    r.productName?.toLowerCase().includes(search.toLowerCase()) ||
    r.grnNumber?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Put Away ─────────────────────────────────────────────
  const handleDone = async (item) => {
    const loc  = scanLocs[item.id] || "";
    const zone = pickZones[item.id] || "";
    if (!loc)  return setToast({ msg:"Enter rack / bin location first", type:"error" });
    if (!zone) return setToast({ msg:"Select a Pick Zone", type:"error" });

    setShownLocs(p => ({...p, [item.id]: loc}));
    const qty  = Number(item.passQty || 0);
    const audit = getAuditFields();

    const existing = await searchByField("inventory","skuId",item.skuId);
    if (existing.length > 0) {
      const inv = existing[0];
      const newAvail = Number(inv.availableStock||0) + qty;
      await updateItem("inventory", inv.id, {
        availableStock: newAvail, purchaseUnits: Number(inv.purchaseUnits||0)+qty,
        stockAmount: newAvail*Number(inv.cost||0),
        location: loc, pickZone: zone, type:"Fresh",
        updatedAt: audit.timestamp, updatedBy: audit.createdBy, updatedByUid: audit.createdByUid,
      });
    } else {
      const prods = await searchByField("products","skuId",item.skuId);
      const cost  = prods[0]?Number(prods[0].buyingPrice||0):0;
      const cat   = prods[0]?.category   || "";
      const subcat = prods[0]?.subcategory || "";
      await addItem("inventory", {
        skuId:item.skuId, productName:item.productName, cost,
        category:cat, subcategory:subcat,
        purchaseUnits:qty, soldUnits:0, availableStock:qty,
        stockAmount:qty*cost, location:loc, pickZone:zone,
        type:"Fresh", batch:item.batch||"", mfgDate:item.mfgDate||"", expiryDate:item.expiryDate||"",
        ...audit, updatedAt:audit.timestamp, updatedBy:audit.createdBy,
      });
    }

    await addItem("putawaydata",{
      grnNumber:item.grnNumber, qcId:item.qcId||"",
      skuId:item.skuId, skuName:item.productName,
      putAwayQty:qty, location:loc, pickZone:zone,
      type:"Fresh", ...audit,
    });

    await addItem("transactions",{
      txnId:genTxnId(), type:"IN", subType:"Fresh",
      skuId:item.skuId, skuName:item.productName,
      qty, location:loc, pickZone:zone, ref:item.grnNumber, ...audit,
    });

    await updateItem("putawayqueue", item.id, {putAwayStatus:"Done",location:loc,pickZone:zone});
    setToast({ msg:`${item.productName} → ${loc} [${zone}] · Inventory updated`, type:"success" });
    load();
  };

  // ── Put-Away Queue: Edit handlers ────────────────────────
  const openEditQueue = (r) => {
    setEditQueue(r);
    setEditQueueForm({
      productName: r.productName||"",
      passQty:     String(r.passQty||0),
      batch:       r.batch||"",
      serial:      r.serial||"",
      mfgDate:     r.mfgDate||"",
      expiryDate:  r.expiryDate||"",
    });
  };

  const handleSaveQueue = async () => {
    if (!editQueue) return;
    setEditQueueSaving(true);
    try {
      const audit = getAuditFields();
      await updateItem("putawayqueue", editQueue.id, {
        productName: editQueueForm.productName,
        passQty:     Number(editQueueForm.passQty||0),
        batch:       editQueueForm.batch,
        serial:      editQueueForm.serial,
        mfgDate:     editQueueForm.mfgDate,
        expiryDate:  editQueueForm.expiryDate,
        updatedAt:   audit.timestamp,
        updatedBy:   audit.createdBy,
      });
      setToast({ msg:`${editQueue.skuId} updated in queue`, type:"success" });
      setEditQueue(null);
      load();
    } catch(e) {
      setToast({ msg:"Update failed: "+e.message, type:"error" });
    }
    setEditQueueSaving(false);
  };

  const handleDeleteQueue = async (r) => {
    if (!window.confirm(`Remove "${r.productName}" (${r.skuId}) from Put-Away Queue? This will not affect inventory.`)) return;
    try {
      await deleteItem("putawayqueue", r.id);
      setToast({ msg:`${r.productName} removed from queue`, type:"success" });
      load();
    } catch(e) {
      setToast({ msg:"Delete failed: "+e.message, type:"error" });
    }
  };

  // ── Inventory Mapping ─────────────────────────────────────
  const handleZoneChange = (category, newZone) => {
    const currentInZone = CATEGORY_LIST.filter(c => c!==category && zoneMap[c]===newZone).length;
    if (currentInZone >= 4) return setToast({ msg:`${newZone} already has 4 categories. Reassign one first.`, type:"error" });
    setZoneMap(p => ({...p,[category]:newZone}));
  };

  const handleSaveMapping = async () => {
    setMappingSaving(true);
    const audit = getAuditFields();
    const allAssigned = CATEGORY_LIST.every(c => zoneMap[c]);
    if (!allAssigned) { setToast({msg:"All 12 categories must be assigned to a zone",type:"error"}); setMappingSaving(false); return; }

    const existing = await getAll("pickzonemapping");
    for (const cat of CATEGORY_LIST) {
      const rec = existing.find(e => e.category===cat);
      if (rec) await updateItem("pickzonemapping",rec.id,{pickZone:zoneMap[cat],...audit});
      else     await addItem("pickzonemapping",{category:cat,pickZone:zoneMap[cat],...audit});
    }
    setToast({msg:"Inventory mapping saved",type:"success"});
    setMappingSaving(false);
  };

  const zoneGroups = PICK_ZONES.reduce((acc,z) => {
    acc[z] = CATEGORY_LIST.filter(c => zoneMap[c]===z);
    return acc;
  }, {});

  const actionBtnBase = { fontSize:11, padding:"4px 10px", borderRadius:6, fontWeight:700, cursor:"pointer", border:"none" };

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}

      {/* ── Queue Edit Modal ── */}
      {editQueue&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
          <div className="ims-card" style={{padding:28,minWidth:420,maxWidth:520,width:"100%"}}>
            <p className="ims-section-title" style={{marginBottom:6}}>Edit Put-Away Item</p>
            <p className="t-muted" style={{fontSize:12,marginBottom:20}}>
              SKU: <span className="t-accent" style={{fontFamily:"monospace",fontWeight:700}}>{editQueue.skuId}</span>
              &nbsp;·&nbsp;GRN: <span style={{fontFamily:"monospace"}}>{editQueue.grnNumber}</span>
            </p>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                <label className="ims-label">Product Name</label>
                <input className="ims-input" value={editQueueForm.productName} onChange={e=>setEditQueueForm(f=>({...f,productName:e.target.value}))}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  <label className="ims-label">Pass Qty</label>
                  <input type="number" className="ims-input" value={editQueueForm.passQty} onChange={e=>setEditQueueForm(f=>({...f,passQty:e.target.value}))}/>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  <label className="ims-label">Batch</label>
                  <input className="ims-input" value={editQueueForm.batch} placeholder="BT-001" onChange={e=>setEditQueueForm(f=>({...f,batch:e.target.value}))}/>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  <label className="ims-label">Serial / IMEI</label>
                  <input className="ims-input" value={editQueueForm.serial} placeholder="SN / IMEI" onChange={e=>setEditQueueForm(f=>({...f,serial:e.target.value}))}/>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  <label className="ims-label">Mfg Date</label>
                  <input type="date" className="ims-input" value={editQueueForm.mfgDate} onChange={e=>setEditQueueForm(f=>({...f,mfgDate:e.target.value}))}/>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  <label className="ims-label">Expiry Date</label>
                  <input type="date" className="ims-input" value={editQueueForm.expiryDate} onChange={e=>setEditQueueForm(f=>({...f,expiryDate:e.target.value}))}/>
                </div>
              </div>
            </div>
            <div style={{marginTop:20,padding:"10px 14px",borderRadius:8,background:"var(--badge-amber-bg)",border:"1px solid var(--badge-amber-br)"}}>
              <p style={{margin:0,fontSize:11,color:"var(--badge-amber-fg)"}}>⚠ Editing Pass Qty here does not automatically adjust GRN lines. Only edit for genuine data corrections.</p>
            </div>
            <div style={{display:"flex",gap:10,marginTop:18}}>
              <Button variant="primary" onClick={handleSaveQueue} disabled={editQueueSaving}>{editQueueSaving?"Saving…":"💾 Save"}</Button>
              <Button variant="ghost" onClick={()=>setEditQueue(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      <SectionHeader title="Put-Away" subtitle="QC-passed items → assign location, pick zone"/>
      <div className="ims-tab-bar">
        {TABS.map(t=>(
          <button key={t} className={`ims-tab${tab===t?" active":""}`} onClick={()=>setTab(t)}>
            {t}
            {t==="Put-Away Queue"&&queue.length>0&&<span className="ims-badge ims-badge-amber" style={{marginLeft:6,fontSize:10,padding:"1px 6px"}}>{queue.length}</span>}
          </button>
        ))}
      </div>

      {/* ── Queue ── */}
      {tab==="Put-Away Queue"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              <label className="ims-label">Search SKU / Product / GRN</label>
              <input className="ims-input" style={{width:280}} placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <Button variant="ghost" onClick={load}>↻ Refresh</Button>
            {search&&<Button variant="ghost" onClick={()=>setSearch("")}>Clear</Button>}
          </div>
          <div className="ims-elevated" style={{padding:"8px 14px",borderRadius:8,width:"fit-content"}}>
            <p className="t-muted" style={{margin:0,fontSize:12}}>Only <strong className="t-success">QC-passed</strong> items appear here</p>
          </div>
          {loading
            ? <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:64}}><div className="spin" style={{width:24,height:24,border:"2px solid var(--border)",borderTopColor:"var(--accent)",borderRadius:"50%"}}/></div>
            : <div className="ims-table-wrap">
                <table className="ims-table">
                  <thead>
                    <tr>
                      {["PO Number","GRN No","QC ID","SKU","Product","Pass Qty","Batch","Scan Location","Pick Zone","Put Away","Edit / Delete"].map(c=>(
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length===0
                      ? <tr><td colSpan={11} className="t-muted" style={{padding:"48px 16px",textAlign:"center"}}>No pending items</td></tr>
                      : filtered.map(r=>(
                        <tr key={r.id}>
                          <td className="mono" style={{padding:"12px 16px"}}><span className="t-accent">{r.poNumber||"—"}</span></td>
                          <td className="mono" style={{padding:"12px 16px"}}>{r.grnNumber}</td>
                          <td className="mono" style={{padding:"12px 16px"}}><span className="t-accent">{r.qcId||"—"}</span></td>
                          <td className="mono" style={{padding:"12px 16px"}}>{r.skuId}</td>
                          <td style={{padding:"12px 16px",fontWeight:600}}>{r.productName}</td>
                          <td style={{padding:"12px 16px"}}><span className="t-success" style={{fontWeight:800,fontSize:15}}>{r.passQty}</span></td>
                          <td style={{padding:"12px 16px"}}>{r.batch||"—"}</td>
                          <td style={{padding:"12px 16px"}}>
                            <input type="text" placeholder="e.g. A-01-R3"
                              value={scanLocs[r.id]||""}
                              onChange={e=>setScanLocs(p=>({...p,[r.id]:e.target.value}))}
                              className="ims-input ims-input-sm" style={{width:120}}
                              disabled={!!shownLocs[r.id]}/>
                          </td>
                          <td style={{padding:"12px 16px"}}>
                            <select className="ims-input ims-input-sm" style={{width:100}}
                              value={pickZones[r.id]||""}
                              onChange={e=>setPickZones(p=>({...p,[r.id]:e.target.value}))}
                              disabled={!!shownLocs[r.id]}>
                              <option value="">Zone…</option>
                              {PICK_ZONES.map(z=><option key={z} value={z}>{z}</option>)}
                            </select>
                          </td>
                          {/* Put Away action */}
                          <td style={{padding:"12px 16px"}}>
                            {shownLocs[r.id]
                              ? <span className="ims-badge ims-badge-teal" style={{fontFamily:"monospace"}}>{shownLocs[r.id]}</span>
                              : <Button variant="success" onClick={()=>handleDone(r)}>Put Away ✓</Button>
                            }
                          </td>
                          {/* ── Edit / Delete ── */}
                          <td style={{padding:"12px 14px",whiteSpace:"nowrap"}}>
                            {!shownLocs[r.id]?(
                              <div style={{display:"flex",gap:6}}>
                                <button
                                  style={{...actionBtnBase,background:"var(--badge-cyan-bg)",color:"var(--badge-cyan-fg)",border:"1px solid var(--badge-cyan-br)"}}
                                  onClick={()=>openEditQueue(r)}
                                >Edit</button>
                                <button
                                  style={{...actionBtnBase,background:"var(--badge-red-bg)",color:"var(--badge-red-fg)",border:"1px solid var(--badge-red-br)"}}
                                  onClick={()=>handleDeleteQueue(r)}
                                >Delete</button>
                              </div>
                            ):(
                              <span className="t-muted" style={{fontSize:11}}>Done</span>
                            )}
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
          }
        </div>
      )}

      {/* ── Done ── */}
      {tab==="Put-Away Data"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Button variant="ghost" onClick={load} style={{width:"fit-content"}}>↻ Refresh</Button>
          <Table loading={loading} cols={["GRN No","SKU","Product","Qty","Location","Pick Zone","Type","By","Date"]} rows={doneList}
            renderRow={r=>(<>
              <Td mono>{r.grnNumber}</Td>
              <Td mono><span className="t-accent">{r.skuId}</span></Td>
              <Td><span style={{fontWeight:600}}>{r.skuName}</span></Td>
              <Td><span className="t-success" style={{fontWeight:700}}>{r.putAwayQty}</span></Td>
              <Td><span className="ims-badge ims-badge-teal" style={{fontFamily:"monospace"}}>{r.location}</span></Td>
              <Td><Badge color="violet">{r.pickZone||"—"}</Badge></Td>
              <Td><Badge color={r.type==="Return"?"amber":"cyan"}>{r.type||"Fresh"}</Badge></Td>
              <Td><span className="t-muted" style={{fontSize:11}}>{r.createdBy||"—"}</span></Td>
              <Td>{r.timestamp?new Date(r.timestamp).toLocaleString():"—"}</Td>
            </>)}
          />
        </div>
      )}

      {/* ── Inventory Mapping ── */}
      {tab==="Inventory Mapping"&&(
        <div style={{display:"flex",flexDirection:"column",gap:20}}>
          <div className="ims-accent-box">
            <p className="t-secondary" style={{margin:0,fontSize:12}}>
              Each Pick Zone holds exactly <strong>4 categories</strong>. A category can only belong to one zone.
              To move a category, its target zone must have a free slot — swap first if needed.
            </p>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
            {PICK_ZONES.map(zone=>{
              const cats = CATEGORY_LIST.filter(c=>zoneMap[c]===zone);
              const full  = cats.length >= 4;
              return(
                <div key={zone} className="ims-panel" style={{border:full?"2px solid var(--success)":"1px solid var(--border)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                    <span className="ims-badge ims-badge-violet" style={{fontSize:13,padding:"4px 14px",fontWeight:800}}>{zone}</span>
                    <span className={full?"t-success":"t-muted"} style={{fontSize:12,fontWeight:full?700:400}}>
                      {cats.length} / 4 {full?"✓ Full":""}
                    </span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {cats.map(cat=>(
                      <div key={cat} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 10px",borderRadius:7,background:"var(--bg-elevated)",border:"1px solid var(--border)"}}>
                        <span className="t-primary" style={{fontSize:12,fontWeight:600}}>{cat}</span>
                        <span className="t-muted" style={{fontSize:10}}>{(CATEGORIES[cat]||[]).length} sub</span>
                      </div>
                    ))}
                    {Array.from({length:4-cats.length}).map((_,i)=>(
                      <div key={i} style={{padding:"7px 10px",borderRadius:7,border:"2px dashed var(--border)",textAlign:"center"}}>
                        <span className="t-muted" style={{fontSize:11}}>Empty slot</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="ims-panel">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <p className="ims-section-title" style={{margin:0}}>Reassign Categories</p>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {PICK_ZONES.map(z=>{
                  const count=CATEGORY_LIST.filter(c=>zoneMap[c]===z).length;
                  return <span key={z} className={`ims-badge ${count===4?"ims-badge-green":count>4?"ims-badge-red":"ims-badge-amber"}`}>{z}: {count}/4</span>;
                })}
              </div>
            </div>
            <div className="ims-table-wrap">
              <table className="ims-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Subcategories</th>
                    <th style={{width:120}}>Current Zone</th>
                    <th style={{width:160}}>Move To</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORY_LIST.map(cat=>{
                    const current = zoneMap[cat] || "";
                    return(
                      <tr key={cat}>
                        <td style={{padding:"10px 16px",fontWeight:600}}>{cat}</td>
                        <td style={{padding:"10px 16px",maxWidth:280,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} className="t-muted">
                          {(CATEGORIES[cat]||[]).slice(0,3).join(", ")}{(CATEGORIES[cat]||[]).length>3?"…":""}
                        </td>
                        <td style={{padding:"10px 16px"}}>
                          <Badge color="violet">{current||"Unassigned"}</Badge>
                        </td>
                        <td style={{padding:"10px 16px"}}>
                          <select
                            className="ims-input ims-input-sm"
                            style={{width:120}}
                            value={current}
                            onChange={e=>{
                              const newZone = e.target.value;
                              if (!newZone||newZone===current) return;
                              const alreadyInTarget = CATEGORY_LIST.filter(c => c!==cat && zoneMap[c]===newZone).length;
                              if (alreadyInTarget >= 4) {
                                setToast({msg:`${newZone} is full (4/4). Reassign a category from it first.`,type:"error"});
                                return;
                              }
                              setZoneMap(p=>({...p,[cat]:newZone}));
                            }}>
                            {PICK_ZONES.map(z=>{
                              const countInZone = CATEGORY_LIST.filter(c=>c!==cat&&zoneMap[c]===z).length;
                              const isFull = countInZone >= 4 && z !== current;
                              return(
                                <option key={z} value={z}>
                                  {z} ({countInZone + (zoneMap[cat]===z?1:0)}/4){isFull?" — FULL":""}
                                </option>
                              );
                            })}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{marginTop:20,display:"flex",gap:12,alignItems:"center"}}>
              <Button variant="primary" onClick={handleSaveMapping} disabled={mappingSaving}>
                {mappingSaving?"Saving…":"💾 Save Mapping"}
              </Button>
              {PICK_ZONES.some(z=>CATEGORY_LIST.filter(c=>zoneMap[c]===z).length!==4)&&(
                <span className="t-warning" style={{fontSize:12}}>
                  ⚠ Each zone must have exactly 4 categories before saving
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}