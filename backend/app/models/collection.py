"""
收藏模型
"""
from sqlalchemy import Column, String, Integer, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class Collection(Base):
    """收藏表"""
    __tablename__ = "collections"

    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), ForeignKey("users.id"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    category_id = Column(String(64), nullable=True)
    source_url = Column(Text, nullable=False)
    source_title = Column(String(512), nullable=False)
    context = Column(Text, nullable=True)
    collected_at = Column(Integer, nullable=False)  # 时间戳 (毫秒)

    user = relationship("User", back_populates="collections")
