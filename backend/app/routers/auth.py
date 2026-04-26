"""
认证相关路由
"""
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.config import settings
from app.dependencies import get_db
from app.models import User
from app.schemas.auth import (
    AuthVerifyResponse,
    AuthResponse,
    RegisterRequest,
    LoginRequest,
    OAuthLoginRequest,
    OAuthLoginResponse,
    OAuthCallbackRequest,
    OAuthCallbackResponse,
)
from app.schemas.user import UserInfo
from app.services.auth import AuthService
from app.services.user import UserService
from app.utils.jwt import create_user_token, decode_access_token

router = APIRouter(prefix="/auth", tags=["认证"])

security = HTTPBearer(auto_error=False)

# 临时存储 state（生产环境应使用 Redis）
_oauth_states: dict[str, str] = {}


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    验证 JWT token 并返回当前用户
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = credentials.credentials
    
    # 解码 JWT token
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    # 获取用户
    user_service = UserService(db)
    user = user_service.get_by_id(user_id)
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user


async def get_current_user_oauth(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    x_auth_provider: str = Header(default="github", alias="X-Auth-Provider"),
    x_user_info_endpoint: Optional[str] = Header(default=None, alias="X-User-Info-Endpoint"),
    db: Session = Depends(get_db),
) -> User:
    """
    验证 OAuth access token 并返回当前用户（兼容旧方式）
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = credentials.credentials

    # 先尝试解析为 JWT
    payload = decode_access_token(token)
    if payload:
        user_id = payload.get("sub")
        if user_id:
            user_service = UserService(db)
            user = user_service.get_by_id(user_id)
            if user:
                return user

    # 如果不是 JWT，尝试用 OAuth token 验证
    user_data = await AuthService.verify_token(
        token=token,
        provider=x_auth_provider,
        user_info_endpoint=x_user_info_endpoint,
    )

    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_service = UserService(db)
    user = user_service.get_or_create(user_data)
    return user


# ============== 本地认证路由 ==============

@router.post("/register", response_model=AuthResponse)
async def register(
    request: RegisterRequest,
    db: Session = Depends(get_db),
):
    """
    用户注册
    
    使用用户名和密码注册本地账户
    """
    user_service = UserService(db)
    user, error = user_service.register(
        username=request.username,
        password=request.password,
        email=request.email,
        name=request.name,
    )
    
    if not user:
        return AuthResponse(success=False, message=error)
    
    # 生成 JWT token
    token = create_user_token(user.id, "local")
    
    return AuthResponse(
        success=True,
        message="注册成功",
        token=token,
        user=UserInfo.model_validate(user),
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    request: LoginRequest,
    db: Session = Depends(get_db),
):
    """
    用户登录
    
    使用用户名和密码登录
    """
    user_service = UserService(db)
    user, error = user_service.authenticate(
        username=request.username,
        password=request.password,
    )
    
    if not user:
        return AuthResponse(success=False, message=error)
    
    # 生成 JWT token
    token = create_user_token(user.id, user.auth_provider or "local")
    
    return AuthResponse(
        success=True,
        message="登录成功",
        token=token,
        user=UserInfo.model_validate(user),
    )


# ============== GitHub OAuth 路由 ==============

@router.post("/github/login", response_model=OAuthLoginResponse)
async def github_login(request: OAuthLoginRequest):
    """
    获取 GitHub OAuth 授权 URL
    
    前端获取此 URL 后，引导用户跳转进行授权
    """
    state = secrets.token_urlsafe(32)
    _oauth_states[state] = request.redirect_uri
    
    auth_url = AuthService.get_github_auth_url(
        redirect_uri=request.redirect_uri,
        state=state,
    )
    
    return OAuthLoginResponse(auth_url=auth_url, state=state)


@router.post("/github/callback", response_model=OAuthCallbackResponse)
async def github_callback(
    request: OAuthCallbackRequest,
    db: Session = Depends(get_db),
):
    """
    处理 GitHub OAuth 回调
    
    前端将授权码发送到此端点，后端换取 token 并返回 JWT
    """
    # 验证 state
    expected_redirect = _oauth_states.pop(request.state, None)
    if not expected_redirect:
        return OAuthCallbackResponse(
            success=False,
            message="Invalid or expired state",
        )
    
    # 用授权码换取 access token
    access_token = await AuthService.exchange_github_code(
        code=request.code,
        redirect_uri=request.redirect_uri,
    )
    
    if not access_token:
        return OAuthCallbackResponse(
            success=False,
            message="Failed to exchange authorization code",
        )
    
    # 获取用户信息
    user_data = await AuthService.get_github_user(access_token)
    if not user_data:
        return OAuthCallbackResponse(
            success=False,
            message="Failed to get user information",
        )
    
    # 创建或更新用户
    user_service = UserService(db)
    user = user_service.get_or_create(user_data)
    
    # 生成 JWT token
    jwt_token = create_user_token(user.id, "github")
    
    return OAuthCallbackResponse(
        success=True,
        message="登录成功",
        token=jwt_token,
        user=UserInfo.model_validate(user),
    )


# ============== 认证提供者配置 ==============

@router.get("/providers")
async def get_auth_providers():
    """
    获取可用的认证方式列表
    
    前端根据此列表动态显示登录按钮
    """
    providers = []
    
    # GitHub OAuth
    if AuthService.is_github_configured():
        providers.append({
            "id": "github",
            "name": "GitHub",
            "icon": "🐙",
        })
    
    # 自定义 OAuth2
    if AuthService.is_custom_oauth_configured():
        providers.append({
            "id": "custom",
            "name": settings.oauth_name,
            "icon": "🔐",
        })
    
    return {"providers": providers}


# ============== 自定义 OAuth2 路由 ==============

@router.get("/oauth2/config")
async def get_oauth2_config():
    """
    获取自定义 OAuth2 配置信息
    
    前端用于判断是否启用自定义 OAuth2 登录
    """
    return {
        "enabled": AuthService.is_custom_oauth_configured(),
        "name": settings.oauth_name,
    }


@router.post("/oauth2/login", response_model=OAuthLoginResponse)
async def oauth2_login(request: OAuthLoginRequest):
    """
    获取自定义 OAuth2 授权 URL
    
    前端获取此 URL 后，引导用户跳转进行授权
    """
    if not AuthService.is_custom_oauth_configured():
        raise HTTPException(status_code=400, detail="Custom OAuth2 not configured")
    
    state = secrets.token_urlsafe(32)
    _oauth_states[state] = request.redirect_uri
    
    auth_url = AuthService.get_custom_oauth_auth_url(
        redirect_uri=request.redirect_uri,
        state=state,
    )
    
    return OAuthLoginResponse(auth_url=auth_url, state=state)


@router.post("/oauth2/callback", response_model=OAuthCallbackResponse)
async def oauth2_callback(
    request: OAuthCallbackRequest,
    db: Session = Depends(get_db),
):
    """
    处理自定义 OAuth2 回调
    
    前端将授权码发送到此端点，后端换取 token 并返回 JWT
    """
    # 验证 state
    expected_redirect = _oauth_states.pop(request.state, None)
    if not expected_redirect:
        return OAuthCallbackResponse(
            success=False,
            message="Invalid or expired state",
        )
    
    # 用授权码换取 access token
    access_token = await AuthService.exchange_custom_oauth_code(
        code=request.code,
        redirect_uri=request.redirect_uri,
    )
    
    if not access_token:
        return OAuthCallbackResponse(
            success=False,
            message="Failed to exchange authorization code",
        )
    
    # 获取用户信息
    user_data = await AuthService.get_custom_oauth_user(access_token)
    if not user_data:
        return OAuthCallbackResponse(
            success=False,
            message="Failed to get user information",
        )
    
    # 创建或更新用户
    user_service = UserService(db)
    user = user_service.get_or_create(user_data)
    
    # 生成 JWT token
    jwt_token = create_user_token(user.id, "custom")
    
    return OAuthCallbackResponse(
        success=True,
        message="登录成功",
        token=jwt_token,
        user=UserInfo.model_validate(user),
    )


# ============== 通用认证路由 ==============

@router.post("/verify", response_model=AuthVerifyResponse)
async def verify_token(user: User = Depends(get_current_user_oauth)):
    """
    验证 token 并返回用户信息
    
    支持 JWT token 和 OAuth access token
    """
    return AuthVerifyResponse(
        success=True,
        message="验证成功",
        user=UserInfo.model_validate(user),
    )


@router.get("/me", response_model=UserInfo)
async def get_me(user: User = Depends(get_current_user)):
    """
    获取当前登录用户信息
    """
    return UserInfo.model_validate(user)
