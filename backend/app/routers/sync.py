"""
数据同步路由
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.models import User
from app.routers.auth import get_current_user
from app.schemas.sync import SyncData, SyncResponse
from app.services.sync import SyncService

router = APIRouter(prefix="/sync", tags=["同步"])


@router.post("", response_model=SyncResponse)
async def sync_upload(
    data: SyncData,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    同步用户数据到后端（全量覆盖）

    请求体：
    - categories: 分类列表
    - words: 单词列表
    - collections: 收藏列表
    """
    sync_service = SyncService(db)
    success, message = sync_service.upload(user, data)
    return SyncResponse(success=success, message=message)


@router.get("", response_model=SyncResponse)
async def sync_download(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    获取用户已同步的数据（用于恢复/导入）
    """
    sync_service = SyncService(db)
    data = sync_service.download(user)
    return SyncResponse(success=True, message="获取成功", data=data)
