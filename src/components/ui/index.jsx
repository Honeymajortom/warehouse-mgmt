import { useEffect } from "react";

const BADGE_CLASS = { cyan:"ims-badge-cyan", green:"ims-badge-green", red:"ims-badge-red", amber:"ims-badge-amber", violet:"ims-badge-violet", teal:"ims-badge-teal" };

export function Badge({ children, color="cyan" }) {
  return <span className={`ims-badge ${BADGE_CLASS[color]||"ims-badge-cyan"}`}>{children}</span>;
}

export function Table({ cols, rows, renderRow, loading }) {
  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"64px 0" }}>
      <div className="spin" style={{ width:20, height:20, border:"2px solid var(--border)", borderTopColor:"var(--accent)", borderRadius:"50%" }}/>
      <span className="t-secondary" style={{ marginLeft:12, fontSize:13 }}>Loading…</span>
    </div>
  );
  return (
    <div className="ims-table-wrap">
      <table className="ims-table">
        <thead><tr>{cols.map(c=><th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.length===0
            ? <tr><td colSpan={cols.length} style={{ padding:"48px 16px", textAlign:"center", fontSize:13 }} className="t-muted">No records found</td></tr>
            : rows.map((row,i)=><tr key={i} className="fade-up" style={{ animationDelay:`${i*20}ms` }}>{renderRow(row,i)}</tr>)
          }
        </tbody>
      </table>
    </div>
  );
}

export function Td({ children, mono=false }) {
  return <td className={mono?"mono":""}>{children}</td>;
}

export function Input({ label, type="text", placeholder, value, onChange, readOnly=false, step }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      {label && <label className="ims-label">{label}</label>}
      <input type={type} placeholder={placeholder} value={value} onChange={onChange}
        readOnly={readOnly} step={step} className="ims-input"
        style={{ cursor:readOnly?"not-allowed":"text" }}/>
    </div>
  );
}

export function Select({ label, value, onChange, options=[], placeholder }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      {label && <label className="ims-label">{label}</label>}
      <select value={value} onChange={onChange} className="ims-input" style={{ cursor:"pointer" }}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
      </select>
    </div>
  );
}

const BTN_CLASS = { primary:"ims-btn-primary", danger:"ims-btn-danger", success:"ims-btn-success", amber:"ims-btn-amber", outline:"ims-btn-outline", ghost:"ims-btn-ghost" };
export function Button({ children, onClick, variant="primary", disabled=false }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`ims-btn ${BTN_CLASS[variant]||"ims-btn-primary"}`}>
      {children}
    </button>
  );
}

export function SectionHeader({ title, subtitle, children }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:24 }}>
      <div>
        <h2 className="gradient-text" style={{ fontSize:28, fontWeight:600, margin:0, fontFamily:"'Syne',sans-serif" }}>{title}</h2>
        {subtitle && <p className="t-secondary" style={{ fontSize:13, marginTop:4 }}>{subtitle}</p>}
      </div>
      {children && <div style={{ display:"flex", gap:8 }}>{children}</div>}
    </div>
  );
}

export function Toast({ message, type="success", onClose }) {
  useEffect(()=>{ const t=setTimeout(onClose,3500); return ()=>clearTimeout(t); },[onClose]);
  return (
    <div className="ims-toast fade-up" style={{ border:`1px solid ${type==="success"?"var(--badge-grn-br)":"var(--badge-red-br)"}` }}>
      <span style={{ fontWeight:700, color:type==="success"?"var(--success-text)":"var(--danger-text)" }}>{type==="success"?"✓":"✕"}</span>
      <span className="t-primary" style={{ fontSize:13, fontWeight:500 }}>{message}</span>
      <button onClick={onClose} className="t-muted" style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer" }}>✕</button>
    </div>
  );
}

export function FormCard({ title, children, onSubmit, submitLabel="Save", loading=false }) {
  return (
    <div className="ims-form-card">
      <h3 className="ims-form-title">{title}</h3>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>{children}</div>
      <div style={{ marginTop:20 }}>
        <Button onClick={onSubmit} disabled={loading}>{loading?"Saving…":submitLabel}</Button>
      </div>
    </div>
  );
}
