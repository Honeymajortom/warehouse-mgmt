import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import useCrud from "../hooks/useCrud";
import { getAll } from "../services/firestoreService";
import { getAuditFields } from "../services/authService";
import { Table, Td, Badge, Button, SectionHeader, Toast } from "../components/ui/index.jsx";
import Modal from "../components/ui/Modal";
import { CATEGORIES, CATEGORY_LIST } from "../data/categories.js";

const margin = (b, s) => b && s ? Math.round(((s - b) / s) * 100) : null;

const emptyForm = () => ({
  vendorName:"", vendorId:"", productName:"", skuId:"",
  category:"", subcategory:"",
  buyingPrice:"", sellingPrice:"", mrp:"",
  imageUrl:"", imageBase64:"",
  brandName:"", manufacturingDate:"", expiryDate:"",
  netWeight:"", batchNumber:"", itemCode:"",
  modelNumber:"", serialNumber:"", ean:"", imei:"",
});

/* ═══════════════════════════════════════════════════════════════
   LAZY IMAGE — only loads when visible, avoids base64 bloat
   ═══════════════════════════════════════════════════════════════ */
function LazyImage({ src, alt = "", className, style }) {
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "50px" }
    );
    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  if (!src) return <span>📦</span>;

  return (
    <div ref={imgRef} style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", ...style }}>
      {visible ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.2s",
          }}
          onLoad={() => setLoaded(true)}
          onError={(e) => { e.target.style.display = "none"; e.target.parentElement.innerHTML = "📦"; }}
        />
      ) : (
        <span>📦</span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGINATION HOOK — reusable
   ═══════════════════════════════════════════════════════════════ */
function usePagination(items, pageSize) {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(items.length / pageSize);
  const paginated = useMemo(() => 
    items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  );
  const reset = useCallback(() => setPage(1), []);
  return { page, setPage, totalPages, paginated, reset };
}

/* ═══════════════════════════════════════════════════════════════
   PAGINATION CONTROLS
   ═══════════════════════════════════════════════════════════════ */
function Pagination({ page, totalPages, onChange, totalItems }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 16 }}>
      <button 
        className="ims-btn ims-btn-ghost" 
        disabled={page === 1}
        onClick={() => onChange(p => p - 1)}
        style={{ opacity: page === 1 ? 0.4 : 1 }}
      >
        ← Prev
      </button>
      <span style={{ padding: "6px 12px", color: "var(--text-secondary)", fontSize: 13, minWidth: 120, textAlign: "center" }}>
        Page {page} of {totalPages}
      </span>
      <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
        ({totalItems} total)
      </span>
      <button 
        className="ims-btn ims-btn-ghost" 
        disabled={page === totalPages}
        onClick={() => onChange(p => p + 1)}
        style={{ opacity: page === totalPages ? 0.4 : 1 }}
      >
        Next →
      </button>
    </div>
  );
}

function ImageUploader({ base64, url, onBase64Change, onUrlChange }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();
  const toBase64 = f => new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(f); });
  const handleFile = async (file) => {
    if (!file||!file.type.startsWith("image/")) return;
    onBase64Change(await toBase64(file)); onUrlChange("");
  };
  const onDrop = useCallback(e=>{ e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0]); },[]);
  const preview = base64||url;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}
        onDrop={onDrop} onClick={()=>inputRef.current?.click()}
        style={{border:`2px dashed ${dragging?"var(--accent)":"var(--border)"}`,borderRadius:12,padding:"24px 20px",
          textAlign:"center",cursor:"pointer",background:dragging?"var(--accent-dim)":"var(--bg-elevated)",transition:"all 0.2s"}}>
        {preview
          ? <img src={preview} alt="preview" style={{maxHeight:90,maxWidth:"100%",borderRadius:8,objectFit:"contain"}} onError={e=>e.target.style.display="none"}/>
          : <><div style={{fontSize:26,marginBottom:6}}>🖼</div><p className="t-secondary" style={{margin:0,fontSize:13}}>Drag & drop or <span className="t-accent" style={{fontWeight:700}}>click to browse</span></p></>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
      <div style={{display:"flex",flexDirection:"column",gap:5}}>
        <label className="ims-label">Or paste image URL</label>
        <input className="ims-input" value={url} placeholder="https://…" onChange={e=>{onUrlChange(e.target.value);if(e.target.value)onBase64Change("");}}/>
      </div>
      {preview&&<button className="ims-btn ims-btn-ghost" style={{fontSize:12,padding:"4px 12px",width:"fit-content",color:"var(--danger-text)"}} onClick={()=>{onBase64Change("");onUrlChange("");}}>✕ Remove</button>}
    </div>
  );
}

const Section=({title,icon,children})=>(
  <div className="ims-panel"><p className="ims-section-title" style={{marginBottom:14}}>{icon} {title}</p>{children}</div>
);
const Grid=({children,cols=2})=>(
  <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:14}}>{children}</div>
);
const F=({label,children,required})=>(
  <div style={{display:"flex",flexDirection:"column",gap:5}}>
    <label className="ims-label">{label}{required&&<span className="t-danger"> *</span>}</label>
    {children}
  </div>
);

export default function ProductsPage() {
  const { 
  items: products, 
  loading, 
  saving, 
  totalCount,
  hasMore,
  refresh,
  loadMore,  // NEW
  add, 
  remove, 
  update 
} = useCrud("products", { pageSize: 50 });
  const [tab,setTab]     = useState("List");
  const [form,setForm]   = useState(emptyForm());
  const [vendors,setVendors]   = useState([]);
  const [vendorProducts,setVendorProducts] = useState([]);
  const [editItem,setEditItem] = useState(null);
  const [toast,setToast] = useState(null);
  const [search,setSearch] = useState("");

  // Pagination for List tab
  const listPagination = usePagination(
    useMemo(() => products.filter(p => 
      !search || 
      p.productName?.toLowerCase().includes(search.toLowerCase()) ||
      p.skuId?.toLowerCase().includes(search.toLowerCase()) ||
      p.vendorName?.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase())
    ), [products, search]),
    50 // 50 items per page
  );

  // Pagination for Edit/Delete tab
  const editPagination = usePagination(products, 20);

  // Reset pagination when search or tab changes
  useEffect(() => { listPagination.reset(); }, [search]);
  useEffect(() => { 
    listPagination.reset(); 
    editPagination.reset();
  }, [tab]);

  useEffect(()=>{ getAll("vendors").then(setVendors); },[]);
  const f = k => e => setForm(p=>({...p,[k]:e.target.value}));

  const uniqueVendors = useMemo(() => 
    [...new Map(vendors.map(v=>[v.vendorName,v])).values()],
    [vendors]
  );

  const handleVendorChange = vendorName => {
    const vps = vendors.filter(v=>v.vendorName===vendorName);
    setVendorProducts(vps);
    setForm(p=>({...p,vendorName,vendorId:vendors.find(v=>v.vendorName===vendorName)?.id||"",productName:"",skuId:""}));
  };

  const handleProductChange = productName => {
    const match = vendors.find(v=>v.vendorName===form.vendorName&&v.productName===productName);
    setForm(p=>({...p,productName,skuId:match?.skuId||""}));
  };

  const handleCategoryChange = cat => setForm(p=>({...p,category:cat,subcategory:""}));

  const handleAdd = async () => {
    if (!form.productName) return setToast({msg:"Product name required",type:"error"});
    if (!form.skuId)       return setToast({msg:"SKU ID required",type:"error"});
    await add({...form, buyingPrice:Number(form.buyingPrice||0), sellingPrice:Number(form.sellingPrice||0), mrp:Number(form.mrp||0), ...getAuditFields()});
    setForm(emptyForm()); setVendorProducts([]); setTab("List");
    setToast({msg:`${form.productName} added`,type:"success"});
  };

  const handleUpdate = async () => {
    await update(editItem.id,{...editItem,buyingPrice:Number(editItem.buyingPrice||0),sellingPrice:Number(editItem.sellingPrice||0),...getAuditFields()});
    setEditItem(null); setToast({msg:"Updated",type:"success"});
  };

  const m = margin(Number(form.buyingPrice),Number(form.sellingPrice));

  return (
    <div>
      {toast&&<Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
      <SectionHeader title="Products" subtitle={`${products.length} SKUs`}/>
      <div className="ims-tab-bar">
        {["List","Add","Edit / Delete"].map(t=><button key={t} className={`ims-tab${tab===t?" active":""}`} onClick={()=>setTab(t)}>{t}</button>)}
      </div>

      {/* ── List ── */}
      {tab==="List"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <input 
            className="ims-input" 
            style={{width:320}} 
            placeholder="Search product, SKU, vendor, category…" 
            value={search} 
            onChange={e=>setSearch(e.target.value)}
          />
          <Table 
            loading={loading} 
            cols={["Image","SKU","Product","Category","Subcategory","Brand","Vendor","MRP","Buy","Sell","Margin"]} 
            rows={listPagination.paginated}
            renderRow={r=>{
              const mg=margin(r.buyingPrice,r.sellingPrice);
              const preview=r.imageBase64||r.imageUrl;
              return(<>
                <Td>
                  <div style={{width:38,height:38,borderRadius:8,border:"1px solid var(--border)",overflow:"hidden",background:"var(--bg-elevated)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>
                    <LazyImage src={preview} />
                  </div>
                </Td>
                <Td mono><span className="t-accent">{r.skuId}</span></Td>
                <Td><span style={{fontWeight:600}}>{r.productName}</span></Td>
                <Td><span className="ims-badge ims-badge-violet">{r.category||"—"}</span></Td>
                <Td><span className="t-secondary" style={{fontSize:11}}>{r.subcategory||"—"}</span></Td>
                <Td><span className="t-secondary">{r.brandName||"—"}</span></Td>
                <Td><span className="t-accent">{r.vendorName||"—"}</span></Td>
                <Td><span className="t-muted">₹{Number(r.mrp||0).toLocaleString()}</span></Td>
                <Td><span className="t-danger">₹{Number(r.buyingPrice||0).toLocaleString()}</span></Td>
                <Td><span className="t-success">₹{Number(r.sellingPrice||0).toLocaleString()}</span></Td>
                <Td>{mg!==null&&<span className={`ims-badge ${mg>30?"ims-badge-green":"ims-badge-amber"}`}>{mg}%</span>}</Td>
              </>);
            }}
          />
          <Pagination 
            page={listPagination.page} 
            totalPages={listPagination.totalPages} 
            onChange={listPagination.setPage}
            totalItems={products.length}
          />
        </div>
      )}

      {/* ── Add ── */}
      {tab==="Add"&&(
        <div style={{display:"flex",flexDirection:"column",gap:20,maxWidth:860}}>
          <Section title="Basic Details" icon="📋">
            <Grid>
              <F label="Vendor Name" required>
                <select className="ims-input" value={form.vendorName} onChange={e=>handleVendorChange(e.target.value)}>
                  <option value="">Select vendor…</option>
                  {uniqueVendors.map(v=><option key={v.id} value={v.vendorName}>{v.vendorName}</option>)}
                </select>
              </F>
              <F label="Product Name" required>
                {form.vendorName
                  ? <select className="ims-input" value={form.productName} onChange={e=>handleProductChange(e.target.value)}>
                      <option value="">Select product…</option>
                      {vendorProducts.map((v,i)=><option key={i} value={v.productName}>{v.productName}</option>)}
                      <option value="__custom__">+ Enter manually</option>
                    </select>
                  : <input className="ims-input" value={form.productName} onChange={e=>setForm(p=>({...p,productName:e.target.value}))} placeholder="Select a vendor first or type manually"/>
                }
                {form.productName==="__custom__"&&<input className="ims-input" style={{marginTop:8}} placeholder="Type product name…" onChange={e=>setForm(p=>({...p,productName:e.target.value}))}/>}
              </F>
              <F label="SKU ID" required>
                <input className="ims-input" value={form.skuId} onChange={f("skuId")} placeholder="Auto-filled or enter manually"/>
              </F>
              <F label="Brand Name">
                <input className="ims-input" value={form.brandName} onChange={f("brandName")} placeholder="e.g. Samsung"/>
              </F>
              <F label="Category" required>
                <select className="ims-input" value={form.category} onChange={e=>handleCategoryChange(e.target.value)}>
                  <option value="">Select category…</option>
                  {CATEGORY_LIST.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </F>
              <F label="Subcategory">
                <select className="ims-input" value={form.subcategory} onChange={f("subcategory")} disabled={!form.category}>
                  <option value="">{form.category?"Select subcategory…":"Select category first"}</option>
                  {form.category&&(CATEGORIES[form.category]||[]).map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </F>
            </Grid>
          </Section>

          <Section title="Pricing Details" icon="💰">
            <Grid>
              <F label="MRP ₹"><input type="number" className="ims-input" value={form.mrp} onChange={f("mrp")} placeholder="0"/></F>
              <F label="Buying Price ₹" required><input type="number" className="ims-input" value={form.buyingPrice} onChange={f("buyingPrice")} placeholder="0"/></F>
              <F label="Selling Price ₹" required><input type="number" className="ims-input" value={form.sellingPrice} onChange={f("sellingPrice")} placeholder="0"/></F>
              <F label="Margin">
                <div style={{padding:"9px 12px",background:"var(--bg-elevated)",borderRadius:8,border:"1px solid var(--border)"}}>
                  {m!==null?<span style={{fontWeight:800,fontSize:16}} className={m>30?"t-success":"t-warning"}>{m}% <span className="t-secondary" style={{fontSize:12,fontWeight:400}}>· ₹{(Number(form.sellingPrice)-Number(form.buyingPrice)).toLocaleString()} profit/unit</span></span>
                  :<span className="t-muted" style={{fontSize:13}}>Enter buy & sell price</span>}
                </div>
              </F>
            </Grid>
          </Section>

          <Section title="Product Media" icon="🖼">
            <ImageUploader base64={form.imageBase64} url={form.imageUrl} onBase64Change={v=>setForm(p=>({...p,imageBase64:v}))} onUrlChange={v=>setForm(p=>({...p,imageUrl:v}))}/>
          </Section>

          <Section title="Product Description" icon="📦">
            <Grid cols={3}>
              {[["manufacturingDate","Mfg Date","date"],["expiryDate","Expiry Date","date"],["netWeight","Net Weight / Volume","text"],["batchNumber","Batch Number","text"],["itemCode","Item Code","text"],["modelNumber","Model Number","text"]].map(([k,l,t])=>(
                <F key={k} label={l}><input type={t} className="ims-input" value={form[k]||""} onChange={f(k)}/></F>
              ))}
            </Grid>
          </Section>

          <Section title="Key Identifiers" icon="🏷">
            <Grid cols={3}>
              {[["serialNumber","Serial Number"],["ean","EAN"],["imei","IMEI"]].map(([k,l])=>(
                <F key={k} label={l}><input className="ims-input" value={form[k]||""} onChange={f(k)}/></F>
              ))}
            </Grid>
          </Section>

          <div style={{display:"flex",gap:12}}>
            <button className="ims-btn ims-btn-primary" onClick={handleAdd} disabled={saving}>{saving?"Saving…":"Add Product"}</button>
            <button className="ims-btn ims-btn-ghost" onClick={()=>{setForm(emptyForm());setVendorProducts([]); }}>Clear</button>
          </div>
        </div>
      )}

      {/* ── Edit / Delete ── */}
      {tab==="Edit / Delete"&&(
        <div style={{display:"flex",flexDirection:"column",gap:8,maxWidth:720}}>
          {editPagination.paginated.map((p)=>{  // REMOVED: i index and fade-up animation
            const preview=p.imageBase64||p.imageUrl;
            return(
              <div key={p.id} className="ims-row-item">
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:38,height:38,borderRadius:8,border:"1px solid var(--border)",overflow:"hidden",background:"var(--bg-elevated)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:16}}>
                    <LazyImage src={preview} />
                  </div>
                  <div>
                    <p className="t-primary" style={{margin:0,fontSize:14,fontWeight:600}}>{p.productName}</p>
                    <p className="t-muted" style={{margin:"2px 0 0",fontSize:11}}>{p.skuId} · {p.vendorName||"No vendor"} · {p.category||"No category"}</p>
                  </div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <Button variant="ghost" onClick={()=>setEditItem({...p})}>Edit</Button>
                  <Button variant="danger" onClick={()=>{remove(p.id);setToast({msg:"Deleted",type:"success"});}}>Delete</Button>
                </div>
              </div>
            );
          })}
          <Pagination 
            page={editPagination.page} 
            totalPages={editPagination.totalPages} 
            onChange={editPagination.setPage}
            totalItems={products.length}
          />
        </div>
      )}

      {editItem&&(
        <Modal title={`Edit — ${editItem.productName}`} onClose={()=>setEditItem(null)} width={740}>
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            <div>
              <p className="ims-section-title">Identifiers</p>
              <Grid>
                {[["skuId","SKU"],["productName","Product"],["brandName","Brand"],["vendorName","Vendor"]].map(([k,l])=>(
                  <F key={k} label={l}><input className="ims-input" value={editItem[k]||""} onChange={e=>setEditItem(p=>({...p,[k]:e.target.value}))}/></F>
                ))}
              </Grid>
            </div>
            <div>
              <p className="ims-section-title">Category</p>
              <Grid>
                <F label="Category">
                  <select className="ims-input" value={editItem.category||""} onChange={e=>setEditItem(p=>({...p,category:e.target.value,subcategory:""}))}>
                    <option value="">Select…</option>
                    {CATEGORY_LIST.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </F>
                <F label="Subcategory">
                  <select className="ims-input" value={editItem.subcategory||""} onChange={e=>setEditItem(p=>({...p,subcategory:e.target.value}))}>
                    <option value="">Select…</option>
                    {editItem.category&&(CATEGORIES[editItem.category]||[]).map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </F>
              </Grid>
            </div>
            <div>
              <p className="ims-section-title">Pricing</p>
              <Grid>
                {[["mrp","MRP ₹"],["buyingPrice","Buy ₹"],["sellingPrice","Sell ₹"]].map(([k,l])=>(
                  <F key={k} label={l}><input type="number" className="ims-input" value={editItem[k]||""} onChange={e=>setEditItem(p=>({...p,[k]:e.target.value}))}/></F>
                ))}
                <F label="Margin"><div style={{padding:"9px 12px",background:"var(--bg-elevated)",borderRadius:8,border:"1px solid var(--border)"}}><span className="t-success" style={{fontWeight:700}}>{margin(Number(editItem.buyingPrice),Number(editItem.sellingPrice))??"—"}%</span></div></F>
              </Grid>
            </div>
            <div>
              <p className="ims-section-title">Image</p>
              <ImageUploader base64={editItem.imageBase64||""} url={editItem.imageUrl||""} onBase64Change={v=>setEditItem(p=>({...p,imageBase64:v}))} onUrlChange={v=>setEditItem(p=>({...p,imageUrl:v}))}/>
            </div>
          </div>
          <div style={{display:"flex",gap:10,marginTop:20}}>
            <Button onClick={handleUpdate} disabled={saving}>{saving?"Saving…":"Save"}</Button>
            <Button variant="ghost" onClick={()=>setEditItem(null)}>Cancel</Button>
          </div>
        </Modal>
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