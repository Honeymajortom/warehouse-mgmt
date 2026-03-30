import { useState } from "react";
import useCrud from "../hooks/useCrud";
import { Table,Td,Input,Button,FormCard,SectionHeader,Toast } from "../components/ui/index.jsx";
import Modal from "../components/ui/Modal";

const FIELDS=[["skuId","SKU ID"],["productName","Product Name"],["vendorName","Vendor Name"],["contact","Contact"],["email","Email"],["gstNo","GST Number"],["address","Address"]];
const empty=Object.fromEntries(FIELDS.map(([k])=>[k,""]));

export default function VendorsPage() {
  const {items:vendors,loading,saving,add,remove,update}=useCrud("vendors");
  const [tab,setTab]=useState("List");
  const [form,setForm]=useState(empty);
  const [editItem,setEditItem]=useState(null);
  const [toast,setToast]=useState(null);
  const f=k=>e=>setForm(p=>({...p,[k]:e.target.value}));

  const handleAdd=async()=>{
    if(!form.vendorName)return setToast({msg:"Vendor name required",type:"error"});
    await add(form);setForm(empty);setTab("List");setToast({msg:"Vendor added",type:"success"});
  };
  const handleUpdate=async()=>{ await update(editItem.id,editItem);setEditItem(null);setToast({msg:"Updated",type:"success"}); };

  return(
    <div>
      {toast&&<Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
      <SectionHeader title="Vendors" subtitle={`${vendors.length} vendors`}/>
      <div className="ims-tab-bar">
        {["List","Add","Edit / Delete"].map(t=><button key={t} className={`ims-tab${tab===t?" active":""}`} onClick={()=>setTab(t)}>{t}</button>)}
      </div>

      {tab==="List"&&(
        <Table loading={loading} cols={["SKU ID","Product","Vendor Name","Contact","Email","GST No","Address"]} rows={vendors}
          renderRow={r=>(<><Td mono>{r.skuId}</Td><Td>{r.productName}</Td><Td><span className="t-accent" style={{fontWeight:600}}>{r.vendorName}</span></Td><Td>{r.contact}</Td><Td>{r.email}</Td><Td mono>{r.gstNo}</Td><Td>{r.address}</Td></>)}
        />
      )}

      {tab==="Add"&&(
        <FormCard title="Add New Vendor" onSubmit={handleAdd} loading={saving} submitLabel="Add Vendor">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            {FIELDS.map(([k,l])=><Input key={k} label={l} value={form[k]} onChange={f(k)} placeholder={`Enter ${l}`}/>)}
          </div>
        </FormCard>
      )}

      {tab==="Edit / Delete"&&(
        <div style={{display:"flex",flexDirection:"column",gap:8,maxWidth:720}}>
          {vendors.map((v,i)=>(
            <div key={v.id} className="ims-row-item fade-up" style={{animationDelay:`${i*30}ms`}}>
              <div>
                <p className="t-primary" style={{margin:0,fontSize:14,fontWeight:600}}>{v.vendorName}</p>
                <p className="t-muted"   style={{margin:"2px 0 0",fontSize:11}}>{v.email} · GST: {v.gstNo||"—"}</p>
              </div>
              <div style={{display:"flex",gap:8}}>
                <Button variant="ghost" onClick={()=>setEditItem({...v})}>Edit</Button>
                <Button variant="danger" onClick={()=>{remove(v.id);setToast({msg:"Deleted",type:"success"});}}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editItem&&(
        <Modal title={`Edit — ${editItem.vendorName}`} onClose={()=>setEditItem(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            {FIELDS.map(([k,l])=><Input key={k} label={l} value={editItem[k]||""} onChange={e=>setEditItem(p=>({...p,[k]:e.target.value}))}/>)}
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
