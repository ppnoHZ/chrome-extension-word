"""
单词相关 schema
"""
from pydantic import BaseModel, Field


class WordSchema(BaseModel):
    """单词"""
    text: str
    categoryId: str = Field(serialization_alias="categoryId", validation_alias="categoryId")
    addedAt: int = Field(serialization_alias="addedAt", validation_alias="addedAt")

    class Config:
        from_attributes = True
        populate_by_name = True
