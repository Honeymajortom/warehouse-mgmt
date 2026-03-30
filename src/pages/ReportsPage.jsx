import { useState } from "react";
import { getAll, exportCSV } from "../services/firestoreService";
import { Button,SectionHeader,Toast } from "../components/ui/index.jsx";

const TYPES=[{value:"customers",label:"Customers"},{value:"vendors",label:"Vendors"},{value:"products",label:"Products"},{value:"purchases",label:"Purchases"},{value:"grn",label:"GRN"},{value:"inventory",label:"Inventory"},{value:"pickingdata",label:"Picking"},{value:"packing",label:"Packing"},{value:"returns",label:"Returns"}];

export default function ReportsPage() {
  const [type,setType]=useState("inventory");
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [preview,setPreview]=useState([]);
  const [loading,setLoading]=useState(false);
  const [toast,setToast]=useState(null);

  const filterDate=rows=>{
    if(!from&&!to)return rows;
    return rows.filter(r=>{
      const d=r.createdAt||r.purchaseDate||r.pickedAt;
      if(!d)return true;
      const dt=new Date(d);
      if(from&&dt<new Date(from))return false;
      if(to&&dt>new Date(to+"T23:59:59"))return false;
      return true;
    });
  };

  const handlePreview=async()=>{
    setLoading(true);
    const rows=filterDate(await getAll(type));
    setPreview(rows.slice(0,10));setLoading(false);
    setToast({msg:`${rows.length} records found`,type:"success"});
  };

  const handleExport=async()=>{
    setLoading(true);
    const rows=filterDate(await getAll(type));
    if(!rows.length){setToast({msg:"No data to export",type:"error"});setLoading(false);return;}
    const label=TYPES.find(r=>r.value===type)?.label||type;
    const d=new Date().toISOString().split("T")[0];
    exportCSV(`${label}-${d}.csv`,rows);
    setToast({msg:`${label} exported (${rows.length} rows)`,type:"success"});
    setLoading(false);
  };

  const cols=preview.length>0?Object.keys(preview[0]).filter(k=>k!=="id"):[];

  return(
    <div>
      {toast&&<Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
      <SectionHeader title="Reports" subtitle="Export any module as CSV"/>

      <div className="ims-panel" style={{marginBottom:20}}>
        <p className="ims-section-title">Report Configuration</p>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr auto",gap:12,alignItems:"flex-end"}}>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            <label className="ims-label">Report Type</label>
            <select className="ims-input" value={type} onChange={e=>setType(e.target.value)}>
              {TYPES.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {[["Date From",from,setFrom],["Date To",to,setTo]].map(([l,v,s])=>(
            <div key={l} style={{display:"flex",flexDirection:"column",gap:6}}>
              <label className="ims-label">{l}</label>
              <input type="date" value={v} onChange={e=>s(e.target.value)} className="ims-input" style={{colorScheme:"dark"}}/>
            </div>
          ))}
          <div style={{display:"flex",gap:8}}>
            <Button variant="ghost" onClick={handlePreview} disabled={loading}>Preview</Button>
            <Button onClick={handleExport} disabled={loading}>{loading?"Loading…":"⬇ Export CSV"}</Button>
          </div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:24}}>
        {TYPES.map(r=>(
          <div key={r.value} onClick={()=>setType(r.value)}
            className={r.value===type?"ims-elevated ims-accent-box":"ims-elevated"}
            style={{padding:"10px 14px",borderRadius:10,cursor:"pointer"}}>
            <p style={{margin:0,fontSize:12,fontWeight:600}} className={r.value===type?"t-accent":"t-secondary"}>{r.label}</p>
          </div>
        ))}
      </div>

      {preview.length>0&&(
        <div className="ims-panel">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <p className="ims-section-title" style={{margin:0}}>Preview (first 10 rows)</p>
            <Button onClick={handleExport} disabled={loading}>⬇ Download Full Report</Button>
          </div>
          <div className="ims-table-wrap">
            <table className="ims-table">
              <thead><tr>{cols.map(c=><th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {preview.map((row,i)=>(
                  <tr key={i}>
                    {cols.map(c=><td key={c} style={{maxWidth:160,overflow:"hidden",textOverflow:"ellipsis"}}>{String(row[c]??"—")}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
