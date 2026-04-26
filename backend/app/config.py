"""
应用配置管理
使用 pydantic-settings 从环境变量加载配置
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置"""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )
    
    # 应用配置
    app_name: str = "Words Backend"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # MySQL 数据库配置
    mysql_host: str = "localhost"
    mysql_port: int = 3306
    mysql_user: str = "root"
    mysql_password: str = ""
    mysql_database: str = "words"
    
    @property
    def database_url(self) -> str:
        """构建数据库连接 URL"""
        return (
            f"mysql+pymysql://{self.mysql_user}:{self.mysql_password}"
            f"@{self.mysql_host}:{self.mysql_port}/{self.mysql_database}"
            f"?charset=utf8mb4"
        )
    
    # CORS 配置
    cors_origins: list[str] = ["*"]
    
    # API 配置
    api_prefix: str = "/api"
    
    # GitHub OAuth 配置
    github_client_id: str = ""
    github_client_secret: str = ""
    
    # JWT 配置
    jwt_secret_key: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 30


@lru_cache
def get_settings() -> Settings:
    """获取配置单例"""
    return Settings()


settings = get_settings()
