import React, { useState, useEffect, useCallback } from "react";
import { listDocuments, openDocument, batchDownload, getAuditTrail, formatBytes } from "../api/documents";

const DOC_TYPES = ["", "ID Copy", "Proof of Address", "Payslip", "Bank Statement", "Contract", "Other"];

export default function DocumentList({ clientNumber, currentUser = "user", onReplaceRequest }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(null);
  const [auditDoc, setAuditDoc] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("🔍 Fetching documents for client:", clientNumber);
      const data = await listDocuments({
        clientNumber,
        documentType: filterType || undefined,
        search: search || undefined,
      });
      console.log("✅ Received documents:", data);
      setDocs(data);
    } catch (e) {
      console.error("❌ Error fetching documents:", e);
      setError(e.message);
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [clientNumber, filterType, search]);

  useEffect(() => { load(); }, [load]);

  const toggleSelect = (id) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const toggleAll = () =>
    selected.size === docs.length
      ? setSelected(new Set())
      : setSelected(new Set(docs.map((d) => d.id)));

  const handleOpen = async (doc, inline = false) => {
    setBusy(doc.id);
    try { await openDocument(doc.id, currentUser, inline); }
    catch (e) { alert(e.message); }
    finally { setBusy(null); }
  };

  const handleBatchDownload = async () => {
    if (!selected.size) return;
    setBusy("batch");
    try { await batchDownload([...selected], currentUser); }
    catch (e) { alert(e.message); }
    finally { setBusy(null); }
  };

  const openAudit = async (doc) => {
    setAuditDoc(doc);
    setAuditLoading(true);
    try { setAuditLogs(await getAuditTrail(doc.id)); }
    catch { setAuditLogs([]); }
    finally { setAuditLoading(false); }
  };

  const isViewable = (mime) =>
    ["application/pdf", "image/jpeg", "image/png"].includes(mime);

  return (
    <div style={s.card}>
      {/* Header */}
      <div style={s.header}>
        <h3 style={s.title}>Documents</h3>
        {selected.size > 0 && (
          <button
            style={s.batchBtn}
            onClick={handleBatchDownload}
            disabled={busy === "batch"}
          >
            {busy === "batch" ? "Preparing ZIP…" : `⬇ Download ${selected.size} as ZIP`}
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={s.filters}>
        <select
          style={s.filterSelect}
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setSelected(new Set()); }}
        >
          {DOC_TYPES.map((t) => <option key={t} value={t}>{t || "All Types"}</option>)}
        </select>
        <input
          style={s.searchInput}
          placeholder="Search by description…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSelected(new Set()); }}
        />
        <button style={s.refreshBtn} onClick={load} title="Refresh">↻</button>
      </div>

      {/* Table */}
      {error && (
        <div style={{ ...s.empty, background: "#3c1f1f", color: "#ff6b6b", border: "1px solid #ff6b6b", borderRadius: 8 }}>
          <strong>⚠️ Error loading documents:</strong> {error}
          <br />
          <small style={{marginTop: 8, display: "block"}}>Check browser console (F12) for details. Make sure backend is running on http://localhost:8000</small>
        </div>
      )}
      {!error && loading ? (
        <div style={s.empty}>Loading documents…</div>
      ) : !error && docs.length === 0 ? (
        <div style={s.empty}>No documents found for {clientNumber}.</div>
      ) : !error && (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>
                  <input
                    type="checkbox"
                    checked={selected.size === docs.length && docs.length > 0}
                    onChange={toggleAll}
                  />
                </th>
                <th style={s.th}>Type</th>
                <th style={s.th}>Description</th>
                <th style={s.th}>Date</th>
                <th style={s.th}>Uploaded By</th>
                <th style={s.th}>Size</th>
                <th style={s.th}>Version</th>
                <th style={s.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr
                  key={doc.id}
                  style={{ ...s.tr, ...(selected.has(doc.id) ? s.trSelected : {}) }}
                >
                  <td style={s.td}>
                    <input
                      type="checkbox"
                      checked={selected.has(doc.id)}
                      onChange={() => toggleSelect(doc.id)}
                    />
                  </td>
                  <td style={s.td}>
                    <span style={s.typePill}>{doc.document_type}</span>
                  </td>
                  <td style={{ ...s.td, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {doc.description || <span style={s.muted}>—</span>}
                  </td>
                  <td style={s.td}>{fmtDate(doc.uploaded_at)}</td>
                  <td style={s.td}>{doc.uploaded_by}</td>
                  <td style={s.td}>{formatBytes(doc.file_size)}</td>
                  <td style={s.td}>
                    <span style={s.verBadge}>v{doc.version_number}</span>
                  </td>
                  <td style={s.td}>
                    <div style={s.actions}>
                      {isViewable(doc.mime_type) && (
                        <button
                          style={s.actionBtn}
                          title="View in browser"
                          onClick={() => handleOpen(doc, true)}
                          disabled={busy === doc.id}
                        >
                          👁 View
                        </button>
                      )}
                      <button
                        style={s.actionBtn}
                        title="Download"
                        onClick={() => handleOpen(doc, false)}
                        disabled={busy === doc.id}
                      >
                        {busy === doc.id ? "…" : "⬇ Download"}
                      </button>
                      {onReplaceRequest && (
                        <button
                          style={s.actionBtn}
                          title="Replace document"
                          onClick={() => onReplaceRequest(doc)}
                        >
                          🔄 Replace
                        </button>
                      )}
                      <button
                        style={s.actionBtn}
                        title="Audit trail"
                        onClick={() => openAudit(doc)}
                      >
                        📋 History
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Audit Trail Modal */}
      {auditDoc && (
        <div style={s.overlay} onClick={() => setAuditDoc(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <div style={s.modalTitle}>Activity Log</div>
                <div style={s.modalSub}>{auditDoc.original_filename}</div>
              </div>
              <button style={s.closeBtn} onClick={() => setAuditDoc(null)}>✕</button>
            </div>
            {auditLoading ? (
              <p style={s.muted}>Loading…</p>
            ) : auditLogs.length === 0 ? (
              <p style={s.muted}>No activity recorded yet.</p>
            ) : (
              <table style={{ ...s.table, marginTop: 0 }}>
                <thead>
                  <tr>
                    <th style={s.th}>Action</th>
                    <th style={s.th}>Performed By</th>
                    <th style={s.th}>Date & Time</th>
                    <th style={s.th}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((l) => (
                    <tr key={l.id} style={s.tr}>
                      <td style={s.td}><span style={s.actionTag}>{l.action}</span></td>
                      <td style={s.td}>{l.performed_by}</td>
                      <td style={s.td}>{fmtDate(l.performed_at)}</td>
                      <td style={{ ...s.td, fontSize: 11, color: "#64748b" }}>
                        {l.details
                          ? (() => { try { const d = JSON.parse(l.details); return Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(", "); } catch { return l.details; } })()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-ZA", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

const s = {
  card: { background: "#1a1d2e", border: "1px solid #2d3154", borderRadius: 12, padding: 28, color: "#e2e8f0" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 18, fontWeight: 700, color: "#f1f5f9" },
  batchBtn: { background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  filters: { display: "flex", gap: 12, marginBottom: 16, alignItems: "center" },
  filterSelect: { background: "#252840", border: "1px solid #3d4266", borderRadius: 8, padding: "8px 12px", color: "#e2e8f0", fontSize: 13, outline: "none" },
  searchInput: { flex: 1, background: "#252840", border: "1px solid #3d4266", borderRadius: 8, padding: "8px 12px", color: "#e2e8f0", fontSize: 13, outline: "none" },
  refreshBtn: { background: "#252840", border: "1px solid #3d4266", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 16 },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { padding: "10px 12px", borderBottom: "1px solid #2d3154", color: "#64748b", fontWeight: 600, textAlign: "left", whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid #1e2140", transition: "background 0.12s" },
  trSelected: { background: "#1e2d4a" },
  td: { padding: "10px 12px", verticalAlign: "middle" },
  typePill: { background: "#1e2d4a", color: "#93c5fd", fontSize: 11, padding: "3px 9px", borderRadius: 20, fontWeight: 600, whiteSpace: "nowrap" },
  verBadge: { background: "#2d3154", color: "#a5b4fc", fontSize: 11, padding: "2px 8px", borderRadius: 20 },
  muted: { color: "#4a5568", fontSize: 13 },
  actions: { display: "flex", gap: 6, flexWrap: "wrap" },
  actionBtn: { background: "#252840", border: "1px solid #3d4266", borderRadius: 6, padding: "4px 10px", color: "#94a3b8", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" },
  actionTag: { background: "#1e2140", color: "#a5b4fc", fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 600, whiteSpace: "nowrap" },
  empty: { textAlign: "center", color: "#4a5568", padding: "48px 0", fontSize: 14 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" },
  modal: { background: "#1a1d2e", border: "1px solid #2d3154", borderRadius: 12, padding: 28, width: "min(720px,95vw)", maxHeight: "80vh", overflowY: "auto" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  modalTitle: { fontSize: 16, fontWeight: 700, color: "#f1f5f9" },
  modalSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  closeBtn: { background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 20, lineHeight: 1 },
};
