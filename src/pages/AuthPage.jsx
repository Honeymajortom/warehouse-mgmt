import { useState } from "react";
import { registerAdmin, loginAdmin } from "../services/authService";

// ── tiny reusable field ──────────────────────────────────────
function Field({ label, type = "text", value, onChange, placeholder, error, hint }) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
      <label style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
        letterSpacing:"0.08em", color:"var(--text-secondary)" }}>{label}</label>
      <div style={{ position:"relative" }}>
        <input
          type={isPassword && show ? "text" : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={{
            width:"100%", boxSizing:"border-box",
            background:"var(--input-bg)", border:`1px solid ${error?"var(--danger)":"var(--input-border)"}`,
            color:"var(--input-color)", borderRadius:8, padding: isPassword ? "9px 44px 9px 12px" : "9px 12px",
            fontSize:13, outline:"none", fontFamily:"inherit", transition:"border-color 0.2s",
          }}
          onFocus={e  => e.target.style.borderColor = error?"var(--danger)":"var(--accent)"}
          onBlur={e   => e.target.style.borderColor = error?"var(--danger)":"var(--input-border)"}
        />
        {isPassword && (
          <button onClick={() => setShow(s => !s)} type="button"
            style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
              background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", fontSize:16, padding:2 }}>
            {show ? "🙈" : "👁"}
          </button>
        )}
      </div>
      {error && <span style={{ fontSize:11, color:"var(--danger-text)" }}>{error}</span>}
      {hint && !error && <span style={{ fontSize:11, color:"var(--text-muted)" }}>{hint}</span>}
    </div>
  );
}

// ── password strength ────────────────────────────────────────
const strength = (p) => {
  if (!p) return { score:0, label:"", color:"" };
  let s = 0;
  if (p.length >= 8)          s++;
  if (/[A-Z]/.test(p))        s++;
  if (/[0-9]/.test(p))        s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  const map = [
    { label:"Too short",  color:"var(--danger)"  },
    { label:"Weak",       color:"var(--danger)"  },
    { label:"Fair",       color:"var(--warning)" },
    { label:"Good",       color:"var(--accent2)" },
    { label:"Strong",     color:"var(--success)" },
  ];
  return { score:s, ...map[s] };
};

function PasswordStrength({ password }) {
  const s = strength(password);
  if (!password) return null;
  return (
    <div style={{ marginTop:6 }}>
      <div style={{ display:"flex", gap:4, marginBottom:4 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ flex:1, height:3, borderRadius:2,
            background: i < s.score ? s.color : "var(--border)",
            transition:"background 0.25s" }}/>
        ))}
      </div>
      <span style={{ fontSize:11, color:s.color, fontWeight:600 }}>{s.label}</span>
    </div>
  );
}

// ── friendly Firebase error messages ────────────────────────
const friendlyError = (err) => {
  const code = err?.code || "";
  const map = {
    "auth/email-already-in-use":    "An account with this email already exists.",
    "auth/invalid-email":           "Please enter a valid email address.",
    "auth/weak-password":           "Password must be at least 6 characters.",
    "auth/user-not-found":          "No account found with this email.",
    "auth/wrong-password":          "Incorrect password. Please try again.",
    "auth/invalid-credential":      "Incorrect email or password.",
    "auth/too-many-requests":       "Too many attempts. Please wait a moment.",
    "auth/network-request-failed":  "Network error. Check your connection.",
    "auth/operation-not-allowed":   "Email/Password sign-in is not enabled. Go to Firebase Console → Authentication → Sign-in method → Email/Password → Enable.",
    "auth/configuration-not-found": "Firebase Auth is not configured. Enable Email/Password in your Firebase Console.",
    "auth/internal-error":          "Firebase internal error. Check your Firebase config in firestoreService.js.",
    "auth/api-key-not-valid":       "Invalid Firebase API key. Check your config in firestoreService.js.",
  };
  if (map[code]) return map[code];
  // Show raw error in dev so nothing is hidden
  return err?.message || "Something went wrong. Please try again.";
};

// ════════════════════════════════════════════════════════════
export default function AuthPage({ isDark, setIsDark }) {
  const [mode, setMode]   = useState("login");  // "login" | "register"
  const [loading, setLoading] = useState(false);
  const [globalErr, setGlobalErr] = useState("");

  // Login fields
  const [loginEmail, setLoginEmail]       = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErrors, setLoginErrors]     = useState({});

  // Register fields
  const [regName, setRegName]         = useState("");
  const [regEmail, setRegEmail]       = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm]   = useState("");
  const [regErrors, setRegErrors]     = useState({});

  const switchMode = (m) => {
    setMode(m);
    setGlobalErr("");
    setLoginErrors({});
    setRegErrors({});
  };

  // ── Login ─────────────────────────────────────────────────
  const handleLogin = async () => {
    const e = {};
    if (!loginEmail)    e.email    = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) e.email = "Enter a valid email";
    if (!loginPassword) e.password = "Password is required";
    setLoginErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    setGlobalErr("");
    try {
      await loginAdmin({ email:loginEmail, password:loginPassword });
    } catch (err) {
      setGlobalErr(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Register ──────────────────────────────────────────────
  const handleRegister = async () => {
    const e = {};
    if (!regName.trim())     e.name     = "Full name is required";
    if (!regEmail)           e.email    = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) e.email = "Enter a valid email";
    if (!regPassword)        e.password = "Password is required";
    else if (regPassword.length < 6) e.password = "Minimum 6 characters";
    if (regPassword !== regConfirm)  e.confirm  = "Passwords do not match";
    setRegErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    setGlobalErr("");
    try {
      await registerAdmin({ name:regName.trim(), email:regEmail, password:regPassword });
    } catch (err) {
      setGlobalErr(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const onKey = (fn) => e => { if (e.key === "Enter") fn(); };

  return (
    <div style={{
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:"var(--bg-base)", padding:20,
    }}>
      {/* Theme toggle top-right */}
      <div style={{ position:"fixed", top:16, right:20, display:"flex", alignItems:"center",
        background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:10, padding:3, gap:2 }}>
        {[{v:true,icon:"🌙",label:"Dark"},{v:false,icon:"☀️",label:"Light"}].map(({v,icon,label})=>(
          <button key={label} onClick={()=>setIsDark(v)}
            style={{ padding:"5px 12px", borderRadius:8, fontSize:12, fontWeight:600,
              cursor:"pointer", border:"none", fontFamily:"inherit", transition:"all 0.2s",
              background: isDark===v ? "var(--accent)" : "transparent",
              color:      isDark===v ? "#fff" : "var(--text-secondary)" }}>
            {icon} {label}
          </button>
        ))}
      </div>

      <div style={{ width:"100%", maxWidth:420 }}>
        {/* Logo / brand */}
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{
            width:56, height:56, borderRadius:16, margin:"0 auto 14px",
            background:"linear-gradient(135deg,var(--accent),var(--accent2))",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:24, boxShadow:"0 8px 24px rgba(0,0,0,0.2)",
          }}>📦</div>
          <h1 style={{ fontSize:28, fontWeight:900, margin:0,
            background:"var(--grad-text)",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
            fontFamily:"'Syne',sans-serif" }}>MIDC IMS</h1>
          <p style={{ fontSize:13, color:"var(--text-secondary)", marginTop:4 }}>
            Eduspark · Warehouse Management
          </p>
        </div>

        {/* Card */}
        <div className="ims-card" style={{ padding:32, borderRadius:20 }}>
          {/* Tab switcher */}
          <div className="ims-tab-bar" style={{ width:"100%", marginBottom:28 }}>
            {[{id:"login",label:"Sign In"},{id:"register",label:"Register"}].map(({id,label})=>(
              <button key={id}
                className={`ims-tab${mode===id?" active":""}`}
                onClick={()=>switchMode(id)}
                style={{ flex:1, textAlign:"center" }}>
                {label}
              </button>
            ))}
          </div>

          {/* Global error */}
          {globalErr && (
            <div style={{ padding:"10px 14px", borderRadius:8, marginBottom:20,
              background:"var(--badge-red-bg)", border:"1px solid var(--badge-red-br)" }}>
              <p style={{ margin:0, fontSize:13, color:"var(--badge-red-fg)", fontWeight:600 }}>
                {globalErr}
              </p>
            </div>
          )}

          {/* ── LOGIN FORM ── */}
          {mode==="login" && (
            <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
              <Field label="Email Address" type="email"
                value={loginEmail} onChange={e=>setLoginEmail(e.target.value)}
                placeholder="admin@company.com" error={loginErrors.email}
                onKeyDown={onKey(handleLogin)}/>
              <Field label="Password" type="password"
                value={loginPassword} onChange={e=>setLoginPassword(e.target.value)}
                placeholder="Enter your password" error={loginErrors.password}/>
              <button onClick={handleLogin} disabled={loading}
                className="ims-btn ims-btn-primary"
                style={{ width:"100%", padding:"11px", fontSize:14, marginTop:4,
                  opacity:loading?0.7:1, cursor:loading?"not-allowed":"pointer" }}>
                {loading ? "Signing in…" : "Sign In →"}
              </button>
              <p style={{ textAlign:"center", fontSize:13, color:"var(--text-muted)", margin:0 }}>
                No account?{" "}
                <button onClick={()=>switchMode("register")}
                  style={{ background:"none", border:"none", color:"var(--accent-text)",
                    fontSize:13, fontWeight:700, cursor:"pointer", padding:0, fontFamily:"inherit" }}>
                  Register here
                </button>
              </p>
            </div>
          )}

          {/* ── REGISTER FORM ── */}
          {mode==="register" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <Field label="Full Name"
                value={regName} onChange={e=>setRegName(e.target.value)}
                placeholder="e.g. Amit Sharma" error={regErrors.name}/>
              <Field label="Email Address" type="email"
                value={regEmail} onChange={e=>setRegEmail(e.target.value)}
                placeholder="admin@company.com" error={regErrors.email}/>
              <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                <Field label="Password" type="password"
                  value={regPassword} onChange={e=>setRegPassword(e.target.value)}
                  placeholder="Min. 6 characters" error={regErrors.password}
                  hint="Use uppercase, numbers & symbols for a stronger password"/>
                <PasswordStrength password={regPassword}/>
              </div>
              <Field label="Confirm Password" type="password"
                value={regConfirm} onChange={e=>setRegConfirm(e.target.value)}
                placeholder="Re-enter password" error={regErrors.confirm}/>

              <div className="ims-elevated" style={{ padding:"10px 14px", borderRadius:8 }}>
                <p style={{ margin:0, fontSize:12, color:"var(--text-secondary)" }}>
                  Your account will be saved in the <strong>admins</strong> collection in Firestore.
                  All admin accounts have full warehouse access.
                </p>
              </div>

              <button onClick={handleRegister} disabled={loading}
                className="ims-btn ims-btn-primary"
                style={{ width:"100%", padding:"11px", fontSize:14,
                  opacity:loading?0.7:1, cursor:loading?"not-allowed":"pointer" }}>
                {loading ? "Creating account…" : "Create Admin Account →"}
              </button>
              <p style={{ textAlign:"center", fontSize:13, color:"var(--text-muted)", margin:0 }}>
                Already registered?{" "}
                <button onClick={()=>switchMode("login")}
                  style={{ background:"none", border:"none", color:"var(--accent-text)",
                    fontSize:13, fontWeight:700, cursor:"pointer", padding:0, fontFamily:"inherit" }}>
                  Sign in
                </button>
              </p>
            </div>
          )}
        </div>

        <p style={{ textAlign:"center", fontSize:11, color:"var(--text-muted)", marginTop:20 }}>
          MIDC IMS · Eduspark · Secure Admin Portal
        </p>
      </div>
    </div>
  );
}
