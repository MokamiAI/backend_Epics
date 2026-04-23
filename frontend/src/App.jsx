import React, { useState } from "react";
import DocumentRepository   from "./components/DocumentRepository";
import SystemConfiguration  from "./components/SystemConfiguration";

const NAV = [
  { id: "documents", label: "📂 Documents",      component: "documents"  },
  { id: "settings",  label: "⚙ Configuration",   component: "settings"   },
];

/**
 * Root App
 *
 * In a real integration replace the values below with your auth context:
 *   currentUser — logged-in user email or name
 *   clientNumber — active client/account from routing context
 *   isAdmin — role flag from auth token
 */
export default function App() {
  const currentUser  = "admin@ids.co.za";
  const clientNumber = "CLIENT001";
  const isAdmin      = true;

  const [active, setActive] = useState("documents");

  return (
    <div style={s.root}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.brand}>
          <div style={s.brandName}>IDS</div>
          <div style={s.brandFull}>Intermediate Data System</div>
        </div>
        <nav style={s.nav}>
          {NAV.map((item) => (
            <button
              key={item.id}
              style={{ ...s.navItem, ...(active === item.id ? s.navActive : {}) }}
              onClick={() => setActive(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div style={s.sidebarFooter}>{currentUser}</div>
      </aside>

      {/* Main content */}
      <main style={s.main}>
        {active === "documents" && (
          <DocumentRepository clientNumber={clientNumber} currentUser={currentUser} />
        )}
        {active === "settings" && (
          <SystemConfiguration currentUser={currentUser} isAdmin={isAdmin} />
        )}
      </main>
    </div>
  );
}

const s = {
  root: { display: "flex", minHeight: "100vh", background: "#0f111a", fontFamily: "'DM Sans', system-ui, sans-serif" },
  sidebar: { width: 220, background: "#12142a", borderRight: "1px solid #2d3154", display: "flex", flexDirection: "column", flexShrink: 0 },
  brand: { padding: "28px 20px 24px", borderBottom: "1px solid #2d3154" },
  brandName: { fontSize: 22, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em" },
  brandFull: { fontSize: 10, color: "#64748b", marginTop: 2, lineHeight: 1.4 },
  nav: { flex: 1, padding: "16px 10px", display: "flex", flexDirection: "column", gap: 4 },
  navItem: { background: "none", border: "none", borderRadius: 8, padding: "10px 14px", color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left", transition: "all 0.15s" },
  navActive: { background: "#1e2140", color: "#f1f5f9" },
  sidebarFooter: { padding: "16px 20px", borderTop: "1px solid #2d3154", fontSize: 11, color: "#4a5568", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  main: { flex: 1, overflowY: "auto" },
};
