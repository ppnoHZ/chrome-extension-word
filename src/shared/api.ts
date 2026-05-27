import { get, getAll } from './storage';
import { resolveApiUrl } from './runtime-config';
import type {
  SystemCategory,
  SystemWordSearchResult,
  CombinedSearchResult,
  DomainStats,
  Word,
  Collection,
  AIAnalyzeResponse,
  AIConfigStatus,
} from './types';

// 后端 API 响应接口
export interface BackendResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * 创建带认证的 fetch 请求
 */
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await get('authToken');
  
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * 验证登录状态
 */
export async function verifyAuth(): Promise<boolean> {
  const [storedApiUrl, authToken] = await Promise.all([
    get('apiUrl'),
    get('authToken'),
  ]);

  const apiUrl = resolveApiUrl(storedApiUrl);

  if (!apiUrl || !authToken) return false;

  try {
    const res = await authFetch(`${apiUrl}/api/auth/verify`, {
      method: 'POST',
    });
    
    if (res.ok) {
      const data = await res.json();
      return data.success === true;
    }
  } catch (err) {
    console.error('Auth verify failed:', err);
  }
  return false;
}

/**
 * 同步数据到后端
 */
export async function syncToBackend(): Promise<boolean> {
  const [storedApiUrl, authToken, autoSync] = await Promise.all([
    get('apiUrl'),
    get('authToken'),
    get('autoSync'),
  ]);

  const apiUrl = resolveApiUrl(storedApiUrl);

  if (!apiUrl || !authToken || !autoSync) {
    return false;
  }

  try {
    const data = await getAll();
    
    const payload = {
      categories: data.categories,
      words: data.words,
      collections: data.collections,
    };

    const res = await authFetch(`${apiUrl}/api/sync`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const result = await res.json();
      return result.success === true;
    }
  } catch (err) {
    console.error('Sync failed:', err);
  }
  return false;
}

/**
 * 从后端下载数据
 */
export async function downloadFromBackend(): Promise<{
  categories: unknown[];
  words: unknown[];
  collections: unknown[];
} | null> {
  const [storedApiUrl, authToken] = await Promise.all([
    get('apiUrl'),
    get('authToken'),
  ]);

  const apiUrl = resolveApiUrl(storedApiUrl);

  if (!apiUrl || !authToken) {
    return null;
  }

  try {
    const res = await authFetch(`${apiUrl}/api/sync`);

    if (res.ok) {
      const result = await res.json();
      if (result.success && result.data) {
        return result.data;
      }
    }
  } catch (err) {
    console.error('Download failed:', err);
  }
  return null;
}

// ============================================
// 系统词库 API
// ============================================

/**
 * 获取所有系统分类
 */
export async function getSystemCategories(): Promise<SystemCategory[]> {
  const storedApiUrl = await get('apiUrl');
  const apiUrl = resolveApiUrl(storedApiUrl);
  if (!apiUrl) return [];

  try {
    const res = await fetch(`${apiUrl}/api/system/categories`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Failed to get system categories:', err);
  }
  return [];
}

/**
 * 搜索系统单词
 */
export async function searchSystemWords(
  q: string,
  limit = 20,
): Promise<SystemWordSearchResult> {
  const storedApiUrl = await get('apiUrl');
  const apiUrl = resolveApiUrl(storedApiUrl);
  if (!apiUrl) return { total: 0, items: [] };

  try {
    const params = new URLSearchParams({ q, limit: String(limit) });
    const res = await fetch(`${apiUrl}/api/system/words/search?${params}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Failed to search system words:', err);
  }
  return { total: 0, items: [] };
}

// ============================================
// 联合查询 API
// ============================================

/**
 * 联合搜索用户单词和系统单词
 */
export async function searchWords(
  q: string,
  domain?: string,
  limit = 20,
): Promise<CombinedSearchResult> {
  const storedApiUrl = await get('apiUrl');
  const apiUrl = resolveApiUrl(storedApiUrl);
  if (!apiUrl) return { userWords: [], systemWords: [] };

  try {
    const params = new URLSearchParams({ q, limit: String(limit) });
    if (domain) params.set('domain', domain);
    
    const res = await authFetch(`${apiUrl}/api/words/search?${params}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Failed to search words:', err);
  }
  return { userWords: [], systemWords: [] };
}

/**
 * 获取指定域名下的所有用户单词
 */
export async function getWordsByDomain(domain: string): Promise<Word[]> {
  const storedApiUrl = await get('apiUrl');
  const apiUrl = resolveApiUrl(storedApiUrl);
  if (!apiUrl) return [];

  try {
    const params = new URLSearchParams({ domain });
    const res = await authFetch(`${apiUrl}/api/words/by-domain?${params}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Failed to get words by domain:', err);
  }
  return [];
}

/**
 * 获取用户所有域名的统计信息
 */
export async function getDomainStats(): Promise<DomainStats[]> {
  const storedApiUrl = await get('apiUrl');
  const apiUrl = resolveApiUrl(storedApiUrl);
  if (!apiUrl) return [];

  try {
    const res = await authFetch(`${apiUrl}/api/words/domains`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Failed to get domain stats:', err);
  }
  return [];
}

/**
 * 获取指定域名下的所有收藏
 */
export async function getCollectionsByDomain(domain: string): Promise<Collection[]> {
  const storedApiUrl = await get('apiUrl');
  const apiUrl = resolveApiUrl(storedApiUrl);
  if (!apiUrl) return [];

  try {
    const params = new URLSearchParams({ domain });
    const res = await authFetch(`${apiUrl}/api/words/collections/by-domain?${params}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Failed to get collections by domain:', err);
  }
  return [];
}

/**
 * 检查单词是否存在于用户词库或系统词库
 */
export async function checkWordExists(word: string): Promise<{
  inUserWords: boolean;
  inSystemWords: boolean;
  userWord?: Word;
  systemWord?: unknown;
}> {
  const storedApiUrl = await get('apiUrl');
  const apiUrl = resolveApiUrl(storedApiUrl);
  if (!apiUrl) return { inUserWords: false, inSystemWords: false };

  try {
    const params = new URLSearchParams({ word });
    const res = await authFetch(`${apiUrl}/api/words/check?${params}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Failed to check word existence:', err);
  }
  return { inUserWords: false, inSystemWords: false };
}

// ============================================
// AI 分析 API
// ============================================

/**
 * 获取 AI 配置状态
 */
export async function getAIStatus(): Promise<AIConfigStatus> {
  const storedApiUrl = await get('apiUrl');
  const apiUrl = resolveApiUrl(storedApiUrl);
  if (!apiUrl) return { configured: false };

  try {
    const res = await fetch(`${apiUrl}/api/ai/status`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Failed to get AI status:', err);
  }
  return { configured: false };
}

/**
 * AI 分析单词
 */
export async function analyzeWord(
  word: string,
  types: string[] = ['full'],
): Promise<AIAnalyzeResponse | null> {
  const storedApiUrl = await get('apiUrl');
  const apiUrl = resolveApiUrl(storedApiUrl);
  if (!apiUrl) return null;

  try {
    const res = await fetch(`${apiUrl}/api/ai/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word, types }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Failed to analyze word:', err);
  }
  return null;
}

/**
 * 清除单词的 AI 分析缓存
 */
export async function clearAICache(word: string): Promise<boolean> {
  const storedApiUrl = await get('apiUrl');
  const apiUrl = resolveApiUrl(storedApiUrl);
  if (!apiUrl) return false;

  try {
    const res = await fetch(`${apiUrl}/api/ai/cache/${encodeURIComponent(word)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to clear AI cache:', err);
  }
  return false;
}

// ============================================
// 收藏 API
// ============================================

export interface SaveCollectionParams {
  text: string;
  sourceUrl: string;
  sourceTitle: string;
  context?: string;
  domain?: string;
  categoryId?: string;
}

export interface SaveCollectionResult {
  success: boolean;
  id?: string;
  message?: string;
}

/**
 * 保存收藏到后端
 * 默认收藏到 General 分类下
 */
export async function saveCollectionToBackend(
  params: SaveCollectionParams,
): Promise<SaveCollectionResult> {
  const [storedApiUrl, authToken] = await Promise.all([
    get('apiUrl'),
    get('authToken'),
  ]);

  const apiUrl = resolveApiUrl(storedApiUrl);
  
  // 如果未登录或未配置后端，返回失败
  if (!apiUrl || !authToken) {
    return { success: false, message: '未登录或未配置后端' };
  }

  try {
    const res = await authFetch(`${apiUrl}/api/collections`, {
      method: 'POST',
      body: JSON.stringify(params),
    });

    if (res.ok) {
      return await res.json();
    } else {
      const error = await res.json().catch(() => ({ detail: '保存失败' }));
      return { success: false, message: error.detail || '保存失败' };
    }
  } catch (err) {
    console.error('Failed to save collection:', err);
    return { success: false, message: String(err) };
  }
}

/**
 * 获取用户的收藏列表
 */
export async function getCollections(params?: {
  categoryId?: string;
  domain?: string;
  page?: number;
  pageSize?: number;
}): Promise<Collection[]> {
  const storedApiUrl = await get('apiUrl');
  const apiUrl = resolveApiUrl(storedApiUrl);
  if (!apiUrl) return [];

  try {
    const searchParams = new URLSearchParams();
    if (params?.categoryId) searchParams.set('categoryId', params.categoryId);
    if (params?.domain) searchParams.set('domain', params.domain);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));

    const res = await authFetch(`${apiUrl}/api/collections?${searchParams}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Failed to get collections:', err);
  }
  return [];
}

/**
 * 删除收藏
 */
export async function deleteCollection(collectionId: string): Promise<boolean> {
  const storedApiUrl = await get('apiUrl');
  const apiUrl = resolveApiUrl(storedApiUrl);
  if (!apiUrl) return false;

  try {
    const res = await authFetch(`${apiUrl}/api/collections/${collectionId}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to delete collection:', err);
  }
  return false;
}
