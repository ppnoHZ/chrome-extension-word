"""
用户模型
"""
from datetime import datetime
from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship, foreign

from app.database import Base
from app.models.base import SoftDeleteMixin


class User(SoftDeleteMixin, Base):
    """用户表 - 支持多种认证方式"""
    __tablename__ = "users"

    id = Column(String(64), primary_key=True)
    username = Column(String(64), unique=True, nullable=True)  # 本地认证用户名
    password_hash = Column(String(256), nullable=True)  # 本地认证密码哈希
    name = Column(String(128), nullable=True)  # 显示名称
    email = Column(String(256), nullable=True, unique=True)
    avatar = Column(String(512), nullable=True)
    auth_provider = Column(String(32), default="local")  # local, github, custom
    github_id = Column(String(64), nullable=True, unique=True)  # GitHub 用户ID
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关联 (不使用 cascade="all, delete-orphan"，软删除由代码控制)
    categories = relationship(
        "Category",
        back_populates="user",
        primaryjoin="User.id == foreign(Category.user_id)",
    )
    words = relationship(
        "Word",
        back_populates="user",
        primaryjoin="User.id == foreign(Word.user_id)",
    )
    collections = relationship(
        "Collection",
        back_populates="user",
        primaryjoin="User.id == foreign(Collection.user_id)",
    )
