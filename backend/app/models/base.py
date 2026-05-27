"""
软删除基类和混入
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import Column, DateTime
from sqlalchemy.orm import Query


class SoftDeleteMixin:
    """软删除混入类"""
    deleted_at = Column(DateTime, nullable=True, default=None, index=True)

    def soft_delete(self) -> None:
        """标记为已删除"""
        self.deleted_at = datetime.utcnow()

    def restore(self) -> None:
        """恢复已删除的记录"""
        self.deleted_at = None

    @property
    def is_deleted(self) -> bool:
        """是否已删除"""
        return self.deleted_at is not None


def not_deleted(query: Query) -> Query:
    """
    过滤器: 只返回未删除的记录
    
    用法:
        query = not_deleted(db.query(Word).filter(...))
    """
    # 获取查询的模型类
    entity = query.column_descriptions[0]["entity"]
    if hasattr(entity, "deleted_at"):
        return query.filter(entity.deleted_at.is_(None))
    return query


def with_deleted(query: Query) -> Query:
    """
    标记: 包含已删除的记录 (默认行为，仅作语义标记)
    """
    return query


def only_deleted(query: Query) -> Query:
    """
    过滤器: 只返回已删除的记录
    """
    entity = query.column_descriptions[0]["entity"]
    if hasattr(entity, "deleted_at"):
        return query.filter(entity.deleted_at.isnot(None))
    return query
