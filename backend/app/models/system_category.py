"""
系统分类模型 (主数据)
"""
from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.orm import relationship, foreign
from sqlalchemy.sql import func

from app.database import Base
from app.models.base import SoftDeleteMixin


class SystemCategory(SoftDeleteMixin, Base):
    """系统分类表 (主数据，无 user_id)"""
    __tablename__ = "system_categories"

    id = Column(String(64), primary_key=True)
    name = Column(String(128), nullable=False, unique=True)  # 如 "GRE核心词汇"
    color = Column(String(16), default="#4caf50")
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    words = relationship(
        "SystemWord",
        back_populates="category",
        primaryjoin="SystemCategory.id == foreign(SystemWord.category_id)",
    )
