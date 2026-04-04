import { useState, useRef, useEffect } from "react";
import useCrud from "../hooks/useCrud";
import { Table, Td, Input, Button, SectionHeader, Toast } from "../components/ui/index.jsx";
import Modal from "../components/ui/Modal";

// Fields that belong to the vendor (not product-specific)
const VENDOR_FIELDS = [
  ["vendorName", "Vendor Name"],
  ["contact",    "Contact Number"],
  ["email",      "Email"],
  ["gstNo",      "GST Number"],
  ["address",    "Address"],
];
const PRODUCT_FIELDS = [
  ["skuId",       "SKU ID"],
  ["productName", "Product Name"],
];

const emptyForm = () => ({
  skuId:"", productName:"",
  vendorName:"", contact:"", email:"", gstNo:"", address:"",
});

// ── Vendor auto-suggest input component ────────────────────────
function VendorSuggest({ value, vendors, onChange, onSelect, onAddNew }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState(value || "");
  const wrapRef           = useRef();

  // sync external value resets (e.g. form clear)
  useEffect(() => { setQuery(value || ""); }, [value]);

  // close on outside click
  useEffect(() => {
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.trim()
    ? vendors.filter(v => v.vendorName?.toLowerCase().includes(query.toLowerCase()))
    : vendors;

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    setOpen(true);
  };

  const handlePick = (vendor) => {
    setQuery(vendor.vendorName);
    setOpen(false);
    onSelect(vendor);
  };

  const showAddNew = query.trim() && !vendors.some(v => v.vendorName?.toLowerCase() === query.toLowerCase());

  return (
    <div ref={wrapRef} style={{ position:"relative" }}>
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
          position:"absolute", top:"calc(100% + 4px)", left:0, right:0, zIndex:50,
          background:"var(--bg-card)", border:"1px solid var(--border-accent)",
          borderRadius:10, overflow:"hidden",
          boxShadow:"0 8px 32px rgba(0,0,0,0.25)", maxHeight:240, overflowY:"auto",
        }}>
          {filtered.map(v => (
            <div key={v.id}
              onMouseDown={() => handlePick(v)}
              style={{ padding:"10px 14px", cursor:"pointer", borderBottom:"1px solid var(--border)" }}
              onMouseEnter={e => e.currentTarget.style.background="var(--bg-elevated)"}
              onMouseLeave={e => e.currentTarget.style.background="transparent"}>
              <div className="t-primary" style={{ fontSize:13, fontWeight:600 }}>{v.vendorName}</div>
              <div className="t-muted" style={{ fontSize:11, marginTop:2 }}>
                {v.contact} · {v.email} · GST: {v.gstNo||"—"}
              </div>
            </div>
          ))}
          {showAddNew && (
            <div
              onMouseDown={() => { setOpen(false); onAddNew(query); }}
              style={{ padding:"10px 14px", cursor:"pointer", background:"var(--accent-dim)", borderTop: filtered.length?"1px solid var(--border)":"none" }}
              onMouseEnter={e => e.currentTarget.style.opacity="0.82"}
              onMouseLeave={e => e.currentTarget.style.opacity="1"}>
              <span className="t-accent" style={{ fontSize:13, fontWeight:700 }}>+ Add "{query}" as New Vendor</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
export default function VendorsPage() {
  const { items:vendors, loading, saving, add, remove, update } = useCrud("vendors");
  const [tab, setTab]         = useState("List");
  const [form, setForm]       = useState(emptyForm());
  const [isNewVendor, setIsNewVendor] = useState(false);   // true = new vendor manual entry
  const [editItem, setEditItem] = useState(null);
  const [toast, setToast]     = useState(null);
  const [search, setSearch]   = useState("");

  const f = k => e => setForm(p => ({...p, [k]: e.target.value}));

  // ── when user picks an existing vendor ──────────────────────
  const handleVendorSelect = (vendor) => {
    setForm(prev => ({
      ...prev,
      vendorName: vendor.vendorName,
      contact:    vendor.contact || "",
      email:      vendor.email   || "",
      gstNo:      vendor.gstNo   || "",
      address:    vendor.address || "",
    }));
    setIsNewVendor(false);
  };

  // ── when user wants to add a completely new vendor ───────────
  const handleAddNew = (name) => {
    setForm(prev => ({
      ...prev,
      vendorName: name,
      contact: "", email: "", gstNo: "", address: "",
    }));
    setIsNewVendor(true);
  };

  const handleVendorNameChange = (val) => {
    setForm(prev => ({...prev, vendorName: val}));
    // if they clear it, reset new-vendor flag
    if (!val.trim()) setIsNewVendor(false);
  };

  const handleAdd = async () => {
    if (!form.vendorName) return setToast({ msg:"Vendor name is required", type:"error" });
    if (!form.contact)    return setToast({ msg:"Contact number is required", type:"error" });
    await add(form);
    setForm(emptyForm());
    setIsNewVendor(false);
    setTab("List");
    setToast({ msg:"Vendor added", type:"success" });
  };

  const handleUpdate = async () => {
    await update(editItem.id, editItem);
    setEditItem(null);
    setToast({ msg:"Updated", type:"success" });
  };

  const filtered = vendors.filter(v =>
    !search ||
    v.vendorName?.toLowerCase().includes(search.toLowerCase()) ||
    v.email?.toLowerCase().includes(search.toLowerCase()) ||
    v.gstNo?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
      <SectionHeader title="Vendors" subtitle={`${vendors.length} vendor${vendors.length!==1?"s":""}`}/>

      <div className="ims-tab-bar">
        {["List","Add","Edit / Delete"].map(t=>(
          <button key={t} className={`ims-tab${tab===t?" active":""}`} onClick={()=>setTab(t)}>{t}</button>
        ))}
      </div>

      {/* ══ List ══ */}
      {tab==="List" && (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <input className="ims-input" style={{width:300}} placeholder="Search vendor, email or GST…"
            value={search} onChange={e=>setSearch(e.target.value)}/>
          <Table loading={loading}
            cols={["SKU ID","Product","Vendor Name","Contact","Email","GST No","Address"]}
            rows={filtered}
            renderRow={r=>(<>
              <Td mono>{r.skuId}</Td>
              <Td>{r.productName}</Td>
              <Td><span className="t-accent" style={{fontWeight:600}}>{r.vendorName}</span></Td>
              <Td>{r.contact}</Td>
              <Td>{r.email}</Td>
              <Td mono>{r.gstNo}</Td>
              <Td>{r.address}</Td>
            </>)}
          />
        </div>
      )}

      {/* ══ Add ══ */}
      {tab==="Add" && (
        <div style={{maxWidth:680,display:"flex",flexDirection:"column",gap:20}}>

          {/* ── Product fields (always manual) ── */}
          <div className="ims-panel">
            <p className="ims-section-title">Product Info</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              {PRODUCT_FIELDS.map(([k,l])=>(
                <div key={k} style={{display:"flex",flexDirection:"column",gap:6}}>
                  <label className="ims-label">{l}</label>
                  <input className="ims-input" value={form[k]} onChange={f(k)} placeholder={`Enter ${l}`}/>
                </div>
              ))}
            </div>
          </div>

          {/* ── Vendor fields with auto-suggest ── */}
          <div className="ims-panel">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <p className="ims-section-title" style={{margin:0}}>Vendor Info</p>
              {isNewVendor
                ? <span className="ims-badge ims-badge-amber">New Vendor</span>
                : form.vendorName
                  ? <span className="ims-badge ims-badge-green">Existing Vendor — fields auto-filled</span>
                  : null
              }
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {/* Vendor name with smart suggest */}
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <label className="ims-label">Vendor Name *</label>
                <VendorSuggest
                  value={form.vendorName}
                  vendors={vendors}
                  onChange={handleVendorNameChange}
                  onSelect={handleVendorSelect}
                  onAddNew={handleAddNew}
                />
                {isNewVendor && (
                  <p className="t-warning" style={{fontSize:11,margin:0}}>
                    ✦ New vendor — fill in all details below
                  </p>
                )}
                {!isNewVendor && form.vendorName && (
                  <p className="t-success" style={{fontSize:11,margin:0}}>
                    ✓ Existing vendor selected — fields auto-filled, editable if needed
                  </p>
                )}
              </div>

              {/* Vendor detail fields — shown and auto-filled after selection */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                {[
                  ["contact","Contact Number","9876543210"],
                  ["email",  "Email",          "vendor@example.com"],
                  ["gstNo",  "GST Number",     "27AAAAA0000A1Z5"],
                  ["address","Address",        "City, State"],
                ].map(([k,l,ph])=>(
                  <div key={k} style={{display:"flex",flexDirection:"column",gap:6}}>
                    <label className="ims-label">{l}{isNewVendor?" *":""}</label>
                    <input className="ims-input" value={form[k]} onChange={f(k)} placeholder={ph}/>
                  </div>
                ))}
              </div>
            </div>

            {/* Hint box */}
            <div className="ims-accent-box" style={{marginTop:16}}>
              <p className="t-secondary" style={{margin:0,fontSize:12}}>
                <strong>Tip:</strong> Start typing a vendor name to auto-suggest existing vendors.
                Selecting one fills in all their details automatically.
                If the vendor doesn't exist, click <strong>"+ Add … as New Vendor"</strong> to enter manually.
              </p>
            </div>
          </div>

          {/* Save button */}
          <div style={{display:"flex",gap:10}}>
            <button className="ims-btn ims-btn-primary" onClick={handleAdd} disabled={saving}>
              {saving ? "Saving…" : "Add Vendor"}
            </button>
            <button className="ims-btn ims-btn-ghost" onClick={()=>{setForm(emptyForm());setIsNewVendor(false);}}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ══ Edit / Delete ══ */}
      {tab==="Edit / Delete" && (
        <div style={{display:"flex",flexDirection:"column",gap:8,maxWidth:720}}>
          {vendors.map((v,i)=>(
            <div key={v.id} className="ims-row-item fade-up" style={{animationDelay:`${i*30}ms`}}>
              <div>
                <p className="t-primary" style={{margin:0,fontSize:14,fontWeight:600}}>{v.vendorName}</p>
                <p className="t-muted"   style={{margin:"2px 0 0",fontSize:11}}>
                  {v.contact} · {v.email} · GST: {v.gstNo||"—"}
                </p>
                {v.productName && (
                  <p className="t-accent" style={{margin:"2px 0 0",fontSize:11,fontFamily:"monospace"}}>
                    {v.skuId} — {v.productName}
                  </p>
                )}
              </div>
              <div style={{display:"flex",gap:8}}>
                <Button variant="ghost"  onClick={()=>setEditItem({...v})}>Edit</Button>
                <Button variant="danger" onClick={()=>{remove(v.id);setToast({msg:"Deleted",type:"success"});}}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══ Edit Modal ══ */}
      {editItem && (
        <Modal title={`Edit — ${editItem.vendorName}`} onClose={()=>setEditItem(null)} width={600}>
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            {/* Product fields */}
            <div>
              <p className="ims-section-title">Product Info</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                {PRODUCT_FIELDS.map(([k,l])=>(
                  <div key={k} style={{display:"flex",flexDirection:"column",gap:6}}>
                    <label className="ims-label">{l}</label>
                    <input className="ims-input" value={editItem[k]||""} onChange={e=>setEditItem(p=>({...p,[k]:e.target.value}))}/>
                  </div>
                ))}
              </div>
            </div>

            {/* Vendor fields */}
            <div>
              <p className="ims-section-title">Vendor Info</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                {VENDOR_FIELDS.map(([k,l])=>(
                  <div key={k} style={{display:"flex",flexDirection:"column",gap:6}}>
                    <label className="ims-label">{l}</label>
                    <input className="ims-input" value={editItem[k]||""} onChange={e=>setEditItem(p=>({...p,[k]:e.target.value}))}/>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{display:"flex",gap:10,marginTop:20}}>
            <Button onClick={handleUpdate} disabled={saving}>{saving?"Saving…":"Save Changes"}</Button>
            <Button variant="ghost" onClick={()=>setEditItem(null)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
