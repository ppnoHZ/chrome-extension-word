import { onMessage, type HighlightData } from '@/shared/messaging';
import { getAll, set, update } from '@/shared/storage';
import { DEFAULT_STORAGE, type Collection, type Word } from '@/shared/types';

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
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const text = info.selectionText?.trim();
  if (!text) return;
  if (info.menuItemId === 'wl-collect') {
    // Use the frame's URL (info.frameUrl) when available — that's where the user actually selected.
    const sourceUrl = info.frameUrl ?? info.pageUrl ?? tab?.url ?? '';
    await saveCollection({
      text,
      sourceUrl,
      sourceTitle: tab?.title ?? '',
    });
  } else if (info.menuItemId === 'wl-add-word') {
    await addWord(text);
    await broadcastWordsUpdated();
  }
});

onMessage(async (msg) => {
  switch (msg.type) {
    case 'collect': {
      const id = await saveCollection(msg.payload);
      return { ok: true, id };
    }
    case 'addWord': {
      const result = await addWord(msg.text, msg.categoryId);
      if (result.added) await broadcastWordsUpdated();
      return { ok: true, ...result };
    }
    case 'getHighlightData': {
      const all = await getAll();
      const data: HighlightData = {
        enabled: all.enabled,
        words: all.words,
        categories: all.categories,
      };
      return data;
    }
    case 'toggleEnabled': {
      await set('enabled', msg.enabled);
      return { ok: true };
    }
    case 'wordsUpdated': {
      await broadcastWordsUpdated();
      return { ok: true };
    }
  }
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
  const entry: Word = { text, categoryId: targetCat, addedAt: Date.now() };
  await update('words', (cur) => [entry, ...cur]);
  return { added: true, categoryId: targetCat };
}

async function saveCollection(
  payload: Omit<Collection, 'id' | 'collectedAt'>,
): Promise<string> {
  const id = crypto.randomUUID();
  const entry: Collection = {
    ...payload,
    id,
    collectedAt: Date.now(),
  };
  await update('collections', (cur) => [entry, ...cur]);
  return id;
}
