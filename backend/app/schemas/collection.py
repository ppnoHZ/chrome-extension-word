"""
收藏相关 schema
"""
from typing import Optional
from pydantic import BaseModel, Field


class CollectionSchema(BaseModel):
    """收藏"""
    id: str
    text: str
    categoryId: Optional[str] = Field(
        default=None,
        serialization_alias="categoryId",
        validation_alias="categoryId",
    )
    sourceUrl: str = Field(serialization_alias="sourceUrl", validation_alias="sourceUrl")
    sourceTitle: str = Field(serialization_alias="sourceTitle", validation_alias="sourceTitle")
    context: Optional[str] = None
    collectedAt: int = Field(serialization_alias="collectedAt", validation_alias="collectedAt")

    class Config:
        from_attributes = True
        populate_by_name = True
