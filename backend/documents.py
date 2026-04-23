"""
backend/documents.py — Re-export router from routers.documents.

The actual document router implementation is in backend/routers/documents.py.
This module re-exports it for convenience.
"""

from backend.routers.documents import router

__all__ = ["router"]
