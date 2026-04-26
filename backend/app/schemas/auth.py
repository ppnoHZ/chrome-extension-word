"""
认证相关 schema
"""
from typing import Optional
from pydantic import BaseModel

from app.schemas.user import UserInfo


class AuthVerifyResponse(BaseModel):
    """认证验证响应"""
    success: bool
    message: str = ""
    user: Optional[UserInfo] = None


class OAuthLoginRequest(BaseModel):
    """OAuth 登录请求"""
    redirect_uri: str


class OAuthLoginResponse(BaseModel):
    """OAuth 登录响应 - 返回授权 URL"""
    auth_url: str
    state: str


class OAuthCallbackRequest(BaseModel):
    """OAuth 回调请求"""
    code: str
    state: str
    redirect_uri: str


class OAuthCallbackResponse(BaseModel):
    """OAuth 回调响应 - 返回 JWT token 和用户信息"""
    success: bool
    message: str = ""
    token: Optional[str] = None
    user: Optional[UserInfo] = None


class TokenRefreshRequest(BaseModel):
    """Token 刷新请求"""
    token: str


class TokenResponse(BaseModel):
    """Token 响应"""
    success: bool
    token: Optional[str] = None
    message: str = ""
