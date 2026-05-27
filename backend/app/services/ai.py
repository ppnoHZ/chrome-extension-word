"""
AI 分析服务
支持 OpenAI 兼容的 API 格式
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, List
import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models import AIAnalysis
from app.models.ai_analysis import AnalysisType
from app.schemas.ai import (
    AIAnalysisResult,
    MeaningDetail,
    ExampleSentence,
    RootsAnalysis,
)

logger = logging.getLogger(__name__)


# AI 分析的 Prompt 模板
ANALYSIS_PROMPT = '''分析英语单词 "{word}"，返回严格的 JSON 格式（不要包含 markdown 代码块）：

{{
  "meaning": {{
    "pos": "词性 (如 n./v./adj.)",
    "cn": "中文释义",
    "en": "英文释义"
  }},
  "examples": [
    {{"en": "英文例句1", "cn": "中文翻译1"}},
    {{"en": "英文例句2", "cn": "中文翻译2"}}
  ],
  "roots": {{
    "root": "词根 (如果有)",
    "prefix": "前缀 (如果有)",
    "suffix": "后缀 (如果有)",
    "explanation": "词根词缀拆解说明"
  }},
  "synonyms": ["同义词1", "同义词2", "同义词3"],
  "antonyms": ["反义词1", "反义词2"],
  "memory": "记忆技巧和联想方法"
}}

要求:
1. 例句应该简洁实用，体现单词的常见用法
2. 词根分析要详细，帮助理解词义
3. 记忆技巧要有创意，便于记忆
4. 返回纯 JSON，不要有任何其他文字'''


class AIService:
    """AI 分析服务"""
    
    def __init__(self, db: Session):
        self.db = db
        self.api_url = settings.ai_api_url
        self.api_key = settings.ai_api_key
        self.model = settings.ai_model
        self.cache_days = settings.ai_cache_days
        self.timeout = settings.ai_timeout
    
    def is_configured(self) -> bool:
        """检查 AI API 是否已配置"""
        return bool(self.api_url and self.api_key)
    
    def _get_cached_analysis(self, word: str, analysis_type: AnalysisType) -> Optional[AIAnalysis]:
        """获取缓存的分析结果"""
        cache_threshold = datetime.now() - timedelta(days=self.cache_days)
        
        return (
            self.db.query(AIAnalysis)
            .filter(
                AIAnalysis.word == word.lower(),
                AIAnalysis.analysis_type == analysis_type,
                AIAnalysis.created_at >= cache_threshold,
            )
            .first()
        )
    
    def _save_to_cache(
        self,
        word: str,
        analysis_type: AnalysisType,
        content: dict,
        model: str,
    ):
        """保存分析结果到缓存"""
        # 删除旧的缓存
        self.db.query(AIAnalysis).filter(
            AIAnalysis.word == word.lower(),
            AIAnalysis.analysis_type == analysis_type,
        ).delete()
        
        # 插入新的缓存
        analysis = AIAnalysis(
            word=word.lower(),
            analysis_type=analysis_type,
            content=content,
            model=model,
        )
        self.db.add(analysis)
        self.db.commit()
    
    async def _call_ai_api(self, prompt: str) -> Optional[dict]:
        """调用 AI API"""
        if not self.is_configured():
            logger.warning("AI API 未配置")
            return None
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.api_url.rstrip('/')}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "system",
                                "content": "你是一个专业的英语学习助手，擅长分析单词的词义、词根、用法和记忆技巧。请用 JSON 格式返回分析结果。",
                            },
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.7,
                        "max_tokens": 1500,
                    },
                )
                response.raise_for_status()
                
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                
                # 尝试解析 JSON
                # 去除可能的 markdown 代码块标记
                content = content.strip()
                if content.startswith("```json"):
                    content = content[7:]
                if content.startswith("```"):
                    content = content[3:]
                if content.endswith("```"):
                    content = content[:-3]
                content = content.strip()
                
                return json.loads(content)
        
        except httpx.HTTPError as e:
            logger.error(f"AI API 请求失败: {e}")
            return None
        except json.JSONDecodeError as e:
            logger.error(f"AI 响应解析失败: {e}")
            return None
        except Exception as e:
            logger.error(f"AI 分析异常: {e}")
            return None
    
    def _parse_analysis_result(self, data: dict) -> AIAnalysisResult:
        """解析 AI 返回的分析结果"""
        result = AIAnalysisResult()
        
        # 解析词义
        if "meaning" in data and isinstance(data["meaning"], dict):
            result.meaning = MeaningDetail(
                pos=data["meaning"].get("pos", ""),
                cn=data["meaning"].get("cn", ""),
                en=data["meaning"].get("en", ""),
            )
        
        # 解析例句
        if "examples" in data and isinstance(data["examples"], list):
            result.examples = [
                ExampleSentence(
                    en=ex.get("en", ""),
                    cn=ex.get("cn", ""),
                )
                for ex in data["examples"]
                if isinstance(ex, dict)
            ]
        
        # 解析词根
        if "roots" in data and isinstance(data["roots"], dict):
            result.roots = RootsAnalysis(
                root=data["roots"].get("root"),
                prefix=data["roots"].get("prefix"),
                suffix=data["roots"].get("suffix"),
                explanation=data["roots"].get("explanation", ""),
            )
        
        # 解析同义词
        if "synonyms" in data and isinstance(data["synonyms"], list):
            result.synonyms = [s for s in data["synonyms"] if isinstance(s, str)]
        
        # 解析反义词
        if "antonyms" in data and isinstance(data["antonyms"], list):
            result.antonyms = [a for a in data["antonyms"] if isinstance(a, str)]
        
        # 解析记忆技巧
        if "memory" in data and isinstance(data["memory"], str):
            result.memory = data["memory"]
        
        return result
    
    async def analyze(
        self,
        word: str,
        types: List[str],
    ) -> tuple[AIAnalysisResult, bool, Optional[str]]:
        """
        分析单词
        
        Args:
            word: 要分析的单词
            types: 分析类型列表
        
        Returns:
            (分析结果, 是否来自缓存, 使用的模型)
        """
        # 检查是否有完整分析的缓存
        if "full" in types or len(types) > 1:
            cached = self._get_cached_analysis(word, AnalysisType.FULL)
            if cached:
                return (
                    self._parse_analysis_result(cached.content),
                    True,
                    cached.model,
                )
        
        # 调用 AI API
        prompt = ANALYSIS_PROMPT.format(word=word)
        data = await self._call_ai_api(prompt)
        
        if not data:
            return AIAnalysisResult(), False, None
        
        # 保存到缓存
        self._save_to_cache(word, AnalysisType.FULL, data, self.model)
        
        return (
            self._parse_analysis_result(data),
            False,
            self.model,
        )
