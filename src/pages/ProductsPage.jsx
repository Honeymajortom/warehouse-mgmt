import { useState, useEffect, useRef, useCallback } from "react";
import useCrud from "../hooks/useCrud";
import { getAll } from "../services/firestoreService";
import { Table, Td, Badge, Button, SectionHeader, Toast } from "../components/ui/index.jsx";
import Modal from "../components/ui/Modal";

const margin = (b, s) => b && s ? Math.round(((s - b) / s) * 100) : null;

const emptyForm = () => ({
  // Identifiers
  vendorName:"", vendorId:"", productName:"", skuId:"",
  // Pricing
  buyingPrice:"", sellingPrice:"", mrp:"",
  // Media
  imageUrl:"", imageBase64:"",
  // Description
  brandName:"", manufacturingDate:"", expiryDate:"",
  netWeight:"", batchNumber:"", itemCode:"",
  modelNumber:"", serialNumber:"", ean:"", imei:"",
});

// ── drag-and-drop / file image uploader ─────────────────────────
function ImageUploader({ base64, url, onBase64Change, onUrlChange }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const toBase64 = file => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const b64 = await toBase64(file);
    onBase64Change(b64);
    onUrlChange(""); // clear URL if file uploaded
  };

  const onDrop = useCallback(e => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const preview = base64 || url;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 12, padding: "28px 20px", textAlign:"center",
          cursor:"pointer", background: dragging ? "var(--accent-dim)" : "var(--bg-elevated)",
          transition:"all 0.2s",
        }}>
        {preview
          ? <img src={preview} alt="preview"
              style={{ maxHeight:100, maxWidth:"100%", borderRadius:8, objectFit:"contain" }}
              onError={e => e.target.style.display="none"}/>
          : <>
              <div style={{ fontSize:28, marginBottom:8 }}>🖼</div>
              <p className="t-secondary" style={{ margin:0, fontSize:13 }}>
                Drag &amp; drop image here, or <span className="t-accent" style={{ fontWeight:700 }}>click to browse</span>
              </p>
              <p className="t-muted" style={{ margin:"4px 0 0", fontSize:11 }}>PNG, JPG, WEBP supported</p>
            </>
        }
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display:"none" }}
        onChange={e => handleFile(e.target.files[0])}/>

      {/* URL alternative */}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        <label className="ims-label">Or paste image URL</label>
        <input className="ims-input" value={url} placeholder="https://example.com/image.jpg"
          onChange={e => { onUrlChange(e.target.value); if (e.target.value) onBase64Change(""); }}/>
      </div>

      {preview && (
        <button className="ims-btn ims-btn-ghost"
          style={{ fontSize:12, padding:"5px 14px", width:"fit-content", color:"var(--danger-text)" }}
          onClick={() => { onBase64Change(""); onUrlChange(""); }}>
          ✕ Remove image
        </button>
      )}
    </div>
  );
}

// ── section wrapper ──────────────────────────────────────────────
function Section({ title, icon, children }) {
  return (
    <div className="ims-panel">
      <p className="ims-section-title" style={{ marginBottom:16 }}>{icon} {title}</p>
      {children}
    </div>
  );
}

// ── field row helper ─────────────────────────────────────────────
const FieldGrid = ({ children, cols = 2 }) => (
  <div style={{ display:"grid", gridTemplateColumns:`repeat(${cols},1fr)`, gap:14 }}>
    {children}
  </div>
);

const Field = ({ label, children, required }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
    <label className="ims-label">{label}{required && <span className="t-danger"> *</span>}</label>
    {children}
  </div>
);

// ════════════════════════════════════════════════════════════════
export default function ProductsPage() {
  const { items:products, loading, saving, add, remove, update } = useCrud("products");
  const [tab, setTab]       = useState("List");
  const [form, setForm]     = useState(emptyForm());
  const [vendors, setVendors]   = useState([]);
  const [vendorProducts, setVendorProducts] = useState([]); // products for selected vendor
  const [editItem, setEditItem] = useState(null);
  const [toast, setToast]   = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => { getAll("vendors").then(setVendors); }, []);

  const f = k => e => setForm(p => ({...p, [k]: e.target.value}));

  // Unique vendor names
  const uniqueVendors = [...new Map(vendors.map(v => [v.vendorName, v])).values()];

  // When vendor changes → filter products by that vendor, reset product/sku fields
  const handleVendorChange = (vendorName) => {
    const v = vendors.find(v => v.vendorName === vendorName);
    const vendorProds = vendors.filter(v => v.vendorName === vendorName);
    setVendorProducts(vendorProds);
    setForm(p => ({
      ...p,
      vendorName, vendorId: v?.id || "",
      productName:"", skuId:"",
    }));
  };

  // When product chosen from vendor's product list → auto-fill SKU
  const handleProductChange = (productName) => {
    const match = vendors.find(v => v.vendorName === form.vendorName && v.productName === productName);
    setForm(p => ({
      ...p,
      productName,
      skuId: match?.skuId || "",
    }));
  };

  const handleAdd = async () => {
    if (!form.productName) return setToast({ msg:"Product name is required", type:"error" });
    if (!form.skuId)       return setToast({ msg:"SKU ID is required", type:"error" });
    await add({
      ...form,
      buyingPrice:  Number(form.buyingPrice  || 0),
      sellingPrice: Number(form.sellingPrice || 0),
      mrp:          Number(form.mrp          || 0),
    });
    setForm(emptyForm());
    setVendorProducts([]);
    setTab("List");
    setToast({ msg:`${form.productName} added`, type:"success" });
  };

  const handleUpdate = async () => {
    await update(editItem.id, {
      ...editItem,
      buyingPrice:  Number(editItem.buyingPrice  || 0),
      sellingPrice: Number(editItem.sellingPrice || 0),
    });
    setEditItem(null);
    setToast({ msg:"Updated", type:"success" });
  };

  const filtered = products.filter(p =>
    !search ||
    p.productName?.toLowerCase().includes(search.toLowerCase()) ||
    p.skuId?.toLowerCase().includes(search.toLowerCase()) ||
    p.vendorName?.toLowerCase().includes(search.toLowerCase()) ||
    p.brandName?.toLowerCase().includes(search.toLowerCase())
  );

  const m = margin(Number(form.buyingPrice), Number(form.sellingPrice));

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)}/>}
      <SectionHeader title="Products" subtitle={`${products.length} SKUs`}/>

      <div className="ims-tab-bar">
        {["List","Add","Edit / Delete"].map(t => (
          <button key={t} className={`ims-tab${tab===t?" active":""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {/* ══ List ══ */}
      {tab==="List" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <input className="ims-input" style={{ width:320 }} placeholder="Search product, SKU, vendor, brand…"
            value={search} onChange={e => setSearch(e.target.value)}/>
          <Table loading={loading}
            cols={["Image","SKU ID","Product","Brand","Vendor","MRP","Buy","Sell","Margin"]}
            rows={filtered}
            renderRow={r => {
              const mg = margin(r.buyingPrice, r.sellingPrice);
              const preview = r.imageBase64 || r.imageUrl;
              return (<>
                <Td>
                  <div style={{ width:40, height:40, borderRadius:8, border:"1px solid var(--border)", overflow:"hidden", background:"var(--bg-elevated)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>
                    {preview
                      ? <img src={preview} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e => e.target.style.display="none"}/>
                      : "📦"}
                  </div>
                </Td>
                <Td mono><span className="t-accent">{r.skuId}</span></Td>
                <Td><span style={{ fontWeight:600 }}>{r.productName}</span></Td>
                <Td><span className="t-secondary">{r.brandName||"—"}</span></Td>
                <Td><span className="t-accent">{r.vendorName||"—"}</span></Td>
                <Td><span className="t-muted">₹{Number(r.mrp||0).toLocaleString()}</span></Td>
                <Td><span className="t-danger">₹{Number(r.buyingPrice||0).toLocaleString()}</span></Td>
                <Td><span className="t-success">₹{Number(r.sellingPrice||0).toLocaleString()}</span></Td>
                <Td>
                  {mg !== null &&
                    <span className={`ims-badge ${mg>30?"ims-badge-green":"ims-badge-amber"}`}>{mg}%</span>}
                </Td>
              </>);
            }}
          />
        </div>
      )}

      {/* ══ Add ══ */}
      {tab==="Add" && (
        <div style={{ display:"flex", flexDirection:"column", gap:20, maxWidth:860 }}>

          {/* ── 1. Basic Details ── */}
          <Section title="Basic Details" icon="📋">
            <FieldGrid>
              {/* Vendor dropdown */}
              <Field label="Vendor Name" required>
                <select className="ims-input" value={form.vendorName} onChange={e => handleVendorChange(e.target.value)}>
                  <option value="">Select vendor…</option>
                  {uniqueVendors.map(v => (
                    <option key={v.id} value={v.vendorName}>{v.vendorName}</option>
                  ))}
                </select>
              </Field>

              {/* Product dropdown — filtered by selected vendor */}
              <Field label="Product Name" required>
                {form.vendorName
                  ? <select className="ims-input" value={form.productName} onChange={e => handleProductChange(e.target.value)}>
                      <option value="">Select product…</option>
                      {vendorProducts.map((v, i) => (
                        <option key={i} value={v.productName}>{v.productName}</option>
                      ))}
                      <option value="__custom__">+ Enter manually</option>
                    </select>
                  : <input className="ims-input" value={form.productName}
                      onChange={e => setForm(p => ({...p, productName:e.target.value}))}
                      placeholder="Select a vendor first, or type manually"/>
                }
                {form.productName === "__custom__" && (
                  <input className="ims-input" style={{ marginTop:8 }}
                    placeholder="Type product name…"
                    onChange={e => setForm(p => ({...p, productName:e.target.value}))}/>
                )}
              </Field>

              {/* SKU — auto-filled from vendor record, editable */}
              <Field label="SKU ID" required>
                <input className="ims-input" value={form.skuId}
                  onChange={f("skuId")} placeholder="Auto-filled or enter manually"/>
                {form.skuId && form.vendorName && (
                  <p className="t-success" style={{ fontSize:11, margin:"3px 0 0" }}>✓ Auto-filled from vendor record</p>
                )}
              </Field>

              <Field label="Brand Name">
                <input className="ims-input" value={form.brandName} onChange={f("brandName")} placeholder="e.g. Samsung, Nike"/>
              </Field>
            </FieldGrid>
          </Section>

          {/* ── 2. Pricing ── */}
          <Section title="Pricing Details" icon="💰">
            <FieldGrid>
              <Field label="MRP (Maximum Retail Price ₹)">
                <input type="number" className="ims-input" value={form.mrp} onChange={f("mrp")} placeholder="0"/>
              </Field>
              <Field label="Buying Price ₹" required>
                <input type="number" className="ims-input" value={form.buyingPrice} onChange={f("buyingPrice")} placeholder="0"/>
              </Field>
              <Field label="Selling Price ₹" required>
                <input type="number" className="ims-input" value={form.sellingPrice} onChange={f("sellingPrice")} placeholder="0"/>
              </Field>
              <Field label="Margin">
                <div style={{ padding:"9px 12px", background:"var(--bg-elevated)", borderRadius:8, border:"1px solid var(--border)" }}>
                  {m !== null
                    ? <span style={{ fontWeight:800, fontSize:16 }} className={m > 30 ? "t-success" : "t-warning"}>
                        {m}% &nbsp;
                        <span className="t-secondary" style={{ fontSize:12, fontWeight:400 }}>
                          · Profit ₹{(Number(form.sellingPrice) - Number(form.buyingPrice)).toLocaleString()} / unit
                        </span>
                      </span>
                    : <span className="t-muted" style={{ fontSize:13 }}>Enter buy &amp; sell price</span>
                  }
                </div>
              </Field>
            </FieldGrid>
          </Section>

          {/* ── 3. Product Media ── */}
          <Section title="Product Media" icon="🖼">
            <ImageUploader
              base64={form.imageBase64}
              url={form.imageUrl}
              onBase64Change={v => setForm(p => ({...p, imageBase64:v}))}
              onUrlChange={v => setForm(p => ({...p, imageUrl:v}))}
            />
          </Section>

          {/* ── 4. Product Description ── */}
          <Section title="Product Description" icon="📦">
            <FieldGrid cols={3}>
              {[
                ["manufacturingDate", "Manufacturing Date", "date"],
                ["expiryDate",        "Expiry Date",        "date"],
                ["netWeight",         "Net Weight / Volume","text","e.g. 500g, 1L"],
                ["batchNumber",       "Batch Number",       "text","e.g. BT-2024-001"],
                ["itemCode",          "Item Code",          "text","e.g. IC-00123"],
                ["modelNumber",       "Model Number",       "text","e.g. MX500"],
              ].map(([k, l, type, ph]) => (
                <Field key={k} label={l}>
                  <input type={type||"text"} className="ims-input" value={form[k]||""}
                    onChange={f(k)} placeholder={ph||""}/>
                </Field>
              ))}
            </FieldGrid>
          </Section>

          {/* ── 5. Key Identifiers ── */}
          <Section title="Key Identifiers" icon="🏷">
            <FieldGrid cols={3}>
              {[
                ["serialNumber", "Serial Number",                  "e.g. SN-XXXXXXXX"],
                ["ean",          "EAN (European Article Number)", "13-digit barcode"],
                ["imei",         "IMEI Number",                   "For electronic devices"],
              ].map(([k, l, ph]) => (
                <Field key={k} label={l}>
                  <input className="ims-input" value={form[k]||""} onChange={f(k)} placeholder={ph}/>
                </Field>
              ))}
            </FieldGrid>
          </Section>

          {/* Save / Clear */}
          <div style={{ display:"flex", gap:12 }}>
            <button className="ims-btn ims-btn-primary" onClick={handleAdd} disabled={saving}>
              {saving ? "Saving…" : "Add Product"}
            </button>
            <button className="ims-btn ims-btn-ghost"
              onClick={() => { setForm(emptyForm()); setVendorProducts([]); }}>
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* ══ Edit / Delete ══ */}
      {tab==="Edit / Delete" && (
        <div style={{ display:"flex", flexDirection:"column", gap:8, maxWidth:720 }}>
          {products.map((p, i) => {
            const preview = p.imageBase64 || p.imageUrl;
            return (
              <div key={p.id} className="ims-row-item fade-up" style={{ animationDelay:`${i*30}ms` }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:40, height:40, borderRadius:8, border:"1px solid var(--border)", overflow:"hidden", background:"var(--bg-elevated)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
                    {preview
                      ? <img src={preview} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e => e.target.style.display="none"}/>
                      : "📦"}
                  </div>
                  <div>
                    <p className="t-primary" style={{ margin:0, fontSize:14, fontWeight:600 }}>{p.productName}</p>
                    <p className="t-muted"   style={{ margin:"2px 0 0", fontSize:11 }}>
                      {p.skuId} · {p.vendorName||"No vendor"}
                      {p.brandName ? ` · ${p.brandName}` : ""}
                    </p>
                  </div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <Button variant="ghost"  onClick={() => setEditItem({...p})}>Edit</Button>
                  <Button variant="danger" onClick={() => { remove(p.id); setToast({ msg:"Deleted", type:"success" }); }}>Delete</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ Edit Modal ══ */}
      {editItem && (
        <Modal title={`Edit — ${editItem.productName}`} onClose={() => setEditItem(null)} width={740}>
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

            {/* Identifiers */}
            <div>
              <p className="ims-section-title">Identifiers</p>
              <FieldGrid>
                {[["skuId","SKU ID"],["productName","Product Name"],["brandName","Brand Name"],["vendorName","Vendor"]].map(([k,l]) => (
                  <Field key={k} label={l}>
                    <input className="ims-input" value={editItem[k]||""} onChange={e => setEditItem(p => ({...p,[k]:e.target.value}))}/>
                  </Field>
                ))}
              </FieldGrid>
            </div>

            {/* Pricing */}
            <div>
              <p className="ims-section-title">Pricing</p>
              <FieldGrid>
                {[["mrp","MRP ₹"],["buyingPrice","Buying Price ₹"],["sellingPrice","Selling Price ₹"]].map(([k,l]) => (
                  <Field key={k} label={l}>
                    <input type="number" className="ims-input" value={editItem[k]||""} onChange={e => setEditItem(p => ({...p,[k]:e.target.value}))}/>
                  </Field>
                ))}
                <Field label="Margin">
                  <div style={{ padding:"9px 12px", background:"var(--bg-elevated)", borderRadius:8, border:"1px solid var(--border)" }}>
                    <span className="t-success" style={{ fontWeight:700 }}>
                      {margin(Number(editItem.buyingPrice), Number(editItem.sellingPrice)) ?? "—"}%
                    </span>
                  </div>
                </Field>
              </FieldGrid>
            </div>

            {/* Description */}
            <div>
              <p className="ims-section-title">Description &amp; Identifiers</p>
              <FieldGrid cols={3}>
                {[
                  ["manufacturingDate","Mfg Date"],["expiryDate","Expiry Date"],
                  ["netWeight","Net Weight"],["batchNumber","Batch No."],
                  ["itemCode","Item Code"],["modelNumber","Model No."],
                  ["serialNumber","Serial No."],["ean","EAN"],["imei","IMEI"],
                ].map(([k,l]) => (
                  <Field key={k} label={l}>
                    <input className="ims-input" value={editItem[k]||""} onChange={e => setEditItem(p => ({...p,[k]:e.target.value}))}/>
                  </Field>
                ))}
              </FieldGrid>
            </div>

            {/* Image */}
            <div>
              <p className="ims-section-title">Product Image</p>
              <ImageUploader
                base64={editItem.imageBase64||""}
                url={editItem.imageUrl||""}
                onBase64Change={v => setEditItem(p => ({...p, imageBase64:v}))}
                onUrlChange={v => setEditItem(p => ({...p, imageUrl:v}))}
              />
            </div>
          </div>

          <div style={{ display:"flex", gap:10, marginTop:24 }}>
            <Button onClick={handleUpdate} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
            <Button variant="ghost" onClick={() => setEditItem(null)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
