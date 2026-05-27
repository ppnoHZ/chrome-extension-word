"""
AI 分析路由
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.config import settings
from app.schemas.ai import (
    AIAnalyzeRequest,
    AIAnalyzeResponse,
    AIConfigStatus,
    AIAnalysisResult,
)
from app.services.ai import AIService

router = APIRouter(prefix="/ai", tags=["AI 分析"])


@router.get("/status", response_model=AIConfigStatus)
async def get_ai_status():
    """获取 AI 配置状态"""
    configured = bool(settings.ai_api_url and settings.ai_api_key)
    return AIConfigStatus(
        configured=configured,
        model=settings.ai_model if configured else None,
    )


@router.post("/analyze", response_model=AIAnalyzeResponse)
async def analyze_word(
    request: AIAnalyzeRequest,
    db: Session = Depends(get_db),
):
    """
    AI 分析单词
    
    分析类型:
    - meaning: 词义详解
    - examples: 例句生成
    - roots: 词根词缀分析
    - synonyms: 同义词/反义词
    - memory: 记忆技巧
    - full: 完整分析 (包含以上所有)
    """
    ai_service = AIService(db)
    
    if not ai_service.is_configured():
        raise HTTPException(
            status_code=503,
            detail="AI 服务未配置，请在后端设置 AI_API_URL 和 AI_API_KEY 环境变量",
        )
    
    analysis, cached, model = await ai_service.analyze(
        word=request.word,
        types=request.types,
    )
    
    return AIAnalyzeResponse(
        word=request.word,
        cached=cached,
        model=model,
        analysis=analysis,
    )


@router.delete("/cache/{word}")
async def clear_word_cache(
    word: str,
    db: Session = Depends(get_db),
):
    """清除指定单词的 AI 分析缓存"""
    from app.models import AIAnalysis
    
    deleted = db.query(AIAnalysis).filter(
        AIAnalysis.word == word.lower()
    ).delete()
    db.commit()
    
    return {
        "success": True,
        "deleted": deleted,
        "word": word,
    }
