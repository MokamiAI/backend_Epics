"""
supabase_client.py — Supabase client singleton.

Replaces database.py entirely. No SQLAlchemy, no ORM.
All DB operations go through the Supabase Python SDK using
your project URL and anon key from .env.

Usage in routers:
    from supabase_client import get_supabase
    supabase = get_supabase()
    result = supabase.table("documents").select("*").execute()
"""

from functools import lru_cache
from supabase import create_client, Client
from backend.config import get_settings


@lru_cache()
def get_supabase() -> Client:
    """
    Returns a cached Supabase client instance.
    Called once per process — safe for FastAPI dependency injection.
    """
    cfg = get_settings()
    return create_client(cfg.supabase_url, cfg.supabase_anon_key)
