import { onMessage, type HighlightData } from '@/shared/messaging';
import { get, getAll, set, update } from '@/shared/storage';
import { DEFAULT_STORAGE, type Collection, type DictCacheEntry, type Word } from '@/shared/types';
import { queryDictionary } from '@/shared/dictionary';
import { saveCollectionToBackend } from '@/shared/api';

// Initialize defaults on install.
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(null);
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(DEFAULT_STORAGE)) {
    if (!(k in existing)) patch[k] = v;
  }
  if (Object.keys(patch).length > 0) {
    await chrome.storage.local.set(patch);
  }

  chrome.contextMenus.create({
    id: 'wl-collect',
    title: chrome.i18n.getMessage('contextMenuCollect') || 'Word Learn: collect "%s"',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'wl-add-word',
    title: chrome.i18n.getMessage('contextMenuAddWord') || 'Word Learn: add "%s" to highlight list',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'wl-lookup',
    title: chrome.i18n.getMessage('contextMenuLookup') || 'Word Learn: lookup "%s"',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const text = info.selectionText?.trim();
  if (!text) return;

  // 从 URL 提取域名
  const extractDomain = (url: string): string | undefined => {
    try {
      return new URL(url).hostname;
    } catch {
      return undefined;
    }
  };

  if (info.menuItemId === 'wl-collect') {
    // Use the frame's URL (info.frameUrl) when available — that's where the user actually selected.
    const sourceUrl = info.frameUrl ?? info.pageUrl ?? tab?.url ?? '';
    const domain = extractDomain(sourceUrl);
    const result = await saveCollection({
      text,
      sourceUrl,
      sourceTitle: tab?.title ?? '',
      domain,
    });

    // 右键收藏后给当前页面提示结果
    if (tab?.id != null) {
      const message = result.backendSaved
        ? '收藏成功，已同步到后端'
        : `已收藏到本地，后端未同步${result.backendMessage ? `：${result.backendMessage}` : ''}`;

      const payload = {
        type: 'wl-show-toast',
        text: message,
        level: result.backendSaved ? 'success' : 'warning',
      };

      // 优先发给发生选中的 frame，失败则回退到当前 tab。
      await chrome.tabs.sendMessage(tab.id, payload, { frameId: info.frameId }).catch(async () => {
        await chrome.tabs.sendMessage(tab.id!, payload).catch(() => {});
      });
    }
  } else if (info.menuItemId === 'wl-add-word') {
    const sourceUrl = info.frameUrl ?? info.pageUrl ?? tab?.url ?? '';
    const domain = extractDomain(sourceUrl);
    await addWord(text, undefined, domain);
    await broadcastWordsUpdated();
  } else if (info.menuItemId === 'wl-lookup') {
    // 通知内容脚本显示释义卡片
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'showLookup',
        word: text,
      }).catch(() => {});
    }
  }
});

onMessage(async (msg) => {
  console.log('[Word Learn] ====== Background received message ======');
  console.log('[Word Learn] Message type:', msg.type);
  console.log('[Word Learn] Message payload:', JSON.stringify(msg));
  
  let response: unknown;
  switch (msg.type) {
    case 'collect': {
      console.log('[Word Learn] Processing collect request');
      const result = await saveCollection(msg.payload);
      response = { ok: true, id: result.id, backendSaved: result.backendSaved, backendMessage: result.backendMessage };
      break;
    }
    case 'addWord': {
      console.log('[Word Learn] Processing addWord request');
      const result = await addWord(msg.text, msg.categoryId, msg.domain);
      if (result.added) await broadcastWordsUpdated();
      response = { ok: true, ...result };
      break;
    }
    case 'getHighlightData': {
      console.log('[Word Learn] Processing getHighlightData request');
      const all = await getAll();
      const data: HighlightData = {
        enabled: all.enabled,
        words: all.words,
        categories: all.categories,
      };
      response = data;
      break;
    }
    case 'toggleEnabled': {
      console.log('[Word Learn] Processing toggleEnabled request');
      await set('enabled', msg.enabled);
      response = { ok: true };
      break;
    }
    case 'wordsUpdated': {
      console.log('[Word Learn] Processing wordsUpdated request');
      await broadcastWordsUpdated();
      response = { ok: true };
      break;
    }
    case 'lookupWord': {
      console.log('[Word Learn] Processing lookupWord request for:', msg.word);
      try {
        const entry = await lookupWord(msg.word);
        console.log('[Word Learn] lookupWord result:', entry ? 'found' : 'not found');
        if (entry) {
          response = { ok: true, entry };
        } else {
          response = { ok: false, error: '未找到该单词的释义' };
        }
      } catch (err) {
        console.error('[Word Learn] lookupWord error:', err);
        response = { ok: false, error: String(err) };
      }
      break;
    }
    default:
      console.warn('[Word Learn] Unknown message type:', (msg as { type: string }).type);
      response = { ok: false, error: 'Unknown message type' };
  }
  
  console.log('[Word Learn] Sending response:', JSON.stringify(response));
  return response;
});

async function broadcastWordsUpdated(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map((t) =>
      t.id != null
        ? chrome.tabs
            .sendMessage(t.id, { type: 'wordsUpdated' })
            .catch(() => undefined)
        : undefined,
    ),
  );
}

async function addWord(
  rawText: string,
  categoryId?: string,
  domain?: string,
): Promise<{ added: boolean; categoryId: string }> {
  const text = rawText.trim();
  if (!text) return { added: false, categoryId: categoryId ?? 'default' };
  const all = await getAll();
  const targetCat =
    (categoryId && all.categories.find((c) => c.id === categoryId)?.id) ||
    all.categories[0]?.id ||
    'default';
  const lower = text.toLowerCase();
  const exists = all.words.some((w) => w.text.toLowerCase() === lower);
  if (exists) return { added: false, categoryId: targetCat };
  const entry: Word = { text, categoryId: targetCat, domain, addedAt: Date.now() };
  await update('words', (cur) => [entry, ...cur]);
  return { added: true, categoryId: targetCat };
}

async function saveCollection(
  payload: Omit<Collection, 'id' | 'collectedAt'>,
): Promise<{ id: string; backendSaved: boolean; backendMessage?: string }> {
  const id = crypto.randomUUID();
  const entry: Collection = {
    ...payload,
    id,
    collectedAt: Date.now(),
  };
  
  // 保存到本地存储
  await update('collections', (cur) => [entry, ...cur]);
  
  // 同时保存到后端（如果已登录）
  // 在 service worker 中必须 await，避免 worker 提前休眠导致请求未发出。
  try {
    const result = await saveCollectionToBackend({
      text: payload.text,
      sourceUrl: payload.sourceUrl,
      sourceTitle: payload.sourceTitle,
      context: payload.context,
      domain: payload.domain,
      categoryId: payload.categoryId,
    });

    if (result.success) {
      console.log('[Word Learn] Collection saved to backend:', result.id);
      return { id, backendSaved: true };
    } else {
      console.log('[Word Learn] Backend save skipped or failed:', result.message);
      return { id, backendSaved: false, backendMessage: result.message };
    }
  } catch (err) {
    console.error('[Word Learn] Failed to save collection to backend:', err);
    return { id, backendSaved: false, backendMessage: String(err) };
  }
}

/** 缓存有效期：7 天 */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function lookupWord(rawWord: string): Promise<DictCacheEntry | null> {
  const word = rawWord.trim().toLowerCase();
  console.log('[Word Learn] lookupWord called:', word);
  if (!word) return null;

  // 检查缓存
  const cache = await get('dictCache');
  const cached = cache[word];
  if (cached && Date.now() - cached.queriedAt < CACHE_TTL_MS) {
    console.log('[Word Learn] Cache hit:', word);
    return cached;
  }

  // 获取配置的 API 类型
  const apiType = await get('dictApi');
  console.log('[Word Learn] Using API type:', apiType);

  // 查询词典
  console.log('[Word Learn] Querying dictionary for:', word);
  const entry = await queryDictionary(word, apiType);
  console.log('[Word Learn] Dictionary result:', entry);
  if (!entry) return null;

  // 存入缓存
  await update('dictCache', (cur) => ({ ...cur, [word]: entry }));
  return entry;
}
