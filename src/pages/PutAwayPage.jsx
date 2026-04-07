import { useState, useEffect } from "react";
import { getAll, searchByField, updateItem, addItem, genTxnId } from "../services/firestoreService";
import { Badge, Table, Td, Button, SectionHeader, Toast } from "../components/ui/index.jsx";

export default function PutAwayPage() {
  const [tab, setTab]             = useState("Put-Away Queue");
  const [queue, setQueue]         = useState([]);   // putawayqueue items
  const [doneList, setDoneList]   = useState([]);   // completed put-aways
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [scanLocs, setScanLocs]   = useState({});   // id → location string
  const [shownLocs, setShownLocs] = useState({});   // id → confirmed location (replaces button)
  const [toast, setToast]         = useState(null);

  const load = async () => {
    setLoading(true);
    const [q, done] = await Promise.all([
      getAll("putawayqueue"),
      getAll("putawaydata"),
    ]);
    setQueue(q.filter(r => r.putAwayStatus === "Pending"));
    setDoneList(done);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = queue.filter(r =>
    !search ||
    r.skuId?.toLowerCase().includes(search.toLowerCase()) ||
    r.productName?.toLowerCase().includes(search.toLowerCase()) ||
    r.grnNumber?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDone = async (item) => {
    const loc = scanLocs[item.id] || "";
    if (!loc) return setToast({ msg:"Enter rack / bin location first", type:"error" });

    // Show the location badge in place of the button
    setShownLocs(p => ({...p, [item.id]: loc}));

    // Upsert inventory
    const existing = await searchByField("inventory","skuId",item.skuId);
    const qty = Number(item.passQty || 0);

    if (existing.length > 0) {
      const inv = existing[0];
      const newAvail = Number(inv.availableStock||0) + qty;
      await updateItem("inventory", inv.id, {
        availableStock: newAvail,
        purchaseUnits:  Number(inv.purchaseUnits||0) + qty,
        stockAmount:    newAvail * Number(inv.cost||0),
        location: loc,
        type: "Fresh",
        updatedAt: new Date().toISOString(),
      });
    } else {
      const prods = await searchByField("products","skuId",item.skuId);
      const cost  = prods[0] ? Number(prods[0].buyingPrice||0) : 0;
      await addItem("inventory", {
        skuId: item.skuId, productName: item.productName,
        cost, purchaseUnits: qty, soldUnits: 0,
        availableStock: qty, stockAmount: qty * cost,
        location: loc, type: "Fresh",
        batch: item.batch||"", mfgDate: item.mfgDate||"", expiryDate: item.expiryDate||"",
        updatedAt: new Date().toISOString(),
      });
    }

    // Save to putawaydata (completed log)
    await addItem("putawaydata", {
      grnNumber: item.grnNumber, qcId: item.qcId||"",
      skuId: item.skuId, skuName: item.productName,
      putAwayQty: qty, location: loc,
      type: "Fresh", completedAt: new Date().toISOString(),
    });

    // Transaction log
    await addItem("transactions", {
      txnId: genTxnId(), type:"IN", subType:"Fresh",
      skuId: item.skuId, skuName: item.productName,
      qty, location: loc, ref: item.grnNumber,
      createdAt: new Date().toISOString(),
    });

    // Mark queue item done
    await updateItem("putawayqueue", item.id, { putAwayStatus:"Done", location:loc });

    setToast({ msg:`${item.productName} → ${loc} · Inventory updated`, type:"success" });
    load();
  };

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
      <SectionHeader title="Put-Away" subtitle="QC-passed items only — assign rack / bin locations"/>

      <div className="ims-tab-bar">
        {["Put-Away Queue","Put-Away Data"].map(t=>(
          <button key={t} className={`ims-tab${tab===t?" active":""}`} onClick={()=>setTab(t)}>
            {t}
            {t==="Put-Away Queue" && queue.length>0 &&
              <span className="ims-badge ims-badge-amber" style={{marginLeft:6,fontSize:10,padding:"1px 6px"}}>{queue.length}</span>}
          </button>
        ))}
      </div>

      {/* ── Queue of QC-passed items ── */}
      {tab==="Put-Away Queue" && (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <label className="ims-label">Search SKU / Product / GRN</label>
              <input className="ims-input" style={{width:280}} placeholder="Search…"
                value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <Button variant="ghost" onClick={load}>↻ Refresh</Button>
            {search && <Button variant="ghost" onClick={()=>setSearch("")}>Clear</Button>}
          </div>

          <div className="ims-elevated" style={{padding:"8px 14px",borderRadius:8,width:"fit-content"}}>
            <p className="t-muted" style={{margin:0,fontSize:12}}>
              Only <strong className="t-success">QC-passed</strong> items appear here.
              QC-failed items are in <strong className="t-danger">GRN → GRN Receiving</strong>.
            </p>
          </div>

          {loading
            ? <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:64}}>
                <div className="spin" style={{width:24,height:24,border:"2px solid var(--border)",borderTopColor:"var(--accent)",borderRadius:"50%"}}/>
              </div>
            : <div className="ims-table-wrap">
                <table className="ims-table">
                  <thead>
                    <tr>{["GRN No","QC ID","SKU","Product","Pass Qty","Batch","Mfg Date","Expiry","Scan Location","Action"].map(c=><th key={c}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filtered.length===0
                      ? <tr><td colSpan={10} className="t-muted" style={{padding:"48px 16px",textAlign:"center"}}>
                          No items pending put-away
                        </td></tr>
                      : filtered.map(r=>(
                        <tr key={r.id}>
                          <td className="mono" style={{padding:"12px 16px"}}>{r.grnNumber}</td>
                          <td className="mono" style={{padding:"12px 16px"}}><span className="t-accent">{r.qcId||"—"}</span></td>
                          <td className="mono" style={{padding:"12px 16px"}}>{r.skuId}</td>
                          <td style={{padding:"12px 16px",fontWeight:600}}>{r.productName}</td>
                          <td style={{padding:"12px 16px"}}>
                            <span className="t-success" style={{fontWeight:800,fontSize:15}}>{r.passQty}</span>
                          </td>
                          <td style={{padding:"12px 16px"}}>{r.batch||"—"}</td>
                          <td style={{padding:"12px 16px"}}>{r.mfgDate||"—"}</td>
                          <td style={{padding:"12px 16px"}}>{r.expiryDate||"—"}</td>
                          <td style={{padding:"12px 16px"}}>
                            <input type="text" placeholder="e.g. A-01-R3"
                              value={scanLocs[r.id]||""}
                              onChange={e=>setScanLocs(p=>({...p,[r.id]:e.target.value}))}
                              className="ims-input ims-input-sm" style={{width:130}}/>
                          </td>
                          <td style={{padding:"12px 16px"}}>
                            {shownLocs[r.id]
                              ? <span className="ims-badge ims-badge-teal" style={{fontFamily:"monospace"}}>{shownLocs[r.id]}</span>
                              : <Button variant="success" onClick={()=>handleDone(r)}>Put Away ✓</Button>
                            }
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
          }
        </div>
      )}

      {/* ── Completed put-aways ── */}
      {tab==="Put-Away Data" && (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Button variant="ghost" onClick={load} style={{width:"fit-content"}}>↻ Refresh</Button>
          <Table loading={loading}
            cols={["GRN No","SKU","Product","Qty","Location","Type","Completed At"]}
            rows={doneList}
            renderRow={r=>(<>
              <Td mono>{r.grnNumber}</Td>
              <Td mono><span className="t-accent">{r.skuId}</span></Td>
              <Td><span style={{fontWeight:600}}>{r.skuName}</span></Td>
              <Td><span className="t-success" style={{fontWeight:700}}>{r.putAwayQty}</span></Td>
              <Td><span className="ims-badge ims-badge-teal" style={{fontFamily:"monospace"}}>{r.location}</span></Td>
              <Td><Badge color={r.type==="Return"?"amber":"cyan"}>{r.type||"Fresh"}</Badge></Td>
              <Td>{r.completedAt ? new Date(r.completedAt).toLocaleString() : "—"}</Td>
            </>)}
          />
        </div>
      )}
    </div>
  );
}
