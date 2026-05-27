"""
单词查询路由 (联合查询用户词和系统词)
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.dependencies import get_db
from app.models import User, Word, Collection, SystemWord, not_deleted
from app.routers.auth import get_current_user
from app.schemas.word import WordSchema
from app.schemas.collection import CollectionSchema
from app.schemas.system_word import SystemWordSchema

router = APIRouter(prefix="/words", tags=["单词查询"])


class CombinedSearchResult(BaseModel):
    """联合搜索结果"""
    userWords: List[WordSchema]
    systemWords: List[SystemWordSchema]


class DomainStats(BaseModel):
    """域名统计"""
    domain: str
    wordCount: int
    collectionCount: int


@router.get("/search", response_model=CombinedSearchResult)
async def search_words(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    domain: Optional[str] = Query(None, description="按域名筛选 (仅用户词)"),
    limit: int = Query(20, ge=1, le=100, description="每类结果上限"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    联合搜索用户单词和系统单词 (只返回未删除的)
    
    - 用户单词可按域名筛选
    - 系统单词返回匹配的词库内容
    """
    # 查询用户单词 (未删除的)
    user_query = not_deleted(
        db.query(Word).filter(
            Word.user_id == user.id,
            Word.text.ilike(f"%{q}%"),
        )
    )
    if domain:
        user_query = user_query.filter(Word.domain == domain)
    user_words = user_query.limit(limit).all()
    
    # 查询系统单词 (未删除的)
    system_words = not_deleted(
        db.query(SystemWord).filter(SystemWord.text.ilike(f"%{q}%"))
    ).limit(limit).all()
    
    return CombinedSearchResult(
        userWords=[
            WordSchema(
                text=w.text,
                categoryId=w.category_id,
                domain=w.domain,
                addedAt=w.added_at,
            )
            for w in user_words
        ],
        systemWords=[
            SystemWordSchema(
                id=w.id,
                text=w.text,
                categoryId=w.category_id,
                phoneticUk=w.phonetic_uk,
                phoneticUs=w.phonetic_us,
                definition=w.definition,
                addedAt=w.added_at,
            )
            for w in system_words
        ],
    )


@router.get("/by-domain", response_model=List[WordSchema])
async def get_words_by_domain(
    domain: str = Query(..., description="域名"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取指定域名下的所有用户单词 (未删除的)"""
    words = not_deleted(
        db.query(Word).filter(Word.user_id == user.id, Word.domain == domain)
    ).order_by(Word.added_at.desc()).all()
    
    return [
        WordSchema(
            text=w.text,
            categoryId=w.category_id,
            domain=w.domain,
            addedAt=w.added_at,
        )
        for w in words
    ]


@router.get("/domains", response_model=List[DomainStats])
async def get_domain_stats(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取用户所有域名的统计信息 (只统计未删除的)"""
    from sqlalchemy import func
    
    # 统计单词域名 (未删除的)
    word_domains = (
        db.query(Word.domain, func.count(Word.id).label("count"))
        .filter(
            Word.user_id == user.id,
            Word.domain.isnot(None),
            Word.deleted_at.is_(None)
        )
        .group_by(Word.domain)
        .all()
    )
    
    # 统计收藏域名 (未删除的)
    collection_domains = (
        db.query(Collection.domain, func.count(Collection.id).label("count"))
        .filter(
            Collection.user_id == user.id,
            Collection.domain.isnot(None),
            Collection.deleted_at.is_(None)
        )
        .group_by(Collection.domain)
        .all()
    )
    
    # 合并统计
    domain_stats = {}
    for domain, count in word_domains:
        if domain not in domain_stats:
            domain_stats[domain] = {"wordCount": 0, "collectionCount": 0}
        domain_stats[domain]["wordCount"] = count
    
    for domain, count in collection_domains:
        if domain not in domain_stats:
            domain_stats[domain] = {"wordCount": 0, "collectionCount": 0}
        domain_stats[domain]["collectionCount"] = count
    
    return [
        DomainStats(
            domain=domain,
            wordCount=stats["wordCount"],
            collectionCount=stats["collectionCount"],
        )
        for domain, stats in sorted(domain_stats.items())
    ]


@router.get("/collections/by-domain", response_model=List[CollectionSchema])
async def get_collections_by_domain(
    domain: str = Query(..., description="域名"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取指定域名下的所有收藏 (未删除的)"""
    collections = not_deleted(
        db.query(Collection).filter(Collection.user_id == user.id, Collection.domain == domain)
    ).order_by(Collection.collected_at.desc()).all()
    
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


@router.get("/check", response_model=dict)
async def check_word_exists(
    word: str = Query(..., description="单词文本"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    检查单词是否存在于用户词库或系统词库 (只检查未删除的)
    
    返回:
    - inUserWords: 是否在用户词库
    - inSystemWords: 是否在系统词库
    - userWord: 用户词详情 (如果存在)
    - systemWord: 系统词详情 (如果存在)
    """
    # 查找用户单词 (未删除的)
    user_word = not_deleted(
        db.query(Word).filter(Word.user_id == user.id, Word.text == word)
    ).first()
    
    # 查找系统单词 (未删除的)
    system_word = not_deleted(
        db.query(SystemWord).filter(SystemWord.text == word)
    ).first()
    
    result = {
        "inUserWords": user_word is not None,
        "inSystemWords": system_word is not None,
    }
    
    if user_word:
        result["userWord"] = WordSchema(
            text=user_word.text,
            categoryId=user_word.category_id,
            domain=user_word.domain,
            addedAt=user_word.added_at,
        ).model_dump()
    
    if system_word:
        result["systemWord"] = SystemWordSchema(
            id=system_word.id,
            text=system_word.text,
            categoryId=system_word.category_id,
            phoneticUk=system_word.phonetic_uk,
            phoneticUs=system_word.phonetic_us,
            definition=system_word.definition,
            addedAt=system_word.added_at,
        ).model_dump()
    
    return result
