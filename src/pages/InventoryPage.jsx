import { useState, useEffect } from "react";
import { getAll, updateItem } from "../services/firestoreService";
import { Badge, Table, Td, Button, SectionHeader } from "../components/ui/index.jsx";

const RETURN_TYPE_BADGE = { FD:"red", DM:"red", QI:"amber", RB:"violet", DIS:"cyan" };
const RETURN_TYPE_LABEL = { FD:"Fraud", DM:"Damaged", QI:"Quality Issue", RB:"Refurb Bulk", DIS:"Disposal" };

export default function InventoryPage() {
  const [tab, setTab]                   = useState("Inventory");
  const [inventory, setInventory]       = useState([]);
  const [returnInv, setReturnInv]       = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [rSearch, setRSearch]           = useState("");

  const load = async () => {
    setLoading(true);
    const [inv, retInv, txn] = await Promise.all([
      getAll("inventory"),
      getAll("returninventory"),
      getAll("transactions"),
    ]);

    // Auto-clear location for zero-stock items
    for (const item of inv) {
      if (Number(item.availableStock||0) === 0 && item.location) {
        await updateItem("inventory", item.id, { location: "" });
        item.location = "";
      }
    }

    setInventory(inv.filter(i => Number(i.availableStock||0) > 0));
    setReturnInv(retInv);
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

  const filteredReturn = returnInv.filter(r =>
    !rSearch ||
    r.skuId?.toLowerCase().includes(rSearch.toLowerCase()) ||
    r.productName?.toLowerCase().includes(rSearch.toLowerCase()) ||
    r.type?.toLowerCase().includes(rSearch.toLowerCase()) ||
    r.location?.toLowerCase().includes(rSearch.toLowerCase())
  );

  const totalVal       = filtered.reduce((s,r) => s+Number(r.stockAmount||0), 0);
  const totalReturnVal = filteredReturn.reduce((s,r) => s+Number(r.stockValue||0), 0);

  return (
    <div>
      <SectionHeader title="Inventory" subtitle="Stock levels, returns &amp; transactions"/>
      <div className="ims-tab-bar">
        {["Inventory","Return Inventory","Transactions"].map(t=>(
          <button key={t} className={`ims-tab${tab===t?" active":""}`} onClick={()=>setTab(t)}>
            {t}
            {t==="Return Inventory" && returnInv.length>0 &&
              <span className="ims-badge ims-badge-amber" style={{marginLeft:6,fontSize:10,padding:"1px 6px"}}>{returnInv.length}</span>}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Regular Inventory ── */}
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
            <p className="t-muted" style={{margin:0,fontSize:12}}>
              <strong className="t-primary">{filtered.length}</strong> active items · Total: <strong className="t-success">₹{totalVal.toLocaleString()}</strong> · Zero-stock hidden &amp; location freed
            </p>
          </div>
          <Table loading={loading}
            cols={["SKU ID","Product","Type","Location","Purchased","Sold","Available","Cost","Stock Value","Status"]}
            rows={filtered}
            renderRow={r=>{
              const avail  = Number(r.availableStock||0);
              const status = avail < 20 ? "Low" : "In Stock";
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

      {/* ── Tab 2: Return Inventory ── */}
      {tab==="Return Inventory" && (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"flex",gap:12,alignItems:"flex-end"}}>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <label className="ims-label">Search SKU / Product / Type / Location</label>
              <input className="ims-input" style={{width:300}} placeholder="Search…" value={rSearch} onChange={e=>setRSearch(e.target.value)}/>
            </div>
            <Button variant="ghost" onClick={load}>↻ Refresh</Button>
            {rSearch && <Button variant="ghost" onClick={()=>setRSearch("")}>Clear</Button>}
          </div>

          {/* Category legend */}
          <div className="ims-elevated" style={{padding:"10px 16px",borderRadius:8,display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
            <span className="t-muted" style={{fontSize:11,fontWeight:700}}>CATEGORIES:</span>
            {Object.entries(RETURN_TYPE_LABEL).map(([code,label])=>(
              <div key={code} style={{display:"flex",gap:6,alignItems:"center"}}>
                <span className={`ims-badge ims-badge-${RETURN_TYPE_BADGE[code]}`}>{code}</span>
                <span className="t-secondary" style={{fontSize:11}}>{label}</span>
              </div>
            ))}
            <span className="t-muted" style={{fontSize:11,marginLeft:"auto"}}>
              Total: <strong className="t-warning">₹{totalReturnVal.toLocaleString()}</strong>
            </span>
          </div>

          <Table loading={loading}
            cols={["SKU ID","Product Name","Type","Category","Location","Purchased Qty","Sold Qty","Available Qty","Cost","Stock Value","Status"]}
            rows={filteredReturn}
            renderRow={r=>{
              const avail = Number(r.availableQty||0);
              return (<>
                <Td mono><span className="t-accent">{r.skuId}</span></Td>
                <Td><span style={{fontWeight:600}}>{r.productName}</span></Td>
                <Td>
                  <span className={`ims-badge ims-badge-${RETURN_TYPE_BADGE[r.type]||"red"}`}>
                    {r.type||"—"}
                  </span>
                </Td>
                <Td><span className="t-secondary">{RETURN_TYPE_LABEL[r.type] || r.category || "—"}</span></Td>
                <Td><span className="ims-badge ims-badge-amber" style={{fontFamily:"monospace"}}>{r.location||"—"}</span></Td>
                <Td>{r.purchasedQty||0}</Td>
                <Td><span className="t-warning">{r.soldQty||0}</span></Td>
                <Td><span style={{fontSize:14,fontWeight:800}} className="t-danger">{avail}</span></Td>
                <Td>₹{Number(r.cost||0).toLocaleString()}</Td>
                <Td><span className="t-warning">₹{Number(r.stockValue||0).toLocaleString()}</span></Td>
                <Td>
                  <Badge color={
                    r.status==="Fraud"?"red":
                    r.status==="Damaged"?"red":
                    r.status==="QC Failed"?"amber":
                    r.status==="Refurbishing"?"violet":
                    r.status==="Pending Disposal"?"cyan":"amber"
                  }>{r.status||"Returned"}</Badge>
                </Td>
              </>);
            }}
          />
        </div>
      )}

      {/* ── Tab 3: Transactions ── */}
      {tab==="Transactions" && (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Button variant="ghost" onClick={load} style={{width:"fit-content"}}>↻ Refresh</Button>
          <Table loading={loading}
            cols={["Txn ID","Type","Sub-Type","SKU ID","SKU Name","Qty","Location","Reference","Date"]}
            rows={transactions}
            renderRow={r=>(<>
              <Td mono><span className="t-muted">{r.txnId}</span></Td>
              <Td><Badge color={r.type==="IN"?"green":"red"}>{r.type}</Badge></Td>
              <Td>
                <span className={`ims-badge ims-badge-${RETURN_TYPE_BADGE[r.subType]||"cyan"}`}>
                  {r.subType||"Fresh"}
                </span>
              </Td>
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

