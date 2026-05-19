export function normalizeApiUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export const DEFAULT_API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL ?? '');
export const CURRENT_BUILD_MODE = import.meta.env.MODE;
export const CURRENT_BUILD_LABEL = import.meta.env.DEV ? '开发环境' : '生产环境';

export function resolveApiUrl(overrideUrl?: string | null): string {
  const normalizedOverride = normalizeApiUrl(overrideUrl ?? '');
  return normalizedOverride || DEFAULT_API_URL;
}
