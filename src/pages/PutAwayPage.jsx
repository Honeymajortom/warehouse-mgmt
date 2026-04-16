import { useState, useEffect } from "react";
import { getAll, searchByField, updateItem, addItem, genTxnId } from "../services/firestoreService";
import { getAuditFields } from "../services/authService";
import { Badge, Table, Td, Button, SectionHeader, Toast } from "../components/ui/index.jsx";
import { CATEGORY_LIST, PICK_ZONES, DEFAULT_ZONE_MAP } from "../data/categories.js";

const TABS = ["Put-Away Queue","Put-Away Data","Inventory Mapping"];

export default function PutAwayPage() {
  const [tab, setTab]           = useState("Put-Away Queue");
  const [queue, setQueue]       = useState([]);
  const [doneList, setDoneList] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [scanLocs, setScanLocs] = useState({});
  const [pickZones, setPickZones] = useState({});    // id → PZ-xx
  const [shownLocs, setShownLocs] = useState({});
  const [toast, setToast]       = useState(null);

  // Inventory Mapping state
  const [zoneMap, setZoneMap]   = useState({});  // { category: "PZ-01" }
  const [mappingSaving, setMappingSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [q, done, mapping] = await Promise.all([
      getAll("putawayqueue"),
      getAll("putawaydata"),
      getAll("pickzonemapping"),
    ]);
    setQueue(q.filter(r => r.putAwayStatus === "Pending"));
    setDoneList(done);

    // Build zoneMap from Firestore, fall back to defaults
    const map = {};
    mapping.forEach(m => { map[m.category] = m.pickZone; });
    // Apply defaults for any unmapped categories
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

  // ── Put Away ──────────────────────────────────────────────
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

  // ── Inventory Mapping ─────────────────────────────────────
  const handleZoneChange = (category, newZone) => {
    // Count categories already in the target zone
    const currentInZone = CATEGORY_LIST.filter(c => c!==category && zoneMap[c]===newZone).length;
    if (currentInZone >= 4) return setToast({ msg:`${newZone} already has 4 categories. Reassign one first.`, type:"error" });
    setZoneMap(p => ({...p,[category]:newZone}));
  };

  const handleSaveMapping = async () => {
    setMappingSaving(true);
    const audit = getAuditFields();
    // Validate: each category belongs to exactly one zone
    const allAssigned = CATEGORY_LIST.every(c => zoneMap[c]);
    if (!allAssigned) { setToast({msg:"All 12 categories must be assigned to a zone",type:"error"}); setMappingSaving(false); return; }

    // Upsert each category mapping
    const existing = await getAll("pickzonemapping");
    for (const cat of CATEGORY_LIST) {
      const rec = existing.find(e => e.category===cat);
      if (rec) await updateItem("pickzonemapping",rec.id,{pickZone:zoneMap[cat],...audit});
      else     await addItem("pickzonemapping",{category:cat,pickZone:zoneMap[cat],...audit});
    }
    setToast({msg:"Inventory mapping saved",type:"success"});
    setMappingSaving(false);
  };

  // Group categories by zone for display
  const zoneGroups = PICK_ZONES.reduce((acc,z) => {
    acc[z] = CATEGORY_LIST.filter(c => zoneMap[c]===z);
    return acc;
  }, {});

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
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
                  <thead><tr>{["GRN No","QC ID","SKU","Product","Pass Qty","Batch","Scan Location","Pick Zone","Action"].map(c=><th key={c}>{c}</th>)}</tr></thead>
                  <tbody>
                    {filtered.length===0
                      ? <tr><td colSpan={9} className="t-muted" style={{padding:"48px 16px",textAlign:"center"}}>No pending items</td></tr>
                      : filtered.map(r=>(
                        <tr key={r.id}>
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
                              className="ims-input ims-input-sm" style={{width:120}}/>
                          </td>
                          <td style={{padding:"12px 16px"}}>
                            <select className="ims-input ims-input-sm" style={{width:100}}
                              value={pickZones[r.id]||""}
                              onChange={e=>setPickZones(p=>({...p,[r.id]:e.target.value}))}>
                              <option value="">Zone…</option>
                              {PICK_ZONES.map(z=><option key={z} value={z}>{z}</option>)}
                            </select>
                          </td>
                          <td style={{padding:"12px 16px"}}>
                            {shownLocs[r.id]
                              ? <span className="ims-badge ims-badge-teal" style={{fontFamily:"monospace"}}>{shownLocs[r.id]}</span>
                              : <Button variant="success" onClick={()=>handleDone(r)}>Put Away ✓</Button>
                            }
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
              Each Pick Zone must contain exactly <strong>4 categories</strong>. A category can belong to only one zone.
              Current counts: {PICK_ZONES.map(z=><span key={z} style={{marginRight:12}}><strong>{z}</strong>: {zoneGroups[z]?.length||0}/4</span>)}
            </p>
          </div>

          {/* Zone columns */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
            {PICK_ZONES.map(zone=>(
              <div key={zone} className="ims-panel">
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                  <span className="ims-badge ims-badge-violet" style={{fontSize:13,padding:"4px 14px",fontWeight:800}}>{zone}</span>
                  <span className="t-muted" style={{fontSize:12}}>{zoneGroups[zone]?.length||0} / 4 categories</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {(zoneGroups[zone]||[]).map(cat=>(
                    <div key={cat} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderRadius:8,background:"var(--bg-elevated)",border:"1px solid var(--border)"}}>
                      <span className="t-primary" style={{fontSize:13,fontWeight:600}}>{cat}</span>
                      <span className="t-muted" style={{fontSize:11}}>{(CATEGORIES[cat]||[]).length} subcats</span>
                    </div>
                  ))}
                  {(zoneGroups[zone]||[]).length<4&&<div style={{padding:"8px 12px",borderRadius:8,border:"2px dashed var(--border)",textAlign:"center"}}><span className="t-muted" style={{fontSize:12}}>Empty slot</span></div>}
                </div>
              </div>
            ))}
          </div>

          {/* Reassignment table */}
          <div className="ims-panel">
            <p className="ims-section-title">Reassign Categories</p>
            <div className="ims-table-wrap">
              <table className="ims-table">
                <thead><tr>{["Category","Subcategories","Current Zone","Reassign To"].map(c=><th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {CATEGORY_LIST.map(cat=>(
                    <tr key={cat}>
                      <td style={{padding:"10px 16px",fontWeight:600}}>{cat}</td>
                      <td style={{padding:"10px 16px"}} className="t-muted">{(CATEGORIES[cat]||[]).join(", ")}</td>
                      <td style={{padding:"10px 16px"}}><Badge color="violet">{zoneMap[cat]||"Unassigned"}</Badge></td>
                      <td style={{padding:"10px 16px"}}>
                        <select className="ims-input ims-input-sm" style={{width:110}}
                          value={zoneMap[cat]||""}
                          onChange={e=>handleZoneChange(cat,e.target.value)}>
                          <option value="">Select…</option>
                          {PICK_ZONES.map(z=>(
                            <option key={z} value={z} disabled={z!==zoneMap[cat]&&(zoneGroups[z]?.length||0)>=4}>
                              {z}{z!==zoneMap[cat]&&(zoneGroups[z]?.length||0)>=4?" (full)":""}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{marginTop:20}}>
              <Button variant="primary" onClick={handleSaveMapping} disabled={mappingSaving}>
                {mappingSaving?"Saving…":"💾 Save Mapping"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
