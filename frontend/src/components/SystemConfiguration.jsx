import React, { useState } from "react";
import CompanySettings from "./CompanySettings";
import BusinessRules from "./BusinessRules";

const TABS = [
  { id: "company", label: "Company Settings" },
  { id: "rules",   label: "Business Rules" },
];

/**
 * SystemConfiguration
 *
 * Props:
 *   currentUser (string) — logged-in admin user name or email
 *   isAdmin     (bool)   — gate this component at the route level for admin-only access
 */
export default function SystemConfiguration({
  currentUser = "admin@ids.co.za",
  isAdmin = true,
}) {
  const [activeTab, setActiveTab] = useState("company");

  if (!isAdmin) {
    return (
      <div style={s.root}>
        <div style={s.denied}>
          <span style={{ fontSize: 36 }}>🔒</span>
          <p style={{ marginTop: 12, color: "#94a3b8" }}>
            You do not have permission to access System Configuration.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={s.root}>
      {/* Page header */}
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.heading}>System Configuration</h1>
          <p style={s.sub}>
            Intermediate Data System trading and Projects CC &mdash;{" "}
            <span style={{ color: "#d97706" }}>Admin only</span>
          </p>
        </div>
        <div style={s.userChip}>{currentUser}</div>
      </div>

      {/* Tab bar */}
      <div style={s.tabBar}>
        {TABS.map((t) => (
          <button
            key={t.id}
            style={{ ...s.tab, ...(activeTab === t.id ? s.tabActive : {}) }}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={s.content}>
        {activeTab === "company" && <CompanySettings currentUser={currentUser} />}
        {activeTab === "rules"   && <BusinessRules   currentUser={currentUser} />}
      </div>
    </div>
  );
}

const s = {
  root: {
    fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
    background: "#0f111a",
    minHeight: "100vh",
    padding: "36px 28px",
    boxSizing: "border-box",
  },
  pageHeader: {
    display: "flex", justifyContent: "space-between",
    alignItems: "flex-start", maxWidth: 1140,
    margin: "0 auto 32px",
  },
  heading: { fontSize: 30, fontWeight: 800, color: "#f1f5f9", margin: "0 0 6px", letterSpacing: "-0.02em" },
  sub: { fontSize: 13, color: "#64748b", margin: 0 },
  userChip: { background: "#1a1d2e", border: "1px solid #2d3154", borderRadius: 20, padding: "6px 16px", fontSize: 12, color: "#94a3b8" },
  tabBar: { display: "flex", gap: 2, maxWidth: 1140, margin: "0 auto 24px", borderBottom: "1px solid #2d3154" },
  tab: { background: "none", border: "none", borderBottom: "2px solid transparent", color: "#64748b", padding: "10px 22px", fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: -1, transition: "all 0.15s" },
  tabActive: { color: "#f1f5f9", borderBottomColor: "#6366f1" },
  content: { maxWidth: 1140, margin: "0 auto" },
  denied: { maxWidth: 400, margin: "80px auto", textAlign: "center", color: "#f1f5f9" },
};
