import { useState, useEffect } from "react";
import { getAll, searchByField, updateItem, addItem, genTxnId } from "../services/firestoreService";
import { Badge, Table, Td, Button, SectionHeader, Toast } from "../components/ui/index.jsx";

export default function PutAwayPage() {
  const [tab, setTab]           = useState("Put-Away");
  const [grnList, setGrnList]   = useState([]);
  const [doneList, setDoneList] = useState([]);   // completed put-aways
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [toast, setToast]       = useState(null);
  const [processItems, setProcessItems] = useState([]);
  const [processingGrn, setProcessingGrn] = useState(null);
  // track which rows have been started (show location instead of button)
  const [startedLocs, setStartedLocs] = useState({}); // id → location string

  const load = async () => {
    setLoading(true);
    const [grn, done] = await Promise.all([getAll("grn"), getAll("putawaydata")]);
    setGrnList(grn);
    setDoneList(done);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = grnList.filter(g =>
    !search || g.poNumber?.toLowerCase().includes(search.toLowerCase())
  );

  const handleStart = (grn) => {
    setProcessingGrn(grn);
    setProcessItems([{
      id: grn.id, skuId: grn.skuId, skuName: grn.skuName,
      receivedQty: grn.receivedQty, putAwayQty: grn.receivedQty,
      scanLocation: "", type: "Fresh",
    }]);
    setTab("Put-Away Process");
  };

  // Reveal location in list row (replaces Start button with location text)
  const handleRevealLocation = (grnId, loc) => {
    if (!loc) return setToast({ msg:"Enter location first", type:"error" });
    setStartedLocs(p => ({...p, [grnId]: loc}));
  };

  const upd = (idx, k, v) => setProcessItems(p => p.map((r,i) => i===idx ? {...r,[k]:v} : r));

  const handleDone = async (item, idx) => {
    if (!item.scanLocation) return setToast({ msg:"Enter location first", type:"error" });

    const ex = await searchByField("inventory","skuId",item.skuId);
    if (ex.length > 0) {
      const inv = ex[0];
      const newAvail = Number(inv.availableStock||0) + Number(item.putAwayQty);
      await updateItem("inventory", inv.id, {
        availableStock: newAvail,
        purchaseUnits:  Number(inv.purchaseUnits||0) + Number(item.putAwayQty),
        stockAmount:    newAvail * Number(inv.cost||0),
        location:       item.scanLocation,
        type:           item.type || "Fresh",
        updatedAt:      new Date().toISOString(),
      });
    } else {
      const prods = await searchByField("products","skuId",item.skuId);
      const cost  = prods.length > 0 ? Number(prods[0].buyingPrice||0) : 0;
      await addItem("inventory", {
        skuId: item.skuId, productName: item.skuName, cost,
        purchaseUnits: Number(item.putAwayQty), soldUnits: 0,
        availableStock: Number(item.putAwayQty),
        stockAmount: Number(item.putAwayQty) * cost,
        location: item.scanLocation,
        type: item.type || "Fresh",
        updatedAt: new Date().toISOString(),
      });
    }

    // Save to putawaydata
    await addItem("putawaydata", {
      grnId: item.id, skuId: item.skuId, skuName: item.skuName,
      putAwayQty: Number(item.putAwayQty), location: item.scanLocation,
      type: item.type || "Fresh", completedAt: new Date().toISOString(),
    });

    // Transaction log
    await addItem("transactions", {
      txnId: genTxnId(), type: "IN", subType: item.type || "Fresh",
      skuId: item.skuId, skuName: item.skuName,
      qty: Number(item.putAwayQty), location: item.scanLocation,
      ref: processingGrn?.grnNumber || "—",
      createdAt: new Date().toISOString(),
    });

    await updateItem("grn", item.id, { location:item.scanLocation, putAwayStatus:"Done" });

    setProcessItems(p => p.filter((_,i) => i !== idx));
    setToast({ msg:`${item.skuName} → ${item.scanLocation} (${item.type})`, type:"success" });
    if (processItems.length === 1) { setTab("Put-Away"); load(); }
    else load();
  };

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
      <SectionHeader title="Put-Away" subtitle="Assign received goods to warehouse locations"/>
      <div className="ims-tab-bar">
        {["Put-Away","Put-Away Process","Put-Away Data"].map(t=>(
          <button key={t} className={`ims-tab${tab===t?" active":""}`} onClick={()=>setTab(t)}>{t}</button>
        ))}
      </div>

      {/* ── Tab 1: GRN list ── */}
      {tab==="Put-Away" && (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <label className="ims-label">Filter by PO Number</label>
              <input className="ims-input" style={{width:280}} placeholder="PO-20250201-1234" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            {search && <Button variant="ghost" onClick={()=>setSearch("")}>Clear</Button>}
            <Button variant="ghost" onClick={load}>↻ Refresh</Button>
          </div>
          {loading
            ? <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:64}}>
                <div className="spin" style={{width:24,height:24,border:"2px solid var(--border)",borderTopColor:"var(--accent)",borderRadius:"50%"}}/>
              </div>
            : <div className="ims-table-wrap">
                <table className="ims-table">
                  <thead><tr>{["GRN No","Invoice No","PO Number","SKU ID","SKU Name","Recv Qty","Status","Action"].map(c=><th key={c}>{c}</th>)}</tr></thead>
                  <tbody>
                    {filtered.map(r=>(
                      <tr key={r.id}>
                        <td className="mono">{r.grnNumber}</td>
                        <td className="mono"><span className="t-warning">{r.invoiceNo}</span></td>
                        <td className="mono"><span className="t-accent">{r.poNumber}</span></td>
                        <td className="mono">{r.skuId}</td>
                        <td>{r.skuName}</td>
                        <td><span className="t-success" style={{fontWeight:700}}>{r.receivedQty}</span></td>
                        <td>{r.putAwayStatus==="Done"?<Badge color="green">Done</Badge>:<Badge color="amber">Pending</Badge>}</td>
                        <td>
                          {r.putAwayStatus!=="Done" && (
                            startedLocs[r.id]
                              ? <span className="ims-badge ims-badge-teal" style={{fontFamily:"monospace"}}>{startedLocs[r.id]}</span>
                              : <Button variant="amber" onClick={()=>handleStart(r)}>Start Put Away</Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filtered.length===0 && <tr><td colSpan={8} className="t-muted" style={{padding:"48px 16px",textAlign:"center"}}>No GRN records</td></tr>}
                  </tbody>
                </table>
              </div>
          }
        </div>
      )}

      {/* ── Tab 2: Process ── */}
      {tab==="Put-Away Process" && (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {processingGrn && (
            <div className="ims-accent-box" style={{width:"fit-content"}}>
              <p className="t-accent" style={{margin:0,fontSize:12}}>Processing: <strong style={{fontFamily:"monospace"}}>{processingGrn.poNumber}</strong></p>
            </div>
          )}
          {processItems.length===0
            ? <div className="ims-panel" style={{textAlign:"center"}}>
                <p className="t-success" style={{margin:"0 0 16px"}}>✓ All items put away!</p>
                <Button onClick={()=>setTab("Put-Away")}>Back to List</Button>
              </div>
            : <div className="ims-table-wrap">
                <table className="ims-table">
                  <thead><tr>{["SKU ID","SKU Name","Recv Qty","Put Away Qty","Type","Scan Location","Action"].map(c=><th key={c}>{c}</th>)}</tr></thead>
                  <tbody>
                    {processItems.map((r,i)=>(
                      <tr key={i}>
                        <td className="mono">{r.skuId}</td>
                        <td>{r.skuName}</td>
                        <td>{r.receivedQty}</td>
                        <td>
                          <input type="number" value={r.putAwayQty} onChange={e=>upd(i,"putAwayQty",e.target.value)}
                            className="ims-input ims-input-sm" style={{width:80}}/>
                        </td>
                        <td>
                          <select value={r.type} onChange={e=>upd(i,"type",e.target.value)}
                            className="ims-input ims-input-sm" style={{width:100}}>
                            <option>Fresh</option>
                            <option>Return</option>
                          </select>
                        </td>
                        <td>
                          <input type="text" value={r.scanLocation} onChange={e=>upd(i,"scanLocation",e.target.value)}
                            placeholder="A-01-R3" className="ims-input ims-input-sm" style={{width:130}}/>
                        </td>
                        <td><Button variant="success" onClick={()=>handleDone(r,i)}>Done ✓</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
        </div>
      )}

      {/* ── Tab 3: Completed Put-Aways ── */}
      {tab==="Put-Away Data" && (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Button variant="ghost" onClick={load} style={{width:"fit-content"}}>↻ Refresh</Button>
          <Table loading={loading}
            cols={["SKU ID","SKU Name","Qty","Location","Type","Completed At"]}
            rows={doneList}
            renderRow={r=>(<>
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
