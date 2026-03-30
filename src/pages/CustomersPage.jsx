import { useState, useEffect } from "react";
import useCrud from "../hooks/useCrud";
import { getAll, genOrderId } from "../services/firestoreService";
import { Badge, Table, Td, Input, Select, Button, FormCard, SectionHeader, Toast } from "../components/ui/index.jsx";
import Modal from "../components/ui/Modal";

const STATUS_OPTIONS = ["In Transit","Pick","Pack","Shipped"];
const STATUS_BADGE   = { "In Transit":"violet", Pick:"cyan", Pack:"amber", Shipped:"green" };
const empty = { name:"", contact:"", email:"", address:"", productName:"", skuId:"", quantity:"", status:"In Transit" };
const TABS  = ["List","Add","Edit / Delete"];

const validatePhone = v => /^[6-9]\d{9}$/.test(v.replace(/\s/g,""));
const validateEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export default function CustomersPage() {
  const { items:customers, loading, saving, add, remove, update } = useCrud("customers");
  const [tab,setTab]       = useState("List");
  const [form,setForm]     = useState(empty);
  const [products,setProducts] = useState([]);
  const [editItem,setEditItem] = useState(null);
  const [toast,setToast]   = useState(null);
  const [search,setSearch] = useState("");
  const [errors,setErrors] = useState({});

  useEffect(() => { getAll("products").then(setProducts); }, []);
  const f = k => e => { setForm(p=>({...p,[k]:e.target.value})); setErrors(p=>({...p,[k]:""})); };

  const pickProduct = (name, setter) => {
    const p = products.find(p => p.productName === name);
    setter(prev => ({...prev, productName:name, skuId:p?.skuId||""}));
  };

  const validate = () => {
    const e = {};
    if (!form.name)                           e.name    = "Name is required";
    if (!form.contact)                        e.contact = "Phone is required";
    else if (!validatePhone(form.contact))    e.contact = "Enter valid 10-digit mobile number";
    if (form.email && !validateEmail(form.email)) e.email = "Enter valid email address";
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

  const validateEdit = () => {
    const e = {};
    if (!editItem.contact)                      e.contact = "Phone required";
    else if (!validatePhone(editItem.contact))  e.contact = "Invalid mobile number";
    if (editItem.email && !validateEmail(editItem.email)) e.email = "Invalid email";
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const handleUpdate = async () => {
    if (!validateEdit()) return;
    await update(editItem.id, editItem);
    setEditItem(null);
    setToast({ msg:"Updated", type:"success" });
  };

  const filtered = customers.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.orderId?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
      <SectionHeader title="Customers" subtitle={`${customers.length} total orders`}/>
      <div className="ims-tab-bar">
        {TABS.map(t=><button key={t} className={`ims-tab${tab===t?" active":""}`} onClick={()=>setTab(t)}>{t}</button>)}
      </div>

      {tab==="List" && (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <input className="ims-input" style={{width:300}} placeholder="Search name or order ID…" value={search} onChange={e=>setSearch(e.target.value)}/>
          <Table loading={loading} cols={["Order ID","Customer","Contact","Email","Address","Product","SKU","Qty","Status"]} rows={filtered}
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
        <FormCard title="Add New Customer" onSubmit={handleAdd} loading={saving} submitLabel="Create Customer">
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
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <label className="ims-label">Product Name</label>
              <input list="prod-dl" className="ims-input" value={form.productName} onChange={e=>pickProduct(e.target.value,setForm)} placeholder="Type product…"/>
              <datalist id="prod-dl">{products.map(p=><option key={p.id} value={p.productName}/>)}</datalist>
            </div>
            <Input label="SKU ID (auto)" value={form.skuId} readOnly/>
            <Input label="Quantity" type="number" value={form.quantity} onChange={f("quantity")} placeholder="0"/>
            <Select label="Status" value={form.status} onChange={f("status")} options={STATUS_OPTIONS}/>
          </div>
          <div className="ims-accent-box" style={{marginTop:12}}>
            <p className="t-muted" style={{fontSize:12,margin:0}}>Order ID auto-generated · Default status: <strong>In Transit</strong></p>
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
                <Button variant="ghost" onClick={()=>{setEditItem({...c});setErrors({});}}>Edit</Button>
                <Button variant="danger" onClick={()=>{remove(c.id);setToast({msg:"Deleted",type:"success"});}}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editItem && (
        <Modal title={`Edit — ${editItem.name}`} onClose={()=>setEditItem(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Input label="Name" value={editItem.name||""} onChange={e=>setEditItem(p=>({...p,name:e.target.value}))}/>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <Input label="Contact" value={editItem.contact||""} onChange={e=>{setEditItem(p=>({...p,contact:e.target.value}));setErrors(p=>({...p,contact:""}));}}/>
              {errors.contact && <span style={{fontSize:11,color:"var(--danger-text)"}}>{errors.contact}</span>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <Input label="Email" value={editItem.email||""} onChange={e=>{setEditItem(p=>({...p,email:e.target.value}));setErrors(p=>({...p,email:""}));}}/>
              {errors.email && <span style={{fontSize:11,color:"var(--danger-text)"}}>{errors.email}</span>}
            </div>
            <Input label="Address" value={editItem.address||""} onChange={e=>setEditItem(p=>({...p,address:e.target.value}))}/>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <label className="ims-label">Product Name</label>
              <input list="edit-prod-dl" className="ims-input" value={editItem.productName||""}
                onChange={e=>{const p=products.find(p=>p.productName===e.target.value);setEditItem(prev=>({...prev,productName:e.target.value,skuId:p?.skuId||prev.skuId}));}}/>
              <datalist id="edit-prod-dl">{products.map(p=><option key={p.id} value={p.productName}/>)}</datalist>
            </div>
            <Input label="SKU ID" value={editItem.skuId||""} readOnly/>
            <Input label="Quantity" type="number" value={editItem.quantity||""} onChange={e=>setEditItem(p=>({...p,quantity:Number(e.target.value)}))}/>
            <Select label="Status" value={editItem.status||"In Transit"} onChange={e=>setEditItem(p=>({...p,status:e.target.value}))} options={STATUS_OPTIONS}/>
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
