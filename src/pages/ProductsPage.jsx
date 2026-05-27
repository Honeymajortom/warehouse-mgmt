import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import useCrud from "../hooks/useCrud";
import { getAll } from "../services/firestoreService";
import { getAuditFields } from "../services/authService";
import { Table, Td, Badge, Button, SectionHeader, Toast } from "../components/ui/index.jsx";
import Modal from "../components/ui/Modal";
import { CATEGORIES, CATEGORY_LIST } from "../data/categories.js";

const margin = (b, s) => b && s ? Math.round(((s - b) / s) * 100) : null;

const emptyForm = () => ({
  vendorName: "", vendorId: "", productName: "", skuId: "",
  category: "", subcategory: "",
  buyingPrice: "", sellingPrice: "", mrp: "",
  imageUrl: "", imageBase64: "",
  brandName: "", manufacturingDate: "", expiryDate: "",
  netWeight: "", batchNumber: "", itemCode: "",
  modelNumber: "", serialNumber: "", ean: "", imei: "",
  description: "",
});

/* ═══════════════════════════════════════════════════════════════
   LAZY IMAGE
   ═══════════════════════════════════════════════════════════════ */
function LazyImage({ src, alt = "", style }) {
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded]   = useState(false);
  const imgRef = useRef();
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "50px" });
    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);
  if (!src) return <span>📦</span>;
  return (
    <div ref={imgRef} style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", ...style }}>
      {visible ? (
        <img src={src} alt={alt} loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover", opacity: loaded ? 1 : 0, transition: "opacity 0.2s" }}
          onLoad={() => setLoaded(true)}
          onError={e => { e.target.style.display = "none"; e.target.parentElement.innerHTML = "📦"; }}
        />
      ) : <span>📦</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ZOOMABLE IMAGE — used inside SKU detail popup
   ═══════════════════════════════════════════════════════════════ */
function ZoomableImage({ src }) {
  const [zoomed, setZoomed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (!src) return (
    <div style={{ width: "100%", height: 220, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-elevated)", borderRadius: 12, fontSize: 48 }}>
      📦
    </div>
  );
  return (
    <>
      <div onClick={() => setZoomed(true)} style={{ cursor: "zoom-in", borderRadius: 12, overflow: "hidden", background: "var(--bg-elevated)", maxHeight: 220, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <img src={src} alt="product"
          style={{ maxHeight: 220, maxWidth: "100%", objectFit: "contain", display: "block", opacity: loaded ? 1 : 0, transition: "opacity 0.2s" }}
          onLoad={() => setLoaded(true)}
          onError={e => { e.target.style.display = "none"; }}
        />
        {!loaded && <div style={{ position: "absolute", fontSize: 40 }}>📦</div>}
        <div style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.5)", borderRadius: 6, padding: "3px 7px", fontSize: 11, color: "#fff" }}>
          🔍 Click to zoom
        </div>
      </div>
      {zoomed && (
        <div
          onClick={() => setZoomed(false)}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}>
          <img src={src} alt="product zoomed"
            style={{ maxHeight: "90vh", maxWidth: "90vw", objectFit: "contain", borderRadius: 12, boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }} />
          <div style={{ position: "absolute", top: 20, right: 24, color: "#fff", fontSize: 28, cursor: "pointer" }} onClick={() => setZoomed(false)}>✕</div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SKU DETAIL POPUP — full product info on SKU click
   ═══════════════════════════════════════════════════════════════ */
function SKUDetailModal({ product, onClose }) {
  const mg      = margin(product.buyingPrice, product.sellingPrice);
  const preview = product.imageBase64 || product.imageUrl;

  const InfoRow = ({ label, value, mono }) => {
    if (!value && value !== 0) return null;
    return (
      <div style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 140, flexShrink: 0 }}>{label}</span>
        <span style={{ fontSize: 12, color: "var(--text-primary)", fontFamily: mono ? "monospace" : "inherit", fontWeight: mono ? 600 : 400 }}>{value}</span>
      </div>
    );
  };

  return (
    <Modal title={product.productName} onClose={onClose} width={700}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Left column — image + pricing */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <ZoomableImage src={preview} />

          {/* Price card */}
          <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--bg-elevated)", border: "1px solid var(--border)", display: "flex", gap: 16, justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>MRP</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-muted)" }}>₹{Number(product.mrp || 0).toLocaleString()}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Buy</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#f87171" }}>₹{Number(product.buyingPrice || 0).toLocaleString()}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Sell</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#4ade80" }}>₹{Number(product.sellingPrice || 0).toLocaleString()}</div>
            </div>
            {mg !== null && (
              <div style={{ textAlign: "center", padding: "6px 12px", borderRadius: 8, background: mg > 30 ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)", border: `1px solid ${mg > 30 ? "rgba(34,197,94,0.3)" : "rgba(245,158,11,0.3)"}` }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: mg > 30 ? "#4ade80" : "#fbbf24" }}>{mg}%</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Margin</div>
              </div>
            )}
          </div>

          {/* Category / Brand */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {product.category    && <span className="ims-badge ims-badge-violet">{product.category}</span>}
            {product.subcategory && <span className="ims-badge ims-badge-cyan">{product.subcategory}</span>}
            {product.brandName   && <span className="ims-badge ims-badge-amber">{product.brandName}</span>}
          </div>

          {/* Description */}
          {product.description && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 4px" }}>Description</p>
              <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0, lineHeight: 1.6 }}>{product.description}</p>
            </div>
          )}
        </div>

        {/* Right column — details */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <p className="ims-section-title" style={{ marginBottom: 6 }}>Product Details</p>
          <InfoRow label="SKU ID"           value={product.skuId}             mono />
          <InfoRow label="Vendor"           value={product.vendorName} />
          <InfoRow label="Brand"            value={product.brandName} />
          <InfoRow label="Category"         value={product.category} />
          <InfoRow label="Subcategory"      value={product.subcategory} />

          <p className="ims-section-title" style={{ marginTop: 14, marginBottom: 6 }}>Specifications</p>
          <InfoRow label="Net Weight/Volume" value={product.netWeight} />
          <InfoRow label="Batch Number"      value={product.batchNumber}      mono />
          <InfoRow label="Item Code"         value={product.itemCode}         mono />
          <InfoRow label="Model Number"      value={product.modelNumber}      mono />
          <InfoRow label="Mfg Date"          value={product.manufacturingDate} />
          <InfoRow label="Expiry Date"       value={product.expiryDate} />

          <p className="ims-section-title" style={{ marginTop: 14, marginBottom: 6 }}>Identifiers &amp; Barcodes</p>
          <InfoRow label="Serial Number"    value={product.serialNumber}      mono />
          <InfoRow label="EAN"              value={product.ean}               mono />
          <InfoRow label="IMEI"             value={product.imei}              mono />
        </div>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DELETE CONFIRMATION MODAL
   ═══════════════════════════════════════════════════════════════ */
function DeleteConfirmModal({ product, onConfirm, onCancel, saving }) {
  return (
    <Modal title="Confirm Delete" onClose={onCancel} width={420}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>🗑️</div>
        <div>
          <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>
            Delete "{product.productName}"?
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
            SKU: <strong style={{ fontFamily: "monospace" }}>{product.skuId}</strong>
          </p>
        </div>
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 12, color: "#f87171" }}>
          ⚠ This will soft-delete the product. It can be restored from the database if needed.
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <Button variant="danger" onClick={onConfirm} disabled={saving}>
            {saving ? "Deleting…" : "Yes, Delete"}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGINATION
   ═══════════════════════════════════════════════════════════════ */
function usePagination(items, pageSize) {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(items.length / pageSize);
  const paginated = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize]);
  const reset = useCallback(() => setPage(1), []);
  return { page, setPage, totalPages, paginated, reset };
}

function Pagination({ page, totalPages, onChange, totalItems }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 16 }}>
      <button className="ims-btn ims-btn-ghost" disabled={page === 1} onClick={() => onChange(p => p - 1)} style={{ opacity: page === 1 ? 0.4 : 1 }}>← Prev</button>
      <span style={{ padding: "6px 12px", color: "var(--text-secondary)", fontSize: 13, minWidth: 120, textAlign: "center" }}>Page {page} of {totalPages}</span>
      <span style={{ color: "var(--text-muted)", fontSize: 11 }}>({totalItems} total)</span>
      <button className="ims-btn ims-btn-ghost" disabled={page === totalPages} onClick={() => onChange(p => p + 1)} style={{ opacity: page === totalPages ? 0.4 : 1 }}>Next →</button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   IMAGE UPLOADER
   ═══════════════════════════════════════════════════════════════ */
function ImageUploader({ base64, url, onBase64Change, onUrlChange }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();
  const toBase64 = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
  const handleFile = async file => { if (!file || !file.type.startsWith("image/")) return; onBase64Change(await toBase64(file)); onUrlChange(""); };
  const onDrop = useCallback(e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }, []);
  const preview = base64 || url;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} onClick={() => inputRef.current?.click()}
        style={{ border: `2px dashed ${dragging ? "var(--accent)" : "var(--border)"}`, borderRadius: 12, padding: "24px 20px", textAlign: "center", cursor: "pointer", background: dragging ? "var(--accent-dim)" : "var(--bg-elevated)", transition: "all 0.2s" }}>
        {preview
          ? <img src={preview} alt="preview" style={{ maxHeight: 90, maxWidth: "100%", borderRadius: 8, objectFit: "contain" }} onError={e => e.target.style.display = "none"} />
          : <><div style={{ fontSize: 26, marginBottom: 6 }}>🖼</div><p className="t-secondary" style={{ margin: 0, fontSize: 13 }}>Drag & drop or <span className="t-accent" style={{ fontWeight: 700 }}>click to browse</span></p></>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label className="ims-label">Or paste image URL</label>
        <input className="ims-input" value={url} placeholder="https://…" onChange={e => { onUrlChange(e.target.value); if (e.target.value) onBase64Change(""); }} />
      </div>
      {preview && <button className="ims-btn ims-btn-ghost" style={{ fontSize: 12, padding: "4px 12px", width: "fit-content", color: "var(--danger-text)" }} onClick={() => { onBase64Change(""); onUrlChange(""); }}>✕ Remove</button>}
    </div>
  );
}

const Section = ({ title, icon, children }) => (
  <div className="ims-panel"><p className="ims-section-title" style={{ marginBottom: 14 }}>{icon} {title}</p>{children}</div>
);
const Grid = ({ children, cols = 2 }) => (
  <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14 }}>{children}</div>
);
const F = ({ label, children, required }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    <label className="ims-label">{label}{required && <span className="t-danger"> *</span>}</label>
    {children}
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function ProductsPage() {
  const { items: products, loading, saving, add, remove, update } = useCrud("products", { pageSize: 50 });
  const [tab, setTab]       = useState("List");
  const [form, setForm]     = useState(emptyForm());
  const [vendors, setVendors]       = useState([]);
  const [vendorProducts, setVendorProducts] = useState([]);
  const [editItem, setEditItem]     = useState(null);
  const [toast, setToast]           = useState(null);
  const [search, setSearch]         = useState("");

  // SKU detail popup
  const [skuDetail, setSkuDetail] = useState(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const listPagination = usePagination(
    useMemo(() => products.filter(p =>
      (!p.deleted) && // hide soft-deleted
      (!search ||
        p.productName?.toLowerCase().includes(search.toLowerCase()) ||
        p.skuId?.toLowerCase().includes(search.toLowerCase()) ||
        p.vendorName?.toLowerCase().includes(search.toLowerCase()) ||
        p.category?.toLowerCase().includes(search.toLowerCase()))
    ), [products, search]),
    50
  );

  const editPagination = usePagination(
    useMemo(() => products.filter(p => !p.deleted), [products]),
    20
  );

  useEffect(() => { listPagination.reset(); }, [search]);
  useEffect(() => { listPagination.reset(); editPagination.reset(); }, [tab]);
  useEffect(() => { getAll("vendors").then(setVendors); }, []);

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const uniqueVendors = useMemo(() => [...new Map(vendors.map(v => [v.vendorName, v])).values()], [vendors]);

  const handleVendorChange = vendorName => {
    const vps = vendors.filter(v => v.vendorName === vendorName);
    setVendorProducts(vps);
    setForm(p => ({ ...p, vendorName, vendorId: vendors.find(v => v.vendorName === vendorName)?.id || "", productName: "", skuId: "" }));
  };

  const handleProductChange = productName => {
    const match = vendors.find(v => v.vendorName === form.vendorName && v.productName === productName);
    setForm(p => ({ ...p, productName, skuId: match?.skuId || "" }));
  };

  const handleCategoryChange = cat => setForm(p => ({ ...p, category: cat, subcategory: "" }));

  const handleAdd = async () => {
    if (!form.productName) return setToast({ msg: "Product name required", type: "error" });
    if (!form.skuId)       return setToast({ msg: "SKU ID required", type: "error" });
    await add({ ...form, buyingPrice: Number(form.buyingPrice || 0), sellingPrice: Number(form.sellingPrice || 0), mrp: Number(form.mrp || 0), deleted: false, ...getAuditFields() });
    setForm(emptyForm()); setVendorProducts([]); setTab("List");
    setToast({ msg: `${form.productName} added`, type: "success" });
  };

  const handleUpdate = async () => {
    await update(editItem.id, { ...editItem, buyingPrice: Number(editItem.buyingPrice || 0), sellingPrice: Number(editItem.sellingPrice || 0), ...getAuditFields() });
    setEditItem(null);
    setToast({ msg: "Updated", type: "success" });
  };

  // ── Soft delete ────────────────────────────────────────────────
  const handleSoftDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSaving(true);
    try {
      await update(deleteTarget.id, { ...deleteTarget, deleted: true, deletedAt: new Date().toISOString() });
      setToast({ msg: `"${deleteTarget.productName}" deleted`, type: "success" });
    } catch {
      setToast({ msg: "Delete failed", type: "error" });
    }
    setDeleteSaving(false);
    setDeleteTarget(null);
  };

  const m = margin(Number(form.buyingPrice), Number(form.sellingPrice));

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <SectionHeader title="Products" subtitle={`${products.filter(p => !p.deleted).length} SKUs`} />

      <div className="ims-tab-bar">
        {["List", "Add", "Edit / Delete"].map(t => (
          <button key={t} className={`ims-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {/* ── List ── */}
      {tab === "List" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input className="ims-input" style={{ width: 320 }} placeholder="Search product, SKU, vendor, category…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <Table loading={loading}
            cols={["Image", "SKU", "Product", "Category", "Subcategory", "Brand", "Vendor", "MRP", "Buy", "Sell", "Margin"]}
            rows={listPagination.paginated}
            renderRow={r => {
              const mg      = margin(r.buyingPrice, r.sellingPrice);
              const preview = r.imageBase64 || r.imageUrl;
              return (<>
                <Td>
                  <div style={{ width: 38, height: 38, borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                    <LazyImage src={preview} />
                  </div>
                </Td>
                {/* ── CLICKABLE SKU ── */}
                <Td mono>
                  <button
                    onClick={() => setSkuDetail(r)}
                    style={{
                      background: "none", border: "none", cursor: "pointer", padding: "2px 6px",
                      borderRadius: 5, color: "var(--accent)", fontFamily: "monospace", fontSize: 12,
                      fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3,
                      transition: "background 0.15s",
                    }}
                    title="Click to view full product details"
                    onMouseEnter={e => e.currentTarget.style.background = "var(--accent-dim)"}
                    onMouseLeave={e => e.currentTarget.style.background = "none"}
                  >
                    {r.skuId}
                  </button>
                </Td>
                <Td><span style={{ fontWeight: 600 }}>{r.productName}</span></Td>
                <Td><span className="ims-badge ims-badge-violet">{r.category || "—"}</span></Td>
                <Td><span className="t-secondary" style={{ fontSize: 11 }}>{r.subcategory || "—"}</span></Td>
                <Td><span className="t-secondary">{r.brandName || "—"}</span></Td>
                <Td><span className="t-accent">{r.vendorName || "—"}</span></Td>
                <Td><span className="t-muted">₹{Number(r.mrp || 0).toLocaleString()}</span></Td>
                <Td><span className="t-danger">₹{Number(r.buyingPrice || 0).toLocaleString()}</span></Td>
                <Td><span className="t-success">₹{Number(r.sellingPrice || 0).toLocaleString()}</span></Td>
                <Td>{mg !== null && <span className={`ims-badge ${mg > 30 ? "ims-badge-green" : "ims-badge-amber"}`}>{mg}%</span>}</Td>
              </>);
            }}
          />
          <Pagination page={listPagination.page} totalPages={listPagination.totalPages} onChange={listPagination.setPage} totalItems={products.filter(p => !p.deleted).length} />
          <p className="t-muted" style={{ fontSize: 11, textAlign: "center" }}>
            💡 Click any <span style={{ color: "var(--accent)", textDecoration: "underline" }}>SKU ID</span> to view full product details
          </p>
        </div>
      )}

      {/* ── Add ── */}
      {tab === "Add" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 860 }}>
          <Section title="Basic Details" icon="📋">
            <Grid>
              <F label="Vendor Name" required>
                <select className="ims-input" value={form.vendorName} onChange={e => handleVendorChange(e.target.value)}>
                  <option value="">Select vendor…</option>
                  {uniqueVendors.map(v => <option key={v.id} value={v.vendorName}>{v.vendorName}</option>)}
                </select>
              </F>
              <F label="Product Name" required>
                {form.vendorName
                  ? <select className="ims-input" value={form.productName} onChange={e => handleProductChange(e.target.value)}>
                      <option value="">Select product…</option>
                      {vendorProducts.map((v, i) => <option key={i} value={v.productName}>{v.productName}</option>)}
                      <option value="__custom__">+ Enter manually</option>
                    </select>
                  : <input className="ims-input" value={form.productName} onChange={e => setForm(p => ({ ...p, productName: e.target.value }))} placeholder="Select a vendor first or type manually" />
                }
                {form.productName === "__custom__" && <input className="ims-input" style={{ marginTop: 8 }} placeholder="Type product name…" onChange={e => setForm(p => ({ ...p, productName: e.target.value }))} />}
              </F>
              <F label="SKU ID" required>
                <input className="ims-input" value={form.skuId} onChange={f("skuId")} placeholder="Auto-filled or enter manually" />
              </F>
              <F label="Brand Name">
                <input className="ims-input" value={form.brandName} onChange={f("brandName")} placeholder="e.g. Samsung" />
              </F>
              <F label="Category" required>
                <select className="ims-input" value={form.category} onChange={e => handleCategoryChange(e.target.value)}>
                  <option value="">Select category…</option>
                  {CATEGORY_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </F>
              <F label="Subcategory">
                <select className="ims-input" value={form.subcategory} onChange={f("subcategory")} disabled={!form.category}>
                  <option value="">{form.category ? "Select subcategory…" : "Select category first"}</option>
                  {form.category && (CATEGORIES[form.category] || []).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </F>
            </Grid>
          </Section>

          <Section title="Pricing Details" icon="💰">
            <Grid>
              <F label="MRP ₹"><input type="number" className="ims-input" value={form.mrp} onChange={f("mrp")} placeholder="0" /></F>
              <F label="Buying Price ₹" required><input type="number" className="ims-input" value={form.buyingPrice} onChange={f("buyingPrice")} placeholder="0" /></F>
              <F label="Selling Price ₹" required><input type="number" className="ims-input" value={form.sellingPrice} onChange={f("sellingPrice")} placeholder="0" /></F>
              <F label="Margin">
                <div style={{ padding: "9px 12px", background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  {m !== null
                    ? <span style={{ fontWeight: 800, fontSize: 16 }} className={m > 30 ? "t-success" : "t-warning"}>{m}% <span className="t-secondary" style={{ fontSize: 12, fontWeight: 400 }}>· ₹{(Number(form.sellingPrice) - Number(form.buyingPrice)).toLocaleString()} profit/unit</span></span>
                    : <span className="t-muted" style={{ fontSize: 13 }}>Enter buy & sell price</span>}
                </div>
              </F>
            </Grid>
          </Section>

          <Section title="Product Media" icon="🖼">
            <ImageUploader base64={form.imageBase64} url={form.imageUrl} onBase64Change={v => setForm(p => ({ ...p, imageBase64: v }))} onUrlChange={v => setForm(p => ({ ...p, imageUrl: v }))} />
          </Section>

          <Section title="Product Description" icon="📝">
            <F label="Description">
              <textarea className="ims-input" value={form.description || ""} onChange={f("description")}
                placeholder="Product description, features, specifications…"
                style={{ minHeight: 80, resize: "vertical", fontFamily: "inherit" }} />
            </F>
          </Section>

          <Section title="Product Specifications" icon="📦">
            <Grid cols={3}>
              {[["manufacturingDate", "Mfg Date", "date"], ["expiryDate", "Expiry Date", "date"], ["netWeight", "Net Weight / Volume", "text"], ["batchNumber", "Batch Number", "text"], ["itemCode", "Item Code", "text"], ["modelNumber", "Model Number", "text"]].map(([k, l, t]) => (
                <F key={k} label={l}><input type={t} className="ims-input" value={form[k] || ""} onChange={f(k)} /></F>
              ))}
            </Grid>
          </Section>

          <Section title="Key Identifiers" icon="🏷">
            <Grid cols={3}>
              {[["serialNumber", "Serial Number"], ["ean", "EAN"], ["imei", "IMEI"]].map(([k, l]) => (
                <F key={k} label={l}><input className="ims-input" value={form[k] || ""} onChange={f(k)} /></F>
              ))}
            </Grid>
          </Section>

          <div style={{ display: "flex", gap: 12 }}>
            <button className="ims-btn ims-btn-primary" onClick={handleAdd} disabled={saving}>{saving ? "Saving…" : "Add Product"}</button>
            <button className="ims-btn ims-btn-ghost" onClick={() => { setForm(emptyForm()); setVendorProducts([]); }}>Clear</button>
          </div>
        </div>
      )}

      {/* ── Edit / Delete ── */}
      {tab === "Edit / Delete" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 720 }}>
          {editPagination.paginated.map(p => {
            const preview = p.imageBase64 || p.imageUrl;
            return (
              <div key={p.id} className="ims-row-item">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}>
                    <LazyImage src={preview} />
                  </div>
                  <div>
                    <p className="t-primary" style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{p.productName}</p>
                    <p className="t-muted" style={{ margin: "2px 0 0", fontSize: 11 }}>
                      <button onClick={() => setSkuDetail(p)}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--accent)", fontFamily: "monospace", fontSize: 11, textDecoration: "underline" }}>
                        {p.skuId}
                      </button>
                      {" · "}{p.vendorName || "No vendor"}{" · "}{p.category || "No category"}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="ghost" onClick={() => setEditItem({ ...p })}>Edit</Button>
                  {/* ── Soft delete with confirmation ── */}
                  <Button variant="danger" onClick={() => setDeleteTarget(p)}>Delete</Button>
                </div>
              </div>
            );
          })}
          <Pagination page={editPagination.page} totalPages={editPagination.totalPages} onChange={editPagination.setPage} totalItems={products.filter(p => !p.deleted).length} />
        </div>
      )}

      {/* ── SKU Detail Popup ── */}
      {skuDetail && <SKUDetailModal product={skuDetail} onClose={() => setSkuDetail(null)} />}

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <DeleteConfirmModal
          product={deleteTarget}
          onConfirm={handleSoftDelete}
          onCancel={() => setDeleteTarget(null)}
          saving={deleteSaving}
        />
      )}

      {/* ── Edit Modal — all fields ── */}
      {editItem && (
        <Modal title={`Edit — ${editItem.productName}`} onClose={() => setEditItem(null)} width={760}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <p className="ims-section-title">Identifiers</p>
              <Grid>
                {[["skuId", "SKU"], ["productName", "Product"], ["brandName", "Brand"], ["vendorName", "Vendor"]].map(([k, l]) => (
                  <F key={k} label={l}><input className="ims-input" value={editItem[k] || ""} onChange={e => setEditItem(p => ({ ...p, [k]: e.target.value }))} /></F>
                ))}
              </Grid>
            </div>
            <div>
              <p className="ims-section-title">Category</p>
              <Grid>
                <F label="Category">
                  <select className="ims-input" value={editItem.category || ""} onChange={e => setEditItem(p => ({ ...p, category: e.target.value, subcategory: "" }))}>
                    <option value="">Select…</option>
                    {CATEGORY_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </F>
                <F label="Subcategory">
                  <select className="ims-input" value={editItem.subcategory || ""} onChange={e => setEditItem(p => ({ ...p, subcategory: e.target.value }))}>
                    <option value="">Select…</option>
                    {editItem.category && (CATEGORIES[editItem.category] || []).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </F>
              </Grid>
            </div>
            <div>
              <p className="ims-section-title">Pricing</p>
              <Grid>
                {[["mrp", "MRP ₹"], ["buyingPrice", "Buy ₹"], ["sellingPrice", "Sell ₹"]].map(([k, l]) => (
                  <F key={k} label={l}><input type="number" className="ims-input" value={editItem[k] || ""} onChange={e => setEditItem(p => ({ ...p, [k]: e.target.value }))} /></F>
                ))}
                <F label="Margin"><div style={{ padding: "9px 12px", background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border)" }}><span className="t-success" style={{ fontWeight: 700 }}>{margin(Number(editItem.buyingPrice), Number(editItem.sellingPrice)) ?? "—"}%</span></div></F>
              </Grid>
            </div>
            {/* Description field in edit */}
            <div>
              <p className="ims-section-title">Description</p>
              <F label="Product Description">
                <textarea className="ims-input" value={editItem.description || ""} onChange={e => setEditItem(p => ({ ...p, description: e.target.value }))}
                  placeholder="Product description, features, specifications…"
                  style={{ minHeight: 80, resize: "vertical", fontFamily: "inherit" }} />
              </F>
            </div>
            {/* Specifications in edit */}
            <div>
              <p className="ims-section-title">Specifications &amp; Identifiers</p>
              <Grid cols={3}>
                {[["manufacturingDate", "Mfg Date"], ["expiryDate", "Expiry Date"], ["netWeight", "Net Weight"], ["batchNumber", "Batch No"], ["itemCode", "Item Code"], ["modelNumber", "Model No"], ["serialNumber", "Serial No"], ["ean", "EAN"], ["imei", "IMEI"]].map(([k, l]) => (
                  <F key={k} label={l}><input className="ims-input" value={editItem[k] || ""} onChange={e => setEditItem(p => ({ ...p, [k]: e.target.value }))} /></F>
                ))}
              </Grid>
            </div>
            <div>
              <p className="ims-section-title">Image</p>
              <ImageUploader base64={editItem.imageBase64 || ""} url={editItem.imageUrl || ""} onBase64Change={v => setEditItem(p => ({ ...p, imageBase64: v }))} onUrlChange={v => setEditItem(p => ({ ...p, imageUrl: v }))} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <Button onClick={handleUpdate} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
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