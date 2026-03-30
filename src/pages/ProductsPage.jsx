import { useState, useEffect } from "react";
import useCrud from "../hooks/useCrud";
import { getAll } from "../services/firestoreService";
import { Table,Td,Input,Button,FormCard,SectionHeader,Toast } from "../components/ui/index.jsx";
import Modal from "../components/ui/Modal";

const empty={skuId:"",productName:"",buyingPrice:"",sellingPrice:"",imageUrl:"",vendorName:"",vendorId:""};
const margin=(b,s)=>b&&s?Math.round(((s-b)/s)*100):null;

export default function ProductsPage() {
  const {items:products,loading,saving,add,remove,update}=useCrud("products");
  const [tab,setTab]=useState("List");
  const [form,setForm]=useState(empty);
  const [vendors,setVendors]=useState([]);
  const [editItem,setEditItem]=useState(null);
  const [toast,setToast]=useState(null);

  useEffect(()=>{getAll("vendors").then(setVendors);},[]);
  const f=k=>e=>setForm(p=>({...p,[k]:e.target.value}));

  const handleAdd=async()=>{
    if(!form.skuId||!form.productName)return setToast({msg:"SKU and name required",type:"error"});
    await add({...form,buyingPrice:Number(form.buyingPrice),sellingPrice:Number(form.sellingPrice)});
    setForm(empty);setTab("List");setToast({msg:"Product added",type:"success"});
  };
  const handleUpdate=async()=>{ await update(editItem.id,{...editItem,buyingPrice:Number(editItem.buyingPrice),sellingPrice:Number(editItem.sellingPrice)}); setEditItem(null);setToast({msg:"Updated",type:"success"}); };

  return(
    <div>
      {toast&&<Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
      <SectionHeader title="Products" subtitle={`${products.length} SKUs`}/>
      <div className="ims-tab-bar">
        {["List","Add","Edit / Delete"].map(t=><button key={t} className={`ims-tab${tab===t?" active":""}`} onClick={()=>setTab(t)}>{t}</button>)}
      </div>

      {tab==="List"&&(
        <Table loading={loading} cols={["Image","SKU ID","Product","Vendor","Buy Price","Sell Price","Margin"]} rows={products}
          renderRow={r=>{
            const m=margin(r.buyingPrice,r.sellingPrice);
            return(<>
              <Td><div style={{width:36,height:36,borderRadius:8,border:"1px solid var(--border)",overflow:"hidden",background:"var(--bg-elevated)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>
                {r.imageUrl?<img src={r.imageUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>{e.target.style.display="none";}}/>:"⬛"}
              </div></Td>
              <Td mono>{r.skuId}</Td>
              <Td><span style={{fontWeight:600}}>{r.productName}</span></Td>
              <Td><span className="t-accent">{r.vendorName||"—"}</span></Td>
              <Td><span className="t-danger">₹{Number(r.buyingPrice).toLocaleString()}</span></Td>
              <Td><span className="t-success">₹{Number(r.sellingPrice).toLocaleString()}</span></Td>
              <Td>{m!==null&&<span className={m>30?"ims-badge ims-badge-green":"ims-badge ims-badge-amber"}>{m}%</span>}</Td>
            </>);
          }}
        />
      )}

      {tab==="Add"&&(
        <FormCard title="Add New Product" onSubmit={handleAdd} loading={saving} submitLabel="Add Product">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Input label="SKU ID" value={form.skuId} onChange={f("skuId")} placeholder="SKU-XX-00"/>
            <Input label="Product Name" value={form.productName} onChange={f("productName")} placeholder="e.g. Headset"/>
            <Input label="Buying Price (₹)" type="number" value={form.buyingPrice} onChange={f("buyingPrice")} placeholder="0"/>
            <Input label="Selling Price (₹)" type="number" value={form.sellingPrice} onChange={f("sellingPrice")} placeholder="0"/>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <label className="ims-label">Associated Vendor</label>
              <select className="ims-input" value={form.vendorName} onChange={e=>{const v=vendors.find(v=>v.vendorName===e.target.value);setForm(p=>({...p,vendorName:e.target.value,vendorId:v?.id||""}));}}>
                <option value="">Select vendor…</option>
                {vendors.map(v=><option key={v.id} value={v.vendorName}>{v.vendorName}</option>)}
              </select>
            </div>
            <Input label="Product Image URL" value={form.imageUrl} onChange={f("imageUrl")} placeholder="https://…"/>
          </div>
          {form.imageUrl&&<div style={{marginTop:12}}><img src={form.imageUrl} alt="preview" style={{height:72,borderRadius:8,border:"1px solid var(--border)"}} onError={e=>{e.target.style.display="none";}}/></div>}
          {form.buyingPrice&&form.sellingPrice&&(
            <div className="ims-elevated" style={{marginTop:12,padding:"10px 14px"}}>
              <p className="t-secondary" style={{margin:0,fontSize:12}}>Margin: <strong className="t-success">{margin(Number(form.buyingPrice),Number(form.sellingPrice))}%</strong> · Profit/unit: <strong className="t-success">₹{(Number(form.sellingPrice)-Number(form.buyingPrice)).toLocaleString()}</strong></p>
            </div>
          )}
        </FormCard>
      )}

      {tab==="Edit / Delete"&&(
        <div style={{display:"flex",flexDirection:"column",gap:8,maxWidth:720}}>
          {products.map((p,i)=>(
            <div key={p.id} className="ims-row-item fade-up" style={{animationDelay:`${i*30}ms`}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:36,height:36,borderRadius:8,border:"1px solid var(--border)",overflow:"hidden",background:"var(--bg-elevated)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>
                  {p.imageUrl?<img src={p.imageUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>{e.target.style.display="none";}}/>:"⬛"}
                </div>
                <div>
                  <p className="t-primary" style={{margin:0,fontSize:14,fontWeight:600}}>{p.productName}</p>
                  <p className="t-muted"   style={{margin:"2px 0 0",fontSize:11}}>{p.skuId} · {p.vendorName||"No vendor"}</p>
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <Button variant="ghost" onClick={()=>setEditItem({...p})}>Edit</Button>
                <Button variant="danger" onClick={()=>{remove(p.id);setToast({msg:"Deleted",type:"success"});}}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editItem&&(
        <Modal title={`Edit — ${editItem.productName}`} onClose={()=>setEditItem(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Input label="SKU ID" value={editItem.skuId||""} onChange={e=>setEditItem(p=>({...p,skuId:e.target.value}))}/>
            <Input label="Product Name" value={editItem.productName||""} onChange={e=>setEditItem(p=>({...p,productName:e.target.value}))}/>
            <Input label="Buying Price" type="number" value={editItem.buyingPrice||""} onChange={e=>setEditItem(p=>({...p,buyingPrice:e.target.value}))}/>
            <Input label="Selling Price" type="number" value={editItem.sellingPrice||""} onChange={e=>setEditItem(p=>({...p,sellingPrice:e.target.value}))}/>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <label className="ims-label">Vendor</label>
              <select className="ims-input" value={editItem.vendorName||""} onChange={e=>setEditItem(p=>({...p,vendorName:e.target.value}))}>
                <option value="">No vendor</option>
                {vendors.map(v=><option key={v.id} value={v.vendorName}>{v.vendorName}</option>)}
              </select>
            </div>
            <Input label="Image URL" value={editItem.imageUrl||""} onChange={e=>setEditItem(p=>({...p,imageUrl:e.target.value}))}/>
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
