import React, { useState } from "react";
import UploadDocuments from "./UploadDocuments";
import DocumentList from "./DocumentList";
import VersionHistory from "./VersionHistory";

const TABS = [
  { id: "documents", label: "Documents" },
  { id: "upload",    label: "Upload" },
];

/**
 * DocumentRepository
 *
 * Props:
 *   clientNumber  (string)  — client/account identifier
 *   currentUser   (string)  — logged-in user name or email
 */
export default function DocumentRepository({
  clientNumber = "CLIENT001",
  currentUser  = "user@example.com",
}) {
  const [activeTab,   setActiveTab]   = useState("documents");
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [refreshKey,  setRefreshKey]  = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  const handleUploadSuccess = () => {
    setActiveTab("documents");
    refresh();
  };

  const handleReplaceRequest = (doc) => {
    setSelectedDoc(doc);
    setActiveTab("versions");
  };

  const handleReplaced = () => {
    setSelectedDoc(null);
    setActiveTab("documents");
    refresh();
  };

  return (
    <div style={s.root}>
      {/* Page header */}
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.heading}>Document Repository</h1>
          <p style={s.sub}>Client: <strong style={{ color: "#e2e8f0" }}>{clientNumber}</strong></p>
        </div>
        <div style={s.userChip}>{currentUser}</div>
      </div>

      {/* Tab navigation */}
      <div style={s.tabBar}>
        {TABS.map((t) => (
          <button
            key={t.id}
            style={{ ...s.tab, ...(activeTab === t.id ? s.tabActive : {}) }}
            onClick={() => { setActiveTab(t.id); setSelectedDoc(null); }}
          >
            {t.label}
          </button>
        ))}
        {selectedDoc && (
          <button
            style={{ ...s.tab, ...(activeTab === "versions" ? s.tabActive : {}), ...s.versionsTab }}
            onClick={() => setActiveTab("versions")}
          >
            Version History
          </button>
        )}
      </div>

      {/* Tab content */}
      <div style={s.content}>
        {activeTab === "documents" && (
          <DocumentList
            key={refreshKey}
            clientNumber={clientNumber}
            currentUser={currentUser}
            onReplaceRequest={handleReplaceRequest}
          />
        )}

        {activeTab === "upload" && (
          <UploadDocuments
            clientNumber={clientNumber}
            uploadedBy={currentUser}
            onUploadSuccess={handleUploadSuccess}
          />
        )}

        {activeTab === "versions" && selectedDoc && (
          <VersionHistory
            document={selectedDoc}
            currentUser={currentUser}
            onReplaced={handleReplaced}
            onClose={() => { setActiveTab("documents"); setSelectedDoc(null); }}
          />
        )}

        {activeTab === "versions" && !selectedDoc && (
          <div style={s.emptyState}>
            <p>Select a document and click <strong>Replace</strong> to manage its version history.</p>
          </div>
        )}
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
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    maxWidth: 1140,
    margin: "0 auto 32px",
  },
  heading: {
    fontSize: 30,
    fontWeight: 800,
    color: "#f1f5f9",
    margin: "0 0 6px",
    letterSpacing: "-0.02em",
  },
  sub: { fontSize: 13, color: "#64748b", margin: 0 },
  userChip: {
    background: "#1a1d2e",
    border: "1px solid #2d3154",
    borderRadius: 20,
    padding: "6px 16px",
    fontSize: 12,
    color: "#94a3b8",
  },
  tabBar: {
    display: "flex",
    gap: 2,
    maxWidth: 1140,
    margin: "0 auto 24px",
    borderBottom: "1px solid #2d3154",
  },
  tab: {
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "#64748b",
    padding: "10px 22px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginBottom: -1,
    transition: "color 0.15s, border-color 0.15s",
    letterSpacing: "0.01em",
  },
  tabActive: {
    color: "#f1f5f9",
    borderBottomColor: "#6366f1",
  },
  versionsTab: {
    color: "#d97706",
  },
  content: {
    maxWidth: 1140,
    margin: "0 auto",
  },
  emptyState: {
    textAlign: "center",
    color: "#4a5568",
    padding: "64px 20px",
    fontSize: 14,
  },
};
