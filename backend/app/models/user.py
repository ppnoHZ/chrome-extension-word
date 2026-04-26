"""
用户模型
"""
from datetime import datetime
from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
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

    # 关联
    categories = relationship("Category", back_populates="user", cascade="all, delete-orphan")
    words = relationship("Word", back_populates="user", cascade="all, delete-orphan")
    collections = relationship("Collection", back_populates="user", cascade="all, delete-orphan")
