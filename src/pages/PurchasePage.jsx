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

// ─── Shipping distance tiers from Nagpur ─────────────────────────────────────
// Approximate road distances (km) from Nagpur for major Indian cities/states.
// Used to pick a flat shipping charge tier for the PO.
const SHIP_TIERS = [
  // [ keyword list (lowercase),  distance km,  charge ₹ ]
  [["nagpur", "wardha", "amravati", "yavatmal", "chandrapur", "gadchiroli", "bhandara", "gondia"], 0,    0],
  [["pune", "nashik", "aurangabad", "nanded", "latur", "osmanabad", "solapur", "akola", "buldhana", "washim"], 500,  500],
  [["mumbai", "thane", "raigad", "ratnagiri", "sindhudurg", "dhule", "nandurbar", "jalgaon", "kolhapur", "sangli", "satara"], 900,  900],
  [["hyderabad", "secunderabad", "warangal", "nizamabad", "karimnagar", "raipur", "bilaspur", "bhopal", "indore", "jabalpur", "gwalior"], 600,  600],
  [["bangalore", "bengaluru", "mysore", "hubli", "dharwad", "belgaum", "mangalore", "chennai", "madurai", "coimbatore", "kochi", "trivandrum", "visakhapatnam", "vijayawada", "tirupati"], 1200, 1200],
  [["delhi", "noida", "gurugram", "faridabad", "ghaziabad", "agra", "jaipur", "lucknow", "kanpur", "varanasi", "allahabad", "patna", "ranchi"], 1100, 1100],
  [["kolkata", "howrah", "bhubaneswar", "cuttack", "guwahati", "siliguri", "dhanbad"], 1400, 1400],
  [["surat", "ahmedabad", "vadodara", "rajkot", "gandhinagar", "jodhpur", "udaipur", "kota", "ajmer"], 1000, 1000],
  [["chandigarh", "ludhiana", "amritsar", "jalandhar", "shimla", "dehradun", "haridwar", "meerut", "aligarh"], 1300, 1300],
];

const DEFAULT_SHIP_CHARGE = 1500; // ₹ for unknown / very far locations

function getShippingCharge(vendorAddress) {
  if (!vendorAddress) return DEFAULT_SHIP_CHARGE;
  const addr = vendorAddress.toLowerCase();
  for (const [keywords, , charge] of SHIP_TIERS) {
    if (keywords.some(k => addr.includes(k))) return charge;
  }
  return DEFAULT_SHIP_CHARGE;
}

function getShippingLabel(vendorAddress) {
  if (!vendorAddress) return `₹${DEFAULT_SHIP_CHARGE.toLocaleString("en-IN")} (estimated)`;
  const addr = vendorAddress.toLowerCase();
  for (const [keywords, dist, charge] of SHIP_TIERS) {
    if (keywords.some(k => addr.includes(k))) {
      if (dist === 0) return "—  (local / ex-premises)";
      return `₹${charge.toLocaleString("en-IN")}  (~${dist} km)`;
    }
  }
  return `₹${DEFAULT_SHIP_CHARGE.toLocaleString("en-IN")} (long distance)`;
}

// ─── Company / Ship-To constants ─────────────────────────────────────────────
const COMPANY = {
  name:    "3APJ WMS",
  address: "MIDC Eduspark, Nagpur, Maharashtra — 440001",
  phone:   "+91-XXXXXXXXXX",       // ← replace with real number
  email:   "accounts@3apjwms.in",  // ← replace with real email
  gst:     "",                     // ← fill in if applicable
};

// ─── UPDATED printPO ──────────────────────────────────────────────────────────
const printPO = (poGroup, svgEl) => {
  const item0      = poGroup.items[0] || {};
  console.log("[printPO] item0:", item0); 
  const subtotal   = poGroup.items.reduce((s, r) => s + Number(r.totalCost || 0), 0);
  const taxAmt     = Math.round(subtotal * 0.18 * 100) / 100;          // 18% GST
  const vendorAddr = item0.vendorAddress || "";
  const shipAmt    = getShippingCharge(vendorAddr);
  const shipLabel  = getShippingLabel(vendorAddr);
  const grandTotal = subtotal + taxAmt + shipAmt;
  const dateStr    = poGroup.date ? new Date(poGroup.date).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN");

  // Barcode SVG clone
  let barcodeHtml = "";
  if (svgEl) {
    const c = svgEl.cloneNode(true);
    c.style.color = "#000";
    c.querySelectorAll("rect,path").forEach(el => {
      if (!el.getAttribute("fill") || el.getAttribute("fill") === "currentColor") el.setAttribute("fill", "#000");
    });
    barcodeHtml = `<div class="barcode-wrap">${c.outerHTML}<div class="barcode-num">${poGroup.poNumber}</div></div>`;
  }

  // Pad to 18 rows
  const MIN_ROWS = 18;
  const rows     = [...poGroup.items];
  while (rows.length < MIN_ROWS) rows.push(null);

  const rowsHtml = rows.map(r => r
    ? `<tr>
        <td class="td-sku">${r.skuId || "—"}</td>
        <td class="td-product">${r.productName || "—"}</td>
        <td class="td-num">${r.units || 0}</td>
        <td class="td-num">₹${Number(r.costPerHead || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
        <td class="td-num td-total">₹${Number(r.totalCost || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
       </tr>`
    : `<tr>
        <td class="td-sku"></td><td class="td-product"></td>
        <td class="td-num"></td><td class="td-num"></td>
        <td class="td-num td-total td-dash">—</td>
       </tr>`
  ).join("");

  // Vendor contact block for footer
  const vendorFooterLines = [
    poGroup.vendorName           ? `<strong>${poGroup.vendorName}</strong>` : null,
    item0.vendorContact          ? `Phone: ${item0.vendorContact}`          : null,
    item0.vendorEmail            ? `Email: ${item0.vendorEmail}`            : null,
    item0.vendorAddress          ? `Address: ${item0.vendorAddress}`        : null,
    item0.vendorGst              ? `GST: ${item0.vendorGst}`                : null,
  ].filter(Boolean).join("&nbsp;&nbsp;·&nbsp;&nbsp;");

  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Purchase Order — ${poGroup.poNumber}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 20px; }

    .po-wrap { max-width: 720px; margin: 0 auto; border: 2px solid #1565C0; border-radius: 4px; overflow: hidden; }

    /* Header */
    .po-header { display: flex; align-items: flex-start; padding: 18px 20px 14px; border-bottom: 1px solid #e0e0e0; gap: 16px; }
    .po-logo-box { width: 160px; min-width: 160px; height: 90px; background: #0a1628; border-radius: 3px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .po-logo-text { color: #fff; font-size: 28px; font-weight: 900; letter-spacing: -1px; }
    .po-logo-text span { color: #1e88e5; }
    .po-title-block { flex: 1; text-align: right; }
    .po-title-purchase { font-size: 32px; font-weight: 900; color: #1565C0; letter-spacing: 2px; line-height: 1; }
    .po-title-order    { font-size: 26px; font-weight: 900; color: #1565C0; letter-spacing: 1px; line-height: 1; margin-top: 2px; }
    .po-meta-grid { display: grid; grid-template-columns: auto auto; gap: 2px 12px; margin-top: 8px; justify-content: end; }
    .po-meta-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #444; text-align: left; }
    .po-meta-val   { font-size: 10px; font-weight: 700; color: #111; font-family: monospace; }

    /* Vendor / Ship-To */
    .po-parties { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #e0e0e0; }
    .po-party { padding: 0 0 12px; }
    .po-party:first-child { border-right: 1px solid #e0e0e0; }
    .po-party-header { background: #1565C0; color: #fff; font-size: 10px; font-weight: 900; letter-spacing: 0.12em; padding: 5px 14px; text-transform: uppercase; }
    .po-party-body { padding: 10px 14px 0; line-height: 1.75; font-size: 11px; }
    .po-party-body .co-name { font-weight: 700; font-size: 12px; }
    .po-party-body .muted   { color: #555; }

    /* Items table */
    .items-table { width: 100%; border-collapse: collapse; }
    .items-table thead tr { background: #1565C0; color: #fff; }
    .items-table thead th { padding: 7px 10px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; text-align: left; border-right: 1px solid rgba(255,255,255,0.2); }
    .items-table thead th:last-child { border-right: none; }
    .items-table tbody td { border-bottom: 1px solid #e8e8e8; border-right: 1px solid #e8e8e8; padding: 5px 10px; font-size: 11px; height: 22px; }
    .items-table tbody td:last-child { border-right: none; }
    .items-table tbody tr:nth-child(odd)  td { background: #fff; }
    .items-table tbody tr:nth-child(even) td { background: #f7f9fc; }
    .td-sku     { font-family: monospace; width: 100px; color: #333; }
    .td-product { }
    .td-num     { text-align: right; width: 80px; }
    .td-total   { font-weight: 700; background: #eef2f8 !important; }
    .td-dash    { color: #aaa; font-weight: 400; }

    /* Footer row: note + totals */
    .po-footer-row { display: flex; border-top: 2px solid #1565C0; }
    .po-note { flex: 1; padding: 12px 16px; font-size: 10px; font-weight: 700; color: #333; border-right: 1px solid #e0e0e0; display: flex; align-items: flex-start; }
    .po-totals { width: 260px; flex-shrink: 0; }
    .po-totals-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 12px; border-bottom: 1px solid #e8e8e8; font-size: 11px; }
    .po-totals-row .lbl { color: #444; font-weight: 600; }
    .po-totals-row .val { font-family: monospace; color: #333; text-align: right; }
    .po-totals-row.tax-row .lbl { color: #1565C0; }
    .po-totals-row.tax-row .val { color: #1565C0; font-weight: 700; }
    .po-totals-row.ship-row .lbl { color: #555; font-size: 10px; }
    .po-totals-row.ship-row .val { color: #555; font-size: 10px; }
    .po-totals-row.grand { background: #FFC107; border-top: 1px solid #e0a800; }
    .po-totals-row.grand .lbl { font-weight: 900; font-size: 12px; color: #111; }
    .po-totals-row.grand .val { font-weight: 900; font-size: 12px; color: #111; }

    /* Barcode */
    .barcode-section { padding: 12px 20px 10px; display: flex; justify-content: center; border-top: 1px solid #e0e0e0; }
    .barcode-wrap { text-align: center; }
    .barcode-wrap svg { width: 240px; max-width: 100%; display: block; margin: 0 auto; }
    .barcode-num { font-family: monospace; font-size: 10px; color: #777; margin-top: 3px; letter-spacing: 0.08em; }

    /* Contact footer */
    .po-contact-footer { text-align: center; padding: 14px 20px 16px; font-size: 10px; color: #555; line-height: 1.9; border-top: 1px solid #e8e8e8; }
    .po-contact-footer .vendor-details { display: inline-block; margin-top: 4px; font-size: 11px; font-weight: 600; color: #111; }

    @media print { body { padding: 0; } .po-wrap { border-radius: 0; } }
  </style>
</head>
<body>
<div class="po-wrap">

  <!-- Header -->
  <div class="po-header">
    <div class="po-logo-box">
      <div class="po-logo-text"><span>3</span>APJ</div>
    </div>
    <div class="po-title-block">
      <div class="po-title-purchase">PURCHASE</div>
      <div class="po-title-order">ORDER</div>
      <div class="po-meta-grid">
        <div class="po-meta-label">DATE</div><div class="po-meta-val">${dateStr}</div>
        <div class="po-meta-label">PO #</div><div class="po-meta-val">${poGroup.poNumber}</div>
        <div class="po-meta-label">STATUS</div><div class="po-meta-val">${poGroup.status}</div>
      </div>
    </div>
  </div>

<!-- Vendor / Ship-To -->
  <div class="po-parties">
    <div class="po-party">
      <div class="po-party-header">Vendor</div>
      <div class="po-party-body">
        <div class="co-name">${poGroup.vendorName || "—"}</div>
        ${item0.vendorContact ? `<div class="muted">Phone: ${item0.vendorContact}</div>` : ""}
        ${item0.vendorEmail ? `<div class="muted">Email: ${item0.vendorEmail || "—"}</div>` : ""}
        ${item0.vendorGst     ? `<div class="muted">GST: ${item0.vendorGst}</div>`       : ""}
        ${item0.vendorAddress ? `<div class="muted">Address: ${item0.vendorAddress || "—"}</div>` : ""}
        ${(() => { const pin = (item0.vendorAddress || "").match(/\b[1-9][0-9]{5}\b/); return pin ? `<div class="muted">Pincode: ${pin[0]}</div>` : ""; })()}
      </div>
    </div>
    <div class="po-party">
      <div class="po-party-header">Ship To</div>
      <div class="po-party-body">
        <div class="co-name">${COMPANY.name}</div>
        <div class="muted">${COMPANY.address}</div>
        <div class="muted">Phone: ${COMPANY.phone}</div>
        <div class="muted">Email: ${COMPANY.email}</div>
        ${COMPANY.gst ? `<div class="muted">GST: ${COMPANY.gst}</div>` : ""}
      </div>
    </div>
  </div>

  <!-- Items table -->
  <table class="items-table">
    <thead>
      <tr>
        <th class="td-sku">SKU ID #</th>
        <th class="td-product">Product Name</th>
        <th class="td-num">QTY</th>
        <th class="td-num">Unit Price</th>
        <th class="td-num">Total</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <!-- Footer: note + totals -->
  <div class="po-footer-row">
    <div class="po-note">
      Goods once sold will not be taken back.<br/>Delivery Ex-Premises.
    </div>
    <div class="po-totals">
      <div class="po-totals-row">
        <span class="lbl">SUBTOTAL</span>
        <span class="val">₹${subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
      </div>
      <div class="po-totals-row tax-row">
        <span class="lbl">TAX (GST 18%)</span>
        <span class="val">₹${taxAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
      </div>
      <div class="po-totals-row ship-row">
        <span class="lbl">SHIPPING${vendorAddr ? ` <em style="font-weight:400;font-style:normal;font-size:9px;color:#888">(${vendorAddr.split(",").slice(-2).join(",").trim()})</em>` : ""}</span>
        <span class="val">${shipLabel}</span>
      </div>
      <div class="po-totals-row">
        <span class="lbl">OTHER</span>
        <span class="val">—</span>
      </div>
      <div class="po-totals-row grand">
        <span class="lbl">TOTAL</span>
        <span class="val">₹ ${grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
      </div>
    </div>
  </div>

  <!-- Barcode -->
  ${barcodeHtml ? `<div class="barcode-section">${barcodeHtml}</div>` : ""}

<!-- Contact footer -->
  <div class="po-contact-footer">
    If you have any questions about this purchase order, please contact<br/>
    <span class="vendor-details">
      ${poGroup.vendorName || "—"}
      ${item0.vendorContact ? `&nbsp;·&nbsp; Phone: ${item0.vendorContact}` : ""}
      ${item0.vendorEmail   ? `&nbsp;·&nbsp; Email: ${item0.vendorEmail}`   : ""}
    </span><br/>
    <span style="font-size:9px;color:#aaa;margin-top:4px;display:inline-block">
      Generated by 3APJ WMS · ${new Date().toLocaleString("en-IN")}
    </span>
  </div>

</div>
<script>window.onload = () => { window.print(); }</script>
</body>
</html>`);
  win.document.close();
};
// ─── END printPO ──────────────────────────────────────────────────────────────

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
  const isLoadingRef = useRef(false);

  const load = async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setLoading(true);
    try {
      const [purchasesData, vendorsData, productsData] = await Promise.all([
        getAll("purchases"),
        getAll("vendors"),
        getAll("products")
      ]);

      console.log("[PurchasePage] Loaded:", {
        purchases: purchasesData.length,
        vendors: vendorsData.length,
        products: productsData.length,
        sampleVendor: vendorsData[0],
        sampleProduct: productsData[0]
      });

      setPurchases(purchasesData);
      setVendors(vendorsData);
      setProducts(productsData);
    } catch (err) {
      console.error("[PurchasePage] Load failed:", err);
      setToast({ msg: "Failed to load data: " + err.message, type: "error" });
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

  useEffect(() => { load(); }, []);

  const grouped = groupByPO(purchases);
  const uniqueVendors = [...new Map(vendors.map(v => [v.vendorName, v])).values()];

  const filterByVendor = true;
  const availableProducts = filterByVendor && draftPO?.vendorName
    ? products.filter(p => p.vendorName === draftPO.vendorName)
    : products;

  const handleNewPO = () => {
    setDraftPO({ poNumber: genPoNumber(), purchaseDate: new Date().toISOString().split("T")[0], vendorName: "", vendorInfo: emptyVendor, rows: [emptyRow()] });
    setTab("Add Purchase");
  };

  const handleVendorSelect = vendorName => {
    const v = vendors.find(v => v.vendorName === vendorName) || {};
    console.log("[VendorSelect] raw vendor doc:", v); 
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

  const selectProduct = (id, name) => {
    const p = products.find(prod => prod.productName === name);
    if (!p) return;
    const buying = p.buyingPrice ?? p.costPrice ?? p.mrp ?? "";
    setDraftPO(d => ({
      ...d,
      rows: d.rows.map(r => {
        if (r._id !== id) return r;
        const total = r.units && buying ? String(Math.round(Number(r.units) * Number(buying) * 100) / 100) : "";
        return { ...r, productName: name, skuId: p.skuId || "", costPerHead: String(buying), totalCost: total };
      })
    }));
  };

  const addRow    = () => setDraftPO(d => ({ ...d, rows: [...d.rows, emptyRow()] }));
  const removeRow = id  => setDraftPO(d => ({ ...d, rows: d.rows.filter(r => r._id !== id) }));

  const handleDonePurchasing = async () => {
    const valid = draftPO.rows.filter(r => r.productName);
    if (!valid.length) return setToast({ msg: "Add at least one product", type: "error" });
    if (!draftPO.vendorName) return setToast({ msg: "Select a vendor first", type: "error" });
    setSaving(true);
    try {
      const audit = getAuditFields();
      for (const r of valid) {
        await addItem("purchases", {
          poNumber:      draftPO.poNumber,
          purchaseDate:  draftPO.purchaseDate,
          vendorName:    draftPO.vendorName,
          vendorContact: draftPO.vendorInfo?.contact  || "",
          vendorEmail:   draftPO.vendorInfo?.email    || "",   // ← now saved
          vendorGst:     draftPO.vendorInfo?.gstNo    || "",
          vendorAddress: draftPO.vendorInfo?.address  || "",   // ← now saved
          productName:   r.productName,
          skuId:         r.skuId,
          units:         Number(r.units || 0),
          costPerHead:   Number(r.costPerHead || 0),
          totalCost:     Number(r.totalCost || 0),
          status:        "ACTIVE",
          ...audit
        });
      }
      const grandTotal = valid.reduce((s, r) => s + Number(r.totalCost || 0), 0);
      setToast({ msg: `PO ${draftPO.poNumber} saved — ${valid.length} product(s) · ₹${grandTotal.toLocaleString()}`, type: "success" });
      await load();
      setExpandedPO(draftPO.poNumber);
      setDraftPO(null);
      setTab("PO List");
    } catch (err) {
      console.error("[PurchasePage] Save failed:", err);
      setToast({ msg: "Failed to save PO: " + err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleEndPO = async () => {
    if (!draftPO) return;
    try {
      const audit = getAuditFields();
      const existing = purchases.filter(p => p.poNumber === draftPO.poNumber);
      for (const p of existing) await updateItem("purchases", p.id, { status: "COMPLETED", ...audit });
      setToast({ msg: `PO ${draftPO.poNumber} completed & locked`, type: "success" });
      setDraftPO(null);
      await load();
      setTab("PO List");
    } catch (err) {
      console.error("[PurchasePage] End PO failed:", err);
      setToast({ msg: "Failed to complete PO: " + err.message, type: "error" });
    }
  };

  const lockPO = async poNumber => {
    try {
      const audit = getAuditFields();
      const items = purchases.filter(p => p.poNumber === poNumber);
      for (const p of items) await updateItem("purchases", p.id, { status: "COMPLETED", ...audit });
      setToast({ msg: `PO ${poNumber} locked`, type: "success" });
      load();
    } catch (err) {
      console.error("[PurchasePage] Lock PO failed:", err);
      setToast({ msg: "Failed to lock PO: " + err.message, type: "error" });
    }
  };

  const deletePO = async poNumber => {
    try {
      const items = purchases.filter(p => p.poNumber === poNumber);
      for (const p of items) await deleteItem("purchases", p.id);
      setToast({ msg: `PO ${poNumber} deleted`, type: "success" });
      load();
    } catch (err) {
      console.error("[PurchasePage] Delete PO failed:", err);
      setToast({ msg: "Failed to delete PO: " + err.message, type: "error" });
    }
  };

  const getBarcodeRef = pn => {
    if (!barcodeRefs.current[pn]) barcodeRefs.current[pn] = { current: null };
    return barcodeRefs.current[pn];
  };

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <SectionHeader title="Purchase" subtitle="Multi-product purchase orders">
        <Button variant="primary" onClick={handleNewPO}>+ New PO</Button>
      </SectionHeader>
      <div className="ims-tab-bar">
        {["PO List", "Add Purchase"].map(t => (
          <button key={`tab-${t}`} className={`ims-tab${tab === t ? " active" : ""}`} onClick={() => { if (t === "Add Purchase" && !draftPO) return handleNewPO(); setTab(t); }}>{t}</button>
        ))}
      </div>

      {/* ── PO List ── */}
      {tab === "PO List" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Button variant="ghost" onClick={load} style={{ width: "fit-content" }}>↻ Refresh</Button>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 64 }}>
              <div className="spin" style={{ width: 24, height: 24, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%" }} />
            </div>
          ) : grouped.length === 0 ? (
            <div className="ims-panel" style={{ textAlign: "center" }}>
              <p className="t-muted" style={{ marginBottom: 16 }}>No POs yet</p>
              <Button onClick={handleNewPO}>+ Create First PO</Button>
            </div>
          ) : (
            grouped.map(po => {
              const grandTotal = po.items.reduce((s, r) => s + Number(r.totalCost || 0), 0);
              const isExpanded = expandedPO === po.poNumber;
              const bRef = getBarcodeRef(po.poNumber);
              return (
                <div key={`po-card-${po.poNumber}`} className="ims-card" style={{ overflow: "hidden" }}>
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
                      <div style={{ height: 0, overflow: "hidden" }}>
                        <BarcodeSvg value={po.poNumber} svgRef={bRef} />
                      </div>
                      <table className="ims-table" style={{ marginTop: 16 }}>
                        <thead>
                          <tr>
                            {["#", "Product", "SKU", "Qty", "Cost/Unit", "Total"].map((c, idx) => (
                              <th key={`th-${po.poNumber}-${c}-${idx}`}>{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {po.items.map((r, i) => (
                            <tr key={`${po.poNumber}-item-${r.id || i}`}>
                              <td className="t-muted" style={{ padding: "10px 16px", fontSize: 12 }}>{i + 1}</td>
                              <td style={{ padding: "10px 16px", fontWeight: 600 }}>{r.productName}</td>
                              <td className="mono" style={{ padding: "10px 16px" }}>{r.skuId}</td>
                              <td style={{ padding: "10px 16px" }}>{r.units}</td>
                              <td style={{ padding: "10px 16px" }}>₹{Number(r.costPerHead).toLocaleString()}</td>
                              <td style={{ padding: "10px 16px", fontWeight: 700 }} className="t-warning">₹{Number(r.totalCost).toLocaleString()}</td>
                            </tr>
                          ))}
                          <tr key={`${po.poNumber}-total`} style={{ borderTop: "2px solid var(--border)" }}>
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
          )}
        </div>
      )}

      {/* ── Add Purchase ── */}
      {tab === "Add Purchase" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {!draftPO ? (
            <div className="ims-panel" style={{ textAlign: "center" }}>
              <p className="t-muted" style={{ marginBottom: 16 }}>No active PO.</p>
              <Button onClick={handleNewPO}>+ New PO</Button>
            </div>
          ) : (
            <>
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
                      {uniqueVendors.map(v => (
                        <option key={`vendor-opt-${v.id || v.vendorName}`} value={v.vendorName}>{v.vendorName}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {draftPO.vendorName && (
                  <div className="ims-success-box" style={{ marginTop: 14 }}>
                    <p className="t-success" style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700 }}>✓ VENDOR SELECTED</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      {[["Contact", draftPO.vendorInfo?.contact], ["GST", draftPO.vendorInfo?.gstNo], ["Address", draftPO.vendorInfo?.address]].map(([l, v]) => (
                        <div key={`vendor-meta-${l}`}>
                          <p className="t-muted" style={{ margin: 0, fontSize: 11 }}>{l}</p>
                          <p className="t-primary" style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 600 }}>{v || "—"}</p>
                        </div>
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
                    <div key={`product-row-${row._id}`} className="ims-panel" style={{ position: "relative" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <span className="ims-section-title" style={{ margin: 0 }}>Product {idx + 1}</span>
                        {draftPO.rows.length > 1 && (
                          <button onClick={() => removeRow(row._id)} className="ims-btn ims-btn-ghost" style={{ padding: "3px 10px", fontSize: 12, color: "var(--danger-text)" }}>✕ Remove</button>
                        )}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          <label className="ims-label">Product</label>
                          <select className="ims-input" value={row.productName} onChange={e => selectProduct(row._id, e.target.value)}>
                            <option value="">Select product…</option>
                            {availableProducts.map(p => (
                              <option key={`product-opt-${p.id || p.skuId || p.productName}`} value={p.productName}>{p.productName}</option>
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
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          <label className="ims-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            Cost / Unit ₹
                            {row.costPerHead && <span className="ims-badge ims-badge-green" style={{ fontSize: 9, padding: "1px 5px" }}>Auto</span>}
                          </label>
                          <input type="number" className="ims-input" value={row.costPerHead} onChange={e => updateRow(row._id, "costPerHead", e.target.value)} placeholder={row.productName ? "Enter cost…" : "—"} style={{ borderColor: row.costPerHead ? "var(--success)" : undefined }} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          <label className="ims-label">Total ₹</label>
                          <div className="t-warning" style={{ fontWeight: 800, fontSize: 15, padding: "9px 0" }}>
                            {row.totalCost ? `₹${Number(row.totalCost).toLocaleString()}` : "—"}
                          </div>
                        </div>
                      </div>
                      {row.productName && !row.costPerHead && (
                        <p className="t-warning" style={{ margin: "8px 0 0", fontSize: 11 }}>⚠ No buying price found for this product — enter manually</p>
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
          )}
        </div>
      )}

      {/* Footer Credit */}
      <div style={{ textAlign: "center", padding: "16px 0", fontSize: "14px", color: "var(--text-primary)", borderTop: "1px solid var(--border)", marginTop: "30px", opacity: 0.8 }}>
        © {new Date().getFullYear()} 3APJ WMS · Engineered by Amit Waghmare & Ajay Rathod · Powered by Firebase
      </div>
    </div>
  );
}