"""
routers/settings.py — Company settings and business rules.

All database operations use the Supabase Python SDK.
Logo files are stored in AWS S3.
Both tables are single-row (id = 1); rows are seeded by supabase_schema.sql.
"""

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from backend.supabase_client import get_supabase
from backend.schemas import (
    LOGO_ALLOWED_MIME_TYPES, LOGO_MAX_SIZE_BYTES,
    BusinessRulesAuditOut, BusinessRulesOut, BusinessRulesUpdate,
    CompanySettingsAuditOut, CompanySettingsOut, CompanySettingsUpdate,
    LoanValidationRequest, LoanValidationResult,
)
from backend.s3_service import delete_file, get_presigned_view_url, upload_file

router   = APIRouter()
LOGO_KEY = "system/logo/company_logo"

SETTINGS_FIELDS = [
    "company_name", "registration_number", "physical_address",
    "contact_phone", "contact_email", "email_signature",
    "default_currency", "fiscal_year_start_month",
]

RULES_FIELDS = [
    "min_loan_amount", "max_loan_amount", "min_loan_term_months",
    "max_loan_term_months", "max_concurrent_loans_per_client",
    "min_credit_score_auto_approve", "days_to_default",
    "interest_calculation_method", "payment_allocation_priority",
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_settings_row() -> dict:
    """
    Fetch the single company_settings row (id=1).
    The row is guaranteed to exist — seeded by supabase_schema.sql.
    """
    res = get_supabase().table("company_settings").select("*").eq("id", 1).maybe_single().execute()
    if not res.data:
        raise HTTPException(500, "Company settings row missing. Re-run supabase_schema.sql.")
    return res.data


def _get_rules_row() -> dict:
    """
    Fetch the single business_rules row (id=1).
    The row is guaranteed to exist — seeded by supabase_schema.sql.
    """
    res = get_supabase().table("business_rules").select("*").eq("id", 1).maybe_single().execute()
    if not res.data:
        raise HTTPException(500, "Business rules row missing. Re-run supabase_schema.sql.")
    return res.data


def _audit_settings(old: dict, new_vals: dict, changed_by: str):
    """Insert one audit row per changed field into company_settings_audit."""
    rows = []
    for field, new_val in new_vals.items():
        if str(old.get(field)) != str(new_val):
            rows.append({
                "settings_id": 1,
                "field_name":  field,
                "old_value":   str(old[field]) if old.get(field) is not None else None,
                "new_value":   str(new_val)    if new_val       is not None else None,
                "changed_by":  changed_by,
                "changed_at":  now_iso(),
            })
    if rows:
        get_supabase().table("company_settings_audit").insert(rows).execute()


def _audit_rules(old: dict, new_vals: dict, changed_by: str):
    """Insert one audit row per changed field into business_rules_audit."""
    rows = []
    for field, new_val in new_vals.items():
        if str(old.get(field)) != str(new_val):
            rows.append({
                "rules_id":   1,
                "field_name": field,
                "old_value":  str(old[field]) if old.get(field) is not None else None,
                "new_value":  str(new_val)    if new_val       is not None else None,
                "changed_by": changed_by,
                "changed_at": now_iso(),
            })
    if rows:
        get_supabase().table("business_rules_audit").insert(rows).execute()


# ── Company Settings ──────────────────────────────────────────────────────────

@router.get("/company", response_model=CompanySettingsOut)
def get_company_settings():
    """Return current company settings. Refreshes the logo URL if a logo is stored."""
    row = _get_settings_row()

    if row.get("logo_s3_key"):
        try:
            row["logo_url"] = get_presigned_view_url(row["logo_s3_key"], "image/png", expiry=3600)
        except Exception:
            row["logo_url"] = None

    return row


@router.patch("/company", response_model=CompanySettingsOut)
def update_company_settings(
    payload:    CompanySettingsUpdate,
    changed_by: str = Query(default="admin"),
):
    """Partially update company settings. Every changed field is logged."""
    old = _get_settings_row()

    updates = payload.model_dump(exclude_none=True)
    if not updates:
        return old

    updates["updated_by"] = changed_by
    updates["updated_at"] = now_iso()

    _audit_settings(old, {k: v for k, v in updates.items() if k in SETTINGS_FIELDS}, changed_by)

    res = get_supabase().table("company_settings").update(updates).eq("id", 1).execute()
    return res.data[0]


@router.post("/company/logo", response_model=CompanySettingsOut)
async def upload_logo(
    changed_by: str        = Form(default="admin"),
    file:       UploadFile = File(...),
):
    """Upload or replace the company logo. PNG or JPG, max 2 MB."""
    if file.content_type not in LOGO_ALLOWED_MIME_TYPES:
        raise HTTPException(400, "Logo must be PNG or JPG.")

    content = await file.read()
    if len(content) > LOGO_MAX_SIZE_BYTES:
        raise HTTPException(400, f"Logo exceeds 2 MB ({len(content)/1024/1024:.1f} MB).")

    ext     = "png" if file.content_type == "image/png" else "jpg"
    s3_key  = f"{LOGO_KEY}.{ext}"
    old_row = _get_settings_row()
    old_key = old_row.get("logo_s3_key")

    upload_file(content, s3_key, file.content_type)

    if old_key and old_key != s3_key:
        delete_file(old_key)

    logo_url = get_presigned_view_url(s3_key, file.content_type, expiry=3600)

    _audit_settings(old_row, {"logo_s3_key": s3_key}, changed_by)

    updates = {
        "logo_s3_key": s3_key,
        "logo_url":    logo_url,
        "updated_by":  changed_by,
        "updated_at":  now_iso(),
    }
    res = get_supabase().table("company_settings").update(updates).eq("id", 1).execute()
    row = res.data[0]
    row["logo_url"] = logo_url          # return the fresh presigned URL
    return row


@router.delete("/company/logo", response_model=CompanySettingsOut)
def delete_logo(changed_by: str = Query(default="admin")):
    """Remove the company logo from S3 and clear the stored key."""
    old_row = _get_settings_row()
    if not old_row.get("logo_s3_key"):
        raise HTTPException(404, "No logo is set.")

    delete_file(old_row["logo_s3_key"])
    _audit_settings(old_row, {"logo_s3_key": None}, changed_by)

    updates = {
        "logo_s3_key": None,
        "logo_url":    None,
        "updated_by":  changed_by,
        "updated_at":  now_iso(),
    }
    res = get_supabase().table("company_settings").update(updates).eq("id", 1).execute()
    return res.data[0]


@router.get("/company/audit", response_model=List[CompanySettingsAuditOut])
def company_audit(limit: int = Query(default=50, le=200)):
    """Audit trail for company settings changes."""
    res = (
        get_supabase().table("company_settings_audit")
        .select("*")
        .eq("settings_id", 1)
        .order("changed_at", desc=True)
        .limit(limit)
        .execute()
    )
    return res.data or []


# ── Business Rules ────────────────────────────────────────────────────────────

@router.get("/rules", response_model=BusinessRulesOut)
def get_rules():
    """Return current business rules."""
    return _get_rules_row()


@router.patch("/rules", response_model=BusinessRulesOut)
def update_rules(
    payload:    BusinessRulesUpdate,
    changed_by: str  = Query(default="admin"),
    override:   bool = Query(default=False),
):
    """
    Partially update business rules. All changes are logged field-by-field.
    Set override=true and supply override_reason to record a written justification.
    """
    if override and not payload.override_reason:
        raise HTTPException(400, "override_reason is required when override=true.")

    old = _get_rules_row()

    updates = payload.model_dump(exclude_none=True, exclude={"override_reason"})
    if not updates:
        return old

    updates["updated_by"] = changed_by
    updates["updated_at"] = now_iso()

    effective_by = (
        f"{changed_by} [override: {payload.override_reason}]" if override else changed_by
    )
    _audit_rules(old, {k: v for k, v in updates.items() if k in RULES_FIELDS}, effective_by)

    res = get_supabase().table("business_rules").update(updates).eq("id", 1).execute()
    return res.data[0]


@router.post("/rules/validate-loan", response_model=LoanValidationResult)
def validate_loan(payload: LoanValidationRequest):
    """Validate a proposed loan against current business rules."""
    rules      = _get_rules_row()
    violations = []

    if float(payload.amount) < float(rules["min_loan_amount"]):
        violations.append(f"Amount {payload.amount} is below the minimum of {rules['min_loan_amount']}.")
    if float(payload.amount) > float(rules["max_loan_amount"]):
        violations.append(f"Amount {payload.amount} exceeds the maximum of {rules['max_loan_amount']}.")
    if payload.term_months < rules["min_loan_term_months"]:
        violations.append(f"Term {payload.term_months}m is below the minimum of {rules['min_loan_term_months']}m.")
    if payload.term_months > rules["max_loan_term_months"]:
        violations.append(f"Term {payload.term_months}m exceeds the maximum of {rules['max_loan_term_months']}m.")
    if payload.credit_score is not None and payload.credit_score < rules["min_credit_score_auto_approve"]:
        violations.append(
            f"Credit score {payload.credit_score} is below the auto-approve "
            f"threshold of {rules['min_credit_score_auto_approve']}."
        )

    return LoanValidationResult(valid=len(violations) == 0, violations=violations, overridable=True)


@router.get("/rules/audit", response_model=List[BusinessRulesAuditOut])
def rules_audit(limit: int = Query(default=50, le=200)):
    """Audit trail for all business rule changes."""
    res = (
        get_supabase().table("business_rules_audit")
        .select("*")
        .eq("rules_id", 1)
        .order("changed_at", desc=True)
        .limit(limit)
        .execute()
    )
    return res.data or []
