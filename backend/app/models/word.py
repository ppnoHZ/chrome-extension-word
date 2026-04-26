"""
单词模型
"""
from sqlalchemy import Column, String, Integer, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.database import Base


class Word(Base):
    """单词表"""
    __tablename__ = "words"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(64), ForeignKey("users.id"), nullable=False, index=True)
    text = Column(String(256), nullable=False)
    category_id = Column(String(64), nullable=False)
    added_at = Column(Integer, nullable=False)  # 时间戳 (毫秒)

    user = relationship("User", back_populates="words")

    __table_args__ = (
        Index("ix_words_user_text", "user_id", "text"),
    )
