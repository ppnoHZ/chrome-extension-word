export interface Category {
  id: string;
  name: string;
  /** 7-char hex color, e.g. "#ffd54f". Used for highlight background. */
  color: string;
}

export interface Word {
  text: string;
  categoryId: string;
  addedAt: number;
}

export interface Collection {
  id: string;
  text: string;
  categoryId?: string;
  /** URL of the frame that owned the selection (NOT necessarily the top page). */
  sourceUrl: string;
  sourceTitle: string;
  /** Short surrounding context snippet, trimmed to a reasonable length. */
  context?: string;
  collectedAt: number;
}

export interface StorageShape {
  categories: Category[];
  words: Word[];
  collections: Collection[];
  /** Global on/off switch for highlighting. */
  enabled: boolean;
}

export const DEFAULT_STORAGE: StorageShape = {
  categories: [
    { id: 'default', name: 'General', color: '#ffd54f' },
  ],
  words: [],
  collections: [],
  enabled: true,
};
