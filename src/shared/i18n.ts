/**
 * Thin wrapper around chrome.i18n. Falls back to the message key if
 * a translation is missing (useful in dev so you immediately notice).
 */
export function t(key: string, substitutions?: string | string[]): string {
  const msg = chrome.i18n.getMessage(key, substitutions);
  return msg || key;
}
