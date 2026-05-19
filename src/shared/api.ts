import { get, getAll } from './storage';
import { resolveApiUrl } from './runtime-config';

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
