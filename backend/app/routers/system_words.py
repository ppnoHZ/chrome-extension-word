"""
系统词库路由
"""
import uuid
import time
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.models import SystemCategory, SystemWord, not_deleted
from app.schemas.system_word import (
    SystemCategorySchema,
    SystemCategoryCreate,
    SystemWordSchema,
    SystemWordCreate,
    SystemWordBatchCreate,
    SystemWordSearchResult,
)

router = APIRouter(prefix="/system", tags=["系统词库"])


# ============================================
# 系统分类 API
# ============================================

@router.get("/categories", response_model=List[SystemCategorySchema])
async def get_system_categories(db: Session = Depends(get_db)):
    """获取所有系统分类 (未删除的)"""
    categories = not_deleted(db.query(SystemCategory)).all()
    return categories


@router.post("/categories", response_model=SystemCategorySchema)
async def create_system_category(
    data: SystemCategoryCreate,
    db: Session = Depends(get_db),
):
    """创建系统分类 (管理员)"""
    # 检查名称是否已存在 (未删除的)
    existing = not_deleted(
        db.query(SystemCategory).filter(SystemCategory.name == data.name)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"分类名称 '{data.name}' 已存在")
    
    category = SystemCategory(
        id=data.id or str(uuid.uuid4()),
        name=data.name,
        color=data.color,
        description=data.description,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.delete("/categories/{category_id}")
async def delete_system_category(
    category_id: str,
    db: Session = Depends(get_db),
):
    """软删除系统分类 (会级联软删除该分类下的所有单词)"""
    category = not_deleted(
        db.query(SystemCategory).filter(SystemCategory.id == category_id)
    ).first()
    if not category:
        raise HTTPException(status_code=404, detail="分类不存在")
    
    now = datetime.utcnow()
    
    # 软删除该分类下的所有单词
    db.query(SystemWord).filter(
        SystemWord.category_id == category_id,
        SystemWord.deleted_at.is_(None)
    ).update({"deleted_at": now})
    
    # 软删除分类
    category.soft_delete()
    db.commit()
    return {"success": True, "message": "删除成功"}


# ============================================
# 系统单词 API
# ============================================

@router.get("/words", response_model=SystemWordSearchResult)
async def get_system_words(
    category_id: Optional[str] = Query(None, description="按分类筛选"),
    q: Optional[str] = Query(None, description="搜索关键词"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=200, description="每页数量"),
    db: Session = Depends(get_db),
):
    """获取系统单词列表 (支持分页和筛选，只返回未删除的)"""
    query = not_deleted(db.query(SystemWord))
    
    if category_id:
        query = query.filter(SystemWord.category_id == category_id)
    
    if q:
        query = query.filter(SystemWord.text.ilike(f"%{q}%"))
    
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    
    return SystemWordSearchResult(
        total=total,
        items=[
            SystemWordSchema(
                id=w.id,
                text=w.text,
                categoryId=w.category_id,
                phoneticUk=w.phonetic_uk,
                phoneticUs=w.phonetic_us,
                definition=w.definition,
                addedAt=w.added_at,
            )
            for w in items
        ],
    )


@router.get("/words/search", response_model=SystemWordSearchResult)
async def search_system_words(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    limit: int = Query(20, ge=1, le=100, description="返回数量上限"),
    db: Session = Depends(get_db),
):
    """快速搜索系统单词 (只返回未删除的)"""
    words = not_deleted(
        db.query(SystemWord).filter(SystemWord.text.ilike(f"%{q}%"))
    ).limit(limit).all()
    
    return SystemWordSearchResult(
        total=len(words),
        items=[
            SystemWordSchema(
                id=w.id,
                text=w.text,
                categoryId=w.category_id,
                phoneticUk=w.phonetic_uk,
                phoneticUs=w.phonetic_us,
                definition=w.definition,
                addedAt=w.added_at,
            )
            for w in words
        ],
    )


@router.post("/words", response_model=SystemWordSchema)
async def create_system_word(
    data: SystemWordCreate,
    db: Session = Depends(get_db),
):
    """创建单个系统单词 (管理员)"""
    # 验证分类存在 (未删除的)
    category = not_deleted(
        db.query(SystemCategory).filter(SystemCategory.id == data.categoryId)
    ).first()
    if not category:
        raise HTTPException(status_code=400, detail=f"分类 '{data.categoryId}' 不存在")
    
    word = SystemWord(
        text=data.text,
        category_id=data.categoryId,
        phonetic_uk=data.phoneticUk,
        phonetic_us=data.phoneticUs,
        definition=data.definition,
        added_at=int(time.time() * 1000),
    )
    db.add(word)
    db.commit()
    db.refresh(word)
    
    return SystemWordSchema(
        id=word.id,
        text=word.text,
        categoryId=word.category_id,
        phoneticUk=word.phonetic_uk,
        phoneticUs=word.phonetic_us,
        definition=word.definition,
        addedAt=word.added_at,
    )


@router.post("/words/batch", response_model=dict)
async def batch_create_system_words(
    data: SystemWordBatchCreate,
    db: Session = Depends(get_db),
):
    """批量导入系统单词 (管理员)"""
    now = int(time.time() * 1000)
    created = 0
    skipped = 0
    
    for word_data in data.words:
        # 检查分类是否存在 (未删除的)
        category = not_deleted(
            db.query(SystemCategory).filter(SystemCategory.id == word_data.categoryId)
        ).first()
        if not category:
            skipped += 1
            continue
        
        # 检查单词是否已存在于该分类 (未删除的)
        existing = not_deleted(
            db.query(SystemWord)
            .filter(
                SystemWord.text == word_data.text,
                SystemWord.category_id == word_data.categoryId,
            )
        ).first()
        if existing:
            skipped += 1
            continue
        
        word = SystemWord(
            text=word_data.text,
            category_id=word_data.categoryId,
            phonetic_uk=word_data.phoneticUk,
            phonetic_us=word_data.phoneticUs,
            definition=word_data.definition,
            added_at=now,
        )
        db.add(word)
        created += 1
    
    db.commit()
    
    return {
        "success": True,
        "created": created,
        "skipped": skipped,
        "total": len(data.words),
    }


@router.delete("/words/{word_id}")
async def delete_system_word(
    word_id: int,
    db: Session = Depends(get_db),
):
    """软删除系统单词"""
    word = not_deleted(
        db.query(SystemWord).filter(SystemWord.id == word_id)
    ).first()
    if not word:
        raise HTTPException(status_code=404, detail="单词不存在")
    
    word.soft_delete()
    db.commit()
    return {"success": True, "message": "删除成功"}
