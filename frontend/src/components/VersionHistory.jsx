import React, { useState, useRef } from "react";
import { replaceDocument, getVersionHistory, openVersion, formatBytes } from "../api/documents";

export default function VersionHistory({ document: doc, currentUser = "user", onReplaced, onClose }) {
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [replaceFile, setReplaceFile] = useState(null);
  const [replaceDesc, setReplaceDesc] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(null);
  const fileRef = useRef();

  if (!doc) return null;

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const h = await getVersionHistory(doc.id);
      setHistory(h);
      setShowHistory(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleReplace = async () => {
    if (!replaceFile) { setError("Please select a replacement file."); return; }
    setError(null);
    setUploading(true);
    try {
      await replaceDocument(doc.id, {
        file: replaceFile,
        uploadedBy: currentUser,
        description: replaceDesc || doc.description,
      });
      setSuccess(`Document replaced. Now at version ${doc.version_number + 1}.`);
      setReplacing(false);
      setReplaceFile(null);
      setReplaceDesc("");
      if (onReplaced) onReplaced();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleOpenVersion = async (version) => {
    setBusy(version.id);
    try { await openVersion(version.id, currentUser); }
    catch (e) { setError(e.message); }
    finally { setBusy(null); }
  };

  return (
    <div style={s.card}>
      {/* Header */}
      <div style={s.topRow}>
        <h3 style={s.title}>Version History</h3>
        {onClose && (
          <button style={s.closeBtn} onClick={onClose}>✕ Close</button>
        )}
      </div>

      {/* Document summary */}
      <div style={s.summary}>
        <Row label="File" value={doc.original_filename} />
        <Row label="Type" value={doc.document_type} />
        <Row label="Current Version" value={
          <span style={s.currentBadge}>v{doc.version_number} — Current</span>
        } />
        <Row label="Last Updated" value={`${fmtDate(doc.uploaded_at)} by ${doc.uploaded_by}`} />
      </div>

      {/* Action buttons */}
      <div style={s.btnRow}>
        <button
          style={s.replaceBtn}
          onClick={() => { setReplacing(true); setSuccess(null); setError(null); }}
        >
          🔄 Replace Document
        </button>
        <button
          style={s.historyBtn}
          onClick={loadHistory}
          disabled={historyLoading}
        >
          {historyLoading ? "Loading…" : "📋 View All Versions"}
        </button>
      </div>

      {/* Replace form */}
      {replacing && (
        <div style={s.replaceBox}>
          <div style={s.replaceTitle}>Replace with a New File</div>
          <p style={s.replaceHint}>
            The current file will be archived as <strong>v{doc.version_number}</strong> and can still
            be downloaded at any time.
          </p>
          <div style={s.filePicker} onClick={() => fileRef.current.click()}>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
              onChange={(e) => setReplaceFile(e.target.files[0] || null)}
            />
            {replaceFile ? (
              <div style={s.pickedFile}>
                <span>{fileIcon(replaceFile.name)}</span>
                <span>{replaceFile.name}</span>
                <span style={s.pickedSize}>({formatBytes(replaceFile.size)})</span>
              </div>
            ) : (
              <span style={s.pickHint}>Click to select a replacement file</span>
            )}
          </div>
          <input
            type="text"
            style={s.input}
            placeholder="Update description (optional)"
            value={replaceDesc}
            onChange={(e) => setReplaceDesc(e.target.value)}
          />
          <div style={s.btnRow}>
            <button style={s.replaceBtn} onClick={handleReplace} disabled={uploading}>
              {uploading ? "Replacing…" : "✓ Confirm Replacement"}
            </button>
            <button
              style={s.cancelBtn}
              onClick={() => { setReplacing(false); setReplaceFile(null); setError(null); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <div style={s.errorBox}>⚠ {error}</div>}
      {success && <div style={s.successBox}>✅ {success}</div>}

      {/* Version table */}
      {showHistory && history && (
        <div style={s.historySection}>
          <div style={s.historyTitle}>All Versions</div>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Version</th>
                  <th style={s.th}>Filename</th>
                  <th style={s.th}>Size</th>
                  <th style={s.th}>Uploaded By</th>
                  <th style={s.th}>Date</th>
                  <th style={s.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* Current version row */}
                <tr style={s.tr}>
                  <td style={s.td}>
                    <span style={s.currentBadge}>v{history.current.version_number} — Current</span>
                  </td>
                  <td style={s.td}>{history.current.original_filename}</td>
                  <td style={s.td}>{formatBytes(history.current.file_size)}</td>
                  <td style={s.td}>{history.current.uploaded_by}</td>
                  <td style={s.td}>{fmtDate(history.current.uploaded_at)}</td>
                  <td style={s.td}><span style={s.activePill}>Active</span></td>
                </tr>

                {/* Archived versions */}
                {history.history.map((v) => (
                  <tr key={v.id} style={{ ...s.tr, opacity: 0.7 }}>
                    <td style={s.td}>
                      <span style={s.archivedBadge}>v{v.version_number}</span>
                    </td>
                    <td style={s.td}>{v.original_filename}</td>
                    <td style={s.td}>{formatBytes(v.file_size)}</td>
                    <td style={s.td}>{v.uploaded_by}</td>
                    <td style={s.td}>{fmtDate(v.uploaded_at)}</td>
                    <td style={s.td}>
                      <button
                        style={s.actionBtn}
                        onClick={() => handleOpenVersion(v)}
                        disabled={busy === v.id}
                      >
                        {busy === v.id ? "…" : "⬇ Download"}
                      </button>
                    </td>
                  </tr>
                ))}

                {history.history.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ ...s.td, textAlign: "center", color: "#4a5568" }}>
                      No previous versions — this is the original upload.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", width: 120, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: "#e2e8f0" }}>{value}</span>
    </div>
  );
}

const fileIcon = (n) =>
  ({ pdf: "📄", jpg: "🖼", jpeg: "🖼", png: "🖼", docx: "📝", xlsx: "📊" }[
    n.split(".").pop().toLowerCase()
  ] || "📎");

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-ZA", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

const s = {
  card: { background: "#1a1d2e", border: "1px solid #2d3154", borderRadius: 12, padding: 28, color: "#e2e8f0" },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 18, fontWeight: 700, color: "#f1f5f9" },
  closeBtn: { background: "#252840", border: "1px solid #3d4266", color: "#94a3b8", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13 },
  summary: { background: "#252840", borderRadius: 10, padding: "16px 20px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 10 },
  currentBadge: { background: "#14532d", color: "#86efac", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 },
  archivedBadge: { background: "#2d3154", color: "#94a3b8", padding: "2px 8px", borderRadius: 20, fontSize: 12 },
  btnRow: { display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" },
  replaceBtn: { background: "linear-gradient(135deg,#d97706,#b45309)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  historyBtn: { background: "#252840", border: "1px solid #3d4266", color: "#94a3b8", borderRadius: 8, padding: "10px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  cancelBtn: { background: "transparent", border: "1px solid #4a5568", color: "#94a3b8", borderRadius: 8, padding: "10px 22px", fontSize: 13, cursor: "pointer" },
  replaceBox: { background: "#1e2140", border: "1px solid #3d4266", borderRadius: 10, padding: 20, marginBottom: 16 },
  replaceTitle: { fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 },
  replaceHint: { fontSize: 12, color: "#64748b", marginBottom: 14, lineHeight: 1.5 },
  filePicker: { border: "2px dashed #3d4266", borderRadius: 8, padding: "20px 16px", cursor: "pointer", textAlign: "center", marginBottom: 12 },
  pickedFile: { display: "flex", alignItems: "center", gap: 8, justifyContent: "center", color: "#a5b4fc", fontSize: 14 },
  pickedSize: { color: "#64748b", fontSize: 12 },
  pickHint: { color: "#64748b", fontSize: 13 },
  input: { width: "100%", background: "#252840", border: "1px solid #3d4266", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 12 },
  errorBox: { background: "#2d1b1b", border: "1px solid #7f1d1d", borderRadius: 8, padding: "12px 16px", marginBottom: 12, color: "#fca5a5", fontSize: 13 },
  successBox: { background: "#1a2e1a", border: "1px solid #166534", borderRadius: 8, padding: "12px 16px", marginBottom: 12, color: "#86efac", fontSize: 13 },
  historySection: { marginTop: 8 },
  historyTitle: { fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 12 },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { padding: "10px 12px", borderBottom: "1px solid #2d3154", color: "#64748b", fontWeight: 600, textAlign: "left", whiteSpace: "nowrap" },
  tr: { borderBottom: "1px solid #1e2140" },
  td: { padding: "10px 12px", verticalAlign: "middle" },
  activePill: { background: "#14532d", color: "#86efac", fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600 },
  actionBtn: { background: "#252840", border: "1px solid #3d4266", borderRadius: 6, padding: "4px 12px", color: "#94a3b8", cursor: "pointer", fontSize: 12 },
};
