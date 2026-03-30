import { useState, useEffect } from "react";
import useCrud from "../hooks/useCrud";
import { getAll, genPoNumber } from "../services/firestoreService";
import { Table, Td, Input, Button, FormCard, SectionHeader, Toast } from "../components/ui/index.jsx";
import Modal from "../components/ui/Modal";

const empty = { skuId:"", productName:"", vendorName:"", purchaseDate:"", units:"", costPerHead:"", totalCost:"" };

export default function PurchasePage() {
  const { items:purchases, loading, saving, add, remove, update } = useCrud("purchases");
  const [tab,setTab]       = useState("List");
  const [form,setForm]     = useState(empty);
  const [products,setProducts] = useState([]);
  const [editItem,setEditItem] = useState(null);
  const [toast,setToast]   = useState(null);
  const [poPreview,setPoPreview] = useState("");

  useEffect(() => { getAll("products").then(setProducts); setPoPreview(genPoNumber()); }, []);

  const handleProductSelect = name => {
    const p = products.find(p => p.productName === name);
    const buying = p?.buyingPrice ? String(p.buyingPrice) : "";
    setForm(prev => {
      const units = prev.units;
      const total = units && buying ? String(Number(units) * Number(buying)) : "";
      return { ...prev, productName:name, skuId:p?.skuId||"", vendorName:p?.vendorName||"", costPerHead:buying, totalCost:total };
    });
  };

  // Recalculate total when units or cost changes; costPerHead is editable (can override)
  const handleField = (k, val) => {
    setForm(prev => {
      const u = { ...prev, [k]: val };
      u.totalCost = u.units && u.costPerHead ? String(Number(u.units) * Number(u.costPerHead)) : "";
      return u;
    });
  };

  const handleAdd = async () => {
    if (!form.productName) return setToast({ msg:"Product required", type:"error" });
    const poNumber = genPoNumber();
    await add({ ...form, poNumber, units:Number(form.units), costPerHead:Number(form.costPerHead), totalCost:Number(form.totalCost), createdAt:new Date().toISOString() });
    setForm(empty);
    setPoPreview(genPoNumber());
    setTab("List");
    setToast({ msg:`Purchase Added — PO: ${poNumber}`, type:"success" });
  };

  const handleUpdate = async () => {
    const tc = Number(editItem.units) * Number(editItem.costPerHead);
    await update(editItem.id, { ...editItem, units:Number(editItem.units), costPerHead:Number(editItem.costPerHead), totalCost:tc });
    setEditItem(null);
    setToast({ msg:"Updated", type:"success" });
  };

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
      <SectionHeader title="Purchase" subtitle="Purchase orders & stock intake"/>
      <div className="ims-tab-bar">
        {["List","Add Purchase","Edit / Delete"].map(t=>(
          <button key={t} className={`ims-tab${tab===t?" active":""}`} onClick={()=>setTab(t)}>{t}</button>
        ))}
      </div>

      {tab==="List" && (
        <Table loading={loading} cols={["PO Number","SKU ID","Product","Vendor","Date","Units","Cost/Head","Total Cost"]} rows={purchases}
          renderRow={r=>(<>
            <Td mono><span className="t-accent">{r.poNumber}</span></Td>
            <Td mono>{r.skuId}</Td><Td>{r.productName}</Td><Td>{r.vendorName}</Td>
            <Td>{r.purchaseDate}</Td><Td>{r.units}</Td>
            <Td>₹{Number(r.costPerHead).toLocaleString()}</Td>
            <Td><span className="t-warning" style={{fontWeight:700}}>₹{Number(r.totalCost).toLocaleString()}</span></Td>
          </>)}
        />
      )}

      {tab==="Add Purchase" && (
        <FormCard title="New Purchase Order" onSubmit={handleAdd} loading={saving} submitLabel="Add Purchase">
          <div className="ims-accent-box">
            <p className="t-accent" style={{margin:0,fontSize:12,fontWeight:600}}>PO (auto): <span style={{fontFamily:"monospace"}}>{poPreview}</span></p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <label className="ims-label">Product Name</label>
              <input list="pur-dl" className="ims-input" value={form.productName}
                onChange={e=>handleProductSelect(e.target.value)} placeholder="Type product…"/>
              <datalist id="pur-dl">{products.map(p=><option key={p.id} value={p.productName}/>)}</datalist>
            </div>
            <Input label="SKU ID (auto)"    value={form.skuId}      readOnly/>
            <Input label="Vendor (auto)"    value={form.vendorName} readOnly/>
            <Input label="Purchase Date"    type="date" value={form.purchaseDate} onChange={e=>handleField("purchaseDate",e.target.value)}/>
            <Input label="Units"            type="number" value={form.units}       onChange={e=>handleField("units",e.target.value)} placeholder="0"/>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <Input label="Cost Per Head (₹)" type="number" value={form.costPerHead} onChange={e=>handleField("costPerHead",e.target.value)} placeholder="Auto from product"/>
              <p className="t-muted" style={{fontSize:11,margin:0}}>Auto-filled from product buying price · editable</p>
            </div>
          </div>
          {form.totalCost && (
            <div className="ims-elevated" style={{padding:"12px 16px"}}>
              <p className="t-warning" style={{margin:0,fontSize:14,fontWeight:700}}>Total: ₹{Number(form.totalCost).toLocaleString()}</p>
            </div>
          )}
        </FormCard>
      )}

      {tab==="Edit / Delete" && (
        <div style={{display:"flex",flexDirection:"column",gap:8,maxWidth:720}}>
          {purchases.map((p,i)=>(
            <div key={p.id} className="ims-row-item fade-up" style={{animationDelay:`${i*30}ms`}}>
              <div>
                <p className="t-accent" style={{margin:0,fontSize:13,fontWeight:700,fontFamily:"monospace"}}>{p.poNumber}</p>
                <p className="t-muted"  style={{margin:"3px 0 0",fontSize:12}}>{p.productName} · {p.vendorName} · ₹{Number(p.totalCost).toLocaleString()}</p>
              </div>
              <div style={{display:"flex",gap:8}}>
                <Button variant="ghost"  onClick={()=>setEditItem({...p})}>Edit</Button>
                <Button variant="danger" onClick={()=>{remove(p.id);setToast({msg:"Deleted",type:"success"});}}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editItem && (
        <Modal title={`Edit PO — ${editItem.poNumber}`} onClose={()=>setEditItem(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Input label="Product"   value={editItem.productName||""} onChange={e=>setEditItem(p=>({...p,productName:e.target.value}))}/>
            <Input label="Vendor"    value={editItem.vendorName||""}  onChange={e=>setEditItem(p=>({...p,vendorName:e.target.value}))}/>
            <Input label="Date" type="date" value={editItem.purchaseDate||""} onChange={e=>setEditItem(p=>({...p,purchaseDate:e.target.value}))}/>
            <Input label="Units" type="number" value={editItem.units||""} onChange={e=>setEditItem(p=>({...p,units:e.target.value}))}/>
            <Input label="Cost/Head" type="number" value={editItem.costPerHead||""} onChange={e=>setEditItem(p=>({...p,costPerHead:e.target.value}))}/>
            <Input label="Total (auto)" value={String(Number(editItem.units||0)*Number(editItem.costPerHead||0))} readOnly/>
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
