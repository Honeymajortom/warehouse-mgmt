import { useState } from "react";
import useCrud from "../hooks/useCrud";
import { searchByField, genGrnNumber } from "../services/firestoreService";
import { Table, Td, Input, Button, SectionHeader, Toast } from "../components/ui/index.jsx";

const empty = { invoiceNo:"", poNumber:"", skuId:"", skuName:"", receivedQty:"" };

export default function GRNPage() {
  const { items:grnList, loading, saving, add } = useCrud("grn");
  const [tab,setTab]         = useState("Create GRN");
  const [form,setForm]       = useState(empty);
  const [poInput,setPoInput] = useState("");
  const [poData,setPoData]   = useState(null);
  const [searching,setSearching] = useState(false);
  const [toast,setToast]     = useState(null);
  const [errors,setErrors]   = useState({});

  const lookupPO = async () => {
    if (!poInput) return setToast({ msg:"Enter a PO number", type:"error" });
    setSearching(true);
    const r = await searchByField("purchases","poNumber",poInput.trim());
    if (r.length > 0) {
      const po = r[0];
      setPoData(po);
      setForm(p => ({...p, poNumber:po.poNumber, skuId:po.skuId, skuName:po.productName, receivedQty:String(po.units||"")}));
      setToast({ msg:`Found: ${po.productName}`, type:"success" });
    } else {
      setPoData(null);
      setToast({ msg:"PO not found", type:"error" });
    }
    setSearching(false);
  };

  const handleAdd = async () => {
    const e = {};
    if (!form.invoiceNo)  e.invoiceNo = "Invoice number is required before creating GRN";
    if (!form.poNumber)   e.po        = "Lookup a valid PO first";
    setErrors(e);
    if (Object.keys(e).length) return;

    const grnNumber = genGrnNumber();
    await add({ ...form, grnNumber, receivedQty:Number(form.receivedQty), createdAt:new Date().toISOString() });
    setForm(empty);
    setPoInput("");
    setPoData(null);
    setTab("GRN List");
    setToast({ msg:`GRN ${grnNumber} created`, type:"success" });
  };

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
      <SectionHeader title="GRN Process" subtitle="Goods Received Note — log incoming stock"/>
      <div className="ims-tab-bar">
        {["Create GRN","GRN List"].map(t=>(
          <button key={t} className={`ims-tab${tab===t?" active":""}`} onClick={()=>setTab(t)}>{t}</button>
        ))}
      </div>

      {tab==="Create GRN" && (
        <div style={{display:"flex",flexDirection:"column",gap:16,maxWidth:680}}>
          {/* Step 1 */}
          <div className="ims-panel">
            <p className="ims-section-title">Step 1 — Lookup PO Number</p>
            <div style={{display:"flex",gap:12,alignItems:"flex-end"}}>
              <div style={{flex:1}}>
                <Input label="PO Number" value={poInput} onChange={e=>setPoInput(e.target.value)} placeholder="e.g. PO-20250201-1234"/>
              </div>
              <Button onClick={lookupPO} disabled={searching}>{searching?"Searching…":"Lookup PO"}</Button>
            </div>
            {errors.po && <p style={{margin:"8px 0 0",fontSize:12,color:"var(--danger-text)"}}>{errors.po}</p>}
            {poData && (
              <div className="ims-success-box" style={{marginTop:16}}>
                <p className="t-success" style={{margin:"0 0 10px",fontSize:11,fontWeight:700}}>✓ PO FOUND</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                  {[["Vendor",poData.vendorName],["Product",poData.productName],["Units",poData.units]].map(([l,v])=>(
                    <div key={l}>
                      <p className="t-muted"   style={{margin:0,fontSize:11}}>{l}</p>
                      <p className="t-primary" style={{margin:"3px 0 0",fontSize:13,fontWeight:600}}>{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 2 */}
          <div className="ims-panel">
            <p className="ims-section-title">Step 2 — GRN Entry</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <Input label="Invoice Number *" value={form.invoiceNo}
                  onChange={e=>{setForm(p=>({...p,invoiceNo:e.target.value}));setErrors(p=>({...p,invoiceNo:""}));}}
                  placeholder="INV-XXXX"/>
                {errors.invoiceNo && <span style={{fontSize:11,color:"var(--danger-text)"}}>{errors.invoiceNo}</span>}
              </div>
              <Input label="PO Number (auto)" value={form.poNumber} readOnly/>
              <Input label="SKU Name (auto)"  value={form.skuName}  readOnly/>
              <Input label="SKU ID (auto)"    value={form.skuId}    readOnly/>
              <Input label="Received Qty" type="number" value={form.receivedQty}
                onChange={e=>setForm(p=>({...p,receivedQty:e.target.value}))} placeholder="0"/>
            </div>
            <div className="ims-accent-box" style={{marginTop:16}}>
              <p className="t-accent" style={{margin:0,fontSize:12}}>⚠ Invoice number is <strong>required</strong> — GRN cannot be created without it</p>
            </div>
            <div style={{marginTop:16}}>
              <Button onClick={handleAdd} disabled={saving||!form.poNumber}>{saving?"Creating…":"Create GRN"}</Button>
            </div>
          </div>
        </div>
      )}

      {tab==="GRN List" && (
        <Table loading={loading} cols={["GRN No","Invoice No","PO Number","SKU ID","SKU Name","Recv Qty","Date"]} rows={grnList}
          renderRow={r=>(<>
            <Td mono><span className="t-success">{r.grnNumber}</span></Td>
            <Td mono><span className="t-warning">{r.invoiceNo}</span></Td>
            <Td mono><span className="t-accent">{r.poNumber}</span></Td>
            <Td mono>{r.skuId}</Td><Td>{r.skuName}</Td>
            <Td><span className="t-success" style={{fontWeight:700}}>{r.receivedQty}</span></Td>
            <Td>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}</Td>
          </>)}
        />
      )}
    </div>
  );
}
