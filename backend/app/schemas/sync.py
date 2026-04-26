"""
同步相关 schema
"""
from typing import Optional
from pydantic import BaseModel

from app.schemas.category import CategorySchema
from app.schemas.word import WordSchema
from app.schemas.collection import CollectionSchema


class SyncData(BaseModel):
    """同步数据"""
    categories: list[CategorySchema] = []
    words: list[WordSchema] = []
    collections: list[CollectionSchema] = []


class SyncResponse(BaseModel):
    """同步响应"""
    success: bool
    message: str = ""
    data: Optional[SyncData] = None
