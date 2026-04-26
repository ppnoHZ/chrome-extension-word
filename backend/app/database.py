"""
数据库连接和会话管理
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

# 创建数据库引擎
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_recycle=3600,
)

# 会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ORM 基类
Base = declarative_base()


def init_db() -> None:
    """初始化数据库，创建所有表"""
    from app.models import user, category, word, collection  # noqa: F401
    Base.metadata.create_all(bind=engine)
