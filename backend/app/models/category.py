"""
分类模型
"""
from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class Category(Base):
    """分类表"""
    __tablename__ = "categories"

    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    color = Column(String(16), default="#ffd54f")

    user = relationship("User", back_populates="categories")
