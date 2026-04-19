import type { Collection, Word, Category } from './types';

/**
 * All cross-context messages flow through here. Keep payloads serializable.
 * Background is the single hub: popup/options/content all message it.
 */
export type Message =
  | { type: 'collect'; payload: Omit<Collection, 'id' | 'collectedAt'> }
  | { type: 'addWord'; text: string; categoryId?: string }
  | { type: 'getHighlightData' }
  | { type: 'wordsUpdated' }
  | { type: 'toggleEnabled'; enabled: boolean };

export interface HighlightData {
  enabled: boolean;
  words: Word[];
  categories: Category[];
}

export type Response<M extends Message> = M extends { type: 'collect' }
  ? { ok: true; id: string } | { ok: false; error: string }
  : M extends { type: 'addWord' }
    ? { ok: true; added: boolean; categoryId: string } | { ok: false; error: string }
    : M extends { type: 'getHighlightData' }
      ? HighlightData
      : { ok: true };

export function send<M extends Message>(msg: M): Promise<Response<M>> {
  return chrome.runtime.sendMessage(msg) as Promise<Response<M>>;
}

export function onMessage(
  handler: (
    msg: Message,
    sender: chrome.runtime.MessageSender,
  ) => Promise<unknown> | unknown,
): void {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    Promise.resolve(handler(msg as Message, sender)).then(
      (result) => sendResponse(result),
      (err) => sendResponse({ ok: false, error: String(err?.message ?? err) }),
    );
    return true; // keep the channel open for async response
  });
}
