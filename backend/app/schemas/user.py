"""
用户相关 schema
"""
from typing import Optional
from pydantic import BaseModel


class UserInfo(BaseModel):
    """用户信息响应"""
    id: str
    name: Optional[str] = None
    email: Optional[str] = None
    avatar: Optional[str] = None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    """创建用户请求"""
    id: str
    name: Optional[str] = None
    email: Optional[str] = None
    avatar: Optional[str] = None
    provider: str = "github"
