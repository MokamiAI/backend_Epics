import React, { useState, useEffect, useRef } from "react";
import {
  getCompanySettings, updateCompanySettings,
  uploadLogo, deleteLogo, getCompanySettingsAudit,
  MONTHS, fmtDate,
} from "../api/settings";

const CURRENCIES = ["ZAR", "USD", "EUR", "GBP", "NAD", "BWP", "ZMW", "MWK"];

export default function CompanySettings({ currentUser = "admin" }) {
  const [settings, setSettings] = useState(null);
  const [form, setForm]         = useState({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [error, setError]       = useState(null);
  const [success, setSuccess]   = useState(null);
  const [showAudit, setShowAudit] = useState(false);
  const [audit, setAudit]       = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [logoPreview, setLogoPreview]   = useState(null);
  const logoRef = useRef();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getCompanySettings();
      setSettings(data);
      setForm({
        company_name:            data.company_name || "",
        registration_number:     data.registration_number || "",
        physical_address:        data.physical_address || "",
        contact_phone:           data.contact_phone || "",
        contact_email:           data.contact_email || "",
        email_signature:         data.email_signature || "",
        default_currency:        data.default_currency || "ZAR",
        fiscal_year_start_month: data.fiscal_year_start_month || 3,
      });
      if (data.logo_url) setLogoPreview(data.logo_url);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    setSaving(true); setError(null); setSuccess(null);
    try {
      const updated = await updateCompanySettings(form, currentUser);
      setSettings(updated);
      setSuccess("Company settings saved successfully.");
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleLogoChange = async (file) => {
    if (!file) return;
    setLogoUploading(true); setError(null);
    try {
      const reader = new FileReader();
      reader.onload = (e) => setLogoPreview(e.target.result);
      reader.readAsDataURL(file);
      const updated = await uploadLogo(file, currentUser);
      setSettings(updated);
      if (updated.logo_url) setLogoPreview(updated.logo_url);
      setSuccess("Logo uploaded successfully.");
    } catch (e) { setError(e.message); setLogoPreview(settings?.logo_url || null); }
    finally { setLogoUploading(false); }
  };

  const handleDeleteLogo = async () => {
    if (!window.confirm("Remove the company logo?")) return;
    setLogoUploading(true); setError(null);
    try {
      await deleteLogo(currentUser);
      setLogoPreview(null);
      setSuccess("Logo removed.");
      load();
    } catch (e) { setError(e.message); }
    finally { setLogoUploading(false); }
  };

  const openAudit = async () => {
    setShowAudit(true); setAuditLoading(true);
    try { setAudit(await getCompanySettingsAudit()); }
    catch { setAudit([]); }
    finally { setAuditLoading(false); }
  };

  if (loading) return <div style={s.loading}>Loading settings…</div>;

  return (
    <div style={s.card}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h3 style={s.title}>Company Settings</h3>
          <p style={s.subtitle}>Intermediate Data System trading and Projects CC</p>
        </div>
        <button style={s.auditBtn} onClick={openAudit}>📋 Change Log</button>
      </div>

      {error   && <div style={s.errorBox}>⚠ {error}</div>}
      {success && <div style={s.successBox}>✅ {success}</div>}

      <div style={s.grid}>
        {/* Left column - Logo + identity */}
        <div style={s.leftCol}>
          {/* Logo */}
          <div style={s.section}>
            <div style={s.sectionTitle}>Company Logo</div>
            <div style={s.logoWrap}>
              {logoPreview ? (
                <img src={logoPreview} alt="Company logo" style={s.logoImg} />
              ) : (
                <div style={s.logoPlaceholder}>
                  <span style={{ fontSize: 32 }}>🏢</span>
                  <span style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>No logo</span>
                </div>
              )}
            </div>
            <input
              ref={logoRef} type="file" hidden accept=".png,.jpg,.jpeg"
              onChange={(e) => handleLogoChange(e.target.files[0])}
            />
            <div style={s.logoBtnRow}>
              <button
                style={s.secondaryBtn}
                onClick={() => logoRef.current.click()}
                disabled={logoUploading}
              >
                {logoUploading ? "Uploading…" : "⬆ Upload Logo"}
              </button>
              {logoPreview && (
                <button style={s.dangerBtn} onClick={handleDeleteLogo} disabled={logoUploading}>
                  Remove
                </button>
              )}
            </div>
            <p style={s.hint}>PNG or JPG · max 2 MB</p>
          </div>

          {/* Currency & fiscal year */}
          <div style={s.section}>
            <div style={s.sectionTitle}>Regional</div>
            <Field label="Default Currency">
              <select style={s.select} value={form.default_currency}
                onChange={(e) => handleChange("default_currency", e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Fiscal Year Start">
              <select style={s.select} value={form.fiscal_year_start_month}
                onChange={(e) => handleChange("fiscal_year_start_month", Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </Field>
          </div>
        </div>

        {/* Right column - Company details */}
        <div style={s.rightCol}>
          <div style={s.section}>
            <div style={s.sectionTitle}>Company Details</div>
            <Field label="Company Name *">
              <input style={s.input} value={form.company_name}
                onChange={(e) => handleChange("company_name", e.target.value)} />
            </Field>
            <Field label="Registration Number">
              <input style={s.input} placeholder="e.g. 2001/012345/23"
                value={form.registration_number}
                onChange={(e) => handleChange("registration_number", e.target.value)} />
            </Field>
            <Field label="Physical Address">
              <textarea style={s.textarea} rows={3}
                placeholder="Street, City, Province, Postal Code"
                value={form.physical_address}
                onChange={(e) => handleChange("physical_address", e.target.value)} />
            </Field>
            <Field label="Contact Phone">
              <input style={s.input} placeholder="+27 11 000 0000"
                value={form.contact_phone}
                onChange={(e) => handleChange("contact_phone", e.target.value)} />
            </Field>
            <Field label="Contact Email">
              <input style={s.input} type="email" placeholder="info@example.com"
                value={form.contact_email}
                onChange={(e) => handleChange("contact_email", e.target.value)} />
            </Field>
          </div>

          <div style={s.section}>
            <div style={s.sectionTitle}>Email Signature</div>
            <p style={s.hint} style={{ marginBottom: 8, color: "#64748b", fontSize: 12 }}>
              Appended to all outgoing email templates.
            </p>
            <textarea style={{ ...s.textarea, minHeight: 120 }} rows={5}
              placeholder="Kind regards,&#10;Intermediate Data System trading and Projects CC&#10;Tel: +27 11 000 0000"
              value={form.email_signature}
              onChange={(e) => handleChange("email_signature", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Settings used in */}
      <div style={s.usedIn}>
        <span style={s.usedInLabel}>Used in:</span>
        {["Loan agreements (letterhead)", "Email templates (footer)", "System header (logo)", "Reports (cover page)"].map((u) => (
          <span key={u} style={s.usedInTag}>{u}</span>
        ))}
      </div>

      {/* Save */}
      <div style={s.footer}>
        <button style={{ ...s.saveBtn, ...(saving ? s.disabled : {}) }} onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Settings"}
        </button>
        <span style={s.lastSaved}>
          {settings?.updated_at ? `Last saved ${fmtDate(settings.updated_at)} by ${settings.updated_by}` : "Not yet saved"}
        </span>
      </div>

      {/* Audit modal */}
      {showAudit && (
        <div style={s.overlay} onClick={() => setShowAudit(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span>Change Log — Company Settings</span>
              <button style={s.closeBtn} onClick={() => setShowAudit(false)}>✕</button>
            </div>
            {auditLoading ? <p style={{ color: "#64748b", padding: 16 }}>Loading…</p> : audit.length === 0 ? (
              <p style={{ color: "#64748b", padding: 16 }}>No changes recorded yet.</p>
            ) : (
              <table style={s.table}>
                <thead><tr>
                  <th style={s.th}>Field</th><th style={s.th}>Old Value</th>
                  <th style={s.th}>New Value</th><th style={s.th}>Changed By</th><th style={s.th}>When</th>
                </tr></thead>
                <tbody>{audit.map((a) => (
                  <tr key={a.id} style={s.tr}>
                    <td style={s.td}><span style={s.fieldTag}>{a.field_name}</span></td>
                    <td style={{ ...s.td, color: "#94a3b8" }}>{a.old_value || "—"}</td>
                    <td style={s.td}>{a.new_value || "—"}</td>
                    <td style={s.td}>{a.changed_by}</td>
                    <td style={s.td}>{fmtDate(a.changed_at)}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const s = {
  card: { background: "#1a1d2e", border: "1px solid #2d3154", borderRadius: 12, padding: 28, color: "#e2e8f0" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  title: { fontSize: 18, fontWeight: 700, color: "#f1f5f9", margin: 0 },
  subtitle: { fontSize: 12, color: "#64748b", marginTop: 4 },
  auditBtn: { background: "#252840", border: "1px solid #3d4266", borderRadius: 8, padding: "7px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13 },
  errorBox: { background: "#2d1b1b", border: "1px solid #7f1d1d", borderRadius: 8, padding: "12px 16px", marginBottom: 16, color: "#fca5a5", fontSize: 13 },
  successBox: { background: "#1a2e1a", border: "1px solid #166534", borderRadius: 8, padding: "12px 16px", marginBottom: 16, color: "#86efac", fontSize: 13 },
  grid: { display: "grid", gridTemplateColumns: "260px 1fr", gap: 24, marginBottom: 20 },
  leftCol: { display: "flex", flexDirection: "column", gap: 20 },
  rightCol: { display: "flex", flexDirection: "column", gap: 20 },
  section: { background: "#252840", borderRadius: 10, padding: 20 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 },
  logoWrap: { width: "100%", height: 120, background: "#1a1d2e", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, overflow: "hidden", border: "1px solid #3d4266" },
  logoImg: { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" },
  logoPlaceholder: { display: "flex", flexDirection: "column", alignItems: "center" },
  logoBtnRow: { display: "flex", gap: 8, marginBottom: 4 },
  hint: { fontSize: 11, color: "#64748b" },
  input: { width: "100%", background: "#1a1d2e", border: "1px solid #3d4266", borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box" },
  textarea: { width: "100%", background: "#1a1d2e", border: "1px solid #3d4266", borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" },
  select: { width: "100%", background: "#1a1d2e", border: "1px solid #3d4266", borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 13, outline: "none" },
  secondaryBtn: { flex: 1, background: "#3b4fd4", color: "#fff", border: "none", borderRadius: 7, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  dangerBtn: { background: "#7f1d1d", color: "#fca5a5", border: "none", borderRadius: 7, padding: "7px 12px", fontSize: 12, cursor: "pointer" },
  usedIn: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "14px 0", borderTop: "1px solid #2d3154", marginBottom: 16 },
  usedInLabel: { fontSize: 12, color: "#64748b", fontWeight: 600 },
  usedInTag: { background: "#1e2140", color: "#94a3b8", fontSize: 11, padding: "3px 10px", borderRadius: 20, border: "1px solid #3d4266" },
  footer: { display: "flex", alignItems: "center", gap: 16 },
  saveBtn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 8, padding: "11px 32px", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  disabled: { opacity: 0.5, cursor: "not-allowed" },
  lastSaved: { fontSize: 12, color: "#64748b" },
  loading: { textAlign: "center", color: "#64748b", padding: "40px 0" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" },
  modal: { background: "#1a1d2e", border: "1px solid #2d3154", borderRadius: 12, padding: 24, width: "min(820px,95vw)", maxHeight: "80vh", overflowY: "auto" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, fontSize: 15, fontWeight: 700, color: "#f1f5f9" },
  closeBtn: { background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 20 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { padding: "9px 12px", borderBottom: "1px solid #2d3154", color: "#64748b", fontWeight: 600, textAlign: "left" },
  tr: { borderBottom: "1px solid #1e2140" },
  td: { padding: "9px 12px", verticalAlign: "middle" },
  fieldTag: { background: "#1e2140", color: "#a5b4fc", fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 600 },
};
