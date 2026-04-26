"""
认证服务
"""
from typing import Optional
from urllib.parse import urlencode
import httpx

from app.config import settings
from app.schemas.user import UserCreate


class AuthService:
    """认证相关业务逻辑"""

    # GitHub OAuth endpoints
    GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize"
    GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
    GITHUB_USER_URL = "https://api.github.com/user"

    @staticmethod
    def get_github_auth_url(redirect_uri: str, state: str) -> str:
        """
        生成 GitHub OAuth 授权 URL
        """
        params = {
            "client_id": settings.github_client_id,
            "redirect_uri": redirect_uri,
            "scope": "read:user user:email",
            "state": state,
        }
        return f"{AuthService.GITHUB_AUTH_URL}?{urlencode(params)}"

    @staticmethod
    async def exchange_github_code(code: str, redirect_uri: str) -> Optional[str]:
        """
        用授权码交换 access token
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    AuthService.GITHUB_TOKEN_URL,
                    data={
                        "client_id": settings.github_client_id,
                        "client_secret": settings.github_client_secret,
                        "code": code,
                        "redirect_uri": redirect_uri,
                    },
                    headers={"Accept": "application/json"},
                )
                if response.status_code == 200:
                    data = response.json()
                    return data.get("access_token")
            except Exception as e:
                print(f"GitHub code exchange failed: {e}")
        return None

    @staticmethod
    async def get_github_user(access_token: str) -> Optional[UserCreate]:
        """
        获取 GitHub 用户信息
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    AuthService.GITHUB_USER_URL,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Accept": "application/vnd.github.v3+json",
                    },
                )
                if response.status_code == 200:
                    data = response.json()
                    return UserCreate(
                        id=str(data.get("id")),
                        name=data.get("name") or data.get("login"),
                        email=data.get("email"),
                        avatar=data.get("avatar_url"),
                        provider="github",
                    )
            except Exception as e:
                print(f"GitHub user fetch failed: {e}")
        return None

    @staticmethod
    async def verify_github_token(token: str) -> Optional[UserCreate]:
        """
        验证 GitHub OAuth token 并获取用户信息
        """
        return await AuthService.get_github_user(token)

    @staticmethod
    async def verify_custom_token(
        token: str,
        user_info_endpoint: Optional[str] = None,
    ) -> Optional[UserCreate]:
        """
        验证自定义 OAuth token
        """
        if not user_info_endpoint:
            return None

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    user_info_endpoint,
                    headers={"Authorization": f"Bearer {token}"},
                )
                if response.status_code == 200:
                    data = response.json()
                    return UserCreate(
                        id=str(data.get("id") or data.get("sub")),
                        name=data.get("name"),
                        email=data.get("email"),
                        avatar=data.get("avatar") or data.get("picture"),
                        provider="custom",
                    )
            except Exception as e:
                print(f"Custom token verification failed: {e}")
        return None

    @staticmethod
    async def verify_token(
        token: str,
        provider: str = "github",
        user_info_endpoint: Optional[str] = None,
    ) -> Optional[UserCreate]:
        """
        根据提供商验证 token
        """
        if provider == "github":
            return await AuthService.verify_github_token(token)
        elif provider == "custom":
            return await AuthService.verify_custom_token(token, user_info_endpoint)
        return None
