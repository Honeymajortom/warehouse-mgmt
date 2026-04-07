import { useState, useEffect } from "react";
import useCrud from "../hooks/useCrud";
import { getAll, genOrderId } from "../services/firestoreService";
import { Badge, Table, Td, Input, Select, Button, FormCard, SectionHeader, Toast } from "../components/ui/index.jsx";
import Modal from "../components/ui/Modal";

const STATUS_OPTIONS = ["In Transit","Pick","Pack","Shipped"];
const STATUS_BADGE   = { "In Transit":"violet", Pick:"cyan", Pack:"amber", Shipped:"green" };

const empty = { name:"", contact:"", email:"", address:"",
                productName:"", skuId:"", quantity:"", status:"In Transit" };

const validatePhone = v => /^[6-9]\d{9}$/.test(v.replace(/\s/g,""));
const validateEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export default function CustomersPage() {
  const { items:customers, loading, saving, add, remove, update } = useCrud("customers");
  const [tab, setTab]       = useState("List");
  const [form, setForm]     = useState(empty);
  const [invProducts, setInvProducts] = useState([]); // only in-stock inventory products
  const [editItem, setEditItem] = useState(null);
  const [toast, setToast]   = useState(null);
  const [search, setSearch] = useState("");
  const [errors, setErrors] = useState({});

  useEffect(() => {
    // Load only products that are actually in inventory (QC-passed, in stock)
    getAll("inventory").then(inv => {
      const inStock = inv.filter(i => Number(i.availableStock||0) > 0);
      setInvProducts(inStock);
    });
  }, []);

  const f = k => e => { setForm(p=>({...p,[k]:e.target.value})); setErrors(p=>({...p,[k]:""})); };

  const pickProduct = name => {
    const item = invProducts.find(i => i.productName === name);
    setForm(prev => ({...prev, productName:name, skuId:item?.skuId||""}));
  };

  const validate = () => {
    const e = {};
    if (!form.name)                        e.name    = "Name is required";
    if (!form.contact)                     e.contact = "Phone is required";
    else if (!validatePhone(form.contact)) e.contact = "Enter valid 10-digit mobile";
    if (form.email && !validateEmail(form.email)) e.email = "Enter valid email";
    if (!form.productName)                 e.product = "Select a product";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAdd = async () => {
    if (!validate()) return;
    const orderId = genOrderId();
    await add({...form, orderId, quantity:Number(form.quantity), createdAt:new Date().toISOString()});
    setForm(empty);
    setTab("List");
    setToast({ msg:`Order ${orderId} created`, type:"success" });
  };

  const handleUpdate = async () => {
    const e = {};
    if (editItem.contact && !validatePhone(editItem.contact)) e.contact = "Invalid mobile";
    if (editItem.email   && !validateEmail(editItem.email))   e.email   = "Invalid email";
    if (Object.keys(e).length) return setErrors(e);
    await update(editItem.id, editItem);
    setEditItem(null);
    setToast({ msg:"Updated", type:"success" });
  };

  const filtered = customers.filter(c =>
    !search ||
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.orderId?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
      <SectionHeader title="Customers" subtitle={`${customers.length} orders`}/>
      <div className="ims-tab-bar">
        {["List","Add","Edit / Delete"].map(t=>(
          <button key={t} className={`ims-tab${tab===t?" active":""}`} onClick={()=>setTab(t)}>{t}</button>
        ))}
      </div>

      {tab==="List" && (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <input className="ims-input" style={{width:300}} placeholder="Search name or order ID…"
            value={search} onChange={e=>setSearch(e.target.value)}/>
          <Table loading={loading}
            cols={["Order ID","Customer","Contact","Email","Address","Product","SKU","Qty","Status"]}
            rows={filtered}
            renderRow={r=>(<>
              <Td mono><span className="t-accent">{r.orderId}</span></Td>
              <Td><span style={{fontWeight:600}}>{r.name}</span></Td>
              <Td>{r.contact}</Td><Td>{r.email}</Td><Td>{r.address}</Td>
              <Td>{r.productName}</Td><Td mono>{r.skuId}</Td><Td>{r.quantity}</Td>
              <Td><Badge color={STATUS_BADGE[r.status]||"cyan"}>{r.status||"In Transit"}</Badge></Td>
            </>)}
          />
        </div>
      )}

      {tab==="Add" && (
        <FormCard title="Add New Order" onSubmit={handleAdd} loading={saving} submitLabel="Create Order">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <Input label="Full Name" value={form.name} onChange={f("name")} placeholder="Customer name"/>
              {errors.name && <span style={{fontSize:11,color:"var(--danger-text)"}}>{errors.name}</span>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <Input label="Contact (10-digit)" value={form.contact} onChange={f("contact")} placeholder="9876543210"/>
              {errors.contact && <span style={{fontSize:11,color:"var(--danger-text)"}}>{errors.contact}</span>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <Input label="Email" value={form.email} onChange={f("email")} placeholder="email@example.com"/>
              {errors.email && <span style={{fontSize:11,color:"var(--danger-text)"}}>{errors.email}</span>}
            </div>
            <Input label="Address" value={form.address} onChange={f("address")} placeholder="City, State"/>

            {/* Product — filtered to IN-STOCK inventory only */}
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <label className="ims-label">Product <span style={{fontSize:10,color:"var(--success-text)"}}>(in-stock only)</span></label>
              <select className="ims-input" value={form.productName}
                onChange={e=>pickProduct(e.target.value)}>
                <option value="">Select product…</option>
                {invProducts.map((p,i)=>(
                  <option key={i} value={p.productName}>
                    {p.productName} — {p.availableStock} units @ {p.location||"—"}
                  </option>
                ))}
              </select>
              {errors.product && <span style={{fontSize:11,color:"var(--danger-text)"}}>{errors.product}</span>}
            </div>
            <Input label="SKU ID (auto)" value={form.skuId} readOnly/>
            <Input label="Quantity" type="number" value={form.quantity} onChange={f("quantity")} placeholder="0"/>
            <Select label="Status" value={form.status} onChange={f("status")} options={STATUS_OPTIONS}/>
          </div>
          <div className="ims-accent-box" style={{marginTop:12}}>
            <p className="t-muted" style={{fontSize:12,margin:0}}>
              Only QC-passed, in-stock products are shown in the dropdown. Default status: <strong>In Transit</strong>
            </p>
          </div>
        </FormCard>
      )}

      {tab==="Edit / Delete" && (
        <div style={{display:"flex",flexDirection:"column",gap:8,maxWidth:720}}>
          {customers.map((c,i)=>(
            <div key={c.id} className="ims-row-item fade-up" style={{animationDelay:`${i*30}ms`}}>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div>
                  <p className="t-primary" style={{margin:0,fontSize:14,fontWeight:600}}>{c.name}</p>
                  <p className="t-accent"  style={{margin:"2px 0 0",fontSize:11,fontFamily:"monospace"}}>{c.orderId}</p>
                </div>
                <Badge color={STATUS_BADGE[c.status]||"cyan"}>{c.status||"In Transit"}</Badge>
              </div>
              <div style={{display:"flex",gap:8}}>
                <Button variant="ghost"  onClick={()=>{setEditItem({...c});setErrors({});}}>Edit</Button>
                <Button variant="danger" onClick={()=>{remove(c.id);setToast({msg:"Deleted",type:"success"});}}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editItem && (
        <Modal title={`Edit — ${editItem.name}`} onClose={()=>setEditItem(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Input label="Name"    value={editItem.name||""} onChange={e=>setEditItem(p=>({...p,name:e.target.value}))}/>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <Input label="Contact" value={editItem.contact||""} onChange={e=>{setEditItem(p=>({...p,contact:e.target.value}));setErrors(p=>({...p,contact:""}));}}/>
              {errors.contact && <span style={{fontSize:11,color:"var(--danger-text)"}}>{errors.contact}</span>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <Input label="Email"   value={editItem.email||""} onChange={e=>{setEditItem(p=>({...p,email:e.target.value}));setErrors(p=>({...p,email:""}));}}/>
              {errors.email && <span style={{fontSize:11,color:"var(--danger-text)"}}>{errors.email}</span>}
            </div>
            <Input label="Address" value={editItem.address||""} onChange={e=>setEditItem(p=>({...p,address:e.target.value}))}/>
            <Input label="Quantity" type="number" value={editItem.quantity||""} onChange={e=>setEditItem(p=>({...p,quantity:Number(e.target.value)}))}/>
            <Select label="Status" value={editItem.status||"In Transit"}
              onChange={e=>setEditItem(p=>({...p,status:e.target.value}))} options={STATUS_OPTIONS}/>
          </div>
          <div style={{display:"flex",gap:10,marginTop:20}}>
            <Button onClick={handleUpdate} disabled={saving}>{saving?"Saving…":"Save"}</Button>
            <Button variant="ghost" onClick={()=>setEditItem(null)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
