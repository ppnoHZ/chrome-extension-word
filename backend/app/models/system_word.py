"""
系统单词模型 (主数据)
"""
from sqlalchemy import Column, String, Integer, BigInteger, Text, Index
from sqlalchemy.orm import relationship, foreign

from app.database import Base
from app.models.base import SoftDeleteMixin


class SystemWord(SoftDeleteMixin, Base):
    """系统单词表 (主数据，无 user_id)"""
    __tablename__ = "system_words"

    id = Column(Integer, primary_key=True, autoincrement=True)
    text = Column(String(256), nullable=False, index=True)
    category_id = Column(String(64), nullable=False)  # 关联 system_categories.id
    phonetic_uk = Column(String(128), nullable=True)  # 英式音标
    phonetic_us = Column(String(128), nullable=True)  # 美式音标
    definition = Column(Text, nullable=True)  # 基础释义
    added_at = Column(BigInteger, nullable=False)  # 时间戳 (毫秒)

    category = relationship(
        "SystemCategory",
        back_populates="words",
        primaryjoin="foreign(SystemWord.category_id) == SystemCategory.id",
    )

    __table_args__ = (
        Index("ix_system_words_category", "category_id"),
    )
