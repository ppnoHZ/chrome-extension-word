import type { Collection, Word, Category } from './types';
import type { DictionaryEntry } from './dictionary';

/**
 * All cross-context messages flow through here. Keep payloads serializable.
 * Background is the single hub: popup/options/content all message it.
 */
export type Message =
  | { type: 'collect'; payload: Omit<Collection, 'id' | 'collectedAt'> }
  | { type: 'addWord'; text: string; categoryId?: string }
  | { type: 'getHighlightData' }
  | { type: 'wordsUpdated' }
  | { type: 'toggleEnabled'; enabled: boolean }
  | { type: 'lookupWord'; word: string };

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
      : M extends { type: 'lookupWord' }
        ? { ok: true; entry: DictionaryEntry } | { ok: false; error: string }
        : { ok: true };

export function send<M extends Message>(msg: M): Promise<Response<M>> {
  console.log('[Word Learn] Messaging: sending message:', msg.type, msg);
  return chrome.runtime.sendMessage(msg).then(
    (res) => {
      console.log('[Word Learn] Messaging: received response for', msg.type, ':', res);
      return res as Response<M>;
    },
    (err) => {
      console.error('[Word Learn] Messaging: error for', msg.type, ':', err);
      throw err;
    }
  );
}

export function onMessage(
  handler: (
    msg: Message,
    sender: chrome.runtime.MessageSender,
  ) => Promise<unknown> | unknown,
): void {
  console.log('[Word Learn] Registering message handler in background');
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log('[Word Learn] onMessage listener triggered, raw message:', msg);
    Promise.resolve(handler(msg as Message, sender)).then(
      (result) => {
        console.log('[Word Learn] Handler completed, sending response');
        sendResponse(result);
      },
      (err) => {
        console.error('[Word Learn] Handler error:', err);
        sendResponse({ ok: false, error: String(err?.message ?? err) });
      },
    );
    return true; // keep the channel open for async response
  });
}
