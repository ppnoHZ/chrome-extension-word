import { get, set } from './storage';

export interface UserProfile {
  id: string;
  name?: string;
  email?: string;
  avatar?: string;
}

/**
 * 通过后端进行 GitHub OAuth 认证
 * 
 * 流程：
 * 1. 调用后端 /api/auth/github/login 获取授权 URL
 * 2. 使用 chrome.identity.launchWebAuthFlow 让用户授权
 * 3. 获取授权码后，调用后端 /api/auth/github/callback 换取 JWT token
 */
export async function authenticateWithBackend(apiUrl: string): Promise<{
  token: string;
  user: UserProfile;
}> {
  const redirectUri = chrome.identity.getRedirectURL();
  
  // 1. 获取授权 URL
  const loginRes = await fetch(`${apiUrl}/api/auth/github/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ redirect_uri: redirectUri }),
  });
  
  if (!loginRes.ok) {
    throw new Error('Failed to get authorization URL');
  }
  
  const { auth_url, state } = await loginRes.json();
  
  // 2. 启动 OAuth 授权流程
  const code = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: auth_url, interactive: true },
      (responseUrl) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        if (!responseUrl) {
          return reject(new Error('No response URL'));
        }
        
        const url = new URL(responseUrl);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        
        if (error) {
          return reject(new Error(`OAuth error: ${error}`));
        }
        if (!code) {
          return reject(new Error('No authorization code received'));
        }
        
        resolve(code);
      }
    );
  });
  
  // 3. 将授权码发送到后端换取 JWT token
  const callbackRes = await fetch(`${apiUrl}/api/auth/github/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      state,
      redirect_uri: redirectUri,
    }),
  });
  
  if (!callbackRes.ok) {
    throw new Error('Failed to exchange authorization code');
  }
  
  const result = await callbackRes.json();
  
  if (!result.success) {
    throw new Error(result.message || 'Authentication failed');
  }
  
  // 4. 保存 token 和用户信息
  await set('authToken', result.token);
  await set('authProvider', 'github');
  await set('userInfo', result.user);
  
  return {
    token: result.token,
    user: result.user,
  };
}

/**
 * 验证当前 token 是否有效
 */
export async function verifyToken(apiUrl: string, token: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${apiUrl}/api/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        return data.user;
      }
    }
  } catch (err) {
    console.error('Token verification failed:', err);
  }
  return null;
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUser(apiUrl: string, token: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${apiUrl}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Failed to get current user:', err);
  }
  return null;
}

/**
 * 登出 - 清除本地存储的认证信息
 */
export async function logout(): Promise<void> {
  await set('authToken', '');
  await set('authProvider', 'none');
  await set('userInfo', undefined);
}

/**
 * 检查是否已登录
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await get('authToken');
  return !!token;
}
