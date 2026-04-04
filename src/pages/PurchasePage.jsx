import { useState, useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { getAll, addItem, deleteItem, updateItem, genPoNumber } from "../services/firestoreService";
import { Badge, Button, SectionHeader, Toast } from "../components/ui/index.jsx";

// ── empty product row ──────────────────────────────────────────
const emptyRow = () => ({ _id: Date.now() + Math.random(), productName:"", skuId:"", vendorName:"", units:"", costPerHead:"", totalCost:"" });

// ── group flat purchases array by poNumber ──────────────────────
const groupByPO = (purchases) => {
  const map = {};
  purchases.forEach(p => {
    if (!map[p.poNumber]) map[p.poNumber] = { poNumber:p.poNumber, date:p.purchaseDate||p.createdAt, status:p.status||"ACTIVE", items:[] };
    map[p.poNumber].items.push(p);
    // a single COMPLETED marker on any item locks the whole PO
    if (p.status === "COMPLETED") map[p.poNumber].status = "COMPLETED";
  });
  return Object.values(map).sort((a,b) => (b.date||"").localeCompare(a.date||""));
};

// ── barcode helper ─────────────────────────────────────────────
function BarcodeSvg({ value, svgRef }) {
  useEffect(() => {
    if (!svgRef?.current || !value) return;
    JsBarcode(svgRef.current, value, {
      format:"CODE128", width:2, height:48,
      displayValue:false, margin:0, background:"transparent", lineColor:"currentColor",
    });
  }, [value]);
  return <svg ref={svgRef} style={{ width:"100%", maxWidth:360, color:"var(--text-primary)" }}/>;
}

// ── PDF generator ──────────────────────────────────────────────
const printPO = (poGroup, svgEl) => {
  const grandTotal = poGroup.items.reduce((s,r) => s+Number(r.totalCost||0), 0);
  let svgHtml = "";
  if (svgEl) {
    const clone = svgEl.cloneNode(true);
    clone.style.color = "#000";
    clone.querySelectorAll("rect,path").forEach(el => { if (!el.getAttribute("fill") || el.getAttribute("fill")==="currentColor") el.setAttribute("fill","#000"); });
    svgHtml = clone.outerHTML;
  }
  const rows = poGroup.items.map((r,i) => `
    <tr>
      <td>${i+1}</td>
      <td>${r.productName||"—"}</td>
      <td>${r.skuId||"—"}</td>
      <td>${r.vendorName||"—"}</td>
      <td style="text-align:right">${r.units||0}</td>
      <td style="text-align:right">₹${Number(r.costPerHead||0).toLocaleString()}</td>
      <td style="text-align:right;font-weight:700">₹${Number(r.totalCost||0).toLocaleString()}</td>
    </tr>`).join("");
  const win = window.open("","_blank");
  win.document.write(`<!DOCTYPE html><html><head><title>PO — ${poGroup.poNumber}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Arial,sans-serif;color:#111;padding:32px;background:#fff;}
  .wrap{max-width:680px;margin:0 auto;border:2px solid #111;border-radius:10px;padding:28px;}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:20px;}
  .title{font-size:24px;font-weight:900;letter-spacing:.1em;}
  .brand{font-size:11px;color:#666;margin-top:4px;}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;}
  .mf{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#888;}
  .mv{font-size:13px;font-weight:700;}
  table{width:100%;border-collapse:collapse;margin-bottom:16px;}
  th{background:#f0f0f0;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #ddd;}
  td{padding:8px 10px;font-size:13px;border-bottom:1px solid #eee;}
  .total-row td{font-weight:700;background:#f9f9f9;border-top:2px solid #ddd;}
  .grand{font-size:18px;font-weight:900;text-align:right;padding:12px 10px 0;border-top:2px solid #111;}
  .barcode-wrap{text-align:center;margin-top:20px;padding:14px;border:1px solid #ddd;border-radius:6px;background:#f9f9f9;}
  .barcode-wrap svg{width:100%;max-width:360px;display:block;margin:0 auto;}
  .barcode-num{font-family:monospace;font-size:12px;color:#666;margin-top:6px;letter-spacing:.1em;}
  .footer{margin-top:16px;font-size:10px;color:#bbb;text-align:center;}
  @media print{body{padding:0;}}
</style></head><body>
<div class="wrap">
  <div class="head">
    <div><div class="title">PURCHASE ORDER</div><div class="brand">MIDC IMS · Eduspark</div></div>
    <div style="text-align:right">
      <div class="mf">PO Number</div>
      <div class="mv" style="font-family:monospace">${poGroup.poNumber}</div>
    </div>
  </div>
  <div class="meta">
    <div><div class="mf">Date</div><div class="mv">${poGroup.date ? new Date(poGroup.date).toLocaleDateString() : "—"}</div></div>
    <div><div class="mf">Status</div><div class="mv">${poGroup.status}</div></div>
    <div><div class="mf">Total Items</div><div class="mv">${poGroup.items.length}</div></div>
    <div><div class="mf">Generated</div><div class="mv">${new Date().toLocaleString()}</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Product</th><th>SKU</th><th>Vendor</th><th style="text-align:right">Qty</th><th style="text-align:right">Cost/Unit</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>
      ${rows}
      <tr class="total-row"><td colspan="6" style="text-align:right">Grand Total</td><td style="text-align:right">₹${grandTotal.toLocaleString()}</td></tr>
    </tbody>
  </table>
  <div class="grand">Grand Total: ₹${grandTotal.toLocaleString()}</div>
  <div class="barcode-wrap">
    ${svgHtml || `<div style="font-family:monospace;font-size:28px;letter-spacing:.15em">||| ${poGroup.poNumber} |||</div>`}
    <div class="barcode-num">${poGroup.poNumber}</div>
  </div>
  <div class="footer">Generated by MIDC IMS · ${new Date().toLocaleString()}</div>
</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`);
  win.document.close();
};

// ══════════════════════════════════════════════════════════════
export default function PurchasePage() {
  const [tab, setTab]         = useState("PO List");
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState(null);

  // Draft PO state
  const [draftPO, setDraftPO]     = useState(null);   // { poNumber, purchaseDate, rows:[] }
  const [expandedPO, setExpandedPO] = useState(null);  // poNumber string for expand in PO List
  const barcodeRefs = useRef({});  // map poNumber → svg ref

  const load = async () => {
    setLoading(true);
    const [p, pr] = await Promise.all([getAll("purchases"), getAll("products")]);
    setPurchases(p);
    setProducts(pr);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const grouped = groupByPO(purchases);

  // ── Start a new PO ──────────────────────────────────────────
  const handleNewPO = () => {
    setDraftPO({
      poNumber: genPoNumber(),
      purchaseDate: new Date().toISOString().split("T")[0],
      rows: [emptyRow()],
    });
    setTab("Add Purchase");
  };

  // ── Row helpers ─────────────────────────────────────────────
  const updateRow = (id, key, val) => {
    setDraftPO(d => ({
      ...d,
      rows: d.rows.map(r => {
        if (r._id !== id) return r;
        const upd = { ...r, [key]: val };
        // recalc total
        upd.totalCost = upd.units && upd.costPerHead
          ? String(Math.round(Number(upd.units) * Number(upd.costPerHead) * 100) / 100)
          : "";
        return upd;
      }),
    }));
  };

  const selectProduct = (id, name) => {
    const p = products.find(p => p.productName === name);
    setDraftPO(d => ({
      ...d,
      rows: d.rows.map(r => {
        if (r._id !== id) return r;
        const cost = p?.buyingPrice ? String(p.buyingPrice) : r.costPerHead;
        const total = r.units && cost ? String(Math.round(Number(r.units)*Number(cost)*100)/100) : "";
        return { ...r, productName:name, skuId:p?.skuId||"", vendorName:p?.vendorName||"", costPerHead:cost, totalCost:total };
      }),
    }));
  };

  const addRow = () => setDraftPO(d => ({ ...d, rows: [...d.rows, emptyRow()] }));
  const removeRow = (id) => setDraftPO(d => ({ ...d, rows: d.rows.filter(r => r._id !== id) }));

  // ── Save all rows (Done Purchasing) ─────────────────────────
  const handleDonePurchasing = async () => {
    const valid = draftPO.rows.filter(r => r.productName);
    if (!valid.length) return setToast({ msg:"Add at least one product", type:"error" });
    setSaving(true);
    for (const r of valid) {
      await addItem("purchases", {
        poNumber:     draftPO.poNumber,
        purchaseDate: draftPO.purchaseDate,
        productName:  r.productName,
        skuId:        r.skuId,
        vendorName:   r.vendorName,
        units:        Number(r.units||0),
        costPerHead:  Number(r.costPerHead||0),
        totalCost:    Number(r.totalCost||0),
        status:       "ACTIVE",
        createdAt:    new Date().toISOString(),
      });
    }
    const grandTotal = valid.reduce((s,r) => s+Number(r.totalCost||0), 0);
    setToast({ msg:`PO ${draftPO.poNumber} saved — ${valid.length} product(s) · ₹${grandTotal.toLocaleString()}`, type:"success" });
    setSaving(false);
    await load();
    setExpandedPO(draftPO.poNumber);
    setDraftPO(null);
    setTab("PO List");
  };

  // ── End PO (lock it) ────────────────────────────────────────
  const handleEndPO = async () => {
    if (!draftPO) return;
    // Mark any already-saved items for this PO as COMPLETED
    const existing = purchases.filter(p => p.poNumber === draftPO.poNumber);
    for (const p of existing) await updateItem("purchases", p.id, { status:"COMPLETED" });
    setToast({ msg:`PO ${draftPO.poNumber} completed & locked`, type:"success" });
    setDraftPO(null);
    await load();
    setTab("PO List");
  };

  // ── Lock a PO from PO List ───────────────────────────────────
  const lockPO = async (poNumber) => {
    const items = purchases.filter(p => p.poNumber === poNumber);
    for (const p of items) await updateItem("purchases", p.id, { status:"COMPLETED" });
    setToast({ msg:`PO ${poNumber} locked`, type:"success" });
    load();
  };

  const deletePO = async (poNumber) => {
    const items = purchases.filter(p => p.poNumber === poNumber);
    for (const p of items) await deleteItem("purchases", p.id);
    setToast({ msg:`PO ${poNumber} deleted`, type:"success" });
    load();
  };

  // ── Barcode ref per PO ──────────────────────────────────────
  const getBarcodeRef = (poNumber) => {
    if (!barcodeRefs.current[poNumber]) barcodeRefs.current[poNumber] = { current: null };
    return barcodeRefs.current[poNumber];
  };

  // ──────────────────────────────────────────────────────────────
  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
      <SectionHeader title="Purchase" subtitle="Purchase orders — multi-product POs">
        <Button variant="primary" onClick={handleNewPO}>+ New PO</Button>
      </SectionHeader>

      <div className="ims-tab-bar">
        {["PO List","Add Purchase"].map(t=>(
          <button key={t} className={`ims-tab${tab===t?" active":""}`} onClick={()=>{
            if (t==="Add Purchase" && !draftPO) return handleNewPO();
            setTab(t);
          }}>{t}</button>
        ))}
      </div>

      {/* ══ Tab 1: PO List ══ */}
      {tab==="PO List" && (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Button variant="ghost" onClick={load} style={{width:"fit-content"}}>↻ Refresh</Button>

          {loading
            ? <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:64}}>
                <div className="spin" style={{width:24,height:24,border:"2px solid var(--border)",borderTopColor:"var(--accent)",borderRadius:"50%"}}/>
              </div>
            : grouped.length===0
              ? <div className="ims-panel" style={{textAlign:"center"}}>
                  <p className="t-muted" style={{marginBottom:16}}>No purchase orders yet</p>
                  <Button onClick={handleNewPO}>+ Create First PO</Button>
                </div>
              : grouped.map(po => {
                const grandTotal = po.items.reduce((s,r)=>s+Number(r.totalCost||0),0);
                const isExpanded = expandedPO === po.poNumber;
                const bRef = getBarcodeRef(po.poNumber);
                return (
                  <div key={po.poNumber} className="ims-card" style={{overflow:"hidden"}}>
                    {/* PO header row */}
                    <div style={{display:"flex",alignItems:"center",gap:16,padding:"16px 20px",cursor:"pointer",borderBottom: isExpanded?"1px solid var(--border)":"none"}}
                      onClick={()=>setExpandedPO(isExpanded ? null : po.poNumber)}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <span className="t-accent" style={{fontFamily:"monospace",fontSize:14,fontWeight:800}}>{po.poNumber}</span>
                          <Badge color={po.status==="COMPLETED"?"green":"cyan"}>{po.status}</Badge>
                          <span className="t-muted" style={{fontSize:12}}>· {po.items.length} product(s)</span>
                          <span className="t-muted" style={{fontSize:12}}>· {po.date ? new Date(po.date).toLocaleDateString() : "—"}</span>
                        </div>
                        <div className="t-warning" style={{fontSize:15,fontWeight:800,marginTop:4}}>
                          Grand Total: ₹{grandTotal.toLocaleString()}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8}} onClick={e=>e.stopPropagation()}>
                        {po.status!=="COMPLETED" &&
                          <Button variant="amber" onClick={()=>lockPO(po.poNumber)}>🔒 End PO</Button>}
                        <Button variant="ghost" onClick={()=>{
                          const ref = bRef;
                          // slight delay so barcode renders if just expanded
                          setTimeout(()=>printPO(po, ref.current), 200);
                          setExpandedPO(po.poNumber);
                        }}>🖨 PDF</Button>
                        {po.status!=="COMPLETED" &&
                          <Button variant="danger" onClick={()=>deletePO(po.poNumber)}>Delete</Button>}
                      </div>
                      <span className="t-muted" style={{fontSize:18,marginLeft:4}}>{isExpanded?"▲":"▼"}</span>
                    </div>

                    {/* Expanded product table */}
                    {isExpanded && (
                      <div style={{padding:"0 20px 20px"}}>
                        {/* Hidden barcode SVG for PDF */}
                        <div style={{height:0,overflow:"hidden"}}>
                          <BarcodeSvg value={po.poNumber} svgRef={bRef}/>
                        </div>
                        <table className="ims-table" style={{marginTop:16}}>
                          <thead>
                            <tr>
                              {["#","Product Name","SKU ID","Vendor","Qty","Cost / Unit","Total"].map(c=><th key={c}>{c}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {po.items.map((r,i)=>(
                              <tr key={r.id||i}>
                                <td className="t-muted" style={{fontSize:12,padding:"12px 16px"}}>{i+1}</td>
                                <td style={{padding:"12px 16px",fontWeight:600}}>{r.productName}</td>
                                <td className="mono" style={{padding:"12px 16px"}}>{r.skuId}</td>
                                <td style={{padding:"12px 16px"}} className="t-secondary">{r.vendorName||"—"}</td>
                                <td style={{padding:"12px 16px"}}>{r.units}</td>
                                <td style={{padding:"12px 16px"}}>₹{Number(r.costPerHead).toLocaleString()}</td>
                                <td style={{padding:"12px 16px",fontWeight:700}} className="t-warning">₹{Number(r.totalCost).toLocaleString()}</td>
                              </tr>
                            ))}
                            {/* Grand total row */}
                            <tr style={{borderTop:"2px solid var(--border)"}}>
                              <td colSpan={6} style={{padding:"12px 16px",textAlign:"right",fontWeight:700,fontSize:13}} className="t-primary">Grand Total</td>
                              <td style={{padding:"12px 16px",fontWeight:900,fontSize:16}} className="t-success">₹{grandTotal.toLocaleString()}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
          }
        </div>
      )}

      {/* ══ Tab 2: Add Purchase (draft PO) ══ */}
      {tab==="Add Purchase" && (
        <div style={{display:"flex",flexDirection:"column",gap:20}}>
          {!draftPO
            ? <div className="ims-panel" style={{textAlign:"center"}}>
                <p className="t-muted" style={{marginBottom:16}}>No active PO. Click to start one.</p>
                <Button onClick={handleNewPO}>+ New PO</Button>
              </div>
            : <>
                {/* PO header info */}
                <div className="ims-panel" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,alignItems:"end"}}>
                  <div>
                    <label className="ims-label">PO Number (auto)</label>
                    <div className="t-accent" style={{fontFamily:"monospace",fontSize:16,fontWeight:800,padding:"9px 0"}}>{draftPO.poNumber}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    <label className="ims-label">Purchase Date</label>
                    <input type="date" className="ims-input" value={draftPO.purchaseDate}
                      onChange={e=>setDraftPO(d=>({...d,purchaseDate:e.target.value}))}/>
                  </div>
                  <div className="ims-accent-box" style={{alignSelf:"center"}}>
                    <p className="t-accent" style={{margin:0,fontSize:12}}>
                      <strong>{draftPO.rows.filter(r=>r.productName).length}</strong> product(s) added ·
                      Grand Total: <strong>₹{draftPO.rows.reduce((s,r)=>s+Number(r.totalCost||0),0).toLocaleString()}</strong>
                    </p>
                  </div>
                </div>

                {/* Product rows */}
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {draftPO.rows.map((row, idx)=>(
                    <div key={row._id} className="ims-panel" style={{position:"relative"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                        <span className="ims-section-title" style={{margin:0}}>Product {idx+1}</span>
                        {draftPO.rows.length > 1 &&
                          <button onClick={()=>removeRow(row._id)}
                            className="ims-btn ims-btn-ghost"
                            style={{padding:"3px 10px",fontSize:12,color:"var(--danger-text)"}}>
                            ✕ Remove
                          </button>
                        }
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr",gap:12,alignItems:"end"}}>
                        {/* Product name with datalist */}
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          <label className="ims-label">Product Name</label>
                          <input list={`dl-${row._id}`} className="ims-input"
                            value={row.productName}
                            onChange={e=>selectProduct(row._id,e.target.value)}
                            placeholder="Type to search…"/>
                          <datalist id={`dl-${row._id}`}>
                            {products.map(p=><option key={p.id} value={p.productName}/>)}
                          </datalist>
                        </div>
                        {/* SKU */}
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          <label className="ims-label">SKU ID</label>
                          <input className="ims-input" value={row.skuId} readOnly style={{cursor:"not-allowed"}}/>
                        </div>
                        {/* Vendor */}
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          <label className="ims-label">Vendor</label>
                          <input className="ims-input" value={row.vendorName} readOnly style={{cursor:"not-allowed"}}/>
                        </div>
                        {/* Qty */}
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          <label className="ims-label">Quantity</label>
                          <input type="number" className="ims-input" value={row.units}
                            onChange={e=>updateRow(row._id,"units",e.target.value)} placeholder="0"/>
                        </div>
                        {/* Cost/unit */}
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          <label className="ims-label">Cost / Unit ₹</label>
                          <input type="number" className="ims-input" value={row.costPerHead}
                            onChange={e=>updateRow(row._id,"costPerHead",e.target.value)} placeholder="Auto"/>
                        </div>
                        {/* Total */}
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          <label className="ims-label">Total ₹</label>
                          <div className="t-warning" style={{fontWeight:800,fontSize:15,padding:"9px 0"}}>
                            {row.totalCost ? `₹${Number(row.totalCost).toLocaleString()}` : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                  <Button variant="outline" onClick={addRow}>+ Add More</Button>
                  <Button variant="primary" onClick={handleDonePurchasing} disabled={saving}>
                    {saving ? "Saving…" : "✓ Done Purchasing"}
                  </Button>
                  <Button variant="amber" onClick={handleEndPO} disabled={saving}>
                    🔒 End this PO
                  </Button>
                  <Button variant="ghost" onClick={()=>{setDraftPO(null);setTab("PO List");}}>
                    Cancel
                  </Button>
                </div>

                {/* Grand total summary */}
                {draftPO.rows.some(r=>r.totalCost) && (
                  <div className="ims-elevated" style={{padding:"14px 18px",borderRadius:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span className="t-secondary" style={{fontSize:13}}>
                        {draftPO.rows.filter(r=>r.productName).length} product(s) in this PO
                      </span>
                      <span className="t-warning" style={{fontSize:20,fontWeight:900}}>
                        Grand Total: ₹{draftPO.rows.reduce((s,r)=>s+Number(r.totalCost||0),0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                <div className="ims-accent-box">
                  <p className="t-secondary" style={{margin:0,fontSize:12}}>
                    <strong>Done Purchasing</strong> saves all products under PO <code style={{fontFamily:"monospace"}}>{draftPO.poNumber}</code> ·
                    <strong> End this PO</strong> locks it — no further products can be added
                  </p>
                </div>
              </>
          }
        </div>
      )}
    </div>
  );
}
