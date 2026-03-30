import { useState, useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { getAll, searchByField, updateItem } from "../services/firestoreService";
import { Badge, Button, SectionHeader, Toast } from "../components/ui/index.jsx";

const makeAwb = (orderId) =>
  `AWB${String(orderId).replace(/\D/g,"").slice(-6).padStart(6,"0")}${Math.floor(1000+Math.random()*9000)}`;

// Renders a CODE128 barcode into an <svg> ref
function Barcode({ value, svgRef }) {
  useEffect(() => {
    if (!svgRef.current || !value) return;
    JsBarcode(svgRef.current, value, {
      format:      "CODE128",
      width:       2,
      height:      56,
      displayValue: false,   // we render text ourselves below
      margin:      0,
      background:  "transparent",
      lineColor:   "currentColor",
    });
  }, [value]);
  return <svg ref={svgRef} style={{ width:"100%", maxWidth:400, color:"var(--text-primary)" }}/>;
}

export default function PackingPage({ packOrder, clearPackOrder, goToReturns }) {
  const [tab, setTab]             = useState("Pack Orders");
  const [packList, setPackList]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeOrder, setActiveOrder] = useState(null);
  const [awbNumber, setAwbNumber] = useState("");
  const [paymentType, setPaymentType] = useState("Prepaid");
  const [promiseDate, setPromiseDate] = useState("");
  const [toast, setToast]         = useState(null);
  const barcodeSvgRef = useRef();

  const load = async () => {
    setLoading(true);
    const picked = await getAll("pickingdata");
    setPackList(picked.filter(p => p.status === "Picked" || p.status === "Packing"));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const enrichOrder = async (order) => {
    const [customers, vendors] = await Promise.all([
      searchByField("customers", "orderId", order.orderId),
      getAll("vendors"),
    ]);
    const customer = customers[0] || {};
    const vendor   = vendors.find(v => v.skuId === order.skuId || v.productName === order.productName) || {};
    return {
      ...order,
      address:      customer.address  || "—",
      customerDate: customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : "—",
      vendorName:   vendor.vendorName  || "—",
      vendorGst:    vendor.gstNo       || "—",
    };
  };

  const openOrder = async (order) => {
    const enriched = await enrichOrder(order);
    setActiveOrder(enriched);
    setAwbNumber(makeAwb(enriched.orderId));
    setPaymentType("Prepaid");
    setPromiseDate("");
    setTab("Packing");
  };

  useEffect(() => {
    if (packOrder) {
      openOrder(packOrder).then(() => clearPackOrder());
    }
  }, [packOrder]);

  const handleShipped = async () => {
    if (!activeOrder) return;
    const [records, customers] = await Promise.all([
      searchByField("pickingdata", "orderId", activeOrder.orderId),
      searchByField("customers",   "orderId", activeOrder.orderId),
    ]);
    for (const r of records)   await updateItem("pickingdata", r.id, { status: "Shipped" });
    for (const c of customers) await updateItem("customers",   c.id, { status: "Shipped" });
    setToast({ msg: `Order ${activeOrder.orderId} marked as Shipped`, type: "success" });
    setTimeout(() => {
      goToReturns({ ...activeOrder, status: "Shipped" });
      setActiveOrder(null);
      setTab("Pack Orders");
      load();
    }, 1200);
  };

  const handleExportPDF = () => {
    if (!activeOrder || !barcodeSvgRef.current) return;

    // Serialize the live SVG so the print window gets the exact same barcode
    const svgClone = barcodeSvgRef.current.cloneNode(true);
    svgClone.style.color = "#000";
    // Set all rect/path fills to black for print
    svgClone.querySelectorAll("rect,path").forEach(el => {
      if (el.getAttribute("fill") === "currentColor" || !el.getAttribute("fill")) {
        el.setAttribute("fill", "#000");
      }
    });
    const svgHtml = svgClone.outerHTML;

    const fields = [
      ["Order ID",              activeOrder.orderId],
      ["AWB No.",               awbNumber],
      ["Payment Type",          paymentType],
      ["Customer Promise Date", promiseDate || "—"],
      ["Customer Date",         activeOrder.customerDate],
      ["Address",               activeOrder.address],
      ["Vendor Name",           activeOrder.vendorName],
      ["Vendor GST No.",        activeOrder.vendorGst],
      ["SKU ID",                activeOrder.skuId],
      ["SKU Name",              activeOrder.productName],
      ["Quantity",              activeOrder.pickedQty ?? activeOrder.orderedQty],
    ];

    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html>
<head><title>Label — ${activeOrder.orderId}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Arial,sans-serif;background:#fff;color:#111;padding:28px;}
  .label{border:3px solid #111;border-radius:10px;padding:24px;max-width:580px;margin:0 auto;}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:20px;}
  .title{font-size:26px;font-weight:900;letter-spacing:0.12em;}
  .brand{font-size:11px;color:#666;margin-top:4px;}
  .awb-lbl{font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#888;text-align:right;}
  .awb-val{font-size:22px;font-weight:900;font-family:monospace;letter-spacing:0.1em;text-align:right;}
  .fields{display:grid;grid-template-columns:1fr 1fr;gap:0;}
  .field{padding:9px 0;border-bottom:1px solid #eee;}
  .field:nth-child(odd){padding-right:20px;border-right:1px solid #eee;}
  .field:nth-child(even){padding-left:20px;}
  .fl{font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin-bottom:3px;}
  .fv{font-size:13px;font-weight:700;word-break:break-word;}
  .barcode-wrap{text-align:center;margin-top:20px;padding:14px;border:1px solid #ddd;border-radius:6px;background:#f9f9f9;}
  .barcode-wrap svg{width:100%;max-width:400px;display:block;margin:0 auto;}
  .barcode-id{font-size:12px;font-family:monospace;letter-spacing:0.1em;color:#555;margin-top:8px;}
  .footer{margin-top:16px;font-size:10px;color:#bbb;text-align:center;}
  @media print{body{padding:0;}}
</style></head><body>
<div class="label">
  <div class="header">
    <div><div class="title">SHIPPING LABEL</div><div class="brand">MIDC IMS · Eduspark</div></div>
    <div><div class="awb-lbl">AWB No.</div><div class="awb-val">${awbNumber}</div></div>
  </div>
  <div class="fields">
    ${fields.map(([l,v])=>`<div class="field"><div class="fl">${l}</div><div class="fv">${v??'—'}</div></div>`).join("")}
  </div>
  <div class="barcode-wrap">
    ${svgHtml}
    <div class="barcode-id">${activeOrder.orderId}</div>
  </div>
  <div class="footer">Generated by MIDC IMS · ${new Date().toLocaleString()}</div>
</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`);
    win.document.close();
  };

  const labelFields = activeOrder ? [
    ["Order ID",              activeOrder.orderId],
    ["AWB No.",               awbNumber],
    ["Payment Type",          paymentType],
    ["Customer Promise Date", promiseDate || "—"],
    ["Customer Date",         activeOrder.customerDate],
    ["Address",               activeOrder.address],
    ["Vendor Name",           activeOrder.vendorName],
    ["Vendor GST No.",        activeOrder.vendorGst],
    ["SKU ID",                activeOrder.skuId],
    ["SKU Name",              activeOrder.productName],
    ["Quantity",              activeOrder.pickedQty ?? activeOrder.orderedQty],
  ] : [];

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
      <SectionHeader title="Packing" subtitle="Pack, label and dispatch orders"/>
      <div className="ims-tab-bar">
        {["Pack Orders","Packing"].map(t=>(
          <button key={t} className={`ims-tab${tab===t?" active":""}`} onClick={()=>setTab(t)}>{t}</button>
        ))}
      </div>

      {/* ── Tab 1: Pack Orders ── */}
      {tab === "Pack Orders" && (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div><Button variant="ghost" onClick={load}>↻ Refresh</Button></div>
          {loading
            ? <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:64}}>
                <div className="spin" style={{width:24,height:24,border:"2px solid var(--border)",borderTopColor:"var(--accent)",borderRadius:"50%"}}/>
              </div>
            : <div className="ims-table-wrap">
                <table className="ims-table">
                  <thead><tr>{["Order ID","Customer","SKU ID","Product","Ordered Qty","Pick Qty","Status","Action"].map(c=><th key={c}>{c}</th>)}</tr></thead>
                  <tbody>
                    {packList.length === 0
                      ? <tr><td colSpan={8} className="t-muted" style={{padding:"48px 16px",textAlign:"center"}}>No orders ready to pack</td></tr>
                      : packList.map((r,i)=>(
                        <tr key={i}>
                          <td className="mono"><span className="t-accent">{r.orderId}</span></td>
                          <td><span style={{fontWeight:600}}>{r.customerName}</span></td>
                          <td className="mono">{r.skuId}</td>
                          <td>{r.productName}</td>
                          <td>{r.orderedQty}</td>
                          <td><span className="t-success" style={{fontWeight:700}}>{r.pickedQty}</span></td>
                          <td><Badge color={r.status==="Shipped"?"green":r.status==="Packing"?"violet":"cyan"}>{r.status}</Badge></td>
                          <td>{r.status!=="Shipped" && <Button variant="primary" onClick={()=>openOrder(r)}>Start Packing</Button>}</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
          }
        </div>
      )}

      {/* ── Tab 2: Label ── */}
      {tab === "Packing" && (
        <div style={{display:"flex",flexDirection:"column",gap:20,maxWidth:680}}>
          {!activeOrder
            ? <div className="ims-panel" style={{textAlign:"center"}}>
                <p className="t-muted" style={{margin:"0 0 16px"}}>No order selected. Go to Pack Orders and click Start Packing.</p>
                <Button variant="ghost" onClick={()=>setTab("Pack Orders")}>← Back to Pack Orders</Button>
              </div>
            : <>
                {/* Editable fields */}
                <div className="ims-panel" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    <label className="ims-label">Payment Type</label>
                    <select className="ims-input" value={paymentType} onChange={e=>setPaymentType(e.target.value)}>
                      <option>Prepaid</option>
                      <option>Cash on Delivery</option>
                      <option>Credit</option>
                    </select>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    <label className="ims-label">Customer Promise Date</label>
                    <input type="date" className="ims-input" value={promiseDate} onChange={e=>setPromiseDate(e.target.value)}/>
                  </div>
                </div>

                {/* Label card */}
                <div className="ims-card" style={{padding:28,borderRadius:16}}>
                  {/* Header */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",borderBottom:"2px solid var(--border)",paddingBottom:18,marginBottom:20}}>
                    <div>
                      <div className="gradient-text" style={{fontSize:22,fontWeight:900,letterSpacing:"0.12em",fontFamily:"'Syne',sans-serif"}}>SHIPPING LABEL</div>
                      <div className="t-muted" style={{fontSize:11,marginTop:3}}>MIDC IMS — Eduspark</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div className="t-muted" style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>AWB No.</div>
                      <div className="t-accent" style={{fontSize:20,fontWeight:900,fontFamily:"monospace",letterSpacing:"0.1em"}}>{awbNumber}</div>
                    </div>
                  </div>

                  {/* 2-column fields */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
                    {labelFields.map(([l,v],i)=>(
                      <div key={l} style={{
                        padding:"10px 0",
                        borderBottom:"1px solid var(--border)",
                        ...(i%2===0 ? {paddingRight:20,borderRight:"1px solid var(--border)"} : {paddingLeft:20}),
                      }}>
                        <div className="t-muted" style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>{l}</div>
                        <div className="t-primary" style={{fontSize:13,fontWeight:700,wordBreak:"break-word"}}>{v??'—'}</div>
                      </div>
                    ))}
                  </div>

                  {/* Real barcode */}
                  <div style={{marginTop:22,padding:"16px",borderRadius:8,border:"1px solid var(--border)",background:"var(--bg-elevated)",textAlign:"center"}}>
                    <Barcode value={activeOrder.orderId} svgRef={barcodeSvgRef}/>
                    <div className="t-secondary" style={{fontSize:12,marginTop:8,fontFamily:"monospace",letterSpacing:"0.08em"}}>
                      {activeOrder.orderId}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{display:"flex",gap:12}}>
                  <Button onClick={handleExportPDF} variant="ghost">🖨 Export / Print Label</Button>
                  <Button onClick={handleShipped}   variant="success">✓ Mark as Shipped</Button>
                  <Button onClick={()=>setTab("Pack Orders")} variant="ghost">← Back</Button>
                </div>
                <div className="ims-accent-box">
                  <p className="t-secondary" style={{margin:0,fontSize:12}}>
                    <strong>Mark as Shipped</strong> updates order status and redirects to Returns for tracking.
                  </p>
                </div>
              </>
          }
        </div>
      )}
    </div>
  );
}
