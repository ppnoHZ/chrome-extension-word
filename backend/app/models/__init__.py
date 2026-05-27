"""
SQLAlchemy ORM 模型
"""
from app.models.base import SoftDeleteMixin, not_deleted, with_deleted, only_deleted
from app.models.user import User
from app.models.category import Category
from app.models.word import Word
from app.models.collection import Collection
from app.models.system_category import SystemCategory
from app.models.system_word import SystemWord
from app.models.ai_analysis import AIAnalysis, AnalysisType

__all__ = [
    "SoftDeleteMixin",
    "not_deleted",
    "with_deleted",
    "only_deleted",
    "User",
    "Category",
    "Word",
    "Collection",
    "SystemCategory",
    "SystemWord",
    "AIAnalysis",
    "AnalysisType",
]
