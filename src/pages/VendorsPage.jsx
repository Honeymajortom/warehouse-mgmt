import { useState, useRef, useEffect, useMemo } from "react";
import useCrud from "../hooks/useCrud";
import { Table, Td, Input, Button, SectionHeader, Toast } from "../components/ui/index.jsx";
import Modal from "../components/ui/Modal";

const VENDOR_FIELDS = [
  ["vendorName", "Vendor Name"],
  ["contact",    "Contact Number"],
  ["email",      "Email"],
  ["gstNo",      "GST Number"],
  ["address",    "Address"],
  ["pincode",    "Pincode"],
];
const PRODUCT_FIELDS = [
  ["skuId",       "SKU ID"],
  ["productName", "Product Name"],
];

const emptyForm = () => ({
  skuId: "", productName: "",
  vendorName: "", contact: "", email: "", gstNo: "", address: "", pincode: "",
});

// ── Pincode zone mapping (Indian regions) ─────────────────────────────────
// Based on first 2-3 digits of 6-digit Indian pincode
const getPincodeZone = (pin) => {
  if (!pin || pin.length < 6) return null;
  const prefix = parseInt(pin.substring(0, 2), 10);
  if (prefix >= 11 && prefix <= 11) return { zone: "Delhi NCR", state: "Delhi" };
  if (prefix >= 40 && prefix <= 44) return { zone: "Maharashtra", state: "Maharashtra" };
  if (prefix >= 56 && prefix <= 57) return { zone: "Karnataka", state: "Karnataka" };
  if (prefix >= 60 && prefix <= 64) return { zone: "Tamil Nadu", state: "Tamil Nadu" };
  if (prefix >= 50 && prefix <= 53) return { zone: "Telangana/AP", state: "Andhra Pradesh" };
  if (prefix >= 38 && prefix <= 39) return { zone: "Gujarat", state: "Gujarat" };
  if (prefix >= 30 && prefix <= 34) return { zone: "Rajasthan", state: "Rajasthan" };
  if (prefix >= 70 && prefix <= 74) return { zone: "West Bengal", state: "West Bengal" };
  if (prefix >= 20 && prefix <= 28) return { zone: "Uttar Pradesh", state: "Uttar Pradesh" };
  if (prefix >= 14 && prefix <= 16) return { zone: "Punjab", state: "Punjab" };
  if (prefix >= 67 && prefix <= 69) return { zone: "Kerala", state: "Kerala" };
  if (prefix >= 80 && prefix <= 85) return { zone: "Bihar/Jharkhand", state: "Bihar" };
  return { zone: "Other", state: "India" };
};

// ── Shipping cost calculator based on pincodes ─────────────────────────────
function calcShipping(vendorPin, customerPin) {
  if (!vendorPin || !customerPin || vendorPin.length !== 6 || customerPin.length !== 6) return null;

  const vendorZone  = getPincodeZone(vendorPin);
  const customerZone = getPincodeZone(customerPin);
  if (!vendorZone || !customerZone) return null;

  const sameState   = vendorZone.state === customerZone.state;
  const sameZone    = vendorZone.zone  === customerZone.zone;
  const vendorDist  = parseInt(vendorPin.substring(0, 3), 10);
  const customerDist = parseInt(customerPin.substring(0, 3), 10);
  const pinDiff     = Math.abs(vendorDist - customerDist);

  let cost, deliveryDays, deliveryZone;

  if (sameZone && pinDiff < 10) {
    cost         = 40;
    deliveryDays = "1–2";
    deliveryZone = "Local";
  } else if (sameState) {
    cost         = 80;
    deliveryDays = "2–3";
    deliveryZone = "Intra-State";
  } else if (pinDiff < 100) {
    cost         = 120;
    deliveryDays = "3–4";
    deliveryZone = "Regional";
  } else {
    cost         = 180;
    deliveryDays = "4–6";
    deliveryZone = "Pan-India";
  }

  return {
    cost,
    deliveryDays,
    deliveryZone,
    vendorZone:   vendorZone.zone,
    customerZone: customerZone.zone,
  };
}

// ── Pincode Shipping Calculator widget ────────────────────────────────────
function ShippingCalculator({ vendorPincode }) {
  const [customerPin, setCustomerPin] = useState("");
  const [result, setResult]           = useState(null);
  const [error, setError]             = useState("");

  const calculate = () => {
    setError(""); setResult(null);
    if (!vendorPincode || vendorPincode.length !== 6) {
      setError("Vendor pincode is missing or invalid (must be 6 digits).");
      return;
    }
    if (!/^\d{6}$/.test(customerPin)) {
      setError("Enter a valid 6-digit customer pincode.");
      return;
    }
    const r = calcShipping(vendorPincode, customerPin);
    if (!r) { setError("Could not calculate — unsupported region."); return; }
    setResult(r);
  };

  const zoneColor = {
    "Local":       { bg: "rgba(34,197,94,0.12)",  color: "#4ade80", border: "rgba(34,197,94,0.3)"  },
    "Intra-State": { bg: "rgba(6,182,212,0.12)",   color: "#22d3ee", border: "rgba(6,182,212,0.3)"  },
    "Regional":    { bg: "rgba(245,158,11,0.12)",  color: "#fbbf24", border: "rgba(245,158,11,0.3)" },
    "Pan-India":   { bg: "rgba(239,68,68,0.12)",   color: "#f87171", border: "rgba(239,68,68,0.3)"  },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p className="ims-section-title" style={{ margin: 0 }}>🚚 Shipping Calculator</p>
      <p className="t-muted" style={{ fontSize: 12, margin: 0 }}>
        Enter customer delivery pincode to estimate shipping cost from vendor pincode{" "}
        {vendorPincode ? <strong style={{ color: "var(--accent)" }}>{vendorPincode}</strong> : <em>(not set)</em>}.
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 160 }}>
          <label className="ims-label">Customer Delivery Pincode</label>
          <input
            className="ims-input"
            value={customerPin}
            maxLength={6}
            placeholder="e.g. 440001"
            onChange={e => {
              const val = e.target.value.replace(/\D/g, "");
              setCustomerPin(val);
              setResult(null); setError("");
            }}
            onKeyDown={e => e.key === "Enter" && calculate()}
          />
        </div>
        <button
          className="ims-btn ims-btn-primary"
          onClick={calculate}
          disabled={customerPin.length !== 6}
          style={{ flexShrink: 0 }}
        >
          Calculate
        </button>
      </div>

      {error && (
        <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 12, color: "#f87171" }}>
          ⚠ {error}
        </div>
      )}

      {result && (() => {
        const zc = zoneColor[result.deliveryZone] || zoneColor["Pan-India"];
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 4 }}>
            {/* Cost */}
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--border)", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent)" }}>₹{result.cost}</div>
              <div className="t-muted" style={{ fontSize: 11, marginTop: 2 }}>Shipping Cost</div>
            </div>
            {/* Zone */}
            <div style={{ padding: "12px 14px", borderRadius: 10, background: zc.bg, border: `1px solid ${zc.border}`, textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: zc.color }}>{result.deliveryZone}</div>
              <div style={{ fontSize: 11, color: zc.color, opacity: 0.8, marginTop: 2 }}>Delivery Zone</div>
            </div>
            {/* ETA */}
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--border)", textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{result.deliveryDays} days</div>
              <div className="t-muted" style={{ fontSize: 11, marginTop: 2 }}>Estimated Delivery</div>
            </div>
            {/* Route */}
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--border)", fontSize: 11 }}>
              <div className="t-muted" style={{ marginBottom: 3 }}>Route</div>
              <div style={{ color: "var(--text-secondary)" }}>
                <span style={{ color: "var(--accent)", fontWeight: 600 }}>{result.vendorZone}</span>
                {" → "}
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{result.customerZone}</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Vendor auto-suggest input — DEDUPLICATED & case-insensitive ──────────
function VendorSuggest({ value, vendors, onChange, onSelect, onAddNew }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState(value || "");
  const wrapRef           = useRef();

  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => {
    const handler = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── DEDUPLICATED unique vendors by name (case-insensitive) ──────
  const uniqueVendors = useMemo(() => {
    const seen = new Map();
    vendors.forEach(v => {
      const key = (v.vendorName || "").trim().toLowerCase();
      if (key && !seen.has(key)) seen.set(key, v);
    });
    return [...seen.values()];
  }, [vendors]);

  // ── Filter: case-insensitive, only matching names ──────────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return uniqueVendors;
    return uniqueVendors.filter(v => v.vendorName?.toLowerCase().includes(q));
  }, [query, uniqueVendors]);

  const handleInput = e => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    setOpen(true);
  };

  const handlePick = vendor => {
    setQuery(vendor.vendorName);
    setOpen(false);
    onSelect(vendor);
  };

  const exactMatch = uniqueVendors.some(v => v.vendorName?.toLowerCase() === query.trim().toLowerCase());
  const showAddNew = query.trim() && !exactMatch;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        className="ims-input"
        value={query}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        placeholder="Type vendor name…"
        autoComplete="off"
      />
      {open && (filtered.length > 0 || showAddNew) && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
          background: "var(--bg-card)", border: "1px solid var(--border-accent)",
          borderRadius: 10, overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)", maxHeight: 240, overflowY: "auto",
        }}>
          {filtered.map(v => (
            <div key={v.id}
              onMouseDown={() => handlePick(v)}
              style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--bg-elevated)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div className="t-primary" style={{ fontSize: 13, fontWeight: 600 }}>{v.vendorName}</div>
              <div className="t-muted" style={{ fontSize: 11, marginTop: 2 }}>
                {v.contact} · {v.email} · GST: {v.gstNo || "—"}
                {v.pincode && ` · PIN: ${v.pincode}`}
              </div>
            </div>
          ))}
          {showAddNew && (
            <div
              onMouseDown={() => { setOpen(false); onAddNew(query); }}
              style={{ padding: "10px 14px", cursor: "pointer", background: "var(--accent-dim)", borderTop: filtered.length ? "1px solid var(--border)" : "none" }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.82"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
              <span className="t-accent" style={{ fontSize: 13, fontWeight: 700 }}>+ Add "{query}" as New Vendor</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Vendor Details Tab ─────────────────────────────────────────────────────
function VendorDetailsTab({ vendors, onEdit, onDelete }) {
  const [search, setSearch]   = useState("");
  const [sortBy, setSortBy]   = useState("vendorName");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage]       = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const PAGE_SIZE = 10;

  // Deduplicate by vendorName
  const uniqueVendors = useMemo(() => {
    const seen = new Map();
    vendors.forEach(v => {
      const key = (v.vendorName || "").trim().toLowerCase();
      if (key && !seen.has(key)) seen.set(key, { ...v });
      else if (key && seen.has(key)) {
        // Merge products supplied
        const existing = seen.get(key);
        const prods = new Set([existing.productName, v.productName].filter(Boolean));
        seen.set(key, { ...existing, productsSupplied: [...prods].join(", ") });
      }
    });
    return [...seen.values()];
  }, [vendors]);

  const filtered = useMemo(() => {
    let list = uniqueVendors;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(v =>
        v.vendorName?.toLowerCase().includes(q) ||
        v.contact?.toLowerCase().includes(q) ||
        v.email?.toLowerCase().includes(q) ||
        v.gstNo?.toLowerCase().includes(q) ||
        v.pincode?.includes(q)
      );
    }
    if (statusFilter !== "all") {
      list = list.filter(v => (statusFilter === "active" ? !v.inactive : v.inactive));
    }
    list = [...list].sort((a, b) => {
      const va = (a[sortBy] || "").toString().toLowerCase();
      const vb = (b[sortBy] || "").toString().toLowerCase();
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return list;
  }, [uniqueVendors, search, sortBy, sortDir, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = col => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
    setPage(1);
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <span style={{ opacity: 0.3, marginLeft: 4 }}>⇅</span>;
    return <span style={{ marginLeft: 4, color: "var(--accent)" }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Controls */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="ims-input"
          style={{ width: 260 }}
          placeholder="Search vendor, contact, GST, pincode…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <select className="ims-input" style={{ width: 140 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="all">All Vendors</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <span className="t-muted" style={{ fontSize: 12, marginLeft: "auto" }}>
          {filtered.length} vendor{filtered.length !== 1 ? "s" : ""} found
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table className="ims-table" style={{ minWidth: 800 }}>
          <thead>
            <tr>
              {[
                ["vendorName", "Vendor Name"],
                ["contact",    "Phone"],
                ["email",      "Email"],
                ["gstNo",      "GST No"],
                ["address",    "Address"],
                ["pincode",    "Pincode"],
              ].map(([key, label]) => (
                <th key={key} onClick={() => handleSort(key)}
                  style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                  {label}<SortIcon col={key} />
                </th>
              ))}
              <th>Products</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                  No vendors found
                </td>
              </tr>
            ) : paginated.map(v => (
              <tr key={v.id}>
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>{v.vendorName}</td>
                <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12 }}>{v.contact || "—"}</td>
                <td style={{ padding: "10px 12px", fontSize: 12 }} className="t-muted">{v.email || "—"}</td>
                <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 11 }} className="t-accent">{v.gstNo || "—"}</td>
                <td style={{ padding: "10px 12px", fontSize: 12, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} className="t-muted">{v.address || "—"}</td>
                <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12 }}>{v.pincode || "—"}</td>
                <td style={{ padding: "10px 12px", fontSize: 11 }} className="t-secondary">
                  {v.productsSupplied || v.productName || "—"}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  {v.inactive
                    ? <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "rgba(107,114,128,0.15)", color: "#9ca3af", border: "1px solid rgba(107,114,128,0.25)" }}>Inactive</span>
                    : <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.25)" }}>Active</span>
                  }
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="ims-btn ims-btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => onEdit(v)}>Edit</button>
                    <button className="ims-btn ims-btn-danger" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => onDelete(v.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
          <button className="ims-btn ims-btn-ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ opacity: page === 1 ? 0.4 : 1 }}>← Prev</button>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", padding: "4px 12px" }}>Page {page} of {totalPages}</span>
          <button className="ims-btn ims-btn-ghost" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{ opacity: page === totalPages ? 0.4 : 1 }}>Next →</button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
export default function VendorsPage() {
  const { items: vendors, loading, saving, add, remove, update } = useCrud("vendors");
  const [tab, setTab]         = useState("List");
  const [form, setForm]       = useState(emptyForm());
  const [isNewVendor, setIsNewVendor] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [toast, setToast]     = useState(null);
  const [search, setSearch]   = useState("");
  // Shipping calculator state (for List tab quick-check)
  const [shippingVendorPin, setShippingVendorPin] = useState("");

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleVendorSelect = vendor => {
    setForm(prev => ({
      ...prev,
      vendorName: vendor.vendorName,
      contact:    vendor.contact || "",
      email:      vendor.email   || "",
      gstNo:      vendor.gstNo   || "",
      address:    vendor.address || "",
      pincode:    vendor.pincode || "",
    }));
    setIsNewVendor(false);
  };

  const handleAddNew = name => {
    setForm(prev => ({ ...prev, vendorName: name, contact: "", email: "", gstNo: "", address: "", pincode: "" }));
    setIsNewVendor(true);
  };

  const handleVendorNameChange = val => {
    setForm(prev => ({ ...prev, vendorName: val }));
    if (!val.trim()) setIsNewVendor(false);
  };

  const handleAdd = async () => {
    if (!form.vendorName) return setToast({ msg: "Vendor name is required", type: "error" });
    if (!form.contact)    return setToast({ msg: "Contact number is required", type: "error" });
    await add(form);
    setForm(emptyForm()); setIsNewVendor(false); setTab("List");
    setToast({ msg: "Vendor added", type: "success" });
  };

  const handleUpdate = async () => {
    await update(editItem.id, editItem);
    setEditItem(null);
    setToast({ msg: "Updated", type: "success" });
  };

  const handleDelete = async (id) => {
    await remove(id);
    setToast({ msg: "Deleted", type: "success" });
  };

  // ── Deduplicated vendor list for display ──────────────────────
  const uniqueVendorsList = useMemo(() => {
    const seen = new Map();
    vendors.forEach(v => {
      const key = (v.vendorName || "").trim().toLowerCase();
      if (key && !seen.has(key)) seen.set(key, v);
    });
    return [...seen.values()];
  }, [vendors]);

  const filtered = vendors.filter(v =>
    !search ||
    v.vendorName?.toLowerCase().includes(search.toLowerCase()) ||
    v.email?.toLowerCase().includes(search.toLowerCase()) ||
    v.gstNo?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <SectionHeader title="Vendors" subtitle={`${uniqueVendorsList.length} vendor${uniqueVendorsList.length !== 1 ? "s" : ""}`} />

      <div className="ims-tab-bar">
        {["List", "Add", "Vendor Details", "Edit / Delete"].map(t => (
          <button key={t} className={`ims-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {/* ══ List ══ */}
      {tab === "List" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input className="ims-input" style={{ width: 300 }} placeholder="Search vendor, email or GST…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <Table loading={loading}
            cols={["SKU ID", "Product", "Vendor Name", "Contact", "Email", "GST No", "Address", "Pincode"]}
            rows={filtered}
            renderRow={r => (<>
              <Td mono>{r.skuId}</Td>
              <Td>{r.productName}</Td>
              <Td><span className="t-accent" style={{ fontWeight: 600 }}>{r.vendorName}</span></Td>
              <Td>{r.contact}</Td>
              <Td>{r.email}</Td>
              <Td mono>{r.gstNo}</Td>
              <Td>{r.address}</Td>
              <Td mono>{r.pincode || "—"}</Td>
            </>)}
          />

          {/* Shipping calculator available from list view */}
          <div className="ims-panel" style={{ marginTop: 8 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label className="ims-label">Quick Shipping Check — Vendor Pincode</label>
                <input
                  className="ims-input"
                  style={{ width: 160 }}
                  value={shippingVendorPin}
                  maxLength={6}
                  placeholder="Vendor PIN"
                  onChange={e => setShippingVendorPin(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>
            <ShippingCalculator vendorPincode={shippingVendorPin} />
          </div>
        </div>
      )}

      {/* ══ Add ══ */}
      {tab === "Add" && (
        <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Product fields */}
          <div className="ims-panel">
            <p className="ims-section-title">Product Info</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {PRODUCT_FIELDS.map(([k, l]) => (
                <div key={k} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label className="ims-label">{l}</label>
                  <input className="ims-input" value={form[k]} onChange={f(k)} placeholder={`Enter ${l}`} />
                </div>
              ))}
            </div>
          </div>

          {/* Vendor fields with auto-suggest */}
          <div className="ims-panel">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <p className="ims-section-title" style={{ margin: 0 }}>Vendor Info</p>
              {isNewVendor
                ? <span className="ims-badge ims-badge-amber">New Vendor</span>
                : form.vendorName ? <span className="ims-badge ims-badge-green">Existing Vendor — auto-filled</span> : null}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label className="ims-label">Vendor Name *</label>
                <VendorSuggest
                  value={form.vendorName}
                  vendors={vendors}
                  onChange={handleVendorNameChange}
                  onSelect={handleVendorSelect}
                  onAddNew={handleAddNew}
                />
                {isNewVendor && <p className="t-warning" style={{ fontSize: 11, margin: 0 }}>✦ New vendor — fill in all details below</p>}
                {!isNewVendor && form.vendorName && <p className="t-success" style={{ fontSize: 11, margin: 0 }}>✓ Existing vendor selected — fields auto-filled</p>}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  ["contact", "Contact Number", "9876543210"],
                  ["email",   "Email",          "vendor@example.com"],
                  ["gstNo",   "GST Number",     "27AAAAA0000A1Z5"],
                  ["address", "Address",        "City, State"],
                  ["pincode", "Pincode",        "e.g. 440001"],
                ].map(([k, l, ph]) => (
                  <div key={k} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label className="ims-label">{l}{isNewVendor ? " *" : ""}</label>
                    <input
                      className="ims-input"
                      value={form[k]}
                      onChange={k === "pincode" ? e => setForm(p => ({ ...p, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })) : f(k)}
                      placeholder={ph}
                      maxLength={k === "pincode" ? 6 : undefined}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="ims-accent-box" style={{ marginTop: 16 }}>
              <p className="t-secondary" style={{ margin: 0, fontSize: 12 }}>
                <strong>Tip:</strong> Start typing to auto-suggest existing vendors (deduplicated). Selecting one fills all fields automatically.
              </p>
            </div>
          </div>

          {/* Shipping calculator in Add form */}
          {form.pincode?.length === 6 && (
            <div className="ims-panel">
              <ShippingCalculator vendorPincode={form.pincode} />
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button className="ims-btn ims-btn-primary" onClick={handleAdd} disabled={saving}>
              {saving ? "Saving…" : "Add Vendor"}
            </button>
            <button className="ims-btn ims-btn-ghost" onClick={() => { setForm(emptyForm()); setIsNewVendor(false); }}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ══ Vendor Details ══ */}
      {tab === "Vendor Details" && (
        <VendorDetailsTab
          vendors={vendors}
          onEdit={v => setEditItem({ ...v })}
          onDelete={handleDelete}
        />
      )}

      {/* ══ Edit / Delete ══ */}
      {tab === "Edit / Delete" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 720 }}>
          {vendors.map((v, i) => (
            <div key={v.id} className="ims-row-item fade-up" style={{ animationDelay: `${i * 30}ms` }}>
              <div>
                <p className="t-primary" style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{v.vendorName}</p>
                <p className="t-muted" style={{ margin: "2px 0 0", fontSize: 11 }}>
                  {v.contact} · {v.email} · GST: {v.gstNo || "—"}
                  {v.pincode && ` · PIN: ${v.pincode}`}
                </p>
                {v.productName && (
                  <p className="t-accent" style={{ margin: "2px 0 0", fontSize: 11, fontFamily: "monospace" }}>
                    {v.skuId} — {v.productName}
                  </p>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="ghost" onClick={() => setEditItem({ ...v })}>Edit</Button>
                <Button variant="danger" onClick={() => { remove(v.id); setToast({ msg: "Deleted", type: "success" }); }}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══ Edit Modal ══ */}
      {editItem && (
        <Modal title={`Edit — ${editItem.vendorName}`} onClose={() => setEditItem(null)} width={620}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <p className="ims-section-title">Product Info</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {PRODUCT_FIELDS.map(([k, l]) => (
                  <div key={k} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label className="ims-label">{l}</label>
                    <input className="ims-input" value={editItem[k] || ""} onChange={e => setEditItem(p => ({ ...p, [k]: e.target.value }))} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="ims-section-title">Vendor Info</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {[...VENDOR_FIELDS].map(([k, l]) => (
                  <div key={k} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label className="ims-label">{l}</label>
                    <input
                      className="ims-input"
                      value={editItem[k] || ""}
                      onChange={k === "pincode"
                        ? e => setEditItem(p => ({ ...p, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))
                        : e => setEditItem(p => ({ ...p, [k]: e.target.value }))
                      }
                      maxLength={k === "pincode" ? 6 : undefined}
                    />
                  </div>
                ))}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label className="ims-label">Status</label>
                  <select className="ims-input" value={editItem.inactive ? "inactive" : "active"}
                    onChange={e => setEditItem(p => ({ ...p, inactive: e.target.value === "inactive" }))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            {/* Shipping preview in edit modal */}
            {editItem.pincode?.length === 6 && (
              <div style={{ padding: "14px", background: "var(--bg-elevated)", borderRadius: 10, border: "1px solid var(--border)" }}>
                <ShippingCalculator vendorPincode={editItem.pincode} />
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <Button onClick={handleUpdate} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
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