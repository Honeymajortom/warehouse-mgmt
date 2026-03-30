import { useEffect } from "react";
export default function Modal({ title, children, onClose, width=640 }) {
  useEffect(()=>{ const h=e=>{if(e.key==="Escape")onClose();}; window.addEventListener("keydown",h); return()=>window.removeEventListener("keydown",h); },[onClose]);
  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{ position:"fixed", inset:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.55)", padding:16 }}>
      <div className="ims-card fade-up" style={{ padding:24, width:"100%", maxWidth:width, maxHeight:"90vh", overflowY:"auto", borderRadius:16 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, paddingBottom:16, borderBottom:"1px solid var(--border)" }}>
          <h3 className="t-primary" style={{ fontSize:15, fontWeight:700, fontFamily:"'Syne',sans-serif", margin:0 }}>{title}</h3>
          <button onClick={onClose} className="ims-btn ims-btn-ghost t-muted"
            style={{ width:28, height:28, padding:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
