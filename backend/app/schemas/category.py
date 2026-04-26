"""
分类相关 schema
"""
from pydantic import BaseModel


class CategorySchema(BaseModel):
    """分类"""
    id: str
    name: str
    color: str = "#ffd54f"

    class Config:
        from_attributes = True
