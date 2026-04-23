import React, { useState, useRef } from "react";
import { uploadDocuments, formatBytes } from "../api/documents";

const DOC_TYPES = [
  "ID Copy",
  "Proof of Address",
  "Payslip",
  "Bank Statement",
  "Contract",
  "Other",
];
const ALLOWED_EXT = [".pdf", ".jpg", ".jpeg", ".png", ".docx", ".xlsx"];
const MAX_SIZE = 10 * 1024 * 1024;
const today = () => new Date().toISOString().split("T")[0];

export default function UploadDocuments({ clientNumber, uploadedBy = "user", onUploadSuccess }) {
  const [files, setFiles] = useState([]);
  const [docType, setDocType] = useState("");
  const [description, setDescription] = useState("");
  const [docDate, setDocDate] = useState(today());
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState([]);
  const inputRef = useRef();

  const validateFiles = (rawFiles) => {
    const valid = [];
    const errs = [];
    Array.from(rawFiles).forEach((f) => {
      const ext = "." + f.name.split(".").pop().toLowerCase();
      if (!ALLOWED_EXT.includes(ext)) {
        errs.push(`"${f.name}" — unsupported format (${ext})`);
      } else if (f.size > MAX_SIZE) {
        errs.push(`"${f.name}" — exceeds 10MB limit (${formatBytes(f.size)})`);
      } else {
        valid.push(f);
      }
    });
    return { valid, errs };
  };

  const addFiles = (rawFiles) => {
    const { valid, errs } = validateFiles(rawFiles);
    setErrors(errs);
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...valid.filter((f) => !existing.has(f.name))];
    });
  };

  const removeFile = (name) => setFiles((prev) => prev.filter((f) => f.name !== name));

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleSubmit = async () => {
    if (!docType) { setErrors(["Please select a document type."]); return; }
    if (!files.length) { setErrors(["Please add at least one file."]); return; }
    setErrors([]);
    setUploading(true);
    setProgress(0);
    setResult(null);
    const tick = setInterval(() => setProgress((p) => Math.min(p + 8, 90)), 200);
    try {
      const res = await uploadDocuments({
        clientNumber, documentType: docType, description,
        documentDate: docDate, uploadedBy, files,
      });
      clearInterval(tick);
      setProgress(100);
      setResult(res);
      setFiles([]);
      setDescription("");
      if (onUploadSuccess) onUploadSuccess(res);
    } catch (err) {
      clearInterval(tick);
      setErrors([err.message]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={s.card}>
      <h3 style={s.title}>Upload Documents</h3>

      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Document Type *</label>
          <select style={s.select} value={docType} onChange={(e) => setDocType(e.target.value)}>
            <option value="">— Select type —</option>
            {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={s.field}>
          <label style={s.label}>Document Date</label>
          <input
            type="date" style={s.input}
            value={docDate}
            onChange={(e) => setDocDate(e.target.value)}
          />
        </div>
      </div>

      <div style={s.field}>
        <label style={s.label}>Description (optional)</label>
        <input
          type="text" style={s.input} maxLength={200}
          placeholder="e.g. January 2025 payslip"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* Drop zone */}
      <div
        style={{ ...s.dropZone, ...(dragging ? s.dropZoneActive : {}) }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current.click()}
      >
        <input
          ref={inputRef} type="file" multiple hidden
          accept={ALLOWED_EXT.join(",")}
          onChange={(e) => addFiles(e.target.files)}
        />
        <div style={s.dropIcon}>📁</div>
        <p style={s.dropText}>
          {dragging ? "Drop files here" : "Drag & drop files or click to browse"}
        </p>
        <p style={s.dropHint}>PDF, JPG, PNG, DOCX, XLSX · max 10 MB each</p>
      </div>

      {files.length > 0 && (
        <ul style={s.fileList}>
          {files.map((f) => (
            <li key={f.name} style={s.fileItem}>
              <span style={s.fileIcon}>{fileIcon(f.name)}</span>
              <span style={s.fileName}>{f.name}</span>
              <span style={s.fileSize}>{formatBytes(f.size)}</span>
              <button style={s.removeBtn} onClick={() => removeFile(f.name)}>✕</button>
            </li>
          ))}
        </ul>
      )}

      {errors.length > 0 && (
        <div style={s.errorBox}>
          {errors.map((e, i) => <p key={i} style={s.errorLine}>⚠ {e}</p>)}
        </div>
      )}

      {uploading && (
        <div style={s.progressWrap}>
          <div style={{ ...s.progressBar, width: `${progress}%` }} />
        </div>
      )}

      {result && !uploading && (
        <div style={s.successBox}>
          ✅ {result.succeeded} of {result.total} file{result.total !== 1 ? "s" : ""} uploaded successfully.
          {result.failed > 0 && (
            <span style={{ color: "#f97316" }}> {result.failed} failed — check file types and sizes.</span>
          )}
        </div>
      )}

      <button
        style={{ ...s.submitBtn, ...(uploading ? s.submitBtnDisabled : {}) }}
        onClick={handleSubmit}
        disabled={uploading}
      >
        {uploading
          ? "Uploading…"
          : `Upload${files.length > 0 ? ` (${files.length}) ` : " "}Files`}
      </button>
    </div>
  );
}

function fileIcon(name) {
  const ext = name.split(".").pop().toLowerCase();
  return { pdf: "📄", jpg: "🖼", jpeg: "🖼", png: "🖼", docx: "📝", xlsx: "📊" }[ext] || "📎";
}

const s = {
  card: { background: "#1a1d2e", border: "1px solid #2d3154", borderRadius: 12, padding: 28, color: "#e2e8f0" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 22, color: "#f1f5f9" },
  row: { display: "flex", gap: 16 },
  field: { flex: 1, display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" },
  input: { background: "#252840", border: "1px solid #3d4266", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 14, outline: "none" },
  select: { background: "#252840", border: "1px solid #3d4266", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 14, outline: "none" },
  dropZone: { border: "2px dashed #3d4266", borderRadius: 10, padding: "36px 20px", textAlign: "center", cursor: "pointer", transition: "all 0.2s", marginBottom: 16 },
  dropZoneActive: { borderColor: "#6366f1", background: "#1e2140" },
  dropIcon: { fontSize: 36, marginBottom: 8 },
  dropText: { fontSize: 15, color: "#94a3b8", margin: "4px 0" },
  dropHint: { fontSize: 12, color: "#64748b" },
  fileList: { listStyle: "none", padding: 0, margin: "0 0 16px", display: "flex", flexDirection: "column", gap: 8 },
  fileItem: { display: "flex", alignItems: "center", gap: 10, background: "#252840", borderRadius: 8, padding: "8px 12px", fontSize: 13 },
  fileIcon: { fontSize: 18 },
  fileName: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  fileSize: { color: "#64748b", fontSize: 12, whiteSpace: "nowrap" },
  removeBtn: { background: "none", border: "none", color: "#f87171", cursor: "pointer", padding: "0 4px", fontSize: 14 },
  errorBox: { background: "#2d1b1b", border: "1px solid #7f1d1d", borderRadius: 8, padding: "12px 16px", marginBottom: 14 },
  errorLine: { margin: "4px 0", fontSize: 13, color: "#fca5a5" },
  progressWrap: { background: "#252840", borderRadius: 20, height: 6, marginBottom: 14, overflow: "hidden" },
  progressBar: { background: "linear-gradient(90deg,#6366f1,#818cf8)", height: "100%", borderRadius: 20, transition: "width 0.3s ease" },
  successBox: { background: "#1a2e1a", border: "1px solid #166534", borderRadius: 8, padding: "12px 16px", marginBottom: 14, color: "#86efac", fontSize: 14 },
  submitBtn: { background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 8, padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%" },
  submitBtnDisabled: { opacity: 0.5, cursor: "not-allowed" },
};
