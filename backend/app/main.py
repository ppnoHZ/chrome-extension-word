"""
Words 后端服务 - FastAPI 应用
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import auth_router, sync_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化数据库
    init_db()
    print("数据库初始化完成")
    yield
    # 关闭时的清理工作
    print("应用关闭")


def create_app() -> FastAPI:
    """应用工厂"""
    app = FastAPI(
        title=settings.app_name,
        description="Chrome 扩展 - 英语学习助手后端 API",
        version=settings.app_version,
        lifespan=lifespan,
    )

    # CORS 配置
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 注册路由
    app.include_router(auth_router, prefix=settings.api_prefix)
    app.include_router(sync_router, prefix=settings.api_prefix)

    # 根路由
    @app.get("/")
    async def root():
        """服务信息"""
        return {
            "service": settings.app_name,
            "version": settings.app_version,
            "status": "ok",
        }

    @app.get("/health")
    async def health():
        """健康检查"""
        return {"status": "healthy"}

    return app


app = create_app()
