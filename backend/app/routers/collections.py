"""
收藏路由
"""
import uuid
import time
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.dependencies import get_db
from app.models import User, Collection, Category, not_deleted
from app.routers.auth import get_current_user
from app.schemas.collection import CollectionSchema

router = APIRouter(prefix="/collections", tags=["收藏"])

# 默认分类名称
DEFAULT_CATEGORY_NAME = "General"
DEFAULT_CATEGORY_COLOR = "#9e9e9e"


class CollectionCreate(BaseModel):
    """创建收藏请求"""
    text: str
    sourceUrl: str = Field(alias="sourceUrl")
    sourceTitle: str = Field(alias="sourceTitle")
    context: Optional[str] = None
    domain: Optional[str] = None
    categoryId: Optional[str] = Field(default=None, alias="categoryId")

    class Config:
        populate_by_name = True


class CollectionResponse(BaseModel):
    """收藏响应"""
    success: bool
    id: Optional[str] = None
    message: Optional[str] = None


def get_or_create_default_category(db: Session, user_id: str) -> str:
    """获取或创建用户的默认 General 分类"""
    # 查找未删除的 General 分类
    general = not_deleted(
        db.query(Category).filter(
            Category.user_id == user_id,
            Category.name == DEFAULT_CATEGORY_NAME
        )
    ).first()
    
    if general:
        return general.id
    
    # 创建 General 分类
    category_id = str(uuid.uuid4())
    category = Category(
        id=category_id,
        user_id=user_id,
        name=DEFAULT_CATEGORY_NAME,
        color=DEFAULT_CATEGORY_COLOR,
    )
    db.add(category)
    db.flush()  # 确保 ID 可用但不提交事务
    return category_id


@router.post("", response_model=CollectionResponse)
async def create_collection(
    data: CollectionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    创建收藏
    
    如果未指定 categoryId，默认收藏到 General 分类下
    """
    # 确定分类 ID
    if data.categoryId:
        # 验证分类存在且属于该用户
        category = not_deleted(
            db.query(Category).filter(
                Category.id == data.categoryId,
                Category.user_id == user.id
            )
        ).first()
        if not category:
            raise HTTPException(status_code=400, detail=f"分类 '{data.categoryId}' 不存在")
        category_id = data.categoryId
    else:
        # 使用默认 General 分类
        category_id = get_or_create_default_category(db, user.id)
    
    # 创建收藏
    collection_id = str(uuid.uuid4())
    collection = Collection(
        id=collection_id,
        user_id=user.id,
        text=data.text,
        category_id=category_id,
        source_url=data.sourceUrl,
        source_title=data.sourceTitle,
        context=data.context,
        domain=data.domain,
        collected_at=int(time.time() * 1000),
    )
    db.add(collection)
    db.commit()
    
    return CollectionResponse(success=True, id=collection_id, message="收藏成功")


@router.get("", response_model=List[CollectionSchema])
async def get_collections(
    category_id: Optional[str] = Query(None, alias="categoryId", description="按分类筛选"),
    domain: Optional[str] = Query(None, description="按域名筛选"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=200, alias="pageSize", description="每页数量"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取用户的收藏列表 (只返回未删除的)"""
    query = not_deleted(
        db.query(Collection).filter(Collection.user_id == user.id)
    )
    
    if category_id:
        query = query.filter(Collection.category_id == category_id)
    
    if domain:
        query = query.filter(Collection.domain == domain)
    
    collections = (
        query
        .order_by(Collection.collected_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    
    return [
        CollectionSchema(
            id=c.id,
            text=c.text,
            categoryId=c.category_id,
            sourceUrl=c.source_url,
            sourceTitle=c.source_title,
            context=c.context,
            domain=c.domain,
            collectedAt=c.collected_at,
        )
        for c in collections
    ]


@router.delete("/{collection_id}", response_model=CollectionResponse)
async def delete_collection(
    collection_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """软删除收藏"""
    collection = not_deleted(
        db.query(Collection).filter(
            Collection.id == collection_id,
            Collection.user_id == user.id
        )
    ).first()
    
    if not collection:
        raise HTTPException(status_code=404, detail="收藏不存在")
    
    collection.soft_delete()
    db.commit()
    
    return CollectionResponse(success=True, message="删除成功")


class BatchCollectionItem(BaseModel):
    """批量创建收藏的单项"""
    id: str  # 客户端生成的 UUID
    text: str
    sourceUrl: str = Field(alias="sourceUrl")
    sourceTitle: str = Field(alias="sourceTitle")
    context: Optional[str] = None
    domain: Optional[str] = None
    categoryId: Optional[str] = Field(default=None, alias="categoryId")
    collectedAt: int = Field(alias="collectedAt")

    class Config:
        populate_by_name = True


class BatchCollectionCreate(BaseModel):
    """批量创建收藏请求"""
    items: List[BatchCollectionItem]


class BatchCollectionResponse(BaseModel):
    """批量创建收藏响应"""
    success: bool
    created: int = 0
    skipped: int = 0
    message: Optional[str] = None


@router.post("/batch", response_model=BatchCollectionResponse)
async def create_collections_batch(
    data: BatchCollectionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    批量创建收藏（用于登录后同步本地数据）
    
    - 使用客户端提供的 id 和 collectedAt
    - 如果 id 已存在（属于该用户且未删除）则跳过该条目
    - 如果未指定 categoryId，使用默认 General 分类
    """
    if not data.items:
        return BatchCollectionResponse(success=True, created=0, skipped=0, message="无数据")
    
    # 获取默认分类
    default_category_id = get_or_create_default_category(db, user.id)
    
    # 检查已存在的 collection ids（仅限当前用户且未删除的）
    item_ids = [item.id for item in data.items]
    existing_ids = set(
        row[0] for row in not_deleted(
            db.query(Collection.id).filter(
                Collection.user_id == user.id,
                Collection.id.in_(item_ids)
            )
        ).all()
    )
    
    # 预先批量查询用户的所有有效分类 ID，避免 N+1 查询
    requested_category_ids = set(item.categoryId for item in data.items if item.categoryId)
    valid_category_ids = set()
    if requested_category_ids:
        valid_category_ids = set(
            row[0] for row in not_deleted(
                db.query(Category.id).filter(
                    Category.user_id == user.id,
                    Category.id.in_(requested_category_ids)
                )
            ).all()
        )
    
    created = 0
    skipped = 0
    
    for item in data.items:
        if item.id in existing_ids:
            skipped += 1
            continue
        
        # 确定分类 ID（使用预查询的有效分类集合）
        category_id = item.categoryId if item.categoryId in valid_category_ids else default_category_id
        
        collection = Collection(
            id=item.id,
            user_id=user.id,
            text=item.text,
            category_id=category_id,
            source_url=item.sourceUrl,
            source_title=item.sourceTitle,
            context=item.context,
            domain=item.domain,
            collected_at=item.collectedAt,
        )
        db.add(collection)
        created += 1
    
    db.commit()
    
    return BatchCollectionResponse(
        success=True,
        created=created,
        skipped=skipped,
        message=f"成功同步 {created} 条收藏" + (f"，跳过 {skipped} 条重复" if skipped > 0 else "")
    )
