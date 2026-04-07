import { useState, useEffect } from "react";
import { getAll, addItem, updateItem, searchByField, genGrnNumber, genQcId, genGrnReceivingId, genTxnId } from "../services/firestoreService";
import { Badge, Table, Td, Button, SectionHeader, Toast } from "../components/ui/index.jsx";

// GRN status flow
const STATUS_COLOR = {
  "PO Created":      "cyan",
  "GRN Initiated":   "violet",
  "QC In Progress":  "amber",
  "QC Completed":    "teal",
  "Put Away":        "green",
  "GRN Receiving":   "red",
};

const TABS = ["GRN List", "Create GRN", "QC Process", "GRN Receiving"];

export default function GRNPage() {
  const [tab, setTab]           = useState("GRN List");
  const [grnList, setGrnList]   = useState([]);
  const [poList, setPoList]     = useState([]);        // unique POs
  const [grnReceiving, setGrnReceiving] = useState([]); // failed QC items
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState(null);

  // Create GRN state
  const [selectedPO, setSelectedPO]   = useState(null);   // { poNumber, vendorName, items[] }
  const [invoiceNo, setInvoiceNo]     = useState("");
  const [invoiceRows, setInvoiceRows] = useState([]);      // per-product invoice entry

  // QC state
  const [activeGrn, setActiveGrn]     = useState(null);   // GRN record being QC'd
  const [qcRows, setQcRows]           = useState([]);      // { ...product, passQty, failQty }

  const load = async () => {
    setLoading(true);
    const [grn, purchases, grnr] = await Promise.all([
      getAll("grn"),
      getAll("purchases"),
      getAll("grnreceiving"),
    ]);

    // Build unique PO summaries from purchases
    const poMap = {};
    purchases.forEach(p => {
      if (!poMap[p.poNumber]) poMap[p.poNumber] = {
        poNumber: p.poNumber,
        vendorName: p.vendorName || "—",
        purchaseDate: p.purchaseDate || p.createdAt,
        status: p.status || "ACTIVE",
        items: [],
      };
      poMap[p.poNumber].items.push(p);
    });
    setPoList(Object.values(poMap).filter(po => po.status !== "GRN Done"));
    setGrnList(grn);
    setGrnReceiving(grnr.filter(r => r.status !== "Deleted"));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // ── Step 1: select PO ────────────────────────────────────────
  const handleSelectPO = (poNumber) => {
    const po = poList.find(p => p.poNumber === poNumber);
    if (!po) return;
    setSelectedPO(po);
    // Pre-fill invoice rows from PO items
    setInvoiceRows(po.items.map(item => ({
      ...item,
      invoiceQty: String(item.units || ""),
      batch: "", serial: "", imei: "", mfgDate: "", expiryDate: "",
    })));
  };

  const updateInvoiceRow = (idx, key, val) => {
    setInvoiceRows(prev => prev.map((r, i) => i === idx ? {...r, [key]: val} : r));
  };

  // ── Step 2: Save GRN + trigger QC ───────────────────────────
  const handleCreateGRN = async () => {
    if (!invoiceNo.trim()) return setToast({ msg:"Invoice number is required", type:"error" });
    if (!selectedPO)       return setToast({ msg:"Select a PO first", type:"error" });

    setSaving(true);
    const grnNumber = genGrnNumber();
    const grnId = await addItem("grn", {
      grnNumber,
      invoiceNo,
      poNumber:    selectedPO.poNumber,
      vendorName:  selectedPO.vendorName,
      status:      "QC In Progress",
      totalItems:  invoiceRows.length,
      createdAt:   new Date().toISOString(),
    });

    // Save each product's invoice entry as a GRN line
    for (const row of invoiceRows) {
      await addItem("grnlines", {
        grnNumber,
        poNumber:    selectedPO.poNumber,
        vendorName:  selectedPO.vendorName,
        productName: row.productName,
        skuId:       row.skuId,
        orderedQty:  Number(row.units || 0),
        invoiceQty:  Number(row.invoiceQty || 0),
        batch:       row.batch || "",
        serial:      row.serial || "",
        imei:        row.imei || "",
        mfgDate:     row.mfgDate || "",
        expiryDate:  row.expiryDate || "",
        qcStatus:    "Pending",
        passQty:     0,
        failQty:     0,
      });
    }

    // Set up QC rows
    setActiveGrn({ grnNumber, invoiceNo, poNumber: selectedPO.poNumber, vendorName: selectedPO.vendorName });
    setQcRows(invoiceRows.map(r => ({
      ...r,
      invoiceQty: Number(r.invoiceQty || 0),
      passQty: String(r.invoiceQty || ""),
      failQty: "0",
    })));

    setToast({ msg:`GRN ${grnNumber} created — Start QC`, type:"success" });
    setSaving(false);
    setInvoiceNo("");
    setSelectedPO(null);
    setInvoiceRows([]);
    await load();
    setTab("QC Process");
  };

  // ── QC: submit pass/fail per product ────────────────────────
  const updateQcRow = (idx, key, val) => {
    setQcRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const upd = {...r, [key]: val};
      // Auto-balance: if user edits pass, set fail = invoiceQty - pass
      if (key === "passQty") {
        const p = Math.min(Number(val || 0), r.invoiceQty);
        upd.failQty = String(Math.max(0, r.invoiceQty - p));
      }
      if (key === "failQty") {
        const f = Math.min(Number(val || 0), r.invoiceQty);
        upd.passQty = String(Math.max(0, r.invoiceQty - f));
      }
      return upd;
    }));
  };

  const handleSubmitQC = async () => {
    if (!activeGrn) return;
    setSaving(true);

    const qcId = genQcId();
    let totalPass = 0, totalFail = 0;

    for (const row of qcRows) {
      const pass = Math.min(Number(row.passQty || 0), row.invoiceQty);
      const fail = Math.max(0, row.invoiceQty - pass);
      totalPass += pass;
      totalFail += fail;

      // Update GRN line
      const lines = await searchByField("grnlines", "grnNumber", activeGrn.grnNumber);
      const line  = lines.find(l => l.skuId === row.skuId);
      if (line) await updateItem("grnlines", line.id, { passQty: pass, failQty: fail, qcStatus: fail > 0 ? "Partial" : "Pass" });

      // QC passed → add to put-away queue
      if (pass > 0) {
        await addItem("putawayqueue", {
          qcId, grnNumber: activeGrn.grnNumber,
          poNumber: activeGrn.poNumber, vendorName: activeGrn.vendorName,
          productName: row.productName, skuId: row.skuId,
          passQty: pass, batch: row.batch || "", serial: row.serial || "",
          imei: row.imei || "", mfgDate: row.mfgDate || "", expiryDate: row.expiryDate || "",
          location: "", putAwayStatus: "Pending",
          createdAt: new Date().toISOString(),
        });
      }

      // QC failed → add to GRN Receiving
      if (fail > 0) {
        await addItem("grnreceiving", {
          grnReceivingId: genGrnReceivingId(),
          qcId, grnNumber: activeGrn.grnNumber,
          poNumber: activeGrn.poNumber, vendorName: activeGrn.vendorName,
          productName: row.productName, skuId: row.skuId,
          failQty: fail, batch: row.batch || "",
          status: "Pending Return", createdAt: new Date().toISOString(),
        });
      }
    }

    // Save QC summary
    await addItem("qcresults", {
      qcId, grnNumber: activeGrn.grnNumber, poNumber: activeGrn.poNumber,
      vendorName: activeGrn.vendorName, totalPass, totalFail,
      products: qcRows.length, completedAt: new Date().toISOString(),
    });

    // Update GRN status
    const grnDocs = await searchByField("grn","grnNumber",activeGrn.grnNumber);
    if (grnDocs[0]) await updateItem("grn", grnDocs[0].id, { status:"QC Completed", qcId, totalPass, totalFail });

    setToast({ msg:`QC done — ${totalPass} passed → Put Away · ${totalFail} failed → GRN Receiving`, type:"success" });
    setSaving(false);
    setActiveGrn(null);
    setQcRows([]);
    await load();
    setTab("GRN List");
  };

  // ── GRN Receiving: delete failed item ───────────────────────
  const handleDeleteReceiving = async (item) => {
    await updateItem("grnreceiving", item.id, { status: "Deleted" });
    setToast({ msg:`${item.productName} removed from GRN Receiving`, type:"success" });
    load();
  };

  // ── Start QC on an existing GRN ─────────────────────────────
  const handleResumeQC = async (grn) => {
    const lines = await searchByField("grnlines","grnNumber",grn.grnNumber);
    setActiveGrn(grn);
    setQcRows(lines.filter(l => l.qcStatus === "Pending").map(l => ({
      ...l,
      passQty: String(l.invoiceQty || 0),
      failQty: "0",
    })));
    setTab("QC Process");
  };

  // Aggregate stats for QC summary
  const totalPassAll = qcRows.reduce((s,r) => s + Math.min(Number(r.passQty||0), r.invoiceQty), 0);
  const totalFailAll = qcRows.reduce((s,r) => s + Math.max(0, r.invoiceQty - Math.min(Number(r.passQty||0), r.invoiceQty)), 0);

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
      <SectionHeader title="GRN Process" subtitle="Goods Receipt Note → QC → Put Away"/>
      <div className="ims-tab-bar">
        {TABS.map(t => (
          <button key={t} className={`ims-tab${tab===t?" active":""}`} onClick={()=>setTab(t)}>
            {t}
            {t==="GRN Receiving" && grnReceiving.length>0 &&
              <span className="ims-badge ims-badge-red" style={{marginLeft:6,fontSize:10,padding:"1px 6px"}}>{grnReceiving.length}</span>}
          </button>
        ))}
      </div>

      {/* ══ TAB 1: GRN List ══ */}
      {tab==="GRN List" && (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Button variant="ghost" onClick={load} style={{width:"fit-content"}}>↻ Refresh</Button>
          <Table loading={loading}
            cols={["GRN No","Invoice No","PO Number","Vendor","Status","Total Items","QC Pass","QC Fail","Date","Action"]}
            rows={grnList}
            renderRow={r=>(<>
              <Td mono><span className="t-success">{r.grnNumber}</span></Td>
              <Td mono><span className="t-warning">{r.invoiceNo}</span></Td>
              <Td mono><span className="t-accent">{r.poNumber}</span></Td>
              <Td>{r.vendorName}</Td>
              <Td><Badge color={STATUS_COLOR[r.status]||"cyan"}>{r.status}</Badge></Td>
              <Td>{r.totalItems||"—"}</Td>
              <Td><span className="t-success" style={{fontWeight:700}}>{r.totalPass??"—"}</span></Td>
              <Td><span className="t-danger"  style={{fontWeight:700}}>{r.totalFail??"—"}</span></Td>
              <Td>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}</Td>
              <Td>{r.status==="QC In Progress" &&
                <Button variant="amber" onClick={()=>handleResumeQC(r)}>Start QC</Button>}
              </Td>
            </>)}
          />
        </div>
      )}

      {/* ══ TAB 2: Create GRN ══ */}
      {tab==="Create GRN" && (
        <div style={{display:"flex",flexDirection:"column",gap:20,maxWidth:900}}>

          {/* Step 1 — Select PO */}
          <div className="ims-panel">
            <p className="ims-section-title">Step 1 — Select Purchase Order</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,alignItems:"end"}}>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <label className="ims-label">PO Number *</label>
                <select className="ims-input" value={selectedPO?.poNumber||""}
                  onChange={e=>handleSelectPO(e.target.value)}>
                  <option value="">Select a PO…</option>
                  {poList.map(po=>(
                    <option key={po.poNumber} value={po.poNumber}>
                      {po.poNumber} — {po.vendorName} ({po.items.length} products)
                    </option>
                  ))}
                </select>
              </div>
              {selectedPO && (
                <div className="ims-success-box" style={{padding:"10px 16px"}}>
                  <p className="t-success" style={{margin:"0 0 4px",fontSize:11,fontWeight:700}}>✓ PO LOADED</p>
                  <p className="t-primary"  style={{margin:0,fontSize:13,fontWeight:600}}>{selectedPO.vendorName}</p>
                  <p className="t-muted"    style={{margin:"2px 0 0",fontSize:11}}>{selectedPO.items.length} products ordered</p>
                </div>
              )}
            </div>
          </div>

          {/* Step 2 — Invoice Number */}
          {selectedPO && (
            <div className="ims-panel">
              <p className="ims-section-title">Step 2 — Invoice Details</p>
              <div style={{display:"flex",flexDirection:"column",gap:6,maxWidth:320}}>
                <label className="ims-label">Invoice Number *</label>
                <input className="ims-input" value={invoiceNo} onChange={e=>setInvoiceNo(e.target.value)}
                  placeholder="INV-XXXX"/>
                {!invoiceNo && <p className="t-danger" style={{fontSize:11,margin:0}}>Required — GRN cannot be created without invoice number</p>}
              </div>
            </div>
          )}

          {/* Step 3 — Per product invoice entry */}
          {selectedPO && invoiceRows.length > 0 && (
            <div className="ims-panel">
              <p className="ims-section-title">Step 3 — Invoice Quantities & Product Details</p>
              <div style={{overflowX:"auto"}}>
                <table className="ims-table">
                  <thead>
                    <tr>
                      {["Product","SKU","Ordered Qty","Invoice Qty","Batch No.","Serial / IMEI","Mfg Date","Expiry Date"].map(c=>(
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceRows.map((row,idx)=>(
                      <tr key={idx}>
                        <td style={{padding:"10px 14px",fontWeight:600}}>{row.productName}</td>
                        <td className="mono" style={{padding:"10px 14px"}}>{row.skuId}</td>
                        <td style={{padding:"10px 14px"}}>{row.units}</td>
                        <td style={{padding:"10px 14px"}}>
                          <input type="number" className="ims-input ims-input-sm" style={{width:80}}
                            value={row.invoiceQty}
                            onChange={e=>updateInvoiceRow(idx,"invoiceQty",e.target.value)}/>
                        </td>
                        <td style={{padding:"10px 14px"}}>
                          <input className="ims-input ims-input-sm" style={{width:120}}
                            value={row.batch} placeholder="BT-001"
                            onChange={e=>updateInvoiceRow(idx,"batch",e.target.value)}/>
                        </td>
                        <td style={{padding:"10px 14px"}}>
                          <input className="ims-input ims-input-sm" style={{width:140}}
                            value={row.serial||row.imei||""} placeholder="SN / IMEI"
                            onChange={e=>updateInvoiceRow(idx,"serial",e.target.value)}/>
                        </td>
                        <td style={{padding:"10px 14px"}}>
                          <input type="date" className="ims-input ims-input-sm" style={{width:140}}
                            value={row.mfgDate}
                            onChange={e=>updateInvoiceRow(idx,"mfgDate",e.target.value)}/>
                        </td>
                        <td style={{padding:"10px 14px"}}>
                          <input type="date" className="ims-input ims-input-sm" style={{width:140}}
                            value={row.expiryDate}
                            onChange={e=>updateInvoiceRow(idx,"expiryDate",e.target.value)}/>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="ims-accent-box" style={{marginTop:16}}>
                <p className="t-secondary" style={{margin:0,fontSize:12}}>
                  Batch, Serial, IMEI, Mfg &amp; Expiry dates are <strong>optional</strong> at GRN stage — they can be captured during QC.
                </p>
              </div>

              <div style={{marginTop:20,display:"flex",gap:12}}>
                <Button variant="primary" onClick={handleCreateGRN} disabled={saving||!invoiceNo.trim()}>
                  {saving ? "Creating…" : "✓ Create GRN & Start QC"}
                </Button>
                <Button variant="ghost" onClick={()=>{setSelectedPO(null);setInvoiceRows([]);setInvoiceNo("");}}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB 3: QC Process ══ */}
      {tab==="QC Process" && (
        <div style={{display:"flex",flexDirection:"column",gap:20}}>
          {!activeGrn || qcRows.length===0
            ? <div className="ims-panel" style={{textAlign:"center"}}>
                <p className="t-muted" style={{marginBottom:16}}>
                  No active QC session. Create a GRN or click "Start QC" on a GRN with pending QC.
                </p>
                <Button variant="ghost" onClick={()=>setTab("GRN List")}>← GRN List</Button>
              </div>
            : <>
                {/* GRN info banner */}
                <div className="ims-panel" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
                  {[
                    ["GRN Number",  activeGrn.grnNumber],
                    ["Invoice No",  activeGrn.invoiceNo||"—"],
                    ["PO Number",   activeGrn.poNumber],
                    ["Vendor",      activeGrn.vendorName],
                  ].map(([l,v])=>(
                    <div key={l}>
                      <p className="t-muted"  style={{margin:"0 0 3px",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>{l}</p>
                      <p className="t-primary" style={{margin:0,fontSize:13,fontWeight:700,fontFamily:"monospace"}}>{v}</p>
                    </div>
                  ))}
                </div>

                {/* Live summary */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                  {[
                    ["Total Invoice Qty", qcRows.reduce((s,r)=>s+r.invoiceQty,0), "t-primary"],
                    ["✓ Pass",            totalPassAll, "t-success"],
                    ["✕ Fail",            totalFailAll, "t-danger"],
                  ].map(([l,v,c])=>(
                    <div key={l} className="ims-card" style={{padding:"16px 20px"}}>
                      <div className="t-muted" style={{fontSize:11,marginBottom:4}}>{l}</div>
                      <div className={c} style={{fontSize:28,fontWeight:900}}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Per-product QC table */}
                <div className="ims-panel">
                  <p className="ims-section-title">QC Per Product</p>
                  <div style={{overflowX:"auto"}}>
                    <table className="ims-table">
                      <thead>
                        <tr>{["Product","SKU","Invoice Qty","✓ Pass Qty","✕ Fail Qty","Status"].map(c=><th key={c}>{c}</th>)}</tr>
                      </thead>
                      <tbody>
                        {qcRows.map((row,idx)=>{
                          const pass = Math.min(Number(row.passQty||0), row.invoiceQty);
                          const fail = Math.max(0, row.invoiceQty - pass);
                          const status = fail===0 ? "Pass" : pass===0 ? "Fail" : "Partial";
                          return (
                            <tr key={idx}>
                              <td style={{padding:"12px 16px",fontWeight:600}}>{row.productName}</td>
                              <td className="mono" style={{padding:"12px 16px"}}>{row.skuId}</td>
                              <td style={{padding:"12px 16px"}}>{row.invoiceQty}</td>
                              <td style={{padding:"12px 16px"}}>
                                <input type="number" min={0} max={row.invoiceQty}
                                  value={row.passQty}
                                  onChange={e=>updateQcRow(idx,"passQty",e.target.value)}
                                  className="ims-input ims-input-sm"
                                  style={{width:80,borderColor: fail>0?"var(--danger)":pass===row.invoiceQty?"var(--success)":undefined}}/>
                              </td>
                              <td style={{padding:"12px 16px"}}>
                                <div style={{display:"flex",alignItems:"center",gap:8}}>
                                  <input type="number" min={0} max={row.invoiceQty}
                                    value={row.failQty}
                                    onChange={e=>updateQcRow(idx,"failQty",e.target.value)}
                                    className="ims-input ims-input-sm"
                                    style={{width:80,borderColor: fail>0?"var(--danger)":undefined}}/>
                                  {fail>0 && <span className="t-danger" style={{fontSize:11}}>→ GRN Receiving</span>}
                                </div>
                              </td>
                              <td style={{padding:"12px 16px"}}>
                                <Badge color={status==="Pass"?"green":status==="Fail"?"red":"amber"}>{status}</Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Result preview */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:16}}>
                    <div className="ims-success-box">
                      <p className="t-success" style={{fontWeight:700,margin:"0 0 4px",fontSize:11}}>✓ WILL GO TO PUT AWAY</p>
                      <p className="t-primary"  style={{margin:0,fontSize:20,fontWeight:900}}>{totalPassAll} units</p>
                      <p className="t-muted"    style={{margin:"4px 0 0",fontSize:11}}>Added to inventory after location assignment</p>
                    </div>
                    <div className="ims-elevated" style={{padding:"14px 18px",borderRadius:8,border:"1px solid var(--badge-red-br)"}}>
                      <p className="t-danger"  style={{fontWeight:700,margin:"0 0 4px",fontSize:11}}>✕ WILL GO TO GRN RECEIVING</p>
                      <p className="t-primary" style={{margin:0,fontSize:20,fontWeight:900}}>{totalFailAll} units</p>
                      <p className="t-muted"   style={{margin:"4px 0 0",fontSize:11}}>Flagged for vendor return</p>
                    </div>
                  </div>

                  <div style={{marginTop:20,display:"flex",gap:12}}>
                    <Button variant="primary" onClick={handleSubmitQC} disabled={saving}>
                      {saving ? "Processing…" : "✓ Submit QC Results"}
                    </Button>
                    <Button variant="ghost" onClick={()=>{setActiveGrn(null);setQcRows([]);setTab("GRN List");}}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </>
          }
        </div>
      )}

      {/* ══ TAB 4: GRN Receiving (failed items) ══ */}
      {tab==="GRN Receiving" && (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div className="ims-elevated" style={{padding:"10px 14px",borderRadius:8,width:"fit-content"}}>
            <p className="t-muted" style={{margin:0,fontSize:12}}>
              Items that <strong className="t-danger">failed QC</strong> — pending return to vendor
            </p>
          </div>
          <Button variant="ghost" onClick={load} style={{width:"fit-content"}}>↻ Refresh</Button>
          <div className="ims-table-wrap">
            <table className="ims-table">
              <thead>
                <tr>{["GRN Receiving ID","GRN No","PO No","Vendor","Product","SKU","Failed Qty","Batch","Status","Action"].map(c=><th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {grnReceiving.length===0
                  ? <tr><td colSpan={10} className="t-muted" style={{padding:"48px 16px",textAlign:"center"}}>No failed QC items</td></tr>
                  : grnReceiving.map(r=>(
                    <tr key={r.id}>
                      <td className="mono" style={{padding:"12px 16px"}}><span className="t-accent">{r.grnReceivingId}</span></td>
                      <td className="mono" style={{padding:"12px 16px"}}>{r.grnNumber}</td>
                      <td className="mono" style={{padding:"12px 16px"}}>{r.poNumber}</td>
                      <td style={{padding:"12px 16px"}}>{r.vendorName}</td>
                      <td style={{padding:"12px 16px",fontWeight:600}}>{r.productName}</td>
                      <td className="mono" style={{padding:"12px 16px"}}>{r.skuId}</td>
                      <td style={{padding:"12px 16px"}}><span className="t-danger" style={{fontWeight:700}}>{r.failQty}</span></td>
                      <td style={{padding:"12px 16px"}}>{r.batch||"—"}</td>
                      <td style={{padding:"12px 16px"}}><Badge color="red">{r.status}</Badge></td>
                      <td style={{padding:"12px 16px"}}>
                        <Button variant="danger" onClick={()=>handleDeleteReceiving(r)}>Remove</Button>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
