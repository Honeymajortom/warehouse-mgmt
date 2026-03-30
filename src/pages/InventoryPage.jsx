import { useState, useEffect } from "react";
import { getAll, updateItem } from "../services/firestoreService";
import { Badge, Table, Td, Button, SectionHeader } from "../components/ui/index.jsx";

export default function InventoryPage() {
  const [tab, setTab]           = useState("Inventory");
  const [inventory, setInventory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");

  const load = async () => {
    setLoading(true);
    const [inv, txn] = await Promise.all([getAll("inventory"), getAll("transactions")]);

    // Auto-clear location for zero-stock items
    for (const item of inv) {
      if (Number(item.availableStock||0) === 0 && item.location) {
        await updateItem("inventory", item.id, { location: "" });
        item.location = "";
      }
    }

    // Only show items with stock > 0
    setInventory(inv.filter(i => Number(i.availableStock||0) > 0));
    setTransactions(txn.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = inventory.filter(r =>
    !search ||
    r.skuId?.toLowerCase().includes(search.toLowerCase()) ||
    r.location?.toLowerCase().includes(search.toLowerCase()) ||
    r.productName?.toLowerCase().includes(search.toLowerCase())
  );
  const totalVal = filtered.reduce((s,r) => s+Number(r.stockAmount||0), 0);

  return (
    <div>
      <SectionHeader title="Inventory" subtitle={`Active stock · Total Value: ₹${totalVal.toLocaleString()}`}/>
      <div className="ims-tab-bar">
        {["Inventory","Transactions"].map(t=>(
          <button key={t} className={`ims-tab${tab===t?" active":""}`} onClick={()=>setTab(t)}>{t}</button>
        ))}
      </div>

      {tab==="Inventory" && (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"flex",gap:12,alignItems:"flex-end"}}>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <label className="ims-label">Search SKU / Product / Location</label>
              <input className="ims-input" style={{width:300}} placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <Button variant="ghost" onClick={load}>↻ Refresh</Button>
            {search && <Button variant="ghost" onClick={()=>setSearch("")}>Clear</Button>}
          </div>
          <div className="ims-elevated" style={{padding:"8px 14px",borderRadius:8,width:"fit-content"}}>
            <p className="t-muted" style={{margin:0,fontSize:12}}>Showing <strong className="t-primary">{filtered.length}</strong> items with stock · Zero-stock items are hidden &amp; location freed</p>
          </div>
          <Table loading={loading}
            cols={["SKU ID","Product","Type","Location","Purchased","Sold","Available","Cost","Stock Value","Status"]}
            rows={filtered}
            renderRow={r=>{
              const avail  = Number(r.availableStock||0);
              const status = avail === 0 ? "Out" : avail < 20 ? "Low" : "In Stock";
              return (<>
                <Td mono><span className="t-accent">{r.skuId}</span></Td>
                <Td><span style={{fontWeight:600}}>{r.productName}</span></Td>
                <Td><Badge color={r.type==="Return"?"amber":"cyan"}>{r.type||"Fresh"}</Badge></Td>
                <Td><span className="ims-badge ims-badge-amber" style={{fontFamily:"monospace"}}>{r.location||"—"}</span></Td>
                <Td>{r.purchaseUnits||0}</Td>
                <Td><span className="t-warning">{r.soldUnits||0}</span></Td>
                <Td><span style={{fontSize:15,fontWeight:800}} className={status==="Low"?"t-warning":"t-success"}>{avail}</span></Td>
                <Td>₹{Number(r.cost||0).toLocaleString()}</Td>
                <Td><span className="t-accent">₹{Number(r.stockAmount||0).toLocaleString()}</span></Td>
                <Td><Badge color={status==="Low"?"amber":"green"}>{status==="Low"?"Low Stock":"In Stock"}</Badge></Td>
              </>);
            }}
          />
        </div>
      )}

      {tab==="Transactions" && (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Button variant="ghost" onClick={load} style={{width:"fit-content"}}>↻ Refresh</Button>
          <Table loading={loading}
            cols={["Txn ID","Type","Sub-Type","SKU ID","SKU Name","Qty","Location","Reference","Date"]}
            rows={transactions}
            renderRow={r=>(<>
              <Td mono><span className="t-muted">{r.txnId}</span></Td>
              <Td><Badge color={r.type==="IN"?"green":"red"}>{r.type}</Badge></Td>
              <Td><Badge color={r.subType==="Return"?"amber":"cyan"}>{r.subType||"Fresh"}</Badge></Td>
              <Td mono><span className="t-accent">{r.skuId}</span></Td>
              <Td>{r.skuName}</Td>
              <Td><span style={{fontWeight:700}} className={r.type==="IN"?"t-success":"t-warning"}>{r.type==="IN"?"+":"-"}{r.qty}</span></Td>
              <Td><span className="ims-badge ims-badge-teal" style={{fontFamily:"monospace"}}>{r.location||"—"}</span></Td>
              <Td mono>{r.ref||"—"}</Td>
              <Td>{r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}</Td>
            </>)}
          />
        </div>
      )}
    </div>
  );
}
