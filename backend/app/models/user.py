"""
用户模型
"""
from datetime import datetime
from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    """用户表"""
    __tablename__ = "users"

    id = Column(String(64), primary_key=True)
    name = Column(String(128), nullable=True)
    email = Column(String(256), nullable=True, unique=True)
    avatar = Column(String(512), nullable=True)
    auth_provider = Column(String(32), default="github")  # github, custom
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关联
    categories = relationship("Category", back_populates="user", cascade="all, delete-orphan")
    words = relationship("Word", back_populates="user", cascade="all, delete-orphan")
    collections = relationship("Collection", back_populates="user", cascade="all, delete-orphan")
