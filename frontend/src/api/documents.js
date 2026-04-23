const BASE = process.env.REACT_APP_API_URL || "http://localhost:8000/api";

async function handleResponse(res) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.blob();
}

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadDocuments({
  clientNumber,
  documentType,
  description,
  documentDate,
  uploadedBy,
  files,
}) {
  const form = new FormData();
  form.append("client_number", clientNumber);
  form.append("document_type", documentType);
  if (description) form.append("description", description);
  if (documentDate) form.append("document_date", documentDate);
  form.append("uploaded_by", uploadedBy || "system");
  files.forEach((f) => form.append("files", f));

  const res = await fetch(`${BASE}/documents/upload`, { method: "POST", body: form });
  return handleResponse(res);
}

// ── List & Retrieve ───────────────────────────────────────────────────────────

export async function listDocuments({ clientNumber, documentType, search } = {}) {
  const params = new URLSearchParams();
  if (clientNumber) params.set("client_number", clientNumber);
  if (documentType) params.set("document_type", documentType);
  if (search) params.set("search", search);
  const res = await fetch(`${BASE}/documents/?${params}`);
  return handleResponse(res);
}

export async function getDocument(id) {
  const res = await fetch(`${BASE}/documents/${id}`);
  return handleResponse(res);
}

export async function getDocumentTypes() {
  const res = await fetch(`${BASE}/documents/meta/document-types`);
  return handleResponse(res);
}

// ── Download & View ───────────────────────────────────────────────────────────

/**
 * Fetches a pre-signed S3 URL and opens it in a new tab.
 * inline=true  → PDF/image previews in the browser
 * inline=false → forces a file download
 */
export async function openDocument(id, performedBy = "user", inline = false) {
  const res = await fetch(
    `${BASE}/documents/${id}/download-url?performed_by=${encodeURIComponent(performedBy)}&inline=${inline}`
  );
  const data = await handleResponse(res);
  window.open(data.url, "_blank");
}

export async function batchDownload(ids, performedBy = "user") {
  const res = await fetch(
    `${BASE}/documents/batch-download?performed_by=${encodeURIComponent(performedBy)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids),
    }
  );
  if (!res.ok) throw new Error("Batch download failed");
  triggerDownload(await res.blob(), `documents_${Date.now()}.zip`);
}

// ── Version Control ───────────────────────────────────────────────────────────

export async function replaceDocument(documentId, { file, uploadedBy, description }) {
  const form = new FormData();
  form.append("file", file);
  form.append("uploaded_by", uploadedBy || "system");
  if (description) form.append("description", description);
  const res = await fetch(`${BASE}/documents/${documentId}/replace`, {
    method: "POST",
    body: form,
  });
  return handleResponse(res);
}

export async function getVersionHistory(documentId) {
  const res = await fetch(`${BASE}/documents/${documentId}/versions`);
  return handleResponse(res);
}

export async function openVersion(versionId, performedBy = "user") {
  const res = await fetch(
    `${BASE}/documents/versions/${versionId}/download-url?performed_by=${encodeURIComponent(performedBy)}`
  );
  const data = await handleResponse(res);
  window.open(data.url, "_blank");
}

// ── Audit Trail ───────────────────────────────────────────────────────────────

export async function getAuditTrail(documentId) {
  const res = await fetch(`${BASE}/documents/${documentId}/audit`);
  return handleResponse(res);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
