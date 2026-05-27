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
    AuthResponse,
    RegisterRequest,
    LoginRequest,
    OAuthLoginRequest,
    OAuthLoginResponse,
    OAuthCallbackRequest,
    OAuthCallbackResponse,
)
from app.schemas.system_word import (
    SystemCategorySchema,
    SystemCategoryCreate,
    SystemWordSchema,
    SystemWordCreate,
    SystemWordBatchCreate,
    SystemWordSearchResult,
)
from app.schemas.ai import (
    MeaningDetail,
    ExampleSentence,
    RootsAnalysis,
    AIAnalysisResult,
    AIAnalyzeRequest,
    AIAnalyzeResponse,
    AIConfigStatus,
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
    "AuthResponse",
    "RegisterRequest",
    "LoginRequest",
    "OAuthLoginRequest",
    "OAuthLoginResponse",
    "OAuthCallbackRequest",
    "OAuthCallbackResponse",
    # System words
    "SystemCategorySchema",
    "SystemCategoryCreate",
    "SystemWordSchema",
    "SystemWordCreate",
    "SystemWordBatchCreate",
    "SystemWordSearchResult",
    # AI analysis
    "MeaningDetail",
    "ExampleSentence",
    "RootsAnalysis",
    "AIAnalysisResult",
    "AIAnalyzeRequest",
    "AIAnalyzeResponse",
    "AIConfigStatus",
]
