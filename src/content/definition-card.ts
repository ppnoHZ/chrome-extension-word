/**
 * 释义卡片 UI —— 点击高亮词时弹出，显示单词释义
 * 纯 vanilla TS，不引入任何框架
 */

import { send } from '@/shared/messaging';
import { t } from '@/shared/i18n';
import type { DictCacheEntry } from '@/shared/types';

const CARD_ID = 'wl-definition-card';
const CARD_CLASS = 'wl-def-card';

let currentCard: HTMLElement | null = null;
let currentAudio: HTMLAudioElement | null = null;

/** 注入卡片样式（只注入一次） */
let styleInjected = false;
function injectStyles(): void {
  if (styleInjected) return;
  styleInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    .${CARD_CLASS} {
      position: fixed;
      z-index: 2147483647;
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      padding: 12px 14px;
      min-width: 240px;
      max-width: 360px;
      max-height: 320px;
      overflow-y: auto;
      font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #333;
      pointer-events: auto;
    }
    .${CARD_CLASS} * {
      box-sizing: border-box;
    }
    .${CARD_CLASS}-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .${CARD_CLASS}-word {
      font-size: 18px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0;
    }
    .${CARD_CLASS}-close {
      margin-left: auto;
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: #999;
      padding: 0 4px;
      line-height: 1;
    }
    .${CARD_CLASS}-close:hover {
      color: #333;
    }
    .${CARD_CLASS}-phonetic {
      display: flex;
      gap: 12px;
      font-size: 13px;
      color: #666;
      margin-bottom: 8px;
    }
    .${CARD_CLASS}-phonetic span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .${CARD_CLASS}-play {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      font-size: 14px;
      color: #1565c0;
    }
    .${CARD_CLASS}-play:hover {
      color: #0d47a1;
    }
    .${CARD_CLASS}-meanings {
      margin: 0;
      padding: 0;
    }
    .${CARD_CLASS}-meaning-group {
      margin-bottom: 8px;
    }
    .${CARD_CLASS}-meaning-group:last-child {
      margin-bottom: 0;
    }
    .${CARD_CLASS}-pos {
      display: inline-block;
      font-size: 12px;
      font-weight: 600;
      color: #1565c0;
      background: #e3f2fd;
      padding: 1px 6px;
      border-radius: 3px;
      margin-bottom: 4px;
    }
    .${CARD_CLASS}-defs {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .${CARD_CLASS}-defs li {
      padding: 3px 0;
      padding-left: 12px;
      position: relative;
      font-size: 13px;
      line-height: 1.5;
      color: #444;
    }
    .${CARD_CLASS}-defs li::before {
      content: "•";
      position: absolute;
      left: 0;
      color: #999;
    }
    .${CARD_CLASS}-loading {
      text-align: center;
      color: #999;
      padding: 16px 0;
    }
    .${CARD_CLASS}-error {
      text-align: center;
      color: #c62828;
      padding: 16px 0;
    }
    .${CARD_CLASS}-source {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #f0f0f0;
      font-size: 11px;
      color: #999;
      text-align: right;
    }
    @media (prefers-color-scheme: dark) {
      .${CARD_CLASS} {
        background: #2a2a2a;
        border-color: #444;
        color: #e0e0e0;
      }
      .${CARD_CLASS}-word {
        color: #fff;
      }
      .${CARD_CLASS}-phonetic {
        color: #aaa;
      }
      .${CARD_CLASS}-pos {
        background: #1e3a5f;
        color: #90caf9;
      }
      .${CARD_CLASS}-defs li {
        color: #ccc;
      }
      .${CARD_CLASS}-defs li::before {
        color: #666;
      }
      .${CARD_CLASS}-close {
        color: #888;
      }
      .${CARD_CLASS}-close:hover {
        color: #fff;
      }
      .${CARD_CLASS}-source {
        border-top-color: #444;
        color: #666;
      }
    }
  `;
  document.head.appendChild(style);
}

/** 隐藏并移除当前卡片 */
export function hideCard(): void {
  // 先移除事件监听器
  document.removeEventListener('click', onDocClick, true);
  document.removeEventListener('keydown', onKeyDown);
  
  if (currentCard) {
    currentCard.remove();
    currentCard = null;
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

/** 点击页面其他地方时关闭卡片 */
function onDocClick(e: MouseEvent): void {
  const target = e.target as Element;
  // 如果点击的是高亮词，不关闭卡片（让 showCard 处理切换）
  if (target.closest('.wl-hl')) {
    return;
  }
  // 如果有选中文本，可能是用户在选词查询，不关闭
  const selection = window.getSelection();
  if (selection && selection.toString().trim()) {
    return;
  }
  if (currentCard && !currentCard.contains(target)) {
    hideCard();
  }
}

/** 按 Esc 关闭卡片 */
function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') hideCard();
}

/**
 * 显示释义卡片
 * @param word 要查询的单词
 * @param anchorRect 锚点元素的 bounding rect（用于定位）
 */
export async function showCard(word: string, anchorRect: DOMRect): Promise<void> {
  console.log('[Word Learn] showCard() called for word:', word);
  injectStyles();
  hideCard();

  // 创建卡片
  console.log('[Word Learn] Creating definition card element');
  const card = document.createElement('div');
  card.id = CARD_ID;
  card.className = CARD_CLASS;
  card.innerHTML = `<div class="${CARD_CLASS}-loading">${t('dict_loading')}</div>`;
  document.body.appendChild(card);
  currentCard = card;
  console.log('[Word Learn] Card appended to body');

  // 定位：优先显示在单词下方，空间不够则显示在上方
  positionCard(card, anchorRect);
  console.log('[Word Learn] Card positioned');

  // 添加事件监听
  document.addEventListener('click', onDocClick, true);
  document.addEventListener('keydown', onKeyDown);

  // 查询释义
  console.log('[Word Learn] About to send lookupWord message for:', word);
  try {
    console.log('[Word Learn] Calling send({ type: lookupWord, word:', word, '})...');
    const res = await send({ type: 'lookupWord', word });
    console.log('[Word Learn] Received lookupWord response:', JSON.stringify(res));
    if (!currentCard) return; // 卡片已被关闭

    if (res && 'ok' in res && res.ok) {
      renderCard(card, res.entry);
    } else {
      const errorMsg = (res && 'error' in res) ? res.error : t('dict_notFound');
      card.innerHTML = `<div class="${CARD_CLASS}-error">${errorMsg}</div>`;
    }
  } catch (err) {
    console.error('[Word Learn] lookupWord error:', err);
    if (currentCard) {
      card.innerHTML = `<div class="${CARD_CLASS}-error">${t('dict_error')}</div>`;
    }
  }
}

function positionCard(card: HTMLElement, anchor: DOMRect): void {
  const margin = 8;
  const viewportH = window.innerHeight;
  const viewportW = window.innerWidth;

  // 先放到 DOM 中测量尺寸
  card.style.visibility = 'hidden';
  card.style.left = '0';
  card.style.top = '0';
  const rect = card.getBoundingClientRect();

  let top: number;
  let left: number;

  // 垂直：优先下方
  if (anchor.bottom + margin + rect.height <= viewportH) {
    top = anchor.bottom + margin;
  } else if (anchor.top - margin - rect.height >= 0) {
    top = anchor.top - margin - rect.height;
  } else {
    top = Math.max(margin, viewportH - rect.height - margin);
  }

  // 水平：与单词左对齐，但不超出屏幕
  left = anchor.left;
  if (left + rect.width > viewportW - margin) {
    left = viewportW - rect.width - margin;
  }
  if (left < margin) left = margin;

  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
  card.style.visibility = 'visible';
}

function renderCard(card: HTMLElement, entry: DictCacheEntry): void {
  const phoneticHtml: string[] = [];
  if (entry.phoneticUk) {
    phoneticHtml.push(`
      <span>
        UK /${entry.phoneticUk}/
        ${entry.speechUk ? `<button class="${CARD_CLASS}-play" data-src="${entry.speechUk}" title="播放英式发音">🔊</button>` : ''}
      </span>
    `);
  }
  if (entry.phoneticUs) {
    phoneticHtml.push(`
      <span>
        US /${entry.phoneticUs}/
        ${entry.speechUs ? `<button class="${CARD_CLASS}-play" data-src="${entry.speechUs}" title="播放美式发音">🔊</button>` : ''}
      </span>
    `);
  }

  // 生成释义 HTML，按词性分组展示
  // 兼容旧格式（string[]）和新格式（DictMeaning[]）
  const meaningsHtml = entry.meanings
    .map((m) => {
      // 检查是否是新格式（对象有 defs 属性）
      if (typeof m === 'object' && m !== null && 'defs' in m) {
        const posHtml = m.pos ? `<span class="${CARD_CLASS}-pos">${escapeHtml(m.pos)}</span>` : '';
        const defsHtml = m.defs.map((d: string) => `<li>${escapeHtml(d)}</li>`).join('');
        return `
          <div class="${CARD_CLASS}-meaning-group">
            ${posHtml}
            <ul class="${CARD_CLASS}-defs">${defsHtml}</ul>
          </div>
        `;
      } else {
        // 旧格式：直接是字符串
        return `
          <div class="${CARD_CLASS}-meaning-group">
            <ul class="${CARD_CLASS}-defs"><li>${escapeHtml(m)}</li></ul>
          </div>
        `;
      }
    })
    .join('');

  // 词典来源显示
  const sourceNames: Record<string, string> = {
    iciba: '金山词霸',
    youdao: '有道翻译',
    freedict: 'Free Dictionary',
  };
  const sourceName = entry.source ? sourceNames[entry.source] || entry.source : '';

  card.innerHTML = `
    <div class="${CARD_CLASS}-header">
      <h3 class="${CARD_CLASS}-word">${escapeHtml(entry.word)}</h3>
      <button class="${CARD_CLASS}-close" title="${t('dict_close')}">&times;</button>
    </div>
    ${phoneticHtml.length ? `<div class="${CARD_CLASS}-phonetic">${phoneticHtml.join('')}</div>` : ''}
    <div class="${CARD_CLASS}-meanings">${meaningsHtml}</div>
    ${sourceName ? `<div class="${CARD_CLASS}-source">来源: ${sourceName}</div>` : ''}
  `;

  // 绑定关闭按钮
  card.querySelector(`.${CARD_CLASS}-close`)?.addEventListener('click', (e) => {
    e.stopPropagation();
    hideCard();
  });

  // 绑定播放按钮
  card.querySelectorAll<HTMLButtonElement>(`.${CARD_CLASS}-play`).forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const src = btn.dataset.src;
      if (src) playAudio(src);
    });
  });
}

function playAudio(src: string): void {
  if (currentAudio) {
    currentAudio.pause();
  }
  currentAudio = new Audio(src);
  currentAudio.play().catch(() => { /* ignore */ });
}

function escapeHtml(str: unknown): string {
  // 确保输入是字符串
  const s = String(str ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 清理事件监听（页面卸载时调用） */
export function cleanup(): void {
  hideCard();
  document.removeEventListener('click', onDocClick, true);
  document.removeEventListener('keydown', onKeyDown);
}
