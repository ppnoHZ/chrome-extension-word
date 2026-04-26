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

/** 单个词性下的释义 */
export interface DictMeaning {
  /** 词性 (part of speech)，如 noun, verb, adjective */
  pos?: string;
  /** 该词性下的释义列表 */
  defs: string[];
}

/** 词典查询缓存条目 */
export interface DictCacheEntry {
  word: string;
  phoneticUk?: string;
  phoneticUs?: string;
  speechUk?: string;
  speechUs?: string;
  /** 按词性分组的释义 */
  meanings: DictMeaning[];
  queriedAt: number;
  /** 词典来源 */
  source?: 'iciba' | 'youdao' | 'freedict';
}

/** 支持的词典 API 类型 */
export type DictApiType = 'iciba' | 'youdao' | 'freedict' | 'auto';

export interface OAuth2Config {
  clientId: string;
  authEndpoint: string;
  scopes: string[];
  userInfoEndpoint?: string;
  responseType?: 'token' | 'code';
}

export interface StorageShape {
  categories: Category[];
  words: Word[];
  collections: Collection[];
  /** Global on/off switch for highlighting. */
  enabled: boolean;
  /** 词典查询结果缓存，key 为小写单词 */
  dictCache: Record<string, DictCacheEntry>;
  /** 选择的词典 API，默认 auto（自动尝试多个） */
  dictApi: DictApiType;
  /** 后端 API 地址 */
  apiUrl: string;
  /** 登录的提供商类型 */
  authProvider: 'none' | 'github' | 'custom';
  /** 用户鉴权 token (现在可以是 OAuth2 Access Token) */
  authToken: string;
  /** 自定义的 OAuth2 配置参数 */
  customOAuthConfig: OAuth2Config | null;
  /** 是否自动同步到后端 */
  autoSync: boolean;
  /** 缓存的用户基本信息 */
  userInfo?: {
    id: string;
    name?: string;
    email?: string;
    avatar?: string;
  };
}

export const DEFAULT_STORAGE: StorageShape = {
  categories: [
    { id: 'default', name: 'General', color: '#ffd54f' },
  ],
  words: [],
  collections: [],
  enabled: true,
  dictCache: {},
  dictApi: 'auto',
  apiUrl: '',
  authProvider: 'none',
  authToken: '',
  customOAuthConfig: null,
  autoSync: true,
  userInfo: undefined,
};
