import { useState, useEffect, useRef } from "react";
import useCrud from "../hooks/useCrud";
import { getAll, genOrderId } from "../services/firestoreService";
import { getAuditFields } from "../services/authService";
import { Badge, Table, Td, Input, Select, Button, FormCard, SectionHeader, Toast } from "../components/ui/index.jsx";
import Modal from "../components/ui/Modal";
import { cacheManager, CACHE_TTL } from "../services/cacheManager";

const STATUS_OPTIONS = ["In Transit", "Pick", "Pack", "Shipped"];

// ── Status badge colors ──────────────────────────────────────────
const STATUS_BADGE = {
  "In Transit": "violet",
  Pick: "cyan",
  Pack: "amber",
  Shipped: "green",
};

// ── Status icons — intuitive, modern emoji/SVG icons ────────────
const STATUS_ICON = {
  "In Transit": (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  Pick: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>
  ),
  Pack: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
  Shipped: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="16 12 12 8 8 12"/><line x1="12" y1="16" x2="12" y2="8"/>
    </svg>
  ),
};

// ── Status badge color styles (inline, for consistency) ──────────
const STATUS_STYLE = {
  "In Transit": { background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" },
  Pick:         { background: "rgba(6,182,212,0.15)",  color: "#22d3ee",  border: "1px solid rgba(6,182,212,0.3)" },
  Pack:         { background: "rgba(245,158,11,0.15)", color: "#fbbf24",  border: "1px solid rgba(245,158,11,0.3)" },
  Shipped:      { background: "rgba(34,197,94,0.15)",  color: "#4ade80",  border: "1px solid rgba(34,197,94,0.3)" },
};

function StatusBadge({ status }) {
  const icon  = STATUS_ICON[status];
  const style = STATUS_STYLE[status] || STATUS_STYLE["In Transit"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      whiteSpace: "nowrap", ...style,
    }}>
      {icon}
      {status || "In Transit"}
    </span>
  );
}

const VALID_STATUSES = new Set(STATUS_OPTIONS);

const empty = {
  name: "", contact: "", email: "", address: "",
  productName: "", skuId: "", quantity: "", status: "In Transit"
};

const validatePhone = v => /^[6-9]\d{9}$/.test((v || "").toString().replace(/\s/g, ""));
const validateEmail = v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// ── Column name → field key mapping (case-insensitive) ──────────────────
const COL_MAP = {
  "full name": "name", "name": "name", "contact": "contact",
  "email": "email", "address": "address", "product name": "productName",
  "productname": "productName", "sku id": "skuId", "skuid": "skuId",
  "sku": "skuId", "quantity": "quantity", "qty": "quantity", "status": "status",
};

// ── Validate a single parsed row against live inventory ──────────────────
function validateRow(row, invProducts) {
  const errors = [];
  if (!row.name?.toString().trim()) errors.push("Name is required");

  const contact = (row.contact || "").toString().trim();
  if (!contact) errors.push("Contact is required");
  else if (!validatePhone(contact)) errors.push("Contact must be 10 digits starting 6–9");

  if (!validateEmail(row.email)) errors.push("Invalid email format");
  if (!row.productName?.toString().trim()) errors.push("Product Name is required");
  if (!row.skuId?.toString().trim()) errors.push("SKU ID is required");

  // ── QUANTITY VALIDATION: must be strictly > 0 ──────────────────
  const qty = Number(row.quantity);
  if (row.quantity === "" || row.quantity === null || row.quantity === undefined) {
    errors.push("Quantity is required");
  } else if (!Number.isInteger(qty) || qty <= 0) {
    errors.push("Quantity must be a positive whole number greater than 0");
  }

  if (!row.status) errors.push("Status is required");
  else if (!VALID_STATUSES.has(row.status.toString().trim()))
    errors.push(`Status must be one of: ${STATUS_OPTIONS.join(", ")}`);

  if (row.productName && row.skuId && qty > 0) {
    const inv = invProducts.find(
      p => p.productName?.toLowerCase() === row.productName.toString().toLowerCase().trim()
        || p.skuId?.toLowerCase() === row.skuId.toString().toLowerCase().trim()
    );
    if (!inv) errors.push("Product not found in inventory or out of stock");
    else if (qty > inv.realStock)
      errors.push(`Only ${inv.realStock} units available (requested ${qty})`);
  }
  return errors;
}

// ── Parse uploaded .xlsx with ExcelJS ────────────────────────────────────
async function parseExcelWithExcelJS(file) {
  const ExcelJS = (await import("exceljs")).default;
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("No worksheets found in the file.");

  const rawRows = [];
  ws.eachRow({ includeEmpty: false }, row => {
    const values = [];
    row.eachCell({ includeEmpty: true }, cell => {
      let val = "";
      const v = cell.value;
      if (v === null || v === undefined) { val = ""; }
      else if (typeof v === "object" && v.richText) { val = v.richText.map(r => r.text).join("").trim(); }
      else if (typeof v === "object" && v.result !== undefined) { val = v.result ?? ""; }
      else if (v instanceof Date) { val = v.toISOString().split("T")[0]; }
      else { val = v; }
      values.push(val);
    });
    rawRows.push({ rowNumber: row.number, values });
  });
  if (!rawRows.length) throw new Error("The sheet appears to be empty.");

  let headerRowIdx = -1;
  let colMapping = {};
  for (let ri = 0; ri < Math.min(8, rawRows.length); ri++) {
    const mapping = {};
    rawRows[ri].values.forEach((cell, ci) => {
      const key = COL_MAP[(cell ?? "").toString().toLowerCase().replace(/\s*\*/g, "").trim()];
      if (key) mapping[ci] = key;
    });
    if (Object.keys(mapping).length >= 3) { headerRowIdx = ri; colMapping = mapping; break; }
  }
  if (headerRowIdx === -1) throw new Error("Could not find a valid header row.");

  const dataRows = [];
  for (let ri = headerRowIdx + 1; ri < rawRows.length; ri++) {
    const { rowNumber, values } = rawRows[ri];
    if (values.every(v => v === "" || v === null || v === undefined)) continue;
    if (ri === headerRowIdx + 1) {
      const mappedVals = Object.keys(colMapping).map(ci => (values[Number(ci)] ?? "").toString());
      const hasPhone = mappedVals.some(v => /^\d{10}$/.test(v.replace(/\s/g, "")));
      const hasQty = mappedVals.some(v => /^\d{1,5}$/.test(v.trim()));
      if (!hasPhone && !hasQty) continue;
    }
    const obj = {};
    Object.entries(colMapping).forEach(([ci, field]) => {
      let rawVal = values[Number(ci)];
      let val = "";
      if (rawVal === null || rawVal === undefined) { val = ""; }
      else if (typeof rawVal === "object") {
        if (rawVal.richText) val = rawVal.richText.map(r => r.text).join("");
        else if (rawVal.text) val = rawVal.text;
        else if (rawVal.result !== undefined) val = rawVal.result;
        else val = JSON.stringify(rawVal);
      } else if (rawVal instanceof Date) { val = rawVal.toISOString().split("T")[0]; }
      else { val = rawVal; }
      val = String(val).trim();
      if (field === "contact") { const cleaned = val.replace(/\D/g, ""); val = cleaned.length ? cleaned : val; }
      if (field === "email") { val = val.toLowerCase().trim(); }
      obj[field] = val;
    });
    dataRows.push({ _raw: obj, rowNum: rowNumber });
  }
  if (!dataRows.length) throw new Error("No data rows found.");
  return dataRows;
}

const rowBg = (errors, skipped) =>
  skipped ? "rgba(107,114,128,0.08)" :
    errors.length > 0 ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)";

// ─────────────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const { items: customers, loading, saving, add, remove, update } = useCrud("customers");
  const [tab, setTab] = useState("List");
  const [form, setForm] = useState(empty);
  const [invProducts, setInvProducts] = useState([]);
  const [editItem, setEditItem] = useState(null);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [errors, setErrors] = useState({});

  const [importFile, setImportFile] = useState(null);
  const [importRows, setImportRows] = useState([]);
  const [importParsing, setImportParsing] = useState(false);
  const [importSaving, setImportSaving] = useState(false);
  const [importDone, setImportDone] = useState(null);
  const [skipRows, setSkipRows] = useState({});
  const fileInputRef = useRef();

  const loadInventory = () =>
    Promise.all([
      cacheManager.getOrFetch("getall:inventory", () => getAll("inventory"), CACHE_TTL.SHORT).then(r => r.data),
      cacheManager.getOrFetch("getall:customers",  () => getAll("customers"),  CACHE_TTL.SHORT).then(r => r.data),
    ]).then(([inv, custs]) => {
      const committed = {};
      custs
        .filter(c => c.status === "In Transit" || c.status === "Pick")
        .forEach(c => { committed[c.skuId] = (committed[c.skuId] || 0) + Number(c.quantity || 0); });
      const inStock = inv
        .filter(i => Number(i.availableStock || 0) > 0)
        .map(i => ({ ...i, realStock: Math.max(0, Number(i.availableStock || 0) - (committed[i.skuId] || 0)) }))
        .filter(i => i.realStock > 0);
      setInvProducts(inStock);
    });

  useEffect(() => { loadInventory(); }, []);

  useEffect(() => {
    if (!importRows.length) return;
    setImportRows(prev => prev.map(r => ({ ...r, errors: skipRows[r.rowNum] ? [] : validateRow(r._raw, invProducts) })));
  }, [invProducts]);

  const f = k => e => { setForm(p => ({ ...p, [k]: e.target.value })); setErrors(p => ({ ...p, [k]: "" })); };

  const pickProduct = name => {
    const item = invProducts.find(i => i.productName === name);
    setForm(prev => ({ ...prev, productName: name, skuId: item?.skuId || "" }));
  };

  // ── QUANTITY VALIDATION: strictly > 0 ────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.name) e.name = "Name is required";
    if (!form.contact) e.contact = "Phone is required";
    else if (!validatePhone(form.contact)) e.contact = "Enter valid 10-digit mobile";
    if (form.email && !validateEmail(form.email)) e.email = "Enter valid email";
    if (!form.productName) e.product = "Select a product";

    // Quantity must be strictly greater than 0
    const qty = Number(form.quantity);
    if (form.quantity === "" || form.quantity === null || form.quantity === undefined) {
      e.quantity = "Quantity is required";
    } else if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
      e.quantity = "Quantity must be a whole number greater than 0";
    } else if (form.productName) {
      const sel = invProducts.find(p => p.productName === form.productName);
      if (sel && qty > sel.realStock)
        e.quantity = `Only ${sel.realStock} units available (after committed orders)`;
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAdd = async () => {
    if (!validate()) return;
    const orderId = genOrderId();
    await add({ ...form, orderId, quantity: Number(form.quantity), createdAt: new Date().toISOString() });
    setForm(empty); setTab("List");
    setToast({ msg: `Order ${orderId} created`, type: "success" });
  };

  const handleUpdate = async () => {
    const e = {};
    if (editItem.contact && !validatePhone(editItem.contact)) e.contact = "Invalid mobile";
    if (editItem.email && !validateEmail(editItem.email)) e.email = "Invalid email";

    // Validate quantity in edit modal too
    const qty = Number(editItem.quantity);
    if (!editItem.quantity && editItem.quantity !== 0) {
      e.quantity = "Quantity is required";
    } else if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
      e.quantity = "Quantity must be a whole number greater than 0";
    }

    if (Object.keys(e).length) return setErrors(e);
    await update(editItem.id, editItem);
    setEditItem(null);
    setToast({ msg: "Updated", type: "success" });
  };

  const handleFileChange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file); setImportDone(null); setSkipRows({}); setImportParsing(true);
    try {
      const rows = await parseExcelWithExcelJS(file);
      setImportRows(rows.map(r => ({ ...r, errors: validateRow(r._raw, invProducts) })));
    } catch (err) {
      setToast({ msg: "Parse error: " + err.message, type: "error" });
      setImportRows([]);
    }
    setImportParsing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleSkip = rowNum => {
    setSkipRows(prev => {
      const next = { ...prev, [rowNum]: !prev[rowNum] };
      setImportRows(rows => rows.map(r => ({ ...r, errors: next[r.rowNum] ? [] : validateRow(r._raw, invProducts) })));
      return next;
    });
  };

  const handleConfirmImport = async () => {
    const toImport = importRows.filter(r => !skipRows[r.rowNum] && r.errors.length === 0);
    if (!toImport.length) { setToast({ msg: "No valid rows to import", type: "error" }); return; }
    setImportSaving(true);
    let success = 0, failed = 0;
    const audit = getAuditFields();
    for (const r of toImport) {
      try {
        const orderId = genOrderId();
        await add({ orderId, name: r._raw.name, contact: r._raw.contact, email: r._raw.email || "", address: r._raw.address || "", productName: r._raw.productName, skuId: r._raw.skuId, quantity: Number(r._raw.quantity), status: r._raw.status || "In Transit", createdAt: new Date().toISOString(), importedFrom: importFile?.name || "bulk-import", ...audit });
        success++;
      } catch { failed++; }
    }
    setImportSaving(false);
    setImportDone({ success, failed, skipped: Object.values(skipRows).filter(Boolean).length });
    setImportRows([]); setImportFile(null); setSkipRows({});
    setToast({ msg: `Import complete — ${success} created${failed ? `, ${failed} failed` : ""}`, type: success ? "success" : "error" });
  };

  const resetImport = () => {
    setImportRows([]); setImportFile(null); setSkipRows({}); setImportDone(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validCount = importRows.filter(r => !skipRows[r.rowNum] && r.errors.length === 0).length;
  const errorCount = importRows.filter(r => !skipRows[r.rowNum] && r.errors.length > 0).length;
  const skippedCount = Object.values(skipRows).filter(Boolean).length;

  const filtered = customers.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.orderId?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Quantity input change — reject 0 and negatives live ──────────
  const handleQuantityChange = (e) => {
    const val = e.target.value;
    setForm(p => ({ ...p, quantity: val }));
    // Live inline feedback
    const qty = Number(val);
    if (val !== "" && (isNaN(qty) || qty <= 0 || !Number.isInteger(qty))) {
      setErrors(p => ({ ...p, quantity: "Quantity must be a whole number greater than 0" }));
    } else {
      setErrors(p => ({ ...p, quantity: "" }));
    }
  };

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <SectionHeader title="Customers" subtitle={`${customers.length} orders`} />

      <div className="ims-tab-bar">
        {["List", "Add", "Bulk Import", "Edit / Delete"].map(t => (
          <button key={t} className={`ims-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t}
            {t === "Bulk Import" && importRows.length > 0 && (
              <span className="ims-badge ims-badge-amber" style={{ marginLeft: 6, fontSize: 10, padding: "1px 6px" }}>{importRows.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Status Legend Bar ── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, padding: "10px 14px", background: "var(--bg-elevated)", borderRadius: 10, border: "1px solid var(--border)" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "center", marginRight: 4 }}>Status:</span>
        {STATUS_OPTIONS.map(s => <StatusBadge key={s} status={s} />)}
      </div>

      {/* ── List ── */}
      {tab === "List" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input className="ims-input" style={{ width: 300 }} placeholder="Search name or order ID…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <Table loading={loading}
            cols={["Order ID", "Customer", "Contact", "Email", "Address", "Product", "SKU", "Qty", "Status"]}
            rows={filtered}
            renderRow={r => (<>
              <Td mono><span className="t-accent">{r.orderId}</span></Td>
              <Td><span style={{ fontWeight: 600 }}>{r.name}</span></Td>
              <Td>{r.contact}</Td><Td>{r.email}</Td><Td>{r.address}</Td>
              <Td>{r.productName}</Td><Td mono>{r.skuId}</Td><Td>{r.quantity}</Td>
              <Td><StatusBadge status={r.status || "In Transit"} /></Td>
            </>)}
          />
        </div>
      )}

      {/* ── Add ── */}
      {tab === "Add" && (
        <FormCard title="Add New Order" onSubmit={handleAdd} loading={saving} submitLabel="Create Order">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Input label="Full Name" value={form.name} onChange={f("name")} placeholder="Customer name" />
              {errors.name && <span style={{ fontSize: 11, color: "var(--danger-text)" }}>{errors.name}</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Input label="Contact (10-digit)" value={form.contact} onChange={f("contact")} placeholder="9876543210" />
              {errors.contact && <span style={{ fontSize: 11, color: "var(--danger-text)" }}>{errors.contact}</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Input label="Email" value={form.email} onChange={f("email")} placeholder="email@example.com" />
              {errors.email && <span style={{ fontSize: 11, color: "var(--danger-text)" }}>{errors.email}</span>}
            </div>
            <Input label="Address" value={form.address} onChange={f("address")} placeholder="City, State" />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="ims-label">Product <span style={{ fontSize: 10, color: "var(--success-text)" }}>(in-stock only)</span></label>
              <select className="ims-input" value={form.productName} onChange={e => pickProduct(e.target.value)}>
                <option value="">Select product…</option>
                {invProducts.map((p, i) => (
                  <option key={i} value={p.productName}>{p.productName} — {p.realStock} units available</option>
                ))}
              </select>
              {errors.product && <span style={{ fontSize: 11, color: "var(--danger-text)" }}>{errors.product}</span>}
              {form.productName && (() => {
                const sel = invProducts.find(p => p.productName === form.productName);
                if (!sel) return null;
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: 6, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                    <span className="t-success" style={{ fontSize: 12, fontWeight: 700 }}>{sel.realStock} units</span>
                    <span className="t-muted" style={{ fontSize: 11 }}>available after committed orders</span>
                    {sel.availableStock !== sel.realStock && (
                      <span className="t-warning" style={{ fontSize: 11 }}>({sel.availableStock - sel.realStock} committed)</span>
                    )}
                  </div>
                );
              })()}
            </div>
            <Input label="SKU ID (auto)" value={form.skuId} readOnly />

            {/* ── Quantity field with strict > 0 validation ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Input
                label="Quantity"
                type="number"
                value={form.quantity}
                onChange={handleQuantityChange}
                placeholder="Enter quantity (min: 1)"
                min="1"
                step="1"
              />
              {errors.quantity && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--danger-text)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {errors.quantity}
                </span>
              )}
              {!errors.quantity && form.quantity && Number(form.quantity) > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--success-text)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Valid quantity
                </span>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="ims-label">Status</label>
              <select className="ims-input" value={form.status} onChange={f("status")}>
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {/* Live preview of selected status badge */}
              {form.status && (
                <div style={{ marginTop: 2 }}>
                  <StatusBadge status={form.status} />
                </div>
              )}
            </div>
          </div>
          <div className="ims-accent-box" style={{ marginTop: 12 }}>
            <p className="t-muted" style={{ fontSize: 12, margin: 0 }}>
              Only QC-passed, in-stock products are shown. Default status: <strong>In Transit</strong>. Quantity must be ≥ 1.
            </p>
          </div>
        </FormCard>
      )}

      {/* ── Bulk Import ── */}
      {tab === "Bulk Import" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="ims-panel">
            <p className="ims-section-title">Step 1 — Download Template &amp; Upload</p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div className="ims-elevated" style={{ padding: "16px 20px", borderRadius: 10, flex: "0 0 auto", minWidth: 260 }}>
                <p className="t-primary" style={{ fontWeight: 700, margin: "0 0 6px", fontSize: 13 }}>📥 Download Template</p>
                <p className="t-muted" style={{ fontSize: 12, margin: "0 0 12px" }}>Use the official template. Includes sample rows, dropdowns, and an Instructions sheet.</p>
                <a href="/Customer_Bulk_Import_Template.xlsx" download="Customer_Bulk_Import_Template.xlsx"
                  style={{ display: "inline-block", padding: "8px 16px", borderRadius: 7, background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 12, textDecoration: "none" }}>
                  ⬇ Customer_Bulk_Import_Template.xlsx
                </a>
                <p className="t-muted" style={{ fontSize: 10, marginTop: 8 }}>Required columns: Name, Contact, Product Name, SKU ID, Quantity, Status</p>
              </div>
              <div className="ims-elevated" style={{ padding: "16px 20px", borderRadius: 10, flex: 1, minWidth: 280 }}>
                <p className="t-primary" style={{ fontWeight: 700, margin: "0 0 6px", fontSize: 13 }}>📤 Upload Filled File</p>
                <p className="t-muted" style={{ fontSize: 12, margin: "0 0 12px" }}>Accepts .xlsx files. Parsed in-browser — no server upload needed.</p>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 7, border: "2px dashed var(--border)", cursor: "pointer", background: "var(--bg-elevated)", fontWeight: 600, fontSize: 12, color: "var(--text-primary)" }}>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleFileChange} />
                    📁 Choose Excel File
                  </label>
                  {importFile && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="ims-badge ims-badge-cyan" style={{ fontSize: 11 }}>{importFile.name}</span>
                      <button onClick={resetImport} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger-text)", fontSize: 16 }}>✕</button>
                    </div>
                  )}
                </div>
                {importParsing && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                    <div className="spin" style={{ width: 16, height: 16, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%" }} />
                    <span className="t-muted" style={{ fontSize: 12 }}>Parsing…</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {importDone && (
            <div className="ims-success-box" style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
              <p className="t-success" style={{ fontWeight: 800, margin: 0, fontSize: 15 }}>✓ Import Complete</p>
              <span className="t-success" style={{ fontSize: 13 }}><strong>{importDone.success}</strong> orders created</span>
              {importDone.failed > 0 && <span className="t-danger" style={{ fontSize: 13 }}><strong>{importDone.failed}</strong> failed</span>}
              {importDone.skipped > 0 && <span className="t-muted" style={{ fontSize: 13 }}><strong>{importDone.skipped}</strong> skipped</span>}
              <Button variant="ghost" onClick={() => setImportDone(null)}>Dismiss</Button>
            </div>
          )}

          {importRows.length > 0 && (
            <div className="ims-panel">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                <p className="ims-section-title" style={{ margin: 0 }}>Step 2 — Review &amp; Validate ({importRows.length} rows)</p>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="ims-badge ims-badge-green" style={{ fontSize: 11 }}>✓ {validCount} valid</span>
                  {errorCount > 0 && <span className="ims-badge ims-badge-red" style={{ fontSize: 11 }}>✕ {errorCount} errors</span>}
                  {skippedCount > 0 && <span className="ims-badge ims-badge-amber" style={{ fontSize: 11 }}>⊘ {skippedCount} skipped</span>}
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="ims-table">
                  <thead>
                    <tr>{["Row", "Name", "Contact", "Email", "Address", "Product", "SKU", "Qty", "Status", "Issues", "Skip"].map(c => <th key={c} style={{ whiteSpace: "nowrap" }}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {importRows.map(r => {
                      const skipped = !!skipRows[r.rowNum];
                      const errs = skipped ? [] : r.errors;
                      const ok = !skipped && errs.length === 0;
                      return (
                        <tr key={r.rowNum} style={{ background: rowBg(errs, skipped) }}>
                          <td style={{ padding: "10px 12px" }}>
                            {skipped ? <span className="ims-badge ims-badge-amber" style={{ fontSize: 10 }}>⊘ {r.rowNum}</span>
                              : ok ? <span className="ims-badge ims-badge-green" style={{ fontSize: 10 }}>✓ {r.rowNum}</span>
                              : <span className="ims-badge ims-badge-red" style={{ fontSize: 10 }}>✕ {r.rowNum}</span>}
                          </td>
                          <td style={{ padding: "10px 12px", fontWeight: 600 }}>{r._raw.name || <span className="t-danger" style={{ fontSize: 11 }}>missing</span>}</td>
                          <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12 }}>{r._raw.contact}</td>
                          <td style={{ padding: "10px 12px", fontSize: 12 }} className="t-muted">{r._raw.email || "—"}</td>
                          <td style={{ padding: "10px 12px", fontSize: 12 }} className="t-muted">{r._raw.address || "—"}</td>
                          <td style={{ padding: "10px 12px", fontSize: 12 }}>{r._raw.productName || <span className="t-danger" style={{ fontSize: 11 }}>missing</span>}</td>
                          <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12 }} className="t-accent">{r._raw.skuId || <span className="t-danger" style={{ fontSize: 11 }}>missing</span>}</td>
                          <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 700 }}>{r._raw.quantity || <span className="t-danger" style={{ fontSize: 11 }}>—</span>}</td>
                          <td style={{ padding: "10px 12px" }}>{r._raw.status ? <StatusBadge status={r._raw.status} /> : <span className="t-danger" style={{ fontSize: 11 }}>missing</span>}</td>
                          <td style={{ padding: "10px 12px", minWidth: 200 }}>
                            {skipped ? <span className="t-muted" style={{ fontSize: 11, fontStyle: "italic" }}>Skipped</span>
                              : errs.length === 0 ? <span className="t-success" style={{ fontSize: 11 }}>✓ No issues</span>
                              : <ul style={{ margin: 0, paddingLeft: 14 }}>{errs.map((e, i) => <li key={i} style={{ fontSize: 11, color: "var(--badge-red-fg)", lineHeight: "1.6" }}>{e}</li>)}</ul>}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                            <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, cursor: "pointer" }}>
                              <input type="checkbox" checked={!!skipRows[r.rowNum]} onChange={() => toggleSkip(r.rowNum)} style={{ width: 14, height: 14, cursor: "pointer", accentColor: "var(--accent)" }} />
                              <span className="t-muted" style={{ fontSize: 10 }}>Skip</span>
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                {validCount === 0 && errorCount > 0 ? (
                  <div className="ims-elevated" style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid var(--badge-red-br)", flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--badge-red-fg)" }}>⚠ All rows have errors. Fix the file and re-upload, or mark rows as "Skip".</p>
                  </div>
                ) : (
                  <>
                    <Button variant="primary" onClick={handleConfirmImport} disabled={importSaving || validCount === 0}>
                      {importSaving ? `Importing… (${validCount} orders)` : `✓ Confirm Import (${validCount} valid rows)`}
                    </Button>
                    {errorCount > 0 && <span className="t-warning" style={{ fontSize: 12 }}>⚠ {errorCount} row{errorCount > 1 ? "s" : ""} with errors will be skipped</span>}
                  </>
                )}
                <Button variant="ghost" onClick={resetImport} disabled={importSaving}>✕ Cancel</Button>
              </div>
            </div>
          )}

          {!importRows.length && !importParsing && !importDone && (
            <div className="ims-elevated" style={{ padding: "40px 24px", borderRadius: 12, textAlign: "center", border: "2px dashed var(--border)" }}>
              <p style={{ fontSize: 32, margin: "0 0 10px" }}>📊</p>
              <p className="t-primary" style={{ fontWeight: 700, margin: "0 0 6px" }}>No file uploaded yet</p>
              <p className="t-muted" style={{ fontSize: 12, margin: 0 }}>Download the template, fill it in, then upload it here for validation and import.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Edit / Delete ── */}
      {tab === "Edit / Delete" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 720 }}>
          {customers.map((c, i) => (
            <div key={c.id} className="ims-row-item fade-up" style={{ animationDelay: `${i * 30}ms` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div>
                  <p className="t-primary" style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{c.name}</p>
                  <p className="t-accent" style={{ margin: "2px 0 0", fontSize: 11, fontFamily: "monospace" }}>{c.orderId}</p>
                  {c.importedFrom && <span className="ims-badge ims-badge-violet" style={{ fontSize: 9, marginTop: 3 }}>bulk import</span>}
                </div>
                <StatusBadge status={c.status || "In Transit"} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="ghost" onClick={() => { setEditItem({ ...c }); setErrors({}); }}>Edit</Button>
                <Button variant="danger" onClick={() => { remove(c.id); setToast({ msg: "Deleted", type: "success" }); }}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editItem && (
        <Modal title={`Edit — ${editItem.name}`} onClose={() => setEditItem(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Input label="Name" value={editItem.name || ""} onChange={e => setEditItem(p => ({ ...p, name: e.target.value }))} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Input label="Contact" value={editItem.contact || ""}
                onChange={e => { setEditItem(p => ({ ...p, contact: e.target.value })); setErrors(p => ({ ...p, contact: "" })); }} />
              {errors.contact && <span style={{ fontSize: 11, color: "var(--danger-text)" }}>{errors.contact}</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Input label="Email" value={editItem.email || ""}
                onChange={e => { setEditItem(p => ({ ...p, email: e.target.value })); setErrors(p => ({ ...p, email: "" })); }} />
              {errors.email && <span style={{ fontSize: 11, color: "var(--danger-text)" }}>{errors.email}</span>}
            </div>
            <Input label="Address" value={editItem.address || ""} onChange={e => setEditItem(p => ({ ...p, address: e.target.value }))} />
            {/* Quantity with > 0 validation in modal */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Input label="Quantity" type="number" min="1" step="1" value={editItem.quantity || ""}
                onChange={e => {
                  const val = Number(e.target.value);
                  setEditItem(p => ({ ...p, quantity: val }));
                  if (isNaN(val) || val <= 0 || !Number.isInteger(val)) {
                    setErrors(p => ({ ...p, quantity: "Quantity must be a whole number greater than 0" }));
                  } else {
                    setErrors(p => ({ ...p, quantity: "" }));
                  }
                }} />
              {errors.quantity && <span style={{ fontSize: 11, color: "var(--danger-text)" }}>{errors.quantity}</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="ims-label">Status</label>
              <select className="ims-input" value={editItem.status || "In Transit"}
                onChange={e => setEditItem(p => ({ ...p, status: e.target.value }))}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {editItem.status && <div style={{ marginTop: 4 }}><StatusBadge status={editItem.status} /></div>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <Button onClick={handleUpdate} disabled={saving || !!errors.quantity}>{saving ? "Saving…" : "Save"}</Button>
            <Button variant="ghost" onClick={() => setEditItem(null)}>Cancel</Button>
          </div>
        </Modal>
      )}

      <div style={{ textAlign: "center", padding: "16px 0", fontSize: "14px", color: "var(--text-primary)", borderTop: "1px solid var(--border)", marginTop: "30px", opacity: 0.8 }}>
        © {new Date().getFullYear()} 3APJ WMS · Engineered by Amit Waghmare & Ajay Rathod · Powered by Firebase
      </div>
    </div>
  );
}