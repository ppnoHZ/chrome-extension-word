import { DEFAULT_STORAGE, type StorageShape } from './types';

type Key = keyof StorageShape;

export async function getAll(): Promise<StorageShape> {
  const raw = (await chrome.storage.local.get(DEFAULT_STORAGE)) as Partial<StorageShape>;
  return { ...DEFAULT_STORAGE, ...raw };
}

export async function get<K extends Key>(key: K): Promise<StorageShape[K]> {
  const raw = await chrome.storage.local.get({ [key]: DEFAULT_STORAGE[key] });
  return raw[key] as StorageShape[K];
}

export async function set<K extends Key>(key: K, value: StorageShape[K]): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function update<K extends Key>(
  key: K,
  updater: (current: StorageShape[K]) => StorageShape[K],
): Promise<StorageShape[K]> {
  const current = await get(key);
  const next = updater(current);
  await set(key, next);
  return next;
}

export function onChanged(
  listener: (changes: Partial<{ [K in Key]: StorageShape[K] }>) => void,
): () => void {
  const handler = (
    changes: { [k: string]: chrome.storage.StorageChange },
    areaName: string,
  ) => {
    if (areaName !== 'local') return;
    const out: Partial<{ [K in Key]: StorageShape[K] }> = {};
    for (const k of Object.keys(changes) as Key[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (out as any)[k] = changes[k].newValue;
    }
    listener(out);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
