"""
AI 分析相关 schema
"""
from typing import Optional, List, Literal
from pydantic import BaseModel, Field


class MeaningDetail(BaseModel):
    """词义详情"""
    pos: str = ""  # 词性
    cn: str = ""   # 中文释义
    en: str = ""   # 英文释义


class ExampleSentence(BaseModel):
    """例句"""
    en: str  # 英文例句
    cn: str  # 中文翻译


class RootsAnalysis(BaseModel):
    """词根词缀分析"""
    root: Optional[str] = None      # 词根
    prefix: Optional[str] = None    # 前缀
    suffix: Optional[str] = None    # 后缀
    explanation: str = ""           # 拆解说明


class AIAnalysisResult(BaseModel):
    """AI 分析结果"""
    meaning: Optional[MeaningDetail] = None
    examples: Optional[List[ExampleSentence]] = None
    roots: Optional[RootsAnalysis] = None
    synonyms: Optional[List[str]] = None   # 同义词
    antonyms: Optional[List[str]] = None   # 反义词
    memory: Optional[str] = None           # 记忆技巧


class AIAnalyzeRequest(BaseModel):
    """AI 分析请求"""
    word: str
    types: List[Literal["meaning", "examples", "roots", "synonyms", "memory", "full"]] = ["full"]


class AIAnalyzeResponse(BaseModel):
    """AI 分析响应"""
    word: str
    cached: bool = False  # 是否来自缓存
    model: Optional[str] = None
    analysis: AIAnalysisResult


class AIConfigStatus(BaseModel):
    """AI 配置状态"""
    configured: bool  # AI API 是否已配置
    model: Optional[str] = None
