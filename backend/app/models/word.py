"""
单词模型
"""
from sqlalchemy import Column, String, Integer, BigInteger, Index
from sqlalchemy.orm import relationship, foreign

from app.database import Base
from app.models.base import SoftDeleteMixin


class Word(SoftDeleteMixin, Base):
    """单词表"""
    __tablename__ = "words"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(64), nullable=False, index=True)  # 关联 users.id
    text = Column(String(256), nullable=False)
    category_id = Column(String(64), nullable=False)  # 关联 categories.id
    domain = Column(String(256), nullable=True)  # 来源域名
    added_at = Column(BigInteger, nullable=False)  # 时间戳 (毫秒)

    user = relationship(
        "User",
        back_populates="words",
        primaryjoin="foreign(Word.user_id) == User.id",
    )

    __table_args__ = (
        Index("ix_words_user_text", "user_id", "text"),
        Index("ix_words_domain", "user_id", "domain"),
    )
