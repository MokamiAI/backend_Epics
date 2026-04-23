const BASE = process.env.REACT_APP_API_URL || "http://localhost:8000/api";

async function handleResponse(res) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.blob();
}

// ── Company Settings ──────────────────────────────────────────────────────────

export async function getCompanySettings() {
  const res = await fetch(`${BASE}/settings/company`);
  return handleResponse(res);
}

export async function updateCompanySettings(payload, changedBy = "admin") {
  const res = await fetch(`${BASE}/settings/company?changed_by=${encodeURIComponent(changedBy)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function uploadLogo(file, changedBy = "admin") {
  const form = new FormData();
  form.append("file", file);
  form.append("changed_by", changedBy);
  const res = await fetch(`${BASE}/settings/company/logo`, { method: "POST", body: form });
  return handleResponse(res);
}

export async function deleteLogo(changedBy = "admin") {
  const res = await fetch(
    `${BASE}/settings/company/logo?changed_by=${encodeURIComponent(changedBy)}`,
    { method: "DELETE" }
  );
  return handleResponse(res);
}

export async function getCompanySettingsAudit() {
  const res = await fetch(`${BASE}/settings/company/audit`);
  return handleResponse(res);
}

// ── Business Rules ────────────────────────────────────────────────────────────

export async function getBusinessRules() {
  const res = await fetch(`${BASE}/settings/rules`);
  return handleResponse(res);
}

export async function updateBusinessRules(payload, changedBy = "admin", override = false) {
  const params = new URLSearchParams({ changed_by: changedBy, override: String(override) });
  const res = await fetch(`${BASE}/settings/rules?${params}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function getBusinessRulesAudit() {
  const res = await fetch(`${BASE}/settings/rules/audit`);
  return handleResponse(res);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const INTEREST_METHOD_LABELS = {
  reducing_balance: "Reducing Balance",
  flat_rate:        "Flat Rate",
  add_on:           "Add-on",
};

export const PAYMENT_PRIORITY_LABELS = {
  interest_first:  "Interest First",
  principal_first: "Principal First",
  proportional:    "Proportional",
};

export function formatZAR(value) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency", currency: "ZAR", minimumFractionDigits: 0,
  }).format(value);
}

export function fmtDate(d) {
  return d
    ? new Date(d).toLocaleDateString("en-ZA", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";
}
