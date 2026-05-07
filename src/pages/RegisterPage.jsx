import { useState } from "react";

function Field({ label, type = "text", value, onChange, placeholder, error, hint, options }) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";

  if (options) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-secondary)" }}>
          {label}
        </label>
        <select
          value={value}
          onChange={onChange}
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "var(--input-bg)",
            border: `1px solid ${error ? "var(--danger)" : "var(--input-border)"}`,
            color: "var(--input-color)",
            borderRadius: 8,
            padding: "9px 12px",
            fontSize: 13,
            outline: "none",
            fontFamily: "inherit",
          }}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <span style={{ fontSize: 11, color: "var(--danger-text)" }}>{error}</span>}
      </div>
    );
  }

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
      {hint && !error && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{hint}</span>}
    </div>
  );
}

const strength = (p) => {
  if (!p) return { score: 0, label: "", color: "" };
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  const map = [
    { label: "Too short", color: "var(--danger)" },
    { label: "Weak", color: "var(--danger)" },
    { label: "Fair", color: "var(--warning)" },
    { label: "Good", color: "var(--accent2)" },
    { label: "Strong", color: "var(--success)" },
  ];
  return { score: s, ...map[s] };
};

function PasswordStrength({ password }) {
  const s = strength(password);
  if (!password) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: i < s.score ? s.color : "var(--border)",
              transition: "background 0.25s",
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.label}</span>
    </div>
  );
}

export default function RegisterPage({ isDark, setIsDark, onRegister, onSwitchMode }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    role: "operator",
  });
  const [errors, setErrors] = useState({});
  const [globalErr, setGlobalErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    const e = {};
    if (!form.name.trim()) e.name = "Full name is required";
    if (!form.email) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email";
    if (!form.password) e.password = "Password is required";
    else if (form.password.length < 6) e.password = "Minimum 6 characters";
    if (form.password !== form.confirm) e.confirm = "Passwords do not match";
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    setGlobalErr("");
    try {
      await onRegister({
        name: form.name.trim(),
        email: form.email,
        password: form.password,
        role: form.role,
      });
      setSubmitted(true);
    } catch (err) {
      setGlobalErr(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              margin: "0 auto 20px",
              background: "var(--badge-amber-bg)",
              border: "1px solid var(--badge-amber-br)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
            }}
          >
            ⏳
          </div>
          <h2 style={{ color: "var(--text-primary)", margin: "0 0 10px" }}>Request Submitted</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, margin: "0 0 24px" }}>
            Waiting for admin approval.
            <br />
            You'll receive access once an administrator reviews your request.
          </p>
          <button
            onClick={onSwitchMode}
            style={{
              display: "inline-block",
              padding: "10px 20px",
              background: "var(--accent)",
              color: "#fff",
              textDecoration: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

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
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, color: "var(--text-primary)" }}>Request Access</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>Warehouse Management System</p>
        </div>

        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", padding: 32, borderRadius: 20 }}>
          {globalErr && (
            <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 20, background: "var(--badge-red-bg)", border: "1px solid var(--badge-red-br)" }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--badge-red-fg)", fontWeight: 600 }}>{globalErr}</p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Full Name" value={form.name} onChange={update("name")} placeholder="e.g. Amit Sharma" error={errors.name} />
            <Field label="Email Address" type="email" value={form.email} onChange={update("email")} placeholder="user@company.com" error={errors.email} />
            <Field
              label="Role"
              value={form.role}
              onChange={update("role")}
              options={[
                { value: "operator", label: "⚙️ Operator — Can execute warehouse operations" },
                { value: "viewer", label: "👁️ Viewer — Read-only access" },
              ]}
            />

            <div>
              <Field
                label="Password"
                type="password"
                value={form.password}
                onChange={update("password")}
                placeholder="Min. 6 characters"
                error={errors.password}
                hint="Use uppercase, numbers & symbols"
              />
              <PasswordStrength password={form.password} />
            </div>

            <Field label="Confirm Password" type="password" value={form.confirm} onChange={update("confirm")} placeholder="Re-enter password" error={errors.confirm} />

            <div style={{ background: "var(--bg-base)", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)" }}>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>
                🔒 Your account request will be reviewed by an administrator. You'll be notified once approved.
              </p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                width: "100%",
                padding: "11px",
                fontSize: 14,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontWeight: 700,
                fontFamily: "inherit",
              }}
            >
              {loading ? "Submitting…" : "Request Access →"}
            </button>

            <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
              Already have access?{" "}
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
                Sign in
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