"""
分类模型
"""
from sqlalchemy import Column, String
from sqlalchemy.orm import relationship, foreign

from app.database import Base
from app.models.base import SoftDeleteMixin


class Category(SoftDeleteMixin, Base):
    """分类表"""
    __tablename__ = "categories"

    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), nullable=False, index=True)  # 关联 users.id
    name = Column(String(128), nullable=False)
    color = Column(String(16), default="#ffd54f")

    user = relationship(
        "User",
        back_populates="categories",
        primaryjoin="foreign(Category.user_id) == User.id",
    )
