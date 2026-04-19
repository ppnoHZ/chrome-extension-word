/**
 * 词典接口封装
 * 支持多个 API 源，可配置选择
 */

import type { DictCacheEntry, DictApiType, DictMeaning } from './types';

// Re-export for convenience
export type { DictCacheEntry };
export type DictionaryEntry = DictCacheEntry;

/**
 * 从词典 API 查询单词释义
 * @param word 要查询的单词
 * @param apiType API 类型：'auto' 自动尝试多个，或指定单个 API
 */
export async function queryDictionary(
  word: string, 
  apiType: DictApiType = 'auto'
): Promise<DictionaryEntry | null> {
  const w = word.trim().toLowerCase();
  if (!w) return null;

  console.log('[Word Learn] queryDictionary called:', w, 'apiType:', apiType);

  if (apiType === 'iciba') {
    return await tryIcibaApi(w);
  } else if (apiType === 'youdao') {
    return await tryYoudaoApi(w);
  } else if (apiType === 'freedict') {
    return await tryFreeDictionaryApi(w);
  } else {
    // auto: 优先获取中文释义，再补充音标
    // 并行请求中文翻译和音标，提高效率
    
    console.log('[Word Learn] Auto mode: fetching Chinese translation and phonetics in parallel');
    
    // 并行发起请求
    const [youdaoResult, icibaResult, myMemoryResult, phoneticResult] = await Promise.all([
      tryYoudaoApi(w).catch(() => null),
      tryIcibaApi(w).catch(() => null),
      tryMyMemoryApi(w).catch(() => null),
      tryFreeDictionaryApi(w).catch(() => null),
    ]);
    
    console.log('[Word Learn] Auto mode results:', {
      youdao: youdaoResult ? 'success' : 'failed',
      iciba: icibaResult ? 'success' : 'failed',
      myMemory: myMemoryResult ? 'success' : 'failed',
      phonetic: phoneticResult ? 'success' : 'failed',
    });
    
    // 选择最佳的中文释义（有道 > 金山词霸 > MyMemory）
    let chineseResult = youdaoResult || icibaResult || myMemoryResult;
    
    // 合并结果
    if (chineseResult) {
      // 有中文释义，补充音标
      if (phoneticResult) {
        chineseResult.phoneticUk = phoneticResult.phoneticUk;
        chineseResult.phoneticUs = phoneticResult.phoneticUs;
        chineseResult.speechUk = phoneticResult.speechUk;
        chineseResult.speechUs = phoneticResult.speechUs;
      }
      return chineseResult;
    }
    
    // 如果中文 API 都失败，返回英文释义
    return phoneticResult;
  }
}

/**
 * 将任意值转换为字符串释义
 * 处理各种 API 返回格式：字符串、对象、数组等
 */
function toMeaningString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    // 数组元素递归转换并拼接
    return value.map(toMeaningString).filter(Boolean).join('; ');
  }
  if (typeof value === 'object') {
    // 尝试提取常见字段
    const obj = value as Record<string, unknown>;
    // 常见释义字段名
    const defKeys = ['definition', 'def', 'meaning', 'means', 'trans', 'tgt', 'value', 'text', 'content'];
    for (const key of defKeys) {
      if (obj[key] != null) {
        const result = toMeaningString(obj[key]);
        if (result) return result;
      }
    }
    // 如果有 part/pos 和 definition
    const pos = obj['part'] || obj['pos'] || obj['partOfSpeech'] || '';
    const def = obj['definition'] || obj['def'] || obj['meaning'] || '';
    if (pos && def) {
      return `${toMeaningString(pos)}. ${toMeaningString(def)}`;
    }
    // 最后尝试 JSON.stringify，但避免 [object Object]
    try {
      const json = JSON.stringify(value);
      // 如果太长或是空对象，返回空
      if (json === '{}' || json.length > 200) return '';
      return json;
    } catch {
      return '';
    }
  }
  return '';
}

/**
 * 将 API 返回的 meanings 统一转换为字符串数组
 */
function normalizeMeanings(raw: unknown): string[] {
  if (!raw) return [];
  if (typeof raw === 'string') return [raw.trim()].filter(Boolean);
  if (Array.isArray(raw)) {
    return raw.map(toMeaningString).filter(Boolean);
  }
  const result = toMeaningString(raw);
  return result ? [result] : [];
}

// 保留旧函数名作为别名，确保向后兼容
export const queryIciba = queryDictionary;

/**
 * 金山词霸 API - 使用多个接口尝试获取音标
 */
async function tryIcibaApi(word: string): Promise<DictionaryEntry | null> {
  // 尝试方法1：爱词霸开放 API
  try {
    const url = `https://dict.iciba.com/dictionary/word/suggestion?word=${encodeURIComponent(word)}&nums=1&is_need_mean=1&version=2`;
    console.log('[Word Learn] Trying iciba suggestion API:', url);
    
    const res = await fetch(url, { 
      headers: { 'Accept': 'application/json' }
    });
    
    if (res.ok) {
      const data = await res.json();
      console.log('[Word Learn] iciba suggestion response:', data);
      
      if (data.message && data.message[0]) {
        const item = data.message[0];
        const meanings: DictMeaning[] = [];
        
        // 尝试解析词性和释义
        if (item.paraphrase) {
          // paraphrase 通常是 "n. 用法；使用" 这样的格式
          const parts = item.paraphrase.split(/[;；]/).map((s: string) => s.trim()).filter(Boolean);
          if (parts.length > 0) {
            meanings.push({ defs: parts });
          }
        } else if (item.means) {
          const defs = normalizeMeanings(item.means);
          if (defs.length > 0) {
            meanings.push({ defs });
          }
        }
        
        if (meanings.length > 0) {
          return {
            word: item.key || word,
            meanings,
            queriedAt: Date.now(),
            source: 'iciba',
          };
        }
      }
    }
  } catch (err) {
    console.warn('[Word Learn] iciba suggestion API failed:', err);
  }
  
  // 尝试方法2：简单接口
  return await tryIcibaSimpleApi(word);
}

/**
 * 金山词霸简单接口（备用）
 */
async function tryIcibaSimpleApi(word: string): Promise<DictionaryEntry | null> {
  try {
    const url = `https://dict-mobile.iciba.com/interface/index.php?c=word&m=getsuggest&nums=1&is_need_mean=1&word=${encodeURIComponent(word)}`;
    console.log('[Word Learn] Trying iciba simple API:', url);
    
    const res = await fetch(url, { 
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return null;
    
    const data = await res.json();
    console.log('[Word Learn] iciba simple response:', data);
    
    if (data.status === 1 && data.message?.length > 0) {
      const item = data.message[0];
      if (item.means) {
        const defs = normalizeMeanings(item.means);
        if (defs.length > 0) {
          const meanings: DictMeaning[] = [{ defs }];
          return {
            word: item.key || word,
            meanings,
            queriedAt: Date.now(),
            source: 'iciba',
          };
        }
      }
    }
    return null;
  } catch (err) {
    console.warn('[Word Learn] iciba simple API failed:', err);
    return null;
  }
}

/**
 * 有道翻译 API
 */
async function tryYoudaoApi(word: string): Promise<DictionaryEntry | null> {
  try {
    // 使用有道翻译接口
    const url = `https://fanyi.youdao.com/translate?&doctype=json&type=AUTO&i=${encodeURIComponent(word)}`;
    console.log('[Word Learn] Trying youdao API:', url);
    
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    console.log('[Word Learn] youdao response status:', res.status);
    if (!res.ok) {
      console.warn('[Word Learn] youdao API returned non-OK status:', res.status);
      return null;
    }
    
    const data = await res.json();
    console.log('[Word Learn] youdao response:', JSON.stringify(data));
    
    // 解析翻译结果
    if (data.translateResult && data.translateResult[0]) {
      const defs = normalizeMeanings(
        data.translateResult[0].map((item: { tgt?: unknown }) => item.tgt)
      );
      
      if (defs.length > 0) {
        // 有道翻译不返回词性，统一放在一个组里
        const meanings: DictMeaning[] = [{ defs }];
        return {
          word: word,
          meanings,
          queriedAt: Date.now(),
          source: 'youdao',
        };
      }
    }
    return null;
  } catch (err) {
    console.warn('[Word Learn] youdao API failed:', err);
    return null;
  }
}

/**
 * MyMemory 翻译 API（备用，免费且支持 CORS）
 */
async function tryMyMemoryApi(word: string): Promise<DictionaryEntry | null> {
  try {
    // MyMemory 是一个免费的翻译 API
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|zh-CN`;
    console.log('[Word Learn] Trying MyMemory API:', url);
    
    const res = await fetch(url);
    if (!res.ok) return null;
    
    const data = await res.json();
    console.log('[Word Learn] MyMemory response:', data);
    
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      const translation = data.responseData.translatedText;
      // 过滤掉原文相同的翻译（表示没有翻译成功）
      if (translation.toLowerCase() !== word.toLowerCase()) {
        const meanings: DictMeaning[] = [{ defs: [translation] }];
        return {
          word: word,
          meanings,
          queriedAt: Date.now(),
          source: 'youdao', // 标记为 youdao 以保持一致性
        };
      }
    }
    return null;
  } catch (err) {
    console.warn('[Word Learn] MyMemory API failed:', err);
    return null;
  }
}

/**
 * Free Dictionary API（英文释义，作为后备）
 */
async function tryFreeDictionaryApi(word: string): Promise<DictionaryEntry | null> {
  try {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    console.log('[Word Learn] Trying free dictionary API:', url);
    
    const res = await fetch(url);
    if (!res.ok) return null;
    
    const data = await res.json();
    console.log('[Word Learn] free dictionary response:', data);
    
    if (!Array.isArray(data) || data.length === 0) return null;
    
    const entry = data[0];
    const meanings: DictMeaning[] = [];
    
    // 提取音标 - Free Dictionary 的音标在 phonetic 字段或 phonetics 数组中
    let phoneticUk: string | undefined;
    let phoneticUs: string | undefined;
    let speechUk: string | undefined;
    let speechUs: string | undefined;
    
    // 首先检查顶层 phonetic 字段
    if (entry.phonetic) {
      phoneticUk = entry.phonetic;
      phoneticUs = entry.phonetic;
    }
    
    // 然后从 phonetics 数组提取更详细的信息
    if (entry.phonetics && Array.isArray(entry.phonetics)) {
      for (const p of entry.phonetics) {
        // 提取文本音标
        if (p.text) {
          // 根据 audio URL 判断是英式还是美式
          if (p.audio) {
            if (p.audio.includes('-uk') || p.audio.includes('/uk/')) {
              phoneticUk = p.text;
              speechUk = p.audio;
            } else if (p.audio.includes('-us') || p.audio.includes('/us/')) {
              phoneticUs = p.text;
              speechUs = p.audio;
            } else {
              // 默认作为第一个可用音标
              if (!phoneticUk) {
                phoneticUk = p.text;
                speechUk = p.audio;
              }
            }
          } else {
            // 没有 audio 的情况，作为默认音标
            if (!phoneticUk) phoneticUk = p.text;
            if (!phoneticUs) phoneticUs = p.text;
          }
        } else if (p.audio) {
          // 只有音频没有文本的情况
          if (p.audio.includes('-uk') || p.audio.includes('/uk/')) {
            if (!speechUk) speechUk = p.audio;
          } else if (p.audio.includes('-us') || p.audio.includes('/us/')) {
            if (!speechUs) speechUs = p.audio;
          }
        }
      }
    }
    
    console.log('[Word Learn] Extracted phonetics:', { phoneticUk, phoneticUs, speechUk, speechUs });
    
    // 提取释义，按词性分组
    if (entry.meanings) {
      for (const m of entry.meanings) {
        const pos = m.partOfSpeech || undefined;
        const defs: string[] = [];
        if (m.definitions) {
          for (const d of m.definitions.slice(0, 3)) { // 每个词性最多3个释义
            const def = d.definition;
            if (def) {
              defs.push(def);
            }
          }
        }
        if (defs.length > 0) {
          meanings.push({ pos, defs });
        }
      }
    }
    
    if (meanings.length === 0) return null;
    
    return {
      word: entry.word || word,
      phoneticUk,
      phoneticUs: phoneticUs || phoneticUk,
      speechUk,
      speechUs,
      meanings,
      queriedAt: Date.now(),
      source: 'freedict',
    };
  } catch (err) {
    console.warn('[Word Learn] free dictionary API failed:', err);
    return null;
  }
}
