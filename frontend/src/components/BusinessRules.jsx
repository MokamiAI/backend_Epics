import React, { useState, useEffect } from "react";
import {
  getBusinessRules, updateBusinessRules, getBusinessRulesAudit,
  INTEREST_METHOD_LABELS, PAYMENT_PRIORITY_LABELS, formatZAR, fmtDate,
} from "../api/settings";

export default function BusinessRules({ currentUser = "admin" }) {
  const [rules, setRules]         = useState(null);
  const [form, setForm]           = useState({});
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);
  const [success, setSuccess]     = useState(null);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [showAudit, setShowAudit] = useState(false);
  const [audit, setAudit]         = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getBusinessRules();
      setRules(data);
      setForm({
        min_loan_amount:                 String(data.min_loan_amount),
        max_loan_amount:                 String(data.max_loan_amount),
        min_loan_term_months:            String(data.min_loan_term_months),
        max_loan_term_months:            String(data.max_loan_term_months),
        max_concurrent_loans_per_client: String(data.max_concurrent_loans_per_client),
        min_credit_score_auto_approve:   String(data.min_credit_score_auto_approve),
        days_to_default:                 String(data.days_to_default),
        interest_calculation_method:     data.interest_calculation_method,
        payment_allocation_priority:     data.payment_allocation_priority,
      });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const buildPayload = (override = false) => {
    const p = {
      min_loan_amount:                 parseFloat(form.min_loan_amount),
      max_loan_amount:                 parseFloat(form.max_loan_amount),
      min_loan_term_months:            parseInt(form.min_loan_term_months),
      max_loan_term_months:            parseInt(form.max_loan_term_months),
      max_concurrent_loans_per_client: parseInt(form.max_concurrent_loans_per_client),
      min_credit_score_auto_approve:   parseInt(form.min_credit_score_auto_approve),
      days_to_default:                 parseInt(form.days_to_default),
      interest_calculation_method:     form.interest_calculation_method,
      payment_allocation_priority:     form.payment_allocation_priority,
    };
    if (override) p.override_reason = overrideReason;
    return p;
  };

  const handleSave = async (override = false) => {
    setSaving(true); setError(null); setSuccess(null);
    try {
      const updated = await updateBusinessRules(buildPayload(override), currentUser, override);
      setRules(updated);
      setSuccess("Business rules saved successfully.");
      setShowOverride(false);
      setOverrideReason("");
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const openAudit = async () => {
    setShowAudit(true); setAuditLoading(true);
    try { setAudit(await getBusinessRulesAudit()); }
    catch { setAudit([]); }
    finally { setAuditLoading(false); }
  };

  if (loading) return <div style={s.loading}>Loading business rules…</div>;

  return (
    <div style={s.card}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h3 style={s.title}>Business Rules</h3>
          <p style={s.subtitle}>Enforced at loan application submission · Changes are fully audited</p>
        </div>
        <button style={s.auditBtn} onClick={openAudit}>📋 Change Log</button>
      </div>

      {error   && <div style={s.errorBox}>⚠ {error}</div>}
      {success && <div style={s.successBox}>✅ {success}</div>}

      <div style={s.grid}>

        {/* Loan Amount */}
        <Section title="Loan Amount Limits" icon="💰">
          <RuleRow
            label="Minimum Loan Amount"
            hint="ZAR"
            defaultNote={`Default: ${formatZAR(10000)}`}
          >
            <input style={s.input} type="number" min={0} value={form.min_loan_amount}
              onChange={(e) => set("min_loan_amount", e.target.value)} />
          </RuleRow>
          <RuleRow
            label="Maximum Loan Amount"
            hint="ZAR"
            defaultNote={`Default: ${formatZAR(5000000)}`}
          >
            <input style={s.input} type="number" min={0} value={form.max_loan_amount}
              onChange={(e) => set("max_loan_amount", e.target.value)} />
          </RuleRow>
        </Section>

        {/* Loan Term */}
        <Section title="Loan Term Limits" icon="📅">
          <RuleRow label="Minimum Term" hint="months" defaultNote="Default: 1 month">
            <input style={s.input} type="number" min={1} value={form.min_loan_term_months}
              onChange={(e) => set("min_loan_term_months", e.target.value)} />
          </RuleRow>
          <RuleRow label="Maximum Term" hint="months" defaultNote="Default: 24 months">
            <input style={s.input} type="number" min={1} value={form.max_loan_term_months}
              onChange={(e) => set("max_loan_term_months", e.target.value)} />
          </RuleRow>
        </Section>

        {/* Client & Risk */}
        <Section title="Client & Risk Rules" icon="⚠️">
          <RuleRow label="Max Concurrent Loans per Client" defaultNote="Default: 3">
            <input style={s.input} type="number" min={1} value={form.max_concurrent_loans_per_client}
              onChange={(e) => set("max_concurrent_loans_per_client", e.target.value)} />
          </RuleRow>
          <RuleRow label="Min Credit Score for Auto-Approve" defaultNote="Default: 80 (out of 100)">
            <input style={s.input} type="number" min={0} max={100} value={form.min_credit_score_auto_approve}
              onChange={(e) => set("min_credit_score_auto_approve", e.target.value)} />
          </RuleRow>
          <RuleRow label="Days Before Loan Marked as Default" defaultNote="Default: 90 days">
            <input style={s.input} type="number" min={1} value={form.days_to_default}
              onChange={(e) => set("days_to_default", e.target.value)} />
          </RuleRow>
        </Section>

        {/* Calculation Methods */}
        <Section title="Calculation Methods" icon="🧮">
          <RuleRow label="Interest Calculation Method">
            <select style={s.select} value={form.interest_calculation_method}
              onChange={(e) => set("interest_calculation_method", e.target.value)}>
              {Object.entries(INTEREST_METHOD_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </RuleRow>
          <RuleRow label="Payment Allocation Priority">
            <select style={s.select} value={form.payment_allocation_priority}
              onChange={(e) => set("payment_allocation_priority", e.target.value)}>
              {Object.entries(PAYMENT_PRIORITY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </RuleRow>
        </Section>
      </div>

      {/* Override form */}
      {showOverride && (
        <div style={s.overrideBox}>
          <div style={s.overrideTitle}>⚠ Override Confirmation Required</div>
          <p style={s.overrideHint}>
            You are saving rules that deviate from standard parameters.
            Please provide a reason — this will be recorded in the audit trail.
          </p>
          <input
            style={s.input}
            placeholder="Override reason (required)"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button style={s.overrideConfirmBtn} onClick={() => handleSave(true)}
              disabled={!overrideReason.trim() || saving}>
              {saving ? "Saving…" : "Confirm Override & Save"}
            </button>
            <button style={s.cancelBtn} onClick={() => { setShowOverride(false); setOverrideReason(""); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={s.footer}>
        <button
          style={{ ...s.saveBtn, ...(saving ? s.disabled : {}) }}
          onClick={() => handleSave(false)}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save Rules"}
        </button>
        <button style={s.overrideBtn} onClick={() => setShowOverride(true)}>
          Save with Override
        </button>
        <span style={s.lastSaved}>
          {rules?.updated_at
            ? `Last saved ${fmtDate(rules.updated_at)} by ${rules.updated_by}`
            : "Using defaults"}
        </span>
      </div>

      {/* Audit modal */}
      {showAudit && (
        <div style={s.overlay} onClick={() => setShowAudit(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span>Change Log — Business Rules</span>
              <button style={s.closeBtn} onClick={() => setShowAudit(false)}>✕</button>
            </div>
            {auditLoading ? <p style={{ color: "#64748b", padding: 16 }}>Loading…</p> : audit.length === 0 ? (
              <p style={{ color: "#64748b", padding: 16 }}>No changes recorded yet.</p>
            ) : (
              <table style={s.table}>
                <thead><tr>
                  <th style={s.th}>Rule</th><th style={s.th}>Old Value</th>
                  <th style={s.th}>New Value</th><th style={s.th}>Changed By</th><th style={s.th}>When</th>
                </tr></thead>
                <tbody>{audit.map((a) => (
                  <tr key={a.id} style={s.tr}>
                    <td style={s.td}><span style={s.fieldTag}>{a.field_name.replace(/_/g, " ")}</span></td>
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

function Section({ title, icon, children }) {
  return (
    <div style={{ background: "#252840", borderRadius: 10, padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
        <span>{icon}</span>{title}
      </div>
      {children}
    </div>
  );
}

function RuleRow({ label, hint, defaultNote, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{label}{hint && <span style={{ color: "#64748b", fontWeight: 400, marginLeft: 4 }}>({hint})</span>}</label>
        {defaultNote && <span style={{ fontSize: 10, color: "#4a5568" }}>{defaultNote}</span>}
      </div>
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
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 },
  input: { width: "100%", background: "#1a1d2e", border: "1px solid #3d4266", borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box" },
  select: { width: "100%", background: "#1a1d2e", border: "1px solid #3d4266", borderRadius: 8, padding: "9px 12px", color: "#e2e8f0", fontSize: 13, outline: "none" },
  overrideBox: { background: "#2d1e0e", border: "1px solid #92400e", borderRadius: 10, padding: 20, marginBottom: 16 },
  overrideTitle: { fontSize: 14, fontWeight: 700, color: "#fcd34d", marginBottom: 8 },
  overrideHint: { fontSize: 12, color: "#d97706", marginBottom: 12, lineHeight: 1.5 },
  overrideConfirmBtn: { background: "#d97706", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  cancelBtn: { background: "transparent", border: "1px solid #4a5568", color: "#94a3b8", borderRadius: 8, padding: "9px 20px", fontSize: 13, cursor: "pointer" },
  footer: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  saveBtn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 8, padding: "11px 32px", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  overrideBtn: { background: "#252840", border: "1px solid #92400e", color: "#d97706", borderRadius: 8, padding: "11px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
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
  fieldTag: { background: "#1e2140", color: "#a5b4fc", fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 600, textTransform: "capitalize" },
};
