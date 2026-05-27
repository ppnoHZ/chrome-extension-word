"""
收藏模型
"""
from sqlalchemy import Column, String, BigInteger, Text, Index
from sqlalchemy.orm import relationship, foreign

from app.database import Base
from app.models.base import SoftDeleteMixin


class Collection(SoftDeleteMixin, Base):
    """收藏表"""
    __tablename__ = "collections"

    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), nullable=False, index=True)  # 关联 users.id
    text = Column(Text, nullable=False)
    category_id = Column(String(64), nullable=True)  # 关联 categories.id
    source_url = Column(Text, nullable=False)
    source_title = Column(String(512), nullable=False)
    context = Column(Text, nullable=True)
    domain = Column(String(256), nullable=True)  # 来源域名
    collected_at = Column(BigInteger, nullable=False)  # 时间戳 (毫秒)

    user = relationship(
        "User",
        back_populates="collections",
        primaryjoin="foreign(Collection.user_id) == User.id",
    )

    __table_args__ = (
        Index("ix_collections_domain", "user_id", "domain"),
    )
