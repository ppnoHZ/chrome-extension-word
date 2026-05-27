/**
 * 释义卡片 UI —— 点击高亮词时弹出，显示单词释义
 * 纯 vanilla TS，不引入任何框架
 */

import { send } from '@/shared/messaging';
import { t } from '@/shared/i18n';
import type { DictCacheEntry, AIAnalysisResult } from '@/shared/types';
import { analyzeWord, getAIStatus } from '@/shared/api';

const CARD_ID = 'wl-definition-card';
const CARD_CLASS = 'wl-def-card';

let currentCard: HTMLElement | null = null;
let currentAudio: HTMLAudioElement | null = null;
let currentWord: string = '';

function extractDomain(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

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
      background: #f5f7ff;
      border: 1px solid #e0e0e0;
      border-radius: 16px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
      padding: 16px 20px;
      min-width: 280px;
      max-width: 360px;
      max-height: 400px;
      overflow-y: auto;
      font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #202124;
      pointer-events: auto;
    }
    .${CARD_CLASS} * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    .${CARD_CLASS}-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .${CARD_CLASS}-word {
      font-size: 24px;
      font-weight: 500;
      color: #1a1a1a;
      margin: 0;
    }
    .${CARD_CLASS}-star {
      background: none;
      border: none;
      font-size: 22px;
      cursor: pointer;
      color: #5f6368;
      line-height: 1;
    }
    .${CARD_CLASS}-star:hover {
      color: #fbbc04;
    }
    .${CARD_CLASS}-phonetic {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }
    .${CARD_CLASS}-phonetic span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #f1f3f4;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 13px;
      color: #3c4043;
    }
    .${CARD_CLASS}-play {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      font-size: 14px;
      color: #5f6368;
      display: flex;
      align-items: center;
    }
    .${CARD_CLASS}-play:hover {
      color: #202124;
    }
    .${CARD_CLASS}-play svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }
    .${CARD_CLASS}-meanings {
      display: block;
      margin: 0;
      padding: 0;
    }
    .${CARD_CLASS}-meaning-group {
      display: block;
      margin-bottom: 12px;
    }
    .${CARD_CLASS}-meaning-group:last-child {
      margin-bottom: 0;
    }
    .${CARD_CLASS}-pos {
      display: inline-block;
      font-size: 15px;
      color: #5f6368;
      margin-right: 6px;
    }
    .${CARD_CLASS}-defs {
      list-style: none;
      display: block;
      border-radius: 8px;
      background: #fff;
      padding: 12px 16px;
    }
    .${CARD_CLASS}-defs li {
      display: block;
      font-size: 15px;
      color: #202124;
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
    .${CARD_CLASS}-footer {
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px solid #ebebeb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .${CARD_CLASS}-toggle-group {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: #202124;
    }
    /* Switch styles */
    .${CARD_CLASS}-switch {
      position: relative;
      display: inline-block;
      width: 36px;
      height: 20px;
    }
    .${CARD_CLASS}-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .${CARD_CLASS}-slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: #4285f4;
      border-radius: 20px;
      transition: .2s;
    }
    .${CARD_CLASS}-slider:before {
      position: absolute;
      content: "";
      height: 16px;
      width: 16px;
      left: 18px;
      bottom: 2px;
      background-color: white;
      border-radius: 50%;
      transition: .2s;
    }
    .${CARD_CLASS}-switch input:not(:checked) + .${CARD_CLASS}-slider {
      background-color: #ccc;
    }
    .${CARD_CLASS}-switch input:not(:checked) + .${CARD_CLASS}-slider:before {
      transform: translateX(-16px);
    }
    .${CARD_CLASS}-more-link {
      font-size: 14px;
      color: #1a73e8;
      cursor: pointer;
      text-decoration: none;
    }
    .${CARD_CLASS}-ai-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      color: #fff;
      padding: 6px 14px;
      border-radius: 16px;
      font-size: 13px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: opacity 0.2s, transform 0.2s;
    }
    .${CARD_CLASS}-ai-btn:hover {
      opacity: 0.9;
      transform: scale(1.02);
    }
    .${CARD_CLASS}-ai-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .${CARD_CLASS}-ai-btn svg {
      width: 14px;
      height: 14px;
    }
    .${CARD_CLASS}-ai-panel {
      margin-top: 16px;
      padding: 16px;
      background: linear-gradient(180deg, #f8f9ff 0%, #fff 100%);
      border-radius: 12px;
      border: 1px solid #e8eaed;
    }
    .${CARD_CLASS}-ai-section {
      margin-bottom: 14px;
    }
    .${CARD_CLASS}-ai-section:last-child {
      margin-bottom: 0;
    }
    .${CARD_CLASS}-ai-title {
      font-size: 13px;
      font-weight: 600;
      color: #5f6368;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .${CARD_CLASS}-ai-title::before {
      content: '';
      width: 3px;
      height: 14px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 2px;
    }
    .${CARD_CLASS}-ai-content {
      font-size: 14px;
      color: #202124;
      line-height: 1.6;
    }
    .${CARD_CLASS}-ai-examples {
      list-style: none;
      padding: 0;
    }
    .${CARD_CLASS}-ai-examples li {
      margin-bottom: 10px;
      padding: 10px;
      background: #fff;
      border-radius: 8px;
      border-left: 3px solid #667eea;
    }
    .${CARD_CLASS}-ai-examples li:last-child {
      margin-bottom: 0;
    }
    .${CARD_CLASS}-ai-example-en {
      font-style: italic;
      color: #1a1a1a;
      margin-bottom: 4px;
    }
    .${CARD_CLASS}-ai-example-cn {
      font-size: 13px;
      color: #5f6368;
    }
    .${CARD_CLASS}-ai-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .${CARD_CLASS}-ai-tag {
      display: inline-block;
      padding: 4px 10px;
      background: #e8f0fe;
      color: #1967d2;
      border-radius: 12px;
      font-size: 12px;
    }
    .${CARD_CLASS}-ai-tag.antonym {
      background: #fce8e6;
      color: #c5221f;
    }
    .${CARD_CLASS}-ai-roots {
      padding: 12px;
      background: #fff;
      border-radius: 8px;
      font-size: 13px;
    }
    .${CARD_CLASS}-ai-roots-parts {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
    }
    .${CARD_CLASS}-ai-roots-part {
      padding: 4px 10px;
      background: #f1f3f4;
      border-radius: 6px;
      font-family: monospace;
    }
    .${CARD_CLASS}-ai-memory {
      padding: 12px;
      background: linear-gradient(135deg, #fff9e6 0%, #fffef5 100%);
      border-radius: 8px;
      border-left: 3px solid #fbbc04;
      font-size: 14px;
      color: #3c4043;
    }
    .${CARD_CLASS}-ai-loading {
      text-align: center;
      padding: 20px;
      color: #5f6368;
    }
    .${CARD_CLASS}-ai-loading::after {
      content: '';
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid #e8eaed;
      border-top-color: #667eea;
      border-radius: 50%;
      animation: wl-spin 0.8s linear infinite;
      margin-left: 8px;
      vertical-align: middle;
    }
    @keyframes wl-spin {
      to { transform: rotate(360deg); }
    }
    .${CARD_CLASS}-ai-error {
      text-align: center;
      color: #c62828;
      padding: 16px;
      font-size: 13px;
    }
    @media (prefers-color-scheme: dark) {
      .${CARD_CLASS} {
        background: #202124;
        border-color: #3c4043;
        color: #e8eaed;
      }
      .${CARD_CLASS}-word {
        color: #e8eaed;
      }
      .${CARD_CLASS}-phonetic span {
        background: #3c4043;
        color: #e8eaed;
      }
      .${CARD_CLASS}-play {
        color: #9aa0a6;
      }
      .${CARD_CLASS}-play:hover {
        color: #e8eaed;
      }
      .${CARD_CLASS}-pos {
        color: #9aa0a6;
      }
      .${CARD_CLASS}-defs li {
        color: #e8eaed;
      }
      .${CARD_CLASS}-toggle-group {
        color: #e8eaed;
      }
      .${CARD_CLASS}-footer {
        border-top-color: #3c4043;
      }
      .${CARD_CLASS}-more-link {
        color: #8ab4f8;
      }
      .${CARD_CLASS}-ai-panel {
        background: linear-gradient(180deg, #292a2d 0%, #202124 100%);
        border-color: #3c4043;
      }
      .${CARD_CLASS}-ai-content {
        color: #e8eaed;
      }
      .${CARD_CLASS}-ai-examples li {
        background: #292a2d;
      }
      .${CARD_CLASS}-ai-example-en {
        color: #e8eaed;
      }
      .${CARD_CLASS}-ai-tag {
        background: #1e3a5f;
        color: #8ab4f8;
      }
      .${CARD_CLASS}-ai-tag.antonym {
        background: #5c2828;
        color: #f28b82;
      }
      .${CARD_CLASS}-ai-roots {
        background: #292a2d;
      }
      .${CARD_CLASS}-ai-roots-part {
        background: #3c4043;
        color: #e8eaed;
      }
      .${CARD_CLASS}-ai-memory {
        background: linear-gradient(135deg, #3c3c00 0%, #2d2d00 100%);
        color: #e8eaed;
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

  currentWord = word;

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
  
  const volumeIcon = `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
  const aiIcon = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`;

  if (entry.phoneticUk) {
    phoneticHtml.push(`
      <span>
        英 [${entry.phoneticUk}]
        ${entry.speechUk ? `<button class="${CARD_CLASS}-play" data-src="${entry.speechUk}" title="播放英式发音">${volumeIcon}</button>` : ''}
      </span>
    `);
  }
  if (entry.phoneticUs) {
    phoneticHtml.push(`
      <span>
        美 [${entry.phoneticUs}]
        ${entry.speechUs ? `<button class="${CARD_CLASS}-play" data-src="${entry.speechUs}" title="播放美式发音">${volumeIcon}</button>` : ''}
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
        `
      } else {
        // 旧格式：直接是字符串
        return `
          <div class="${CARD_CLASS}-meaning-group">
            <ul class="${CARD_CLASS}-defs"><li>${escapeHtml(m)}</li></ul>
          </div>
        `
      }
    })
    .join('');

  card.innerHTML = `
    <div class="${CARD_CLASS}-header">
      <h3 class="${CARD_CLASS}-word">${escapeHtml(entry.word)}</h3>
      <button class="${CARD_CLASS}-star" title="收藏">☆</button>
    </div>
    ${phoneticHtml.length ? `<div class="${CARD_CLASS}-phonetic">${phoneticHtml.join('')}</div>` : ''}
    <div class="${CARD_CLASS}-meanings">${meaningsHtml}</div>
    <div class="${CARD_CLASS}-footer">
      <button class="${CARD_CLASS}-ai-btn" title="AI 智能分析">${aiIcon} AI 分析</button>
      <a href="#" class="${CARD_CLASS}-more-link">详细释义</a>
    </div>
    <div class="${CARD_CLASS}-ai-container"></div>
  `;

  // 绑定听音频按钮
  card.querySelectorAll<HTMLButtonElement>(`.${CARD_CLASS}-play`).forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const src = btn.dataset.src;
      if (src) playAudio(src);
    });
  });

  // 绑定 AI 分析按钮
  const aiBtn = card.querySelector<HTMLButtonElement>(`.${CARD_CLASS}-ai-btn`);
  const aiContainer = card.querySelector<HTMLElement>(`.${CARD_CLASS}-ai-container`);
  if (aiBtn && aiContainer) {
    aiBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await handleAIAnalysis(aiBtn, aiContainer, currentWord);
    });
  }

  // 绑定收藏按钮
  const starBtn = card.querySelector<HTMLButtonElement>(`.${CARD_CLASS}-star`);
  if (starBtn) {
    starBtn.addEventListener('click', async (e) => {
      e.stopPropagation();

      const sourceUrl = location.href;
      const domain = extractDomain(sourceUrl);
      const res = await send({
        type: 'collect',
        payload: {
          text: entry.word,
          sourceUrl,
          sourceTitle: document.title,
          domain,
        },
      });

      if (res.ok) {
        starBtn.textContent = '★';
        starBtn.title = '已收藏';

        const backendSaved = (res as { backendSaved?: boolean }).backendSaved;
        const backendMessage = (res as { backendMessage?: string }).backendMessage;
        if (backendSaved === false) {
          showCollectHint(card, `已收藏到本地，后端未同步${backendMessage ? `：${backendMessage}` : ''}`, true);
        } else {
          showCollectHint(card, '收藏成功，已同步到后端');
        }
      } else {
        showCollectHint(card, '收藏失败，请稍后重试', true);
      }
    });
  }
}

function showCollectHint(card: HTMLElement, message: string, isError = false): void {
  const hint = document.createElement('div');
  hint.textContent = message;
  Object.assign(hint.style, {
    marginTop: '10px',
    padding: '8px 10px',
    borderRadius: '8px',
    fontSize: '12px',
    lineHeight: '1.4',
    color: isError ? '#7f1d1d' : '#14532d',
    background: isError ? '#fee2e2' : '#dcfce7',
    border: `1px solid ${isError ? '#fecaca' : '#bbf7d0'}`,
  } satisfies Partial<CSSStyleDeclaration>);

  card.appendChild(hint);
  setTimeout(() => hint.remove(), 1800);
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

/**
 * 处理 AI 分析按钮点击
 */
async function handleAIAnalysis(
  btn: HTMLButtonElement,
  container: HTMLElement,
  word: string,
): Promise<void> {
  // 如果已经展示了分析结果，则折叠
  if (container.innerHTML) {
    container.innerHTML = '';
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg> AI 分析`;
    return;
  }

  // 检查 AI 配置状态
  const status = await getAIStatus();
  if (!status.configured) {
    container.innerHTML = `<div class="${CARD_CLASS}-ai-panel"><div class="${CARD_CLASS}-ai-error">AI 服务未配置，请在后端设置 AI_API_URL 和 AI_API_KEY</div></div>`;
    return;
  }

  // 显示加载状态
  btn.disabled = true;
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg> 分析中...`;
  container.innerHTML = `<div class="${CARD_CLASS}-ai-panel"><div class="${CARD_CLASS}-ai-loading">AI 正在分析</div></div>`;

  try {
    const result = await analyzeWord(word, ['full']);
    if (!result) {
      container.innerHTML = `<div class="${CARD_CLASS}-ai-panel"><div class="${CARD_CLASS}-ai-error">AI 分析失败，请稍后重试</div></div>`;
      return;
    }

    renderAIPanel(container, result.analysis, result.cached);
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg> 收起分析`;
  } catch (err) {
    console.error('[Word Learn] AI analysis error:', err);
    container.innerHTML = `<div class="${CARD_CLASS}-ai-panel"><div class="${CARD_CLASS}-ai-error">AI 分析失败: ${escapeHtml(String(err))}</div></div>`;
  } finally {
    btn.disabled = false;
  }
}

/**
 * 渲染 AI 分析面板
 */
function renderAIPanel(
  container: HTMLElement,
  analysis: AIAnalysisResult,
  cached: boolean,
): void {
  const sections: string[] = [];

  // 词义详解
  if (analysis.meaning) {
    sections.push(`
      <div class="${CARD_CLASS}-ai-section">
        <div class="${CARD_CLASS}-ai-title">词义详解</div>
        <div class="${CARD_CLASS}-ai-content">
          <strong>${escapeHtml(analysis.meaning.pos)}</strong>
          <div>${escapeHtml(analysis.meaning.cn)}</div>
          <div style="color: #5f6368; font-size: 13px; margin-top: 4px;">${escapeHtml(analysis.meaning.en)}</div>
        </div>
      </div>
    `);
  }

  // 例句
  if (analysis.examples && analysis.examples.length > 0) {
    const examplesHtml = analysis.examples
      .map((ex) => `
        <li>
          <div class="${CARD_CLASS}-ai-example-en">${escapeHtml(ex.en)}</div>
          <div class="${CARD_CLASS}-ai-example-cn">${escapeHtml(ex.cn)}</div>
        </li>
      `)
      .join('');
    sections.push(`
      <div class="${CARD_CLASS}-ai-section">
        <div class="${CARD_CLASS}-ai-title">例句</div>
        <ul class="${CARD_CLASS}-ai-examples">${examplesHtml}</ul>
      </div>
    `);
  }

  // 词根词缀分析
  if (analysis.roots) {
    const parts: string[] = [];
    if (analysis.roots.prefix) parts.push(`<span class="${CARD_CLASS}-ai-roots-part">前缀: ${escapeHtml(analysis.roots.prefix)}</span>`);
    if (analysis.roots.root) parts.push(`<span class="${CARD_CLASS}-ai-roots-part">词根: ${escapeHtml(analysis.roots.root)}</span>`);
    if (analysis.roots.suffix) parts.push(`<span class="${CARD_CLASS}-ai-roots-part">后缀: ${escapeHtml(analysis.roots.suffix)}</span>`);
    
    sections.push(`
      <div class="${CARD_CLASS}-ai-section">
        <div class="${CARD_CLASS}-ai-title">词根词缀</div>
        <div class="${CARD_CLASS}-ai-roots">
          ${parts.length > 0 ? `<div class="${CARD_CLASS}-ai-roots-parts">${parts.join('')}</div>` : ''}
          <div>${escapeHtml(analysis.roots.explanation)}</div>
        </div>
      </div>
    `);
  }

  // 同义词/反义词
  if ((analysis.synonyms && analysis.synonyms.length > 0) || (analysis.antonyms && analysis.antonyms.length > 0)) {
    const tags: string[] = [];
    if (analysis.synonyms) {
      tags.push(...analysis.synonyms.map((s) => `<span class="${CARD_CLASS}-ai-tag">${escapeHtml(s)}</span>`));
    }
    if (analysis.antonyms) {
      tags.push(...analysis.antonyms.map((a) => `<span class="${CARD_CLASS}-ai-tag antonym">${escapeHtml(a)}</span>`));
    }
    sections.push(`
      <div class="${CARD_CLASS}-ai-section">
        <div class="${CARD_CLASS}-ai-title">同义词 / 反义词</div>
        <div class="${CARD_CLASS}-ai-tags">${tags.join('')}</div>
      </div>
    `);
  }

  // 记忆技巧
  if (analysis.memory) {
    sections.push(`
      <div class="${CARD_CLASS}-ai-section">
        <div class="${CARD_CLASS}-ai-title">💡 记忆技巧</div>
        <div class="${CARD_CLASS}-ai-memory">${escapeHtml(analysis.memory)}</div>
      </div>
    `);
  }

  const cacheNote = cached ? '<div style="text-align: right; font-size: 11px; color: #9aa0a6; margin-top: 8px;">⚡ 已缓存</div>' : '';

  container.innerHTML = `
    <div class="${CARD_CLASS}-ai-panel">
      ${sections.join('')}
      ${cacheNote}
    </div>
  `;
}

/** 清理事件监听（页面卸载时调用） */
export function cleanup(): void {
  hideCard();
  document.removeEventListener('click', onDocClick, true);
  document.removeEventListener('keydown', onKeyDown);
}
