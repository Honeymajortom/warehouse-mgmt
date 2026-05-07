import { useState } from "react";
import { Link } from "react-router-dom";

function Field({ label, type = "text", value, onChange, placeholder, error, onKeyDown }) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-secondary)" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          type={isPassword && show ? "text" : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          onKeyDown={onKeyDown}
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "var(--input-bg)",
            border: `1px solid ${error ? "var(--danger)" : "var(--input-border)"}`,
            color: "var(--input-color)",
            borderRadius: 8,
            padding: isPassword ? "9px 44px 9px 12px" : "9px 12px",
            fontSize: 13,
            outline: "none",
            fontFamily: "inherit",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => (e.target.style.borderColor = error ? "var(--danger)" : "var(--accent)")}
          onBlur={(e) => (e.target.style.borderColor = error ? "var(--danger)" : "var(--input-border)")}
        />
        {isPassword && (
          <button
            onClick={() => setShow((s) => !s)}
            type="button"
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontSize: 16,
              padding: 2,
            }}
          >
            {show ? "🙈" : "👁️"}
          </button>
        )}
      </div>
      {error && <span style={{ fontSize: 11, color: "var(--danger-text)" }}>{error}</span>}
    </div>
  );
}

export default function LoginPage({ isDark, setIsDark, onLogin, onSwitchMode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [globalErr, setGlobalErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const e = {};
    if (!email) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email";
    if (!password) e.password = "Password is required";
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    setGlobalErr("");
    try {
      await onLogin({ email, password });
      // App.jsx handles routing based on user.status
    } catch (err) {
      setGlobalErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div
            // style={{
            //   width: 70,
            //   height: 70,
            //   borderRadius: 16,
            //   margin: "0 auto 14px",
            //   // background: "linear-gradient(135deg, var(--accent), var(--accent2))",
            //   display: "flex",
            //   alignItems: "center",
            //   justifyContent: "center",
            //   fontSize: 24,
            //   boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            // }}
          >
            <img
              src="/3APJ.png"
              alt="Logo"
              style={{
                width: "70%",
                height: "70%",
                objectFit: "contain",
              }}
            />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, color: "var(--text-primary)", fontFamily: "'Syne',sans-serif" }}>
            3APJ WMS
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>Warehouse Management System</p>
        </div>

        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", padding: 32, borderRadius: 20 }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 18, color: "var(--text-primary)" }}>Sign In</h2>

          {globalErr && (
            <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 20, background: "var(--badge-red-bg)", border: "1px solid var(--badge-red-br)" }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--badge-red-fg)", fontWeight: 600 }}>{globalErr}</p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <Field
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@wms.com"
              error={errors.email}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              error={errors.password}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                width: "100%",
                padding: "11px",
                fontSize: 14,
                marginTop: 4,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontWeight: 700,
                fontFamily: "inherit",
                transition: "opacity 0.2s",
              }}
            >
              {loading ? "Signing in…" : "Sign In →"}
            </button>

            <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
              No account?{" "}
              <button
                onClick={onSwitchMode}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--accent-text)",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: 0,
                  fontFamily: "inherit",
                }}
              >
                Request Access
              </button>
            </p>
          </div>
        </div>

        {/* Theme toggle */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 3,
              gap: 2,
            }}
          >
            {[
              { v: true, icon: "🌙", label: "Dark" },
              { v: false, icon: "☀️", label: "Light" },
            ].map(({ v, icon, label }) => (
              <button
                key={label}
                onClick={() => setIsDark(v)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "none",
                  fontFamily: "inherit",
                  transition: "all 0.2s",
                  background: isDark === v ? "var(--accent)" : "transparent",
                  color: isDark === v ? "#fff" : "var(--text-secondary)",
                }}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}