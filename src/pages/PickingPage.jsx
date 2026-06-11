import { useState, useEffect, useRef, useCallback } from "react";
import { getAll, searchByField, updateItem, addItem } from "../services/firestoreService";
import { getAuditFields } from "../services/authService";
import { cacheManager, CACHE_TTL } from "../services/cacheManager";
import { Badge, Table, Td, Button, SectionHeader, Toast } from "../components/ui/index.jsx";
import Modal from "../components/ui/Modal";

/* ═══════════════════════════════════════════════════════════════
   LAZY + RELIABLE IMAGE — intersection observer + fallback chain
   ═══════════════════════════════════════════════════════════════ */
function ProductImage({ src, alt = "", size = 72, onClick, zoomable = false }) {
  const [visible, setVisible]   = useState(false);
  const [errored, setErrored]   = useState(false);
  const [loaded, setLoaded]     = useState(false);
  const [zoomed, setZoomed]     = useState(false);
  const ref = useRef();

  useEffect(() => {
    setErrored(false);
    setLoaded(false);
  }, [src]);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { rootMargin: "80px" }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const handleClick = () => {
    if (zoomable && src && !errored) setZoomed(true);
    if (onClick) onClick();
  };

  return (
    <>
      <div
        ref={ref}
        onClick={handleClick}
        style={{
          width: size, height: size, borderRadius: 10,
          border: "1px solid var(--border)",
          overflow: "hidden",
          background: "var(--bg-elevated)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, fontSize: size * 0.42,
          cursor: (zoomable && src && !errored) ? "zoom-in" : "default",
          position: "relative",
          transition: "box-shadow 0.2s",
          boxShadow: (zoomable && src && !errored) ? "0 0 0 1px var(--accent-dim)" : "none",
        }}
      >
        {visible && src && !errored ? (
          <>
            <img
              src={src}
              alt={alt}
              loading="lazy"
              decoding="async"
              style={{
                width: "100%", height: "100%", objectFit: "cover",
                opacity: loaded ? 1 : 0,
                transition: "opacity 0.25s ease",
                display: "block",
              }}
              onLoad={() => setLoaded(true)}
              onError={() => setErrored(true)}
            />
            {!loaded && (
              <span style={{ position: "absolute", fontSize: size * 0.42 }}>📦</span>
            )}
            {zoomable && loaded && (
              <div style={{
                position: "absolute", bottom: 4, right: 4,
                background: "rgba(0,0,0,0.55)", borderRadius: 4,
                padding: "2px 5px", fontSize: 9, color: "#fff", lineHeight: 1.4,
              }}>🔍</div>
            )}
          </>
        ) : (
          <span>📦</span>
        )}
      </div>

      {/* Zoom overlay */}
      {zoomed && (
        <div
          onClick={() => setZoomed(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.88)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          <img
            src={src} alt={alt}
            style={{
              maxHeight: "88vh", maxWidth: "88vw",
              objectFit: "contain", borderRadius: 14,
              boxShadow: "0 16px 64px rgba(0,0,0,0.7)",
            }}
          />
          <button
            onClick={() => setZoomed(false)}
            style={{
              position: "absolute", top: 20, right: 28,
              background: "rgba(255,255,255,0.12)", border: "none",
              color: "#fff", fontSize: 22, cursor: "pointer",
              borderRadius: "50%", width: 40, height: 40,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✕</button>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MINI BARCODE — visual SKU barcode using CSS bars
   ═══════════════════════════════════════════════════════════════ */
function MiniBarcodeDisplay({ value }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  // Deterministic bar widths from SKU string chars
  const bars = (value || "").split("").map((c, i) => {
    const w = (c.charCodeAt(0) % 3) + 1;
    return { w, space: (i % 4 === 0) ? 2 : 1, dark: i % 2 === 0 };
  });

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 5,
    }}>
      {/* Barcode visual */}
      <div style={{
        display: "flex", alignItems: "flex-end", gap: 0, height: 36,
        padding: "4px 8px", background: "#fff", borderRadius: 6,
        overflow: "hidden", flexWrap: "nowrap", width: "fit-content", maxWidth: "100%",
      }}>
        {bars.slice(0, 36).map((b, i) => (
          <div key={i} style={{ display: "flex", gap: b.space === 2 ? 2 : 1 }}>
            <div style={{
              width: b.w, height: b.dark ? 28 : 20,
              background: "#111", borderRadius: 0.5, flexShrink: 0,
            }} />
            <div style={{ width: b.space, height: 28, background: "transparent", flexShrink: 0 }} />
          </div>
        ))}
      </div>
      {/* SKU + copy */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <code style={{
          fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.12em",
          background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: 4,
          border: "1px solid var(--border)",
        }}>{value}</code>
        <button
          onClick={copy}
          title="Copy SKU"
          style={{
            background: "none", border: "1px solid var(--border)", borderRadius: 4,
            cursor: "pointer", padding: "2px 7px", fontSize: 10,
            color: copied ? "var(--success-text)" : "var(--text-muted)",
            transition: "all 0.2s",
          }}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PRODUCT DETAIL MODAL — lightweight, dark-themed
   ═══════════════════════════════════════════════════════════════ */
function ProductDetailModal({ product, order, onClose }) {
  const preview = product?.imageBase64 || product?.imageUrl || order?.imageBase64 || order?.imageUrl;

  const InfoRow = ({ label, value, mono, accent }) => {
    if (!value && value !== 0) return null;
    return (
      <div style={{
        display: "flex", gap: 10, padding: "6px 0",
        borderBottom: "1px solid var(--border)",
      }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 130, flexShrink: 0 }}>{label}</span>
        <span style={{
          fontSize: 12,
          color: accent ? "var(--accent)" : "var(--text-primary)",
          fontFamily: mono ? "monospace" : "inherit",
          fontWeight: (mono || accent) ? 600 : 400,
        }}>{value}</span>
      </div>
    );
  };

  const p = { ...product, ...order };

  return (
    <Modal title={p.productName || "Product Detail"} onClose={onClose} width={680}>
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24 }}>

        {/* Left — image + barcode + pricing */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <ProductImage src={preview} alt={p.productName} size={200} zoomable />

          {/* Pricing */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
            padding: "12px", borderRadius: 10,
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
          }}>
            {[
              ["MRP",  p.mrp,          "var(--text-muted)"],
              ["Buy",  p.buyingPrice,   "#f87171"],
              ["Sell", p.sellingPrice,  "#4ade80"],
              ["Stock", p.availableStock, p.availableStock > 0 ? "#4ade80" : "#f87171"],
            ].map(([label, val, color]) => (
              val !== undefined && val !== "" ? (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color }}>
                    {label === "Stock" ? val : `₹${Number(val || 0).toLocaleString()}`}
                  </div>
                </div>
              ) : null
            ))}
          </div>

          {/* Barcode */}
          {p.skuId && (
            <div>
              <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Barcode / SKU</p>
              <MiniBarcodeDisplay value={p.skuId} />
            </div>
          )}

          {/* Badges */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {p.category    && <span className="ims-badge ims-badge-violet">{p.category}</span>}
            {p.subcategory && <span className="ims-badge ims-badge-cyan">{p.subcategory}</span>}
            {p.brandName   && <span className="ims-badge ims-badge-amber">{p.brandName}</span>}
          </div>
        </div>

        {/* Right — details */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0, overflowY: "auto", maxHeight: 520 }}>
          <p className="ims-section-title" style={{ marginBottom: 6 }}>Product Info</p>
          <InfoRow label="SKU ID"         value={p.skuId}         mono accent />
          <InfoRow label="Product Name"   value={p.productName} />
          <InfoRow label="Vendor"         value={p.vendorName} />
          <InfoRow label="Brand"          value={p.brandName} />
          <InfoRow label="Category"       value={p.category} />
          <InfoRow label="Subcategory"    value={p.subcategory} />

          {p.description && (
            <div style={{ padding: "10px 0" }}>
              <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.07em" }}>Description</p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.65 }}>{p.description}</p>
            </div>
          )}

          <p className="ims-section-title" style={{ marginTop: 14, marginBottom: 6 }}>Inventory & Location</p>
          <InfoRow label="Order ID"        value={p.orderId}       mono accent />
          <InfoRow label="Customer"        value={p.name || p.customerName} />
          <InfoRow label="Ordered Qty"     value={p.quantity || p.orderedQty} />
          <InfoRow label="Available Stock" value={p.availableStock} />
          <InfoRow label="Pick Zone"       value={p.pickZone} />
          <InfoRow label="Bin Location"    value={p.location} />

          <p className="ims-section-title" style={{ marginTop: 14, marginBottom: 6 }}>Specifications</p>
          <InfoRow label="Net Weight"      value={p.netWeight} />
          <InfoRow label="Batch No"        value={p.batchNumber}   mono />
          <InfoRow label="Item Code"       value={p.itemCode}      mono />
          <InfoRow label="Model Number"    value={p.modelNumber}   mono />
          <InfoRow label="Mfg Date"        value={p.manufacturingDate} />
          <InfoRow label="Expiry Date"     value={p.expiryDate} />

          <p className="ims-section-title" style={{ marginTop: 14, marginBottom: 6 }}>Identifiers</p>
          <InfoRow label="Serial Number"   value={p.serialNumber}  mono />
          <InfoRow label="EAN"             value={p.ean}           mono />
          <InfoRow label="IMEI"            value={p.imei}          mono />
        </div>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCAN LOCATION INPUT — auto-focus, green/red state, smooth UX
   ═══════════════════════════════════════════════════════════════ */
function ScanInput({ value, onChange, autoFocus }) {
  const ref = useRef();

  useEffect(() => {
    if (autoFocus && ref.current) {
      setTimeout(() => ref.current?.focus(), 80);
    }
  }, [autoFocus]);

  const filled = value.trim().length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{
        fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
        color: filled ? "var(--success-text)" : "var(--text-muted)",
        transition: "color 0.2s",
        display: "flex", alignItems: "center", gap: 5,
      }}>
        {filled
          ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Location Scanned
            </span>
          : <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
              Scan Location <span style={{ color: "var(--danger-text)" }}>(required)</span>
            </span>
        }
      </label>
      <div style={{ position: "relative" }}>
        <input
          ref={ref}
          type="text"
          className="ims-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Scan or type bin location — e.g. A-01-R3"
          autoComplete="off"
          spellCheck={false}
          style={{
            borderColor: filled
              ? "var(--success)"
              : "var(--input-border)",
            boxShadow: filled
              ? "0 0 0 2px rgba(34,197,94,0.15)"
              : "none",
            paddingRight: 34,
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
        />
        {filled && (
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="var(--success-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          >
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PICK BUTTON — smooth enable/disable transition
   ═══════════════════════════════════════════════════════════════ */
function PickButton({ canPick, noStock, onClick }) {
  if (noStock) {
    return (
      <button disabled style={{
        padding: "9px 20px", borderRadius: 8, border: "none",
        background: "rgba(239,68,68,0.12)", color: "#f87171",
        fontWeight: 700, fontSize: 13, cursor: "not-allowed",
        display: "flex", alignItems: "center", gap: 7,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        No Stock
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={!canPick}
      style={{
        padding: "9px 22px", borderRadius: 8,
        background: canPick ? "var(--accent)" : "var(--bg-elevated)",
        color: canPick ? "#fff" : "var(--text-muted)",
        fontWeight: 700, fontSize: 13,
        cursor: canPick ? "pointer" : "not-allowed",
        opacity: canPick ? 1 : 0.55,
        transition: "all 0.22s cubic-bezier(0.34,1.56,0.64,1)",
        transform: canPick ? "scale(1)" : "scale(0.97)",
        display: "flex", alignItems: "center", gap: 7,
        boxShadow: canPick ? "0 4px 18px rgba(var(--accent-rgb,0,183,235),0.28)" : "none",
        border: canPick ? "none" : "1px solid var(--border)",
      }}
    >
      {canPick ? (
        <>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
          Pick ✓
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
          Scan Location First
        </>
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PICK ORDER CARD — enriched, with clickable image/SKU/name
   ═══════════════════════════════════════════════════════════════ */
function PickOrderCard({ r, scanLoc, onScanChange, onPick, onShowDetail, isFirst }) {
  const enough    = Number(r.availableStock) >= Number(r.quantity || 1);
  const locFilled = (scanLoc || "").trim().length > 0;
  const canPick   = enough && locFilled;
  const preview   = r.imageBase64 || r.imageUrl;

  return (
    <div
      className="ims-panel"
      style={{
        display: "flex", flexDirection: "column", gap: 0,
        border: canPick
          ? "1px solid rgba(34,197,94,0.35)"
          : "1px solid var(--border)",
        borderRadius: 14,
        overflow: "hidden",
        transition: "border-color 0.25s",
      }}
    >
      {/* ── Header strip ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px",
        background: "var(--bg-elevated)",
        borderBottom: "1px solid var(--border)",
        flexWrap: "wrap", gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            fontFamily: "monospace", fontSize: 13, fontWeight: 700,
            color: "var(--accent)",
          }}>{r.orderId}</span>
          <span style={{
            padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600,
            background: "rgba(6,182,212,0.14)", color: "#22d3ee",
            border: "1px solid rgba(6,182,212,0.28)",
          }}>Pick</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {r.name}
          </span>
          {r.contact && (
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
              {r.contact}
            </span>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ display: "flex", gap: 18, padding: "16px", alignItems: "flex-start" }}>

        {/* Product image — clickable */}
        <div>
          <ProductImage
            src={preview}
            alt={r.productName}
            size={88}
            zoomable
            onClick={() => onShowDetail(r)}
          />
          {/* Stock indicator below image */}
          <div style={{
            marginTop: 6, textAlign: "center", fontSize: 10, fontWeight: 700,
            color: enough ? "var(--success-text)" : "var(--danger-text)",
          }}>
            {enough ? `${r.availableStock} in stock` : "⚠ Low stock"}
          </div>
        </div>

        {/* Product details grid */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Product name + SKU — clickable */}
          <div>
            <button
              onClick={() => onShowDetail(r)}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 0,
                textAlign: "left", display: "block",
              }}
            >
              <span style={{
                fontSize: 15, fontWeight: 700, color: "var(--text-primary)",
                display: "block", lineHeight: 1.3,
                textDecoration: "underline", textUnderlineOffset: 3,
                textDecorationColor: "rgba(var(--accent-rgb,0,183,235),0.4)",
              }}>
                {r.productName}
              </span>
            </button>
            <button
              onClick={() => onShowDetail(r)}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 0,
              }}
            >
              <span style={{
                fontFamily: "monospace", fontSize: 11, fontWeight: 600,
                color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: 2,
              }}>
                {r.skuId}
              </span>
            </button>
          </div>

          {/* Info grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: "8px 16px",
          }}>
            {[
              { label: "Ordered Qty",  value: r.quantity || 1,        highlight: true },
              { label: "Available",    value: r.availableStock,       danger: !enough },
              { label: "Pick Zone",    value: r.pickZone,             mono: true },
              { label: "Bin Location", value: r.location,             mono: true },
              { label: "Vendor",       value: r.vendorName,           muted: true },
              { label: "Category",     value: r.category,             muted: true },
              { label: "Address",      value: r.address,              muted: true, span2: true },
            ].map(({ label, value, highlight, danger, mono, muted, span2 }) => value ? (
              <div key={label} style={{ gridColumn: span2 ? "span 2" : undefined }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 2,
                }}>{label}</div>
                <div style={{
                  fontSize: 12, fontWeight: highlight ? 800 : 500,
                  fontFamily: mono ? "monospace" : "inherit",
                  color: danger
                    ? "var(--danger-text)"
                    : highlight
                      ? "var(--text-primary)"
                      : muted
                        ? "var(--text-muted)"
                        : "var(--text-secondary)",
                }}>
                  {value}
                </div>
              </div>
            ) : null)}
          </div>

          {/* Barcode + category badges row */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <MiniBarcodeDisplay value={r.skuId} />
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {r.category    && <span className="ims-badge ims-badge-violet" style={{ fontSize: 10 }}>{r.category}</span>}
              {r.subcategory && <span className="ims-badge ims-badge-cyan"   style={{ fontSize: 10 }}>{r.subcategory}</span>}
              {r.brandName   && <span className="ims-badge ims-badge-amber"  style={{ fontSize: 10 }}>{r.brandName}</span>}
            </div>
          </div>
        </div>

        {/* Right panel — scan + pick */}
        <div style={{
          display: "flex", flexDirection: "column", gap: 10,
          flexShrink: 0, minWidth: 210, alignSelf: "stretch",
          paddingLeft: 16,
          borderLeft: "1px solid var(--border)",
        }}>
          <ScanInput
            value={scanLoc || ""}
            onChange={onScanChange}
            autoFocus={isFirst}
          />
          <PickButton canPick={canPick} noStock={!enough} onClick={() => onPick(r)} />
          {!enough && (
            <p style={{ fontSize: 11, color: "var(--danger-text)", margin: 0, lineHeight: 1.4 }}>
              Ordered {r.quantity} · Only {r.availableStock} available
            </p>
          )}
          {locFilled && enough && (
            <p style={{ fontSize: 11, color: "var(--success-text)", margin: 0, lineHeight: 1.4, display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Ready to pick
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE — workflow unchanged
   ═══════════════════════════════════════════════════════════════ */
export default function PickingPage({ goToPack }) {
  const [tab, setTab]             = useState("Assigned Pick");
  const [inTransit, setInTransit] = useState([]);
  const [orders, setOrders]       = useState([]);
  const [pickingData, setPickingData] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [assignSearch, setAssignSearch] = useState("");
  const [scanLocs, setScanLocs]   = useState({});
  const [selected, setSelected]   = useState({});
  const [toast, setToast]         = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [detailProduct, setDetailProduct] = useState(null);

  const load = async () => {
    setLoading(true);
    const [{ data: customers }, { data: inventory }, { data: picked }] = await Promise.all([
      cacheManager.getOrFetch("getall:customers",   () => getAll("customers"),   CACHE_TTL.SHORT),
      cacheManager.getOrFetch("getall:inventory",   () => getAll("inventory"),   CACHE_TTL.SHORT),
      cacheManager.getOrFetch("getall:pickingdata", () => getAll("pickingdata"), CACHE_TTL.SHORT),
    ]);

    const enrich = (c) => {
      const inv = inventory.find(i => i.skuId === c.skuId);
      return {
        ...c,
        availableStock:  inv?.availableStock  || 0,
        location:        inv?.location        || "—",
        pickZone:        inv?.pickZone        || "—",
        inventoryId:     inv?.id              || null,
        soldUnits:       inv?.soldUnits       || 0,
        cost:            inv?.cost            || 0,
        imageBase64:     inv?.imageBase64     || c.imageBase64 || "",
        imageUrl:        inv?.imageUrl        || c.imageUrl    || "",
        // carry rich product fields from inventory doc
        vendorName:      inv?.vendorName      || c.vendorName  || "",
        category:        inv?.category        || c.category    || "",
        subcategory:     inv?.subcategory     || c.subcategory || "",
        brandName:       inv?.brandName       || c.brandName   || "",
        description:     inv?.description     || c.description || "",
        netWeight:       inv?.netWeight       || "",
        batchNumber:     inv?.batchNumber     || "",
        itemCode:        inv?.itemCode        || "",
        modelNumber:     inv?.modelNumber     || "",
        serialNumber:    inv?.serialNumber    || "",
        ean:             inv?.ean             || "",
        imei:            inv?.imei            || "",
        manufacturingDate: inv?.manufacturingDate || "",
        expiryDate:      inv?.expiryDate      || "",
        mrp:             inv?.mrp             || "",
        buyingPrice:     inv?.buyingPrice     || "",
        sellingPrice:    inv?.sellingPrice    || "",
      };
    };

    setInTransit(customers.filter(c => c.status === "In Transit").map(enrich));
    setOrders(customers.filter(c => c.status === "Pick").map(enrich));
    setPickingData(picked);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const reload = async () => {
    await Promise.all([
      cacheManager.invalidate("getall:customers"),
      cacheManager.invalidate("getall:inventory"),
      cacheManager.invalidate("getall:pickingdata"),
    ]).catch(() => {});
    await load();
  };

  // ── Select all / individual ───────────────────────────────
  const allIds       = inTransit.map(o => o.id);
  const allSelected  = allIds.length > 0 && allIds.every(id => selected[id]);
  const someSelected = allIds.some(id => selected[id]);

  const toggleAll = () => {
    if (allSelected) setSelected({});
    else setSelected(Object.fromEntries(allIds.map(id => [id, true])));
  };
  const toggleOne = id => setSelected(p => ({ ...p, [id]: !p[id] }));

  // ── Assign selected → status Pick (unchanged) ─────────────
  const handleAssign = async () => {
    const ids = allIds.filter(id => selected[id]);
    if (!ids.length) return setToast({ msg: "Select at least one order", type: "error" });
    setAssigning(true);
    const audit = getAuditFields();
    for (const id of ids) await updateItem("customers", id, { status: "Pick", ...audit });
    setSelected({});
    setToast({ msg: `${ids.length} order(s) moved to Pick Orders`, type: "success" });
    setAssigning(false);
    reload();
  };

  // ── Pick action (unchanged) ───────────────────────────────
  const handlePick = async (order) => {
    const qty = Number(order.quantity || 1);
    const loc = scanLocs[order.id] || "";
    if (!loc) return setToast({ msg: "Scan a location before picking", type: "error" });
    if (Number(order.availableStock) < qty)
      return setToast({ msg: `Insufficient stock for ${order.productName}`, type: "error" });

    const audit = getAuditFields();
    if (order.inventoryId) {
      const na = Number(order.availableStock) - qty;
      await updateItem("inventory", order.inventoryId, {
        availableStock: na,
        soldUnits: Number(order.soldUnits) + qty,
        stockAmount: na * Number(order.cost || 0),
      });
    }
    await addItem("pickingdata", {
      orderId: order.orderId, customerName: order.name,
      skuId: order.skuId, productName: order.productName,
      orderedQty: qty, pickedQty: qty,
      location: loc, pickZone: order.pickZone || "—",
      pickedAt: new Date().toISOString(), status: "Picked", ...audit,
    });
    await updateItem("customers", order.id, { status: "Pack", ...audit });
    setToast({ msg: `${order.productName} picked for ${order.name}`, type: "success" });
    reload();
  };

  const filteredTransit = inTransit.filter(o =>
    !assignSearch ||
    o.orderId?.toLowerCase().includes(assignSearch.toLowerCase()) ||
    o.name?.toLowerCase().includes(assignSearch.toLowerCase()) ||
    o.skuId?.toLowerCase().includes(assignSearch.toLowerCase())
  );

  const filteredOrders = orders.filter(o =>
    !search ||
    o.orderId?.toLowerCase().includes(search.toLowerCase()) ||
    o.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.skuId?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {detailProduct && (
        <ProductDetailModal
          product={detailProduct}
          order={detailProduct}
          onClose={() => setDetailProduct(null)}
        />
      )}

      <SectionHeader title="Picking" subtitle="Assign → Pick → Dispatch" />

      <div className="ims-tab-bar">
        {["Assigned Pick", "Pick Orders", "Picking Data"].map(t => (
          <button key={t} className={`ims-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t}
            {t === "Assigned Pick" && inTransit.length > 0 &&
              <span className="ims-badge ims-badge-violet" style={{ marginLeft: 6, fontSize: 10, padding: "1px 6px" }}>{inTransit.length}</span>}
            {t === "Pick Orders" && orders.length > 0 &&
              <span className="ims-badge ims-badge-cyan" style={{ marginLeft: 6, fontSize: 10, padding: "1px 6px" }}>{orders.length}</span>}
          </button>
        ))}
      </div>

      {/* ══ Tab 1: Assigned Pick (unchanged layout, refined) ══ */}
      {tab === "Assigned Pick" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input className="ims-input" style={{ width: 280 }} placeholder="Search order, customer, SKU…"
              value={assignSearch} onChange={e => setAssignSearch(e.target.value)} />
            {assignSearch && <Button variant="ghost" onClick={() => setAssignSearch("")}>Clear</Button>}
            <Button variant="ghost" onClick={load}>↻ Refresh</Button>
            {someSelected && (
              <Button variant="primary" onClick={handleAssign} disabled={assigning}>
                {assigning
                  ? "Assigning…"
                  : `Assign ${Object.values(selected).filter(Boolean).length} to Pick →`}
              </Button>
            )}
          </div>

          <div className="ims-accent-box">
            <p className="t-secondary" style={{ margin: 0, fontSize: 12 }}>
              Orders with status <strong>In Transit</strong>. Select entries and click <strong>Assign</strong> to move them to Pick Orders.
            </p>
          </div>

          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 64 }}>
              <div className="spin" style={{ width: 24, height: 24, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%" }} />
            </div>
          ) : (
            <div className="ims-table-wrap">
              <table className="ims-table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>
                      <input type="checkbox" checked={allSelected} onChange={toggleAll}
                        style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--accent)" }} />
                    </th>
                    {["Order ID", "Customer", "Contact", "Address", "SKU", "Product", "Qty", "Status"].map(c => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTransit.length === 0 ? (
                    <tr><td colSpan={9} className="t-muted" style={{ padding: "48px 16px", textAlign: "center" }}>No In Transit orders</td></tr>
                  ) : filteredTransit.map(r => (
                    <tr key={r.id} style={{ background: selected[r.id] ? "var(--accent-dim)" : "transparent", transition: "background 0.15s" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <input type="checkbox" checked={!!selected[r.id]} onChange={() => toggleOne(r.id)}
                          style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--accent)" }} />
                      </td>
                      <td className="mono" style={{ padding: "12px 16px" }}><span className="t-accent">{r.orderId}</span></td>
                      <td style={{ padding: "12px 16px", fontWeight: 600 }}>{r.name}</td>
                      <td style={{ padding: "12px 16px" }}>{r.contact || "—"}</td>
                      <td style={{ padding: "12px 16px" }}>{r.address || "—"}</td>
                      <td className="mono" style={{ padding: "12px 16px" }}>{r.skuId}</td>
                      <td style={{ padding: "12px 16px" }}>{r.productName}</td>
                      <td style={{ padding: "12px 16px" }}>{r.quantity || 1}</td>
                      <td style={{ padding: "12px 16px" }}><Badge color="violet">In Transit</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ Tab 2: Pick Orders — enhanced cards ══ */}
      {tab === "Pick Orders" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input className="ims-input" style={{ width: 280 }} placeholder="Order ID, customer, SKU…"
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && <Button variant="ghost" onClick={() => setSearch("")}>Clear</Button>}
            <Button variant="ghost" onClick={load}>↻ Refresh</Button>
          </div>

          <div className="ims-elevated" style={{ padding: "8px 14px", borderRadius: 8, width: "fit-content", display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><circle cx="17.5" cy="17.5" r="2.5"/>
            </svg>
            <p className="t-muted" style={{ margin: 0, fontSize: 12 }}>
              Scan or type a <strong>bin location</strong> to enable the Pick button. Click any product image, name, or SKU to view full details.
            </p>
          </div>

          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 64 }}>
              <div className="spin" style={{ width: 24, height: 24, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%" }} />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="ims-panel" style={{ textAlign: "center", padding: "40px 24px" }}>
              <p style={{ fontSize: 32, margin: "0 0 8px" }}>📦</p>
              <p className="t-muted" style={{ margin: 0 }}>No orders in Pick status</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filteredOrders.map((r, idx) => (
                <PickOrderCard
                  key={r.id}
                  r={r}
                  scanLoc={scanLocs[r.id] || ""}
                  onScanChange={val => setScanLocs(p => ({ ...p, [r.id]: val }))}
                  onPick={handlePick}
                  onShowDetail={setDetailProduct}
                  isFirst={idx === 0}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ Tab 3: Picking Data (unchanged) ══ */}
      {tab === "Picking Data" && (
        <Table loading={loading}
          cols={["Order ID", "Customer", "SKU", "Product", "Ordered", "Picked", "Location", "Pick Zone", "By", "Picked At", "Status"]}
          rows={pickingData}
          renderRow={r => (<>
            <Td mono><span className="t-accent">{r.orderId}</span></Td>
            <Td><span style={{ fontWeight: 600 }}>{r.customerName}</span></Td>
            <Td mono>{r.skuId}</Td>
            <Td>{r.productName}</Td>
            <Td>{r.orderedQty}</Td>
            <Td><span className="t-success" style={{ fontWeight: 700 }}>{r.pickedQty}</span></Td>
            <Td><span className="ims-badge ims-badge-amber" style={{ fontFamily: "monospace" }}>{r.location}</span></Td>
            <Td><Badge color="violet">{r.pickZone || "—"}</Badge></Td>
            <Td><span className="t-muted" style={{ fontSize: 11 }}>{r.createdBy || "—"}</span></Td>
            <Td>{r.pickedAt ? new Date(r.pickedAt).toLocaleString() : "—"}</Td>
            <Td><Badge color="green">Picked</Badge></Td>
          </>)}
        />
      )}

      <div style={{
        textAlign: "center", padding: "16px 0", fontSize: "14px",
        color: "var(--text-primary)", borderTop: "1px solid var(--border)",
        marginTop: "30px", opacity: 0.8,
      }}>
        © {new Date().getFullYear()} 3APJ WMS · Engineered by Amit Waghmare & Ajay Rathod · Powered by Firebase
      </div>
    </div>
  );
}