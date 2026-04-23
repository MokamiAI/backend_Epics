"""
main.py — FastAPI application entry point.

No SQLAlchemy. No Base.metadata.create_all.
Tables are managed directly in Supabase — run supabase_schema.sql once.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import get_settings
from backend.supabase_client import get_supabase
from backend.routers import documents, settings

cfg = get_settings()

app = FastAPI(
    title="IDS Platform API",
    description="Intermediate Data System trading and Projects CC",
    version="2.0.0",
)

_origins = cfg.cors_origins_list
_wildcard = _origins == ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r".*" if _wildcard else None,
    allow_credentials=not _wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(settings.router,  prefix="/api/settings",  tags=["Settings"])


@app.get("/")
def root():
    return {"service": "IDS Platform API", "version": "2.0.0", "status": "running"}


@app.get("/health")
def health():
    from backend.s3_service import get_s3, BUCKET
    from botocore.exceptions import ClientError

    # ── S3 check ──────────────────────────────────────────────────────────
    try:
        get_s3().head_bucket(Bucket=BUCKET)
        s3_status = "ok"
    except ClientError:
        s3_status = "unreachable"

    # ── Supabase check ────────────────────────────────────────────────────
    try:
        get_supabase().table("documents").select("id").limit(1).execute()
        supabase_status = "ok"
    except Exception:
        supabase_status = "unreachable"

    return {
        "api": "ok",
        "supabase": supabase_status,
        "s3": s3_status,
        "bucket": BUCKET,
    }
