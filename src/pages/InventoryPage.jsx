import { useState, useEffect } from "react";
import { getAll, updateItem, deleteItem } from "../services/firestoreService";
import { getAuditFields } from "../services/authService";
import { cacheManager, CACHE_TTL } from "../services/cacheManager";
import { Badge, Table, Td, Button, SectionHeader, Toast } from "../components/ui/index.jsx";

const RETURN_TYPE_BADGE  = { FD:"red", DM:"red", QI:"amber", RB:"violet", DIS:"cyan" };
const RETURN_TYPE_LABEL  = { FD:"Fraud", DM:"Damaged", QI:"Quality Issue", RB:"Refurb Bulk", DIS:"Disposal" };

const isLowStock = (avail, purchased) => {
  if (!purchased || purchased === 0) return avail === 0;
  return (avail / purchased) <= 0.10;
};

// ── Inline Edit Modal ──────────────────────────────────────────────────────
function EditModal({ title, fields, values, onChange, onSave, onCancel, saving }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
      <div className="ims-card" style={{padding:28,minWidth:380,maxWidth:480,width:"100%"}}>
        <p className="ims-section-title" style={{marginBottom:20}}>{title}</p>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {fields.map(f=>(
            <div key={f.key} style={{display:"flex",flexDirection:"column",gap:5}}>
              <label className="ims-label">{f.label}</label>
              {f.type==="select"?(
                <select className="ims-input" value={values[f.key]||""} onChange={e=>onChange(f.key,e.target.value)}>
                  {f.options.map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              ):(
                <input
                  type={f.type||"text"}
                  className="ims-input"
                  value={values[f.key]||""}
                  onChange={e=>onChange(f.key,e.target.value)}
                  placeholder={f.placeholder||""}
                />
              )}
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:10,marginTop:22}}>
          <Button variant="primary" onClick={onSave} disabled={saving}>{saving?"Saving…":"💾 Save"}</Button>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const [tab, setTab]                   = useState("Inventory");
  const [inventory, setInventory]       = useState([]);
  const [returnInv, setReturnInv]       = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [toast, setToast]               = useState(null);
  const [search, setSearch]             = useState("");
  const [rSearch, setRSearch]           = useState("");
  const [filterZone, setFilterZone]     = useState("");
  const [filterCat, setFilterCat]       = useState("");

  // Edit state — Inventory
  const [editInv, setEditInv]     = useState(null); // the record being edited
  const [editInvForm, setEditInvForm] = useState({});
  const [editInvSaving, setEditInvSaving] = useState(false);

  // Edit state — Return Inventory
  const [editRet, setEditRet]     = useState(null);
  const [editRetForm, setEditRetForm] = useState({});
  const [editRetSaving, setEditRetSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    // Inventory needs cleanup before caching — manual cache flow
    let inv;
    try {
      const cached = await cacheManager.get("getall:inventory");
      if (cached) {
        inv = cached;
      } else {
        inv = await getAll("inventory");
        for (const item of inv) {
          if (Number(item.availableStock||0) === 0 && item.location) {
            await updateItem("inventory", item.id, { location:"", pickZone:"" });
            item.location=""; item.pickZone="";
          }
        }
        cacheManager.set("getall:inventory", inv, CACHE_TTL.SHORT).catch(() => {});
      }
    } catch (_) {
      inv = await getAll("inventory");
    }
    const [{ data: retInv }, { data: txn }] = await Promise.all([
      cacheManager.getOrFetch("getall:returninventory", () => getAll("returninventory"), CACHE_TTL.MEDIUM),
      cacheManager.getOrFetch("getall:transactions",    () => getAll("transactions"),    CACHE_TTL.LONG),
    ]);
    setInventory(inv.filter(i => Number(i.availableStock||0) > 0));
    setReturnInv(retInv);
    setTransactions(txn.sort((a,b)=>new Date(b.createdAt||b.timestamp)-new Date(a.createdAt||a.timestamp)));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const reload = async () => {
    await Promise.all([
      cacheManager.invalidate("getall:inventory"),
      cacheManager.invalidate("getall:returninventory"),
    ]).catch(() => {});
    await load();
  };

  const zones = [...new Set(inventory.map(i=>i.pickZone).filter(Boolean))].sort();
  const cats  = [...new Set(inventory.map(i=>i.category).filter(Boolean))].sort();

  const filtered = inventory.filter(r =>
    (!search  || r.skuId?.toLowerCase().includes(search.toLowerCase()) || r.productName?.toLowerCase().includes(search.toLowerCase()) || r.location?.toLowerCase().includes(search.toLowerCase())) &&
    (!filterZone || r.pickZone === filterZone) &&
    (!filterCat  || r.category === filterCat)
  );

  const filteredReturn = returnInv.filter(r =>
    !rSearch ||
    r.skuId?.toLowerCase().includes(rSearch.toLowerCase()) ||
    r.productName?.toLowerCase().includes(rSearch.toLowerCase()) ||
    r.type?.toLowerCase().includes(rSearch.toLowerCase())
  );

  const totalVal       = filtered.reduce((s,r)=>s+Number(r.stockAmount||0),0);
  const totalReturnVal = filteredReturn.reduce((s,r)=>s+Number(r.stockValue||0),0);
  const lowStockCount  = filtered.filter(r=>isLowStock(Number(r.availableStock||0),Number(r.purchaseUnits||0))).length;

  // ── Inventory Edit / Delete ────────────────────────────────────────────
  const openEditInv = (r) => {
    setEditInv(r);
    setEditInvForm({
      availableStock: String(r.availableStock||0),
      location:       r.location||"",
      pickZone:       r.pickZone||"",
      cost:           String(r.cost||0),
    });
  };

  const handleSaveInv = async () => {
    if (!editInv) return;
    setEditInvSaving(true);
    try {
      const audit = getAuditFields();
      const avail = Number(editInvForm.availableStock||0);
      const cost  = Number(editInvForm.cost||0);
      await updateItem("inventory", editInv.id, {
        availableStock: avail,
        location:       editInvForm.location,
        pickZone:       editInvForm.pickZone,
        cost,
        stockAmount:    avail * cost,
        updatedAt:      audit.timestamp,
        updatedBy:      audit.createdBy,
      });
      setToast({ msg:`${editInv.productName} updated`, type:"success" });
      setEditInv(null);
      reload();
    } catch(e) {
      setToast({ msg:"Update failed: "+e.message, type:"error" });
    }
    setEditInvSaving(false);
  };

  const handleDeleteInv = async (r) => {
    if (!window.confirm(`Delete "${r.productName}" (${r.skuId}) from inventory? This cannot be undone.`)) return;
    try {
      await deleteItem("inventory", r.id);
      setToast({ msg:`${r.productName} removed from inventory`, type:"success" });
      reload();
    } catch(e) {
      setToast({ msg:"Delete failed: "+e.message, type:"error" });
    }
  };

  // ── Return Inventory Edit / Delete ────────────────────────────────────
  const openEditRet = (r) => {
    setEditRet(r);
    setEditRetForm({
      availableQty: String(r.availableQty||0),
      location:     r.location||"",
      status:       r.status||"Returned",
      type:         r.type||"",
      cost:         String(r.cost||0),
    });
  };

  const handleSaveRet = async () => {
    if (!editRet) return;
    setEditRetSaving(true);
    try {
      const audit = getAuditFields();
      const avail = Number(editRetForm.availableQty||0);
      const cost  = Number(editRetForm.cost||0);
      await updateItem("returninventory", editRet.id, {
        availableQty: avail,
        location:     editRetForm.location,
        status:       editRetForm.status,
        type:         editRetForm.type,
        cost,
        stockValue:   avail * cost,
        updatedAt:    audit.timestamp,
        updatedBy:    audit.createdBy,
      });
      setToast({ msg:`${editRet.productName} updated`, type:"success" });
      setEditRet(null);
      reload();
    } catch(e) {
      setToast({ msg:"Update failed: "+e.message, type:"error" });
    }
    setEditRetSaving(false);
  };

  const handleDeleteRet = async (r) => {
    if (!window.confirm(`Delete "${r.productName}" from Return Inventory? This cannot be undone.`)) return;
    try {
      await deleteItem("returninventory", r.id);
      setToast({ msg:`${r.productName} removed from return inventory`, type:"success" });
      reload();
    } catch(e) {
      setToast({ msg:"Delete failed: "+e.message, type:"error" });
    }
  };

  // Shared action cell style
  const actionBtnBase = { fontSize:11, padding:"4px 10px", borderRadius:6, fontWeight:700, cursor:"pointer", border:"none" };

  return (
    <div>
      {toast&&<Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}

      {/* ── Edit Modals ── */}
      {editInv&&(
        <EditModal
          title={`Edit Inventory — ${editInv.productName}`}
          fields={[
            { key:"availableStock", label:"Available Stock",  type:"number", placeholder:"0" },
            { key:"cost",           label:"Cost / Unit (₹)",  type:"number", placeholder:"0" },
            { key:"location",       label:"Location (Bin/Rack)", placeholder:"e.g. A-01-R3" },
            { key:"pickZone",       label:"Pick Zone",         placeholder:"e.g. PZ-01" },
          ]}
          values={editInvForm}
          onChange={(k,v)=>setEditInvForm(f=>({...f,[k]:v}))}
          onSave={handleSaveInv}
          onCancel={()=>setEditInv(null)}
          saving={editInvSaving}
        />
      )}
      {editRet&&(
        <EditModal
          title={`Edit Return Inventory — ${editRet.productName}`}
          fields={[
            { key:"availableQty", label:"Available Qty",    type:"number", placeholder:"0" },
            { key:"cost",         label:"Cost / Unit (₹)", type:"number", placeholder:"0" },
            { key:"location",     label:"Location",         placeholder:"e.g. FD-L01-03" },
            { key:"type",         label:"Category Code",    type:"select", options:["FD","DM","QI","RB","DIS"] },
            { key:"status",       label:"Status",           type:"select", options:["Returned","Fraud","Damaged","QC Failed","Refurbishing","Disposal"] },
          ]}
          values={editRetForm}
          onChange={(k,v)=>setEditRetForm(f=>({...f,[k]:v}))}
          onSave={handleSaveRet}
          onCancel={()=>setEditRet(null)}
          saving={editRetSaving}
        />
      )}

      <SectionHeader title="Inventory" subtitle="Stock levels, returns & transactions"/>
      <div className="ims-tab-bar">
        {["Inventory","Return Inventory","Transactions"].map(t=>(
          <button key={t} className={`ims-tab${tab===t?" active":""}`} onClick={()=>setTab(t)}>
            {t}
            {t==="Return Inventory"&&returnInv.length>0&&<span className="ims-badge ims-badge-amber" style={{marginLeft:6,fontSize:10,padding:"1px 6px"}}>{returnInv.length}</span>}
            {t==="Inventory"&&lowStockCount>0&&<span className="ims-badge ims-badge-red" style={{marginLeft:6,fontSize:10,padding:"1px 6px"}}>⚠ {lowStockCount}</span>}
          </button>
        ))}
      </div>

      {/* ── Inventory ── */}
      {tab==="Inventory"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap"}}>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              <label className="ims-label">Search</label>
              <input className="ims-input" style={{width:260}} placeholder="SKU / Product / Location…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              <label className="ims-label">Pick Zone</label>
              <select className="ims-input" style={{width:120}} value={filterZone} onChange={e=>setFilterZone(e.target.value)}>
                <option value="">All Zones</option>
                {zones.map(z=><option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              <label className="ims-label">Category</label>
              <select className="ims-input" style={{width:180}} value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
                <option value="">All Categories</option>
                {cats.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <Button variant="ghost" onClick={load}>↻</Button>
            {(search||filterZone||filterCat)&&<Button variant="ghost" onClick={()=>{setSearch("");setFilterZone("");setFilterCat("");}}>Clear</Button>}
          </div>

          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            <div className="ims-elevated" style={{padding:"8px 14px",borderRadius:8}}>
              <p className="t-muted" style={{margin:0,fontSize:12}}>
                <strong className="t-primary">{filtered.length}</strong> active items ·
                Value: <strong className="t-success">₹{totalVal.toLocaleString()}</strong>
              </p>
            </div>
            {lowStockCount>0&&(
              <div style={{padding:"8px 14px",borderRadius:8,background:"var(--badge-red-bg)",border:"1px solid var(--badge-red-br)"}}>
                <p style={{margin:0,fontSize:12,color:"var(--badge-red-fg)",fontWeight:600}}>
                  ⚠ {lowStockCount} item(s) at ≤10% stock — Low Stock Alert
                </p>
              </div>
            )}
          </div>

          <div className="ims-table-wrap">
            <table className="ims-table">
              <thead>
                <tr>
                  {["SKU","Product","Category","Subcategory","Pick Zone","Type","Location","Purchased","Sold","Available","Cost","Stock Value","Status","Actions"].map(c=>(
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? <tr><td colSpan={14} style={{padding:"48px 16px",textAlign:"center"}}><div className="spin" style={{width:20,height:20,border:"2px solid var(--border)",borderTopColor:"var(--accent)",borderRadius:"50%",margin:"0 auto"}}/></td></tr>
                  : filtered.length===0
                    ? <tr><td colSpan={14} className="t-muted" style={{padding:"48px 16px",textAlign:"center"}}>No inventory items</td></tr>
                    : filtered.map(r=>{
                        const avail     = Number(r.availableStock||0);
                        const purchased = Number(r.purchaseUnits||0);
                        const low       = isLowStock(avail, purchased);
                        const out       = avail === 0;
                        return(
                          <tr key={r.id}>
                            <Td mono><span className="t-accent">{r.skuId}</span></Td>
                            <Td><span style={{fontWeight:600}}>{r.productName}</span></Td>
                            <Td><span className="ims-badge ims-badge-violet" style={{fontSize:11}}>{r.category||"—"}</span></Td>
                            <Td><span className="t-secondary" style={{fontSize:11}}>{r.subcategory||"—"}</span></Td>
                            <Td><Badge color="cyan">{r.pickZone||"—"}</Badge></Td>
                            <Td><Badge color={r.type==="Return"?"amber":"cyan"}>{r.type||"Fresh"}</Badge></Td>
                            <Td><span className="ims-badge ims-badge-amber" style={{fontFamily:"monospace"}}>{r.location||"—"}</span></Td>
                            <Td>{purchased}</Td>
                            <Td><span className="t-warning">{r.soldUnits||0}</span></Td>
                            <Td>
                              <span style={{fontSize:15,fontWeight:800}} className={out?"t-danger":low?"t-warning":"t-success"}>{avail}</span>
                              {low&&!out&&<span className="ims-badge ims-badge-red" style={{marginLeft:6,fontSize:10,padding:"1px 7px"}}>Low</span>}
                              {out&&<span className="ims-badge ims-badge-red" style={{marginLeft:6,fontSize:10,padding:"1px 7px"}}>Out</span>}
                            </Td>
                            <Td>₹{Number(r.cost||0).toLocaleString()}</Td>
                            <Td><span className="t-accent">₹{Number(r.stockAmount||0).toLocaleString()}</span></Td>
                            <Td><Badge color={out?"red":low?"amber":"green"}>{out?"Out of Stock":low?"Low Stock":"In Stock"}</Badge></Td>
                            {/* ── Actions ── */}
                            <td style={{padding:"10px 14px",whiteSpace:"nowrap"}}>
                              <div style={{display:"flex",gap:6}}>
                                <button
                                  style={{...actionBtnBase,background:"var(--badge-cyan-bg)",color:"var(--badge-cyan-fg)",border:"1px solid var(--badge-cyan-br)"}}
                                  onClick={()=>openEditInv(r)}
                                >Edit</button>
                                <button
                                  style={{...actionBtnBase,background:"var(--badge-red-bg)",color:"var(--badge-red-fg)",border:"1px solid var(--badge-red-br)"}}
                                  onClick={()=>handleDeleteInv(r)}
                                >Delete</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Return Inventory ── */}
      {tab==="Return Inventory"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"flex",gap:12,alignItems:"flex-end"}}>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              <label className="ims-label">Search</label>
              <input className="ims-input" style={{width:280}} placeholder="Search…" value={rSearch} onChange={e=>setRSearch(e.target.value)}/>
            </div>
            <Button variant="ghost" onClick={load}>↻</Button>
          </div>
          <div className="ims-elevated" style={{padding:"10px 16px",borderRadius:8,display:"flex",gap:14,flexWrap:"wrap",alignItems:"center"}}>
            <span className="t-muted" style={{fontSize:11,fontWeight:700}}>CATEGORIES:</span>
            {Object.entries(RETURN_TYPE_LABEL).map(([code,label])=>(
              <div key={code} style={{display:"flex",gap:6,alignItems:"center"}}>
                <span className={`ims-badge ims-badge-${RETURN_TYPE_BADGE[code]}`}>{code}</span>
                <span className="t-secondary" style={{fontSize:11}}>{label}</span>
              </div>
            ))}
            <span className="t-muted" style={{fontSize:11,marginLeft:"auto"}}>Total: <strong className="t-warning">₹{totalReturnVal.toLocaleString()}</strong></span>
          </div>

          <div className="ims-table-wrap">
            <table className="ims-table">
              <thead>
                <tr>
                  {["SKU","Product","Type","Category","Location","Purchased","Sold","Available","Cost","Stock Value","Status","Actions"].map(c=>(
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? <tr><td colSpan={12} style={{padding:"48px 16px",textAlign:"center"}}><div className="spin" style={{width:20,height:20,border:"2px solid var(--border)",borderTopColor:"var(--accent)",borderRadius:"50%",margin:"0 auto"}}/></td></tr>
                  : filteredReturn.length===0
                    ? <tr><td colSpan={12} className="t-muted" style={{padding:"48px 16px",textAlign:"center"}}>No return inventory items</td></tr>
                    : filteredReturn.map(r=>{
                        const avail=Number(r.availableQty||0);
                        return(
                          <tr key={r.id}>
                            <Td mono><span className="t-accent">{r.skuId}</span></Td>
                            <Td><span style={{fontWeight:600}}>{r.productName}</span></Td>
                            <Td><span className={`ims-badge ims-badge-${RETURN_TYPE_BADGE[r.type]||"red"}`}>{r.type||"—"}</span></Td>
                            <Td><span className="t-secondary">{RETURN_TYPE_LABEL[r.type]||r.category||"—"}</span></Td>
                            <Td><span className="ims-badge ims-badge-amber" style={{fontFamily:"monospace"}}>{r.location||"—"}</span></Td>
                            <Td>{r.purchasedQty||0}</Td>
                            <Td><span className="t-warning">{r.soldQty||0}</span></Td>
                            <Td><span className="t-danger" style={{fontWeight:800,fontSize:14}}>{avail}</span></Td>
                            <Td>₹{Number(r.cost||0).toLocaleString()}</Td>
                            <Td><span className="t-warning">₹{Number(r.stockValue||0).toLocaleString()}</span></Td>
                            <Td><Badge color={r.status==="Fraud"||r.status==="Damaged"?"red":r.status==="QC Failed"?"amber":r.status==="Refurbishing"?"violet":"cyan"}>{r.status||"Returned"}</Badge></Td>
                            {/* ── Actions ── */}
                            <td style={{padding:"10px 14px",whiteSpace:"nowrap"}}>
                              <div style={{display:"flex",gap:6}}>
                                <button
                                  style={{...actionBtnBase,background:"var(--badge-cyan-bg)",color:"var(--badge-cyan-fg)",border:"1px solid var(--badge-cyan-br)"}}
                                  onClick={()=>openEditRet(r)}
                                >Edit</button>
                                <button
                                  style={{...actionBtnBase,background:"var(--badge-red-bg)",color:"var(--badge-red-fg)",border:"1px solid var(--badge-red-br)"}}
                                  onClick={()=>handleDeleteRet(r)}
                                >Delete</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Transactions ── */}
      {tab==="Transactions"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Button variant="ghost" onClick={load} style={{width:"fit-content"}}>↻ Refresh</Button>
          <Table loading={loading}
            cols={["Txn ID","Type","Sub-Type","SKU","Product","Qty","Location","Pick Zone","By","Date"]}
            rows={transactions}
            renderRow={r=>(<>
              <Td mono><span className="t-muted">{r.txnId}</span></Td>
              <Td><Badge color={r.type==="IN"?"green":"red"}>{r.type}</Badge></Td>
              <Td><span className={`ims-badge ims-badge-${RETURN_TYPE_BADGE[r.subType]||"cyan"}`}>{r.subType||"Fresh"}</span></Td>
              <Td mono><span className="t-accent">{r.skuId}</span></Td>
              <Td>{r.skuName}</Td>
              <Td><span className={r.type==="IN"?"t-success":"t-warning"} style={{fontWeight:700}}>{r.type==="IN"?"+":"-"}{r.qty}</span></Td>
              <Td><span className="ims-badge ims-badge-teal" style={{fontFamily:"monospace"}}>{r.location||"—"}</span></Td>
              <Td><Badge color="violet">{r.pickZone||"—"}</Badge></Td>
              <Td><span className="t-muted" style={{fontSize:11}}>{r.createdBy||"—"}</span></Td>
              <Td>{r.timestamp?new Date(r.timestamp).toLocaleString():r.createdAt?new Date(r.createdAt).toLocaleString():"—"}</Td>
            </>)}
          />
        </div>
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