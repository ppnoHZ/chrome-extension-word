"""
系统分类和单词相关 schema
"""
from typing import Optional, List
from pydantic import BaseModel, Field


class SystemCategorySchema(BaseModel):
    """系统分类"""
    id: str
    name: str
    color: str = "#4caf50"
    description: Optional[str] = None

    class Config:
        from_attributes = True


class SystemCategoryCreate(BaseModel):
    """创建系统分类"""
    id: Optional[str] = None  # 可选，不提供则自动生成 UUID
    name: str
    color: str = "#4caf50"
    description: Optional[str] = None


class SystemWordSchema(BaseModel):
    """系统单词"""
    id: int
    text: str
    categoryId: str = Field(serialization_alias="categoryId", validation_alias="categoryId")
    phoneticUk: Optional[str] = Field(
        default=None,
        serialization_alias="phoneticUk",
        validation_alias="phoneticUk",
    )
    phoneticUs: Optional[str] = Field(
        default=None,
        serialization_alias="phoneticUs",
        validation_alias="phoneticUs",
    )
    definition: Optional[str] = None
    addedAt: int = Field(serialization_alias="addedAt", validation_alias="addedAt")

    class Config:
        from_attributes = True
        populate_by_name = True


class SystemWordCreate(BaseModel):
    """创建系统单词"""
    text: str
    categoryId: str = Field(validation_alias="categoryId")
    phoneticUk: Optional[str] = Field(default=None, validation_alias="phoneticUk")
    phoneticUs: Optional[str] = Field(default=None, validation_alias="phoneticUs")
    definition: Optional[str] = None

    class Config:
        populate_by_name = True


class SystemWordBatchCreate(BaseModel):
    """批量创建系统单词"""
    words: List[SystemWordCreate]


class SystemWordSearchResult(BaseModel):
    """系统单词搜索结果"""
    total: int
    items: List[SystemWordSchema]
