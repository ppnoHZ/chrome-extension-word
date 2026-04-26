"""
Pydantic 数据模式 (DTOs)
"""
from app.schemas.user import UserInfo, UserCreate
from app.schemas.category import CategorySchema
from app.schemas.word import WordSchema
from app.schemas.collection import CollectionSchema
from app.schemas.sync import SyncData, SyncResponse
from app.schemas.auth import (
    AuthVerifyResponse,
    OAuthLoginRequest,
    OAuthLoginResponse,
    OAuthCallbackRequest,
    OAuthCallbackResponse,
)

__all__ = [
    "UserInfo",
    "UserCreate",
    "CategorySchema",
    "WordSchema",
    "CollectionSchema",
    "SyncData",
    "SyncResponse",
    "AuthVerifyResponse",
    "OAuthLoginRequest",
    "OAuthLoginResponse",
    "OAuthCallbackRequest",
    "OAuthCallbackResponse",
]
