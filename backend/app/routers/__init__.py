"""
API 路由
"""
from app.routers.auth import router as auth_router
from app.routers.sync import router as sync_router

__all__ = ["auth_router", "sync_router"]
