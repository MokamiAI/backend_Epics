"""
routers/documents.py — Document upload, retrieval, versioning, and audit.

All database operations use the Supabase Python SDK.
Files are stored in AWS S3; this router stores/reads metadata in Supabase.
"""

import io
import json
import zipfile
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import StreamingResponse

from ..supabase_client import get_supabase
from ..schemas import (
    ALLOWED_DOCUMENT_TYPES, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES,
    BatchUploadResponse, DocumentAuditLogOut, DocumentListOut, DocumentOut,
    DocumentVersionOut, UploadResult,
)
from ..s3_service import (
    build_active_key, build_archive_key, copy_file,
    download_file_bytes, get_presigned_download_url, get_presigned_view_url, upload_file,
)
from ..config import get_settings

router = APIRouter()
cfg    = get_settings()

VIEWABLE = {"application/pdf", "image/jpeg", "image/png"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def now_iso() -> str:
    """UTC timestamp as ISO-8601 string — Supabase accepts this for timestamptz columns."""
    return datetime.now(timezone.utc).isoformat()


def build_stored_filename(client_number: str, doc_type: str, original: str) -> str:
    date = datetime.now(timezone.utc).strftime("%Y%m%d")
    safe = lambda s: s.replace(" ", "_")
    return f"{safe(client_number)}_{safe(doc_type)}_{date}_{original}"


def log_action(action: str, performed_by: str, doc_id=None, details=None, ip=None):
    """Insert a row into document_audit_logs."""
    get_supabase().table("document_audit_logs").insert({
        "document_id":  doc_id,
        "action":       action,
        "performed_by": performed_by,
        "performed_at": now_iso(),
        "details":      json.dumps(details) if details else None,
        "ip_address":   ip,
    }).execute()


def validate_file(file: UploadFile, content: bytes) -> Optional[str]:
    if file.content_type not in ALLOWED_MIME_TYPES:
        return f'"{file.filename}" — unsupported format. Allowed: PDF, JPG, PNG, DOCX, XLSX.'
    if len(content) > MAX_FILE_SIZE_BYTES:
        return f'"{file.filename}" — exceeds 10 MB ({len(content)/1024/1024:.1f} MB).'
    return None


def ip_of(req: Request) -> Optional[str]:
    return req.client.host if req.client else None


def _doc_not_found():
    raise HTTPException(404, "Document not found.")


def _get_document_row(document_id: int) -> dict:
    """Fetch a single document row or raise 404."""
    res = get_supabase().table("documents").select("*").eq("id", document_id).maybe_single().execute()
    if not res.data:
        _doc_not_found()
    return res.data


# ── Upload ────────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=BatchUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_documents(
    request:       Request,
    client_number: str              = Form(...),
    document_type: str              = Form(...),
    description:   Optional[str]    = Form(None),
    document_date: Optional[str]    = Form(None),
    uploaded_by:   str              = Form(default="system"),
    files:         List[UploadFile] = File(...),
):
    """Upload one or more documents for a client. Validates, renames, stores in S3, records metadata in Supabase."""
    if document_type not in ALLOWED_DOCUMENT_TYPES:
        raise HTTPException(400, f"Invalid document type. Allowed: {ALLOWED_DOCUMENT_TYPES}")

    doc_date = now_iso()
    if document_date:
        try:
            doc_date = datetime.strptime(document_date, "%Y-%m-%d").replace(
                tzinfo=timezone.utc
            ).isoformat()
        except ValueError:
            pass

    results: List[UploadResult] = []

    for file in files:
        content = await file.read()
        err = validate_file(file, content)
        if err:
            results.append(UploadResult(filename=file.filename, success=False, error=err))
            continue

        stored = build_stored_filename(client_number, document_type, file.filename)
        s3_key = build_active_key(client_number, stored)

        try:
            upload_file(content, s3_key, file.content_type)
        except HTTPException as e:
            results.append(UploadResult(filename=file.filename, success=False, error=e.detail))
            continue

        row = {
            "client_number":     client_number,
            "document_type":     document_type,
            "description":       description,
            "original_filename": file.filename,
            "stored_filename":   stored,
            "s3_key":            s3_key,
            "file_size":         len(content),
            "mime_type":         file.content_type,
            "document_date":     doc_date,
            "uploaded_by":       uploaded_by,
            "uploaded_at":       now_iso(),
            "version_number":    1,
            "is_active":         True,
        }

        insert_res = get_supabase().table("documents").insert(row).execute()
        doc = insert_res.data[0]

        log_action("UPLOAD", uploaded_by, doc["id"],
                   {"filename": file.filename, "size": len(content)}, ip_of(request))
        results.append(UploadResult(filename=file.filename, success=True, document_id=doc["id"]))

    succeeded = sum(1 for r in results if r.success)
    return BatchUploadResponse(
        total=len(results), succeeded=succeeded,
        failed=len(results) - succeeded, results=results,
    )


# ── List & Retrieve ───────────────────────────────────────────────────────────

@router.get("/", response_model=List[DocumentListOut])
def list_documents(
    client_number: Optional[str] = Query(None),
    document_type: Optional[str] = Query(None),
    search:        Optional[str] = Query(None),
):
    """List active documents with optional filters."""
    q = get_supabase().table("documents").select(
        "id, client_number, document_type, description, original_filename, "
        "stored_filename, file_size, mime_type, document_date, uploaded_by, "
        "uploaded_at, version_number"
    ).eq("is_active", True)

    if client_number:
        q = q.eq("client_number", client_number)
    if document_type:
        q = q.eq("document_type", document_type)
    if search:
        q = q.ilike("description", f"%{search}%")

    res = q.order("uploaded_at", desc=True).execute()
    return res.data


@router.get("/meta/document-types")
def document_types():
    return {"document_types": ALLOWED_DOCUMENT_TYPES}


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(document_id: int):
    """Get a single document with its full version history."""
    doc = _get_document_row(document_id)

    versions_res = (
        get_supabase().table("document_versions")
        .select("*")
        .eq("document_id", document_id)
        .order("version_number", desc=True)
        .execute()
    )
    doc["versions"] = versions_res.data or []
    return doc


# ── Download & View ───────────────────────────────────────────────────────────

@router.get("/{document_id}/download-url")
def get_download_url(
    request:      Request,
    document_id:  int,
    performed_by: str  = Query(default="system"),
    inline:       bool = Query(default=False),
):
    """Return a pre-signed S3 URL. inline=true opens PDFs/images in the browser."""
    doc = _get_document_row(document_id)

    if inline and doc["mime_type"] in VIEWABLE:
        url    = get_presigned_view_url(doc["s3_key"], doc["mime_type"])
        action = "VIEW"
    else:
        url    = get_presigned_download_url(doc["s3_key"], doc["original_filename"])
        action = "DOWNLOAD"

    log_action(action, performed_by, doc["id"],
               {"filename": doc["original_filename"]}, ip_of(request))
    return {"url": url, "expires_in": cfg.s3_signed_url_expiry, "filename": doc["original_filename"]}


@router.post("/batch-download")
def batch_download(
    request:      Request,
    document_ids: List[int],
    performed_by: str = Query(default="system"),
):
    """Download multiple documents as a server-side ZIP stream."""
    buf   = io.BytesIO()
    added = 0

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for doc_id in document_ids:
            res = get_supabase().table("documents").select("*").eq("id", doc_id).maybe_single().execute()
            if not res.data:
                continue
            doc = res.data
            try:
                zf.writestr(doc["stored_filename"], download_file_bytes(doc["s3_key"]))
                log_action("BATCH_DOWNLOAD", performed_by, doc["id"], {"batch": True}, ip_of(request))
                added += 1
            except HTTPException:
                continue

    if added == 0:
        raise HTTPException(404, "None of the requested documents could be found.")

    buf.seek(0)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return StreamingResponse(
        buf, media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=documents_{ts}.zip"},
    )


# ── Version Control ───────────────────────────────────────────────────────────

@router.post("/{document_id}/replace", response_model=DocumentOut)
async def replace_document(
    request:     Request,
    document_id: int,
    uploaded_by: str           = Form(default="system"),
    description: Optional[str] = Form(None),
    file:        UploadFile    = File(...),
):
    """
    Replace a document with a new file.
    The current S3 file is archived; the old metadata row is recorded in
    document_versions. Old versions are never deleted.
    """
    res = (
        get_supabase().table("documents")
        .select("*")
        .eq("id", document_id)
        .eq("is_active", True)
        .maybe_single()
        .execute()
    )
    if not res.data:
        _doc_not_found()
    doc = res.data

    content = await file.read()
    err = validate_file(file, content)
    if err:
        raise HTTPException(400, err)

    # Archive current S3 file
    archive_key = build_archive_key(doc["client_number"], doc["version_number"], doc["stored_filename"])
    copy_file(doc["s3_key"], archive_key)

    # Record current version in document_versions
    get_supabase().table("document_versions").insert({
        "document_id":       doc["id"],
        "version_number":    doc["version_number"],
        "original_filename": doc["original_filename"],
        "stored_filename":   doc["stored_filename"],
        "s3_key":            archive_key,
        "file_size":         doc["file_size"],
        "mime_type":         doc["mime_type"],
        "uploaded_by":       doc["uploaded_by"],
        "uploaded_at":       doc["uploaded_at"],
        "archived_at":       now_iso(),
    }).execute()

    # Upload new file
    new_stored = build_stored_filename(doc["client_number"], doc["document_type"], file.filename)
    new_key    = build_active_key(doc["client_number"], new_stored)
    upload_file(content, new_key, file.content_type)

    # Update the document row
    updates = {
        "original_filename": file.filename,
        "stored_filename":   new_stored,
        "s3_key":            new_key,
        "file_size":         len(content),
        "mime_type":         file.content_type,
        "uploaded_by":       uploaded_by,
        "uploaded_at":       now_iso(),
        "version_number":    doc["version_number"] + 1,
    }
    if description is not None:
        updates["description"] = description

    updated = (
        get_supabase().table("documents")
        .update(updates)
        .eq("id", document_id)
        .execute()
    )
    updated_doc = updated.data[0]

    # Attach versions for response schema
    versions_res = (
        get_supabase().table("document_versions")
        .select("*")
        .eq("document_id", document_id)
        .order("version_number", desc=True)
        .execute()
    )
    updated_doc["versions"] = versions_res.data or []

    log_action("REPLACE", uploaded_by, document_id,
               {"new_version": updated_doc["version_number"]}, ip_of(request))
    return updated_doc


@router.get("/{document_id}/versions")
def get_version_history(document_id: int):
    """Full version history for a document."""
    doc = _get_document_row(document_id)

    versions_res = (
        get_supabase().table("document_versions")
        .select("*")
        .eq("document_id", document_id)
        .order("version_number", desc=True)
        .execute()
    )

    return {
        "current": {
            "version_number":    doc["version_number"],
            "original_filename": doc["original_filename"],
            "stored_filename":   doc["stored_filename"],
            "s3_key":            doc["s3_key"],
            "file_size":         doc["file_size"],
            "uploaded_by":       doc["uploaded_by"],
            "uploaded_at":       doc["uploaded_at"],
            "is_current":        True,
        },
        "history": [
            {
                "id":                v["id"],
                "version_number":    v["version_number"],
                "original_filename": v["original_filename"],
                "stored_filename":   v["stored_filename"],
                "s3_key":            v["s3_key"],
                "file_size":         v["file_size"],
                "uploaded_by":       v["uploaded_by"],
                "uploaded_at":       v["uploaded_at"],
                "is_current":        False,
            }
            for v in (versions_res.data or [])
        ],
    }


@router.get("/versions/{version_id}/download-url")
def get_version_download_url(
    request:     Request,
    version_id:  int,
    performed_by: str = Query(default="system"),
):
    """Pre-signed URL for a specific archived version."""
    res = get_supabase().table("document_versions").select("*").eq("id", version_id).maybe_single().execute()
    if not res.data:
        raise HTTPException(404, "Version not found.")
    ver = res.data
    url = get_presigned_download_url(ver["s3_key"], f"v{ver['version_number']}_{ver['original_filename']}")
    log_action("DOWNLOAD_VERSION", performed_by, ver["document_id"],
               {"version": ver["version_number"]}, ip_of(request))
    return {"url": url, "expires_in": cfg.s3_signed_url_expiry, "version": ver["version_number"], "filename": ver["original_filename"]}


@router.get("/{document_id}/audit", response_model=List[DocumentAuditLogOut])
def get_document_audit(document_id: int):
    """Audit trail for a document."""
    res = (
        get_supabase().table("document_audit_logs")
        .select("*")
        .eq("document_id", document_id)
        .order("performed_at", desc=True)
        .execute()
    )
    return res.data
