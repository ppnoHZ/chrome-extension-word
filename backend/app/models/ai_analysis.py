"""
AI 分析缓存模型
"""
from sqlalchemy import Column, String, Integer, DateTime, Enum, JSON, Index
from sqlalchemy.sql import func
import enum

from app.database import Base


class AnalysisType(str, enum.Enum):
    """AI 分析类型"""
    MEANING = "meaning"      # 词义详解
    EXAMPLES = "examples"    # 例句生成
    ROOTS = "roots"          # 词根词缀分析
    SYNONYMS = "synonyms"    # 同义词/反义词
    MEMORY = "memory"        # 记忆技巧
    FULL = "full"            # 完整分析


class AIAnalysis(Base):
    """AI 分析缓存表"""
    __tablename__ = "ai_analyses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    word = Column(String(256), nullable=False, index=True)
    analysis_type = Column(
        Enum(AnalysisType),
        nullable=False
    )
    content = Column(JSON, nullable=False)  # 分析结果 JSON
    model = Column(String(64), nullable=True)  # AI 模型名称
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("ix_ai_word_type", "word", "analysis_type", unique=True),
    )
