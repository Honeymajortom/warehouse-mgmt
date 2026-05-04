import { useState, useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { getAll, addItem, deleteItem, updateItem, genPoNumber } from "../services/firestoreService";
import { getAuditFields } from "../services/authService";
import { Badge, Button, SectionHeader, Toast } from "../components/ui/index.jsx";

const emptyRow = () => ({ _id: Date.now() + Math.random(), productName: "", skuId: "", units: "", costPerHead: "", totalCost: "" });
const emptyVendor = { vendorName: "", contact: "", email: "", gstNo: "", address: "" };

const groupByPO = (purchases) => {
  const map = {};
  purchases.forEach(p => {
    if (!map[p.poNumber]) map[p.poNumber] = { poNumber: p.poNumber, date: p.purchaseDate || p.createdAt, status: p.status || "ACTIVE", vendorName: p.vendorName || "", items: [] };
    map[p.poNumber].items.push(p);
    if (p.status === "COMPLETED") map[p.poNumber].status = "COMPLETED";
  });
  return Object.values(map).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
};

function BarcodeSvg({ value, svgRef }) {
  useEffect(() => { if (!svgRef?.current || !value) return; JsBarcode(svgRef.current, value, { format: "CODE128", width: 2, height: 48, displayValue: false, margin: 0, background: "transparent", lineColor: "currentColor" }); }, [value]);
  return <svg ref={svgRef} style={{ width: "100%", maxWidth: 360, color: "var(--text-primary)" }} />;
}

const printPO = (poGroup, svgEl) => {
  const grandTotal = poGroup.items.reduce((s, r) => s + Number(r.totalCost || 0), 0);
  let svgHtml = "";
  if (svgEl) { const c = svgEl.cloneNode(true); c.style.color = "#000"; c.querySelectorAll("rect,path").forEach(el => { if (!el.getAttribute("fill") || el.getAttribute("fill") === "currentColor") el.setAttribute("fill", "#000"); }); svgHtml = c.outerHTML; }
  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html><html><head><title>PO — ${poGroup.poNumber}</title>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;color:#111;padding:28px;background:#fff;}
.wrap{max-width:680px;margin:0 auto;border:2px solid #111;border-radius:10px;padding:24px;}
.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:18px;}
.title{font-size:22px;font-weight:900;letter-spacing:.1em;}.brand{font-size:11px;color:#666;margin-top:4px;}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px;}
.mf{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#888;}.mv{font-size:13px;font-weight:700;}
table{width:100%;border-collapse:collapse;margin-bottom:14px;}th{background:#f0f0f0;padding:7px 10px;text-align:left;font-size:11px;text-transform:uppercase;border-bottom:2px solid #ddd;}
td{padding:7px 10px;font-size:13px;border-bottom:1px solid #eee;}.trow td{font-weight:700;background:#f9f9f9;border-top:2px solid #ddd;}
.grand{font-size:17px;font-weight:900;text-align:right;padding:10px 10px 0;border-top:2px solid #111;}
.bc{text-align:center;margin-top:18px;padding:12px;border:1px solid #ddd;border-radius:6px;background:#f9f9f9;}
.bc svg{width:100%;max-width:360px;display:block;margin:0 auto;}.bnum{font-family:monospace;font-size:11px;color:#777;margin-top:5px;}
.footer{margin-top:14px;font-size:10px;color:#bbb;text-align:center;}@media print{body{padding:0;}}</style></head><body>
<div class="wrap">
<div class="head"><div><div class="title">PURCHASE ORDER</div><div class="brand">MIDC IMS · Eduspark</div></div>
<div style="text-align:right"><div class="mf">PO Number</div><div class="mv" style="font-family:monospace">${poGroup.poNumber}</div></div></div>
<div class="meta">
<div><div class="mf">Vendor</div><div class="mv">${poGroup.vendorName || "—"}</div></div>
<div><div class="mf">Date</div><div class="mv">${poGroup.date ? new Date(poGroup.date).toLocaleDateString() : "—"}</div></div>
<div><div class="mf">Status</div><div class="mv">${poGroup.status}</div></div>
<div><div class="mf">Items</div><div class="mv">${poGroup.items.length}</div></div></div>
<table><thead><tr><th>#</th><th>Product</th><th>SKU</th><th style="text-align:right">Qty</th><th style="text-align:right">Cost/Unit</th><th style="text-align:right">Total</th></tr></thead>
<tbody>${poGroup.items.map((r, i) => `<tr><td>${i + 1}</td><td>${r.productName || "—"}</td><td>${r.skuId || "—"}</td><td style="text-align:right">${r.units || 0}</td><td style="text-align:right">₹${Number(r.costPerHead || 0).toLocaleString()}</td><td style="text-align:right;font-weight:700">₹${Number(r.totalCost || 0).toLocaleString()}</td></tr>`).join("")}
<tr class="trow"><td colspan="5" style="text-align:right">Grand Total</td><td style="text-align:right">₹${grandTotal.toLocaleString()}</td></tr></tbody></table>
<div class="grand">Grand Total: ₹${grandTotal.toLocaleString()}</div>
<div class="bc">${svgHtml || `<div style="font-family:monospace;font-size:26px;letter-spacing:.15em">||| ${poGroup.poNumber} |||</div>`}<div class="bnum">${poGroup.poNumber}</div></div>
<div class="footer">Generated by MIDC IMS · ${new Date().toLocaleString()}</div></div>
<script>window.onload=()=>{window.print();}</script></body></html>`);
  win.document.close();
};

export default function PurchasePage() {
  const [tab, setTab] = useState("PO List");
  const [purchases, setPurchases] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [draftPO, setDraftPO] = useState(null);
  const [expandedPO, setExpandedPO] = useState(null);
  const barcodeRefs = useRef({});

  const load = async () => {
    setLoading(true);

    const [purchasesData, vendorsData, productsData] = await Promise.all([
      getAll("purchases"),
      getAll("vendors"),
      getAll("products")
    ]);

    setPurchases(purchasesData);
    setVendors(vendorsData);
    setProducts(productsData);

    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const grouped = groupByPO(purchases);
  const uniqueVendors = [...new Map(vendors.map(v => [v.vendorName, v])).values()];

  const handleNewPO = () => {
    setDraftPO({ poNumber: genPoNumber(), purchaseDate: new Date().toISOString().split("T")[0], vendorName: "", vendorInfo: emptyVendor, rows: [emptyRow()] });
    setTab("Add Purchase");
  };

  const handleVendorSelect = vendorName => {
    const v = vendors.find(v => v.vendorName === vendorName) || {};
    setDraftPO(d => ({ ...d, vendorName, vendorInfo: { vendorName, contact: v.contact || "", email: v.email || "", gstNo: v.gstNo || "", address: v.address || "" } }));
  };


  const updateRow = (id, key, val) => {
    setDraftPO(d => ({
      ...d, rows: d.rows.map(r => {
        if (r._id !== id) return r;
        const upd = { ...r, [key]: val };
        upd.totalCost = upd.units && upd.costPerHead ? String(Math.round(Number(upd.units) * Number(upd.costPerHead) * 100) / 100) : "";
        return upd;
      })
    }));
  };

  // ── FIX: auto-populate costPerHead from product's buyingPrice ──
  // const selectProduct = (id, name) => {
  //   const p = vendors.find(v=>v.vendorName===draftPO.vendorName && v.productName===name);
  //   // Resolve buying price — try multiple field names for safety
  //   const buying = p?.buyingPrice != null && p.buyingPrice !== ""
  //     ? String(p.buyingPrice)
  //     : p?.costPrice != null && p.costPrice !== ""
  //       ? String(p.costPrice)
  //       : p?.mrp != null && p.mrp !== ""
  //         ? String(p.mrp)
  //         : "";
  //   setDraftPO(d=>({...d, rows:d.rows.map(r=>{
  //     if (r._id!==id) return r;
  //     const total = r.units && buying
  //       ? String(Math.round(Number(r.units)*Number(buying)*100)/100)
  //       : "";
  //     return { ...r, productName:name, skuId:p?.skuId||"", costPerHead:buying, totalCost:total };
  //   })}));
  // };
  const selectProduct = (id, name) => {
    const p = products.find(prod => prod.productName === name);

    if (!p) return;

    const buying =
      p.buyingPrice ?? p.costPrice ?? p.mrp ?? "";

    setDraftPO(d => ({
      ...d,
      rows: d.rows.map(r => {
        if (r._id !== id) return r;

        const total =
          r.units && buying
            ? String(
              Math.round(Number(r.units) * Number(buying) * 100) / 100
            )
            : "";

        return {
          ...r,
          productName: name,
          skuId: p.skuId || "",
          costPerHead: String(buying),
          totalCost: total
        };
      })
    }));
  };

  const addRow = () => setDraftPO(d => ({ ...d, rows: [...d.rows, emptyRow()] }));
  const removeRow = id => setDraftPO(d => ({ ...d, rows: d.rows.filter(r => r._id !== id) }));

  const handleDonePurchasing = async () => {
    const valid = draftPO.rows.filter(r => r.productName);
    if (!valid.length) return setToast({ msg: "Add at least one product", type: "error" });
    if (!draftPO.vendorName) return setToast({ msg: "Select a vendor first", type: "error" });
    setSaving(true);
    const audit = getAuditFields();
    for (const r of valid) {
      await addItem("purchases", { poNumber: draftPO.poNumber, purchaseDate: draftPO.purchaseDate, vendorName: draftPO.vendorName, vendorContact: draftPO.vendorInfo?.contact || "", vendorGst: draftPO.vendorInfo?.gstNo || "", productName: r.productName, skuId: r.skuId, units: Number(r.units || 0), costPerHead: Number(r.costPerHead || 0), totalCost: Number(r.totalCost || 0), status: "ACTIVE", ...audit });
    }
    const grandTotal = valid.reduce((s, r) => s + Number(r.totalCost || 0), 0);
    setToast({ msg: `PO ${draftPO.poNumber} saved — ${valid.length} product(s) · ₹${grandTotal.toLocaleString()}`, type: "success" });
    setSaving(false); await load(); setExpandedPO(draftPO.poNumber); setDraftPO(null); setTab("PO List");
  };

  const handleEndPO = async () => {
    if (!draftPO) return;
    const audit = getAuditFields();
    const existing = purchases.filter(p => p.poNumber === draftPO.poNumber);
    for (const p of existing) await updateItem("purchases", p.id, { status: "COMPLETED", ...audit });
    setToast({ msg: `PO ${draftPO.poNumber} completed & locked`, type: "success" });
    setDraftPO(null); await load(); setTab("PO List");
  };

  const lockPO = async poNumber => { const audit = getAuditFields(); const items = purchases.filter(p => p.poNumber === poNumber); for (const p of items) await updateItem("purchases", p.id, { status: "COMPLETED", ...audit }); setToast({ msg: `PO ${poNumber} locked`, type: "success" }); load(); };
  const deletePO = async poNumber => { const items = purchases.filter(p => p.poNumber === poNumber); for (const p of items) await deleteItem("purchases", p.id); setToast({ msg: `PO ${poNumber} deleted`, type: "success" }); load(); };
  const getBarcodeRef = pn => { if (!barcodeRefs.current[pn]) barcodeRefs.current[pn] = { current: null }; return barcodeRefs.current[pn]; };

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <SectionHeader title="Purchase" subtitle="Multi-product purchase orders">
        <Button variant="primary" onClick={handleNewPO}>+ New PO</Button>
      </SectionHeader>
      <div className="ims-tab-bar">
        {["PO List", "Add Purchase"].map(t => (
          <button key={t} className={`ims-tab${tab === t ? " active" : ""}`} onClick={() => { if (t === "Add Purchase" && !draftPO) return handleNewPO(); setTab(t); }}>{t}</button>
        ))}
      </div>

      {/* ── PO List ── */}
      {tab === "PO List" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Button variant="ghost" onClick={load} style={{ width: "fit-content" }}>↻ Refresh</Button>
          {loading ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 64 }}><div className="spin" style={{ width: 24, height: 24, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%" }} /></div>
            : grouped.length === 0 ? <div className="ims-panel" style={{ textAlign: "center" }}><p className="t-muted" style={{ marginBottom: 16 }}>No POs yet</p><Button onClick={handleNewPO}>+ Create First PO</Button></div>
              : grouped.map(po => {
                const grandTotal = po.items.reduce((s, r) => s + Number(r.totalCost || 0), 0);
                const isExpanded = expandedPO === po.poNumber;
                const bRef = getBarcodeRef(po.poNumber);
                return (
                  <div key={po.poNumber} className="ims-card" style={{ overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", cursor: "pointer", borderBottom: isExpanded ? "1px solid var(--border)" : "none" }} onClick={() => setExpandedPO(isExpanded ? null : po.poNumber)}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span className="t-accent" style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 800 }}>{po.poNumber}</span>
                          <Badge color={po.status === "COMPLETED" ? "green" : "cyan"}>{po.status}</Badge>
                          <span className="t-muted" style={{ fontSize: 12 }}>· {po.vendorName || "—"} · {po.items.length} product(s) · {po.date ? new Date(po.date).toLocaleDateString() : "—"}</span>
                        </div>
                        <div className="t-warning" style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>Grand Total: ₹{grandTotal.toLocaleString()}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
                        {po.status !== "COMPLETED" && <Button variant="amber" onClick={() => lockPO(po.poNumber)}>🔒 End PO</Button>}
                        <Button variant="ghost" onClick={() => { setTimeout(() => printPO(po, getBarcodeRef(po.poNumber).current), 200); setExpandedPO(po.poNumber); }}>🖨 PDF</Button>
                        {po.status !== "COMPLETED" && <Button variant="danger" onClick={() => deletePO(po.poNumber)}>Delete</Button>}
                      </div>
                      <span className="t-muted" style={{ fontSize: 18, marginLeft: 4 }}>{isExpanded ? "▲" : "▼"}</span>
                    </div>
                    {isExpanded && (
                      <div style={{ padding: "0 20px 20px" }}>
                        <div style={{ height: 0, overflow: "hidden" }}><BarcodeSvg value={po.poNumber} svgRef={bRef} /></div>
                        <table className="ims-table" style={{ marginTop: 16 }}>
                          <thead><tr>{["#", "Product", "SKU", "Qty", "Cost/Unit", "Total"].map(c => <th key={c}>{c}</th>)}</tr></thead>
                          <tbody>
                            {po.items.map((r, i) => (
                              <tr key={r.id || i}>
                                <td className="t-muted" style={{ padding: "10px 16px", fontSize: 12 }}>{i + 1}</td>
                                <td style={{ padding: "10px 16px", fontWeight: 600 }}>{r.productName}</td>
                                <td className="mono" style={{ padding: "10px 16px" }}>{r.skuId}</td>
                                <td style={{ padding: "10px 16px" }}>{r.units}</td>
                                <td style={{ padding: "10px 16px" }}>₹{Number(r.costPerHead).toLocaleString()}</td>
                                <td style={{ padding: "10px 16px", fontWeight: 700 }} className="t-warning">₹{Number(r.totalCost).toLocaleString()}</td>
                              </tr>
                            ))}
                            <tr style={{ borderTop: "2px solid var(--border)" }}>
                              <td colSpan={5} style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700 }} className="t-primary">Grand Total</td>
                              <td style={{ padding: "12px 16px", fontWeight: 900, fontSize: 16 }} className="t-success">₹{grandTotal.toLocaleString()}</td>
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

      {/* ── Add Purchase ── */}
      {tab === "Add Purchase" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {!draftPO ? <div className="ims-panel" style={{ textAlign: "center" }}><p className="t-muted" style={{ marginBottom: 16 }}>No active PO.</p><Button onClick={handleNewPO}>+ New PO</Button></div>
            : <>
              {/* PO Header */}
              <div className="ims-panel">
                <p className="ims-section-title">PO Details</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 16, alignItems: "end" }}>
                  <div>
                    <label className="ims-label">PO Number (auto)</label>
                    <div className="t-accent" style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 800, padding: "9px 0" }}>{draftPO.poNumber}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <label className="ims-label">Purchase Date</label>
                    <input type="date" className="ims-input" value={draftPO.purchaseDate} onChange={e => setDraftPO(d => ({ ...d, purchaseDate: e.target.value }))} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <label className="ims-label">Vendor *</label>
                    <select className="ims-input" value={draftPO.vendorName} onChange={e => handleVendorSelect(e.target.value)}>
                      <option value="">Select vendor…</option>
                      {uniqueVendors.map(v => <option key={v.id} value={v.vendorName}>{v.vendorName}</option>)}
                    </select>
                  </div>
                </div>
                {draftPO.vendorName && (
                  <div className="ims-success-box" style={{ marginTop: 14 }}>
                    <p className="t-success" style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700 }}>✓ VENDOR SELECTED</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      {[["Contact", draftPO.vendorInfo?.contact], ["GST", draftPO.vendorInfo?.gstNo], ["Address", draftPO.vendorInfo?.address]].map(([l, v]) => (
                        <div key={l}><p className="t-muted" style={{ margin: 0, fontSize: 11 }}>{l}</p><p className="t-primary" style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 600 }}>{v || "—"}</p></div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Product rows */}
              {!draftPO.vendorName ? (
                <div className="ims-elevated" style={{ padding: "14px 18px", borderRadius: 10, textAlign: "center" }}>
                  <p className="t-muted" style={{ margin: 0, fontSize: 13 }}>Select a vendor above to add products</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {draftPO.rows.map((row, idx) => (
                    <div key={row._id} className="ims-panel" style={{ position: "relative" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <span className="ims-section-title" style={{ margin: 0 }}>Product {idx + 1}</span>
                        {draftPO.rows.length > 1 && <button onClick={() => removeRow(row._id)} className="ims-btn ims-btn-ghost" style={{ padding: "3px 10px", fontSize: 12, color: "var(--danger-text)" }}>✕ Remove</button>}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          <label className="ims-label">Product</label>
                          <select
                            className="ims-input"
                            value={row.productName}
                            onChange={(e) => selectProduct(row._id, e.target.value)}
                          >
                            <option value="">Select product…</option>

                            {products.map((p) => (
                              <option key={p.id} value={p.productName}>
                                {p.productName}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          <label className="ims-label">SKU (auto)</label>
                          <input className="ims-input" value={row.skuId} readOnly style={{ cursor: "not-allowed" }} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          <label className="ims-label">Quantity</label>
                          <input type="number" className="ims-input" value={row.units} onChange={e => updateRow(row._id, "units", e.target.value)} placeholder="0" />
                        </div>
                        {/* ── FIX: editable cost field, pre-filled from buyingPrice ── */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          <label className="ims-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            Cost / Unit ₹
                            {row.costPerHead && <span className="ims-badge ims-badge-green" style={{ fontSize: 9, padding: "1px 5px" }}>Auto</span>}
                          </label>
                          <input
                            type="number"
                            className="ims-input"
                            value={row.costPerHead}
                            onChange={e => updateRow(row._id, "costPerHead", e.target.value)}
                            placeholder={row.productName ? "Enter cost…" : "—"}
                            style={{ borderColor: row.costPerHead ? "var(--success)" : undefined }}
                          />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          <label className="ims-label">Total ₹</label>
                          <div className="t-warning" style={{ fontWeight: 800, fontSize: 15, padding: "9px 0" }}>{row.totalCost ? `₹${Number(row.totalCost).toLocaleString()}` : "—"}</div>
                        </div>
                      </div>
                      {/* Warn if product selected but no buying price found */}
                      {row.productName && !row.costPerHead && (
                        <p className="t-warning" style={{ margin: "8px 0 0", fontSize: 11 }}>
                          ⚠ No buying price found for this product — enter manually
                        </p>
                      )}
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <Button variant="outline" onClick={addRow}>+ Add More</Button>
                    <Button variant="primary" onClick={handleDonePurchasing} disabled={saving}>{saving ? "Saving…" : "✓ Done Purchasing"}</Button>
                    <Button variant="amber" onClick={handleEndPO} disabled={saving}>🔒 End this PO</Button>
                    <Button variant="ghost" onClick={() => { setDraftPO(null); setTab("PO List"); }}>Cancel</Button>
                  </div>
                  {draftPO.rows.some(r => r.totalCost) && (
                    <div className="ims-elevated" style={{ padding: "14px 18px", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="t-secondary" style={{ fontSize: 13 }}>{draftPO.rows.filter(r => r.productName).length} product(s)</span>
                      <span className="t-warning" style={{ fontSize: 20, fontWeight: 900 }}>Grand Total: ₹{draftPO.rows.reduce((s, r) => s + Number(r.totalCost || 0), 0).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          }
        </div>
      )}
    </div>
  );
}