"""
API 路由
"""
from app.routers.auth import router as auth_router
from app.routers.sync import router as sync_router
from app.routers.system_words import router as system_words_router
from app.routers.words import router as words_router
from app.routers.ai import router as ai_router
from app.routers.collections import router as collections_router

__all__ = [
    "auth_router",
    "sync_router",
    "system_words_router",
    "words_router",
    "ai_router",
    "collections_router",
]
