import { send } from '@/shared/messaging';
import { clearHighlights, hasData, highlight, setData, SKIP_TAGS, HL_CLASS } from './highlighter';
import { installCollector } from './collector';
import { showCard } from './definition-card';

/**
 * Pre-render highlights this many pixels outside the viewport so they appear
 * smoothly while the user is still scrolling toward them.
 */
const VIEWPORT_MARGIN_PX = 400;
/** Debounce window for batching DOM mutations before rescanning for new blocks. */
const MUTATION_DEBOUNCE_MS = 250;

/**
 * Marks elements we have already highlighted (or scheduled to highlight),
 * so we never re-process the same subtree.
 */
const PROCESSED_ATTR = 'data-wl-processed';

/** Block-ish tags whose direct text we want to lazy-highlight as a unit. */
const TEXT_BLOCK_TAGS = new Set([
  'P', 'LI', 'DD', 'DT', 'BLOCKQUOTE', 'FIGCAPTION', 'SUMMARY',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'TD', 'TH', 'CAPTION',
  'ARTICLE', 'SECTION', 'ASIDE', 'MAIN', 'HEADER', 'FOOTER',
  'DIV', 'SPAN', 'A', 'EM', 'STRONG', 'B', 'I', 'LABEL', 'BUTTON',
]);

let io: IntersectionObserver | null = null;
let mo: MutationObserver | null = null;
let mutationTimer: ReturnType<typeof setTimeout> | null = null;

// Skip frames where messaging/storage is unreliable.
if (location.protocol === 'about:' || location.protocol === 'data:') {
  // no-op
} else {
  void bootstrap();
}

async function bootstrap(): Promise<void> {
  installCollector();
  installClickHandler();
  installSelectionHandler();
  installKeyboardShortcuts();
  await refresh();

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'wordsUpdated') void refresh();
    // 右键菜单查询释义
    if (msg?.type === 'showLookup' && msg.word) {
      const selection = window.getSelection();
      let rect: DOMRect | null = null;
      if (selection && selection.rangeCount > 0) {
        rect = selection.getRangeAt(0).getBoundingClientRect();
      }
      // 如果没有有效的选区位置，使用屏幕中心
      if (!rect || rect.width === 0) {
        rect = new DOMRect(window.innerWidth / 2 - 100, window.innerHeight / 3, 200, 20);
      }
      void showCard(msg.word, rect);
    }
  });

  // SPA navigation: re-highlight on history changes.
  patchHistory();
  window.addEventListener('wl:locationchange', () => {
    void refresh();
  });
}

/** Alt+D 快捷键查询选中文本 */
function installKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    // Alt+D: 查询当前选中的文本
    if (e.altKey && e.key.toLowerCase() === 'd') {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (text && /^[a-zA-Z]+(?:[-'][a-zA-Z]+)*$/.test(text)) {
        e.preventDefault();
        const range = selection?.getRangeAt(0);
        if (range) {
          console.log('[Word Learn] Alt+D lookup:', text);
          void showCard(text, range.getBoundingClientRect());
        }
      }
    }
  });
}

/** 事件委托：点击高亮词时显示释义卡片 */
function installClickHandler(): void {
  console.log('[Word Learn] Installing click handler for highlighted words');
  document.addEventListener('click', (e) => {
    const target = e.target as Element;
    console.log('[Word Learn] Click event, target:', target.tagName, target.className);
    const hlSpan = target.closest(`.${HL_CLASS}`);
    if (hlSpan) {
      console.log('[Word Learn] Clicked on highlighted word:', hlSpan.textContent);
      e.preventDefault();
      e.stopPropagation();
      const word = hlSpan.textContent?.trim();
      if (word) {
        const rect = hlSpan.getBoundingClientRect();
        console.log('[Word Learn] Showing card for word:', word);
        void showCard(word, rect);
      }
    }
  }, true);
}

/** 选中文本时显示释义卡片（双击或拖选单词） */
function installSelectionHandler(): void {
  console.log('[Word Learn] Installing selection handler for any word lookup');
  
  // 用于防止双击和 mouseup 重复触发
  let lastShownWord = '';
  let lastShownTime = 0;
  
  const tryShowCard = (text: string, rect: DOMRect) => {
    const now = Date.now();
    // 300ms 内同一个词不重复触发
    if (text === lastShownWord && now - lastShownTime < 300) {
      return;
    }
    lastShownWord = text;
    lastShownTime = now;
    console.log('[Word Learn] Selection lookup for:', text);
    void showCard(text, rect);
  };
  
  // 双击选词
  document.addEventListener('dblclick', (e) => {
    const target = e.target as Node;
    const element = target.nodeType === Node.TEXT_NODE ? target.parentElement : target as Element;
    // 如果在卡片内部双击选词，不再触发弹窗
    if (element && typeof element.closest === 'function' && element.closest('.wl-def-card')) {
      return;
    }
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    // 只处理单个单词（无空格）
    if (text && /^[a-zA-Z]+(?:[-'][a-zA-Z]+)*$/.test(text)) {
      const range = selection?.getRangeAt(0);
      if (range) {
        tryShowCard(text, range.getBoundingClientRect());
      }
    }
  });
  
  // 拖选后松开鼠标
  document.addEventListener('mouseup', (e) => {
    const target = e.target as Node;
    const element = target.nodeType === Node.TEXT_NODE ? target.parentElement : target as Element;
    // 如果在卡片内部拖选，不再触发弹窗
    if (element && typeof element.closest === 'function' && element.closest('.wl-def-card')) {
      return;
    }
    // 延迟一点让选区稳定
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      // 只处理单个单词（无空格）
      if (text && /^[a-zA-Z]+(?:[-'][a-zA-Z]+)*$/.test(text) && selection?.rangeCount) {
        const range = selection.getRangeAt(0);
        if (!range.collapsed) {
          tryShowCard(text, range.getBoundingClientRect());
        }
      }
    }, 50);
  });
}

async function refresh(): Promise<void> {
  try {
    const data = await send({ type: 'getHighlightData' });
    teardownObservers();
    clearHighlights();
    if (!data || !data.enabled) return;
    setData(data.words, data.categories);
    if (!hasData() || !document.body) return;
    setupObservers();
    scanAndObserve(document.body);
  } catch {
    /* extension context invalidated, etc. */
  }
}

function setupObservers(): void {
  io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as Element;
        io?.unobserve(el);
        if (el.getAttribute(PROCESSED_ATTR) === '1') continue;
        el.setAttribute(PROCESSED_ATTR, '1');
        highlight(el);
      }
    },
    { rootMargin: `${VIEWPORT_MARGIN_PX}px` },
  );

  mo = new MutationObserver((mutations) => {
    if (mutationTimer) clearTimeout(mutationTimer);
    const addedRoots: Node[] = [];
    const dirtyContainers = new Set<Element>();
    for (const m of mutations) {
      m.addedNodes.forEach((n) => addedRoots.push(n));
      if (m.type === 'characterData' && m.target.parentElement) {
        // Text inside an already-processed container changed — re-highlight that block only.
        const container = m.target.parentElement.closest(`[${PROCESSED_ATTR}="1"]`);
        if (container) dirtyContainers.add(container);
      }
    }
    mutationTimer = setTimeout(() => {
      for (const root of addedRoots) {
        if (root.nodeType === Node.ELEMENT_NODE) scanAndObserve(root as Element);
      }
      for (const c of dirtyContainers) {
        clearHighlights(c);
        highlight(c);
      }
    }, MUTATION_DEBOUNCE_MS);
  });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });
}

function teardownObservers(): void {
  io?.disconnect();
  io = null;
  mo?.disconnect();
  mo = null;
  if (mutationTimer) {
    clearTimeout(mutationTimer);
    mutationTimer = null;
  }
  document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach((el) => {
    el.removeAttribute(PROCESSED_ATTR);
  });
}

/**
 * Walk `root` and start observing every text-bearing block container.
 * "Text-bearing" = the element has at least one direct, non-whitespace text-node child.
 * We treat accepted containers as leaves (don't descend further) so a containing
 * highlight call covers all nested text without double-observing.
 */
function scanAndObserve(root: Node): void {
  if (!io) return;
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const candidates: Element[] = [];
  collectTopTextContainers(root as Element, candidates);
  for (const el of candidates) io.observe(el);
}

function collectTopTextContainers(el: Element, out: Element[]): void {
  if (SKIP_TAGS.has(el.tagName)) return;
  if (el.getAttribute(PROCESSED_ATTR) === '1') return;
  if ((el as HTMLElement).isContentEditable) return;
  if (isTextContainer(el)) {
    out.push(el);
    return; // treat as leaf; highlight() walks all text inside
  }
  for (const child of el.children) {
    collectTopTextContainers(child, out);
  }
}

function isTextContainer(el: Element): boolean {
  if (!TEXT_BLOCK_TAGS.has(el.tagName)) return false;
  for (const child of el.childNodes) {
    if (
      child.nodeType === Node.TEXT_NODE &&
      child.nodeValue &&
      child.nodeValue.trim().length > 0
    ) {
      return true;
    }
  }
  return false;
}

function patchHistory(): void {
  const fire = () => window.dispatchEvent(new Event('wl:locationchange'));
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function (...args) {
    const r = origPush.apply(this, args);
    fire();
    return r;
  };
  history.replaceState = function (...args) {
    const r = origReplace.apply(this, args);
    fire();
    return r;
  };
  window.addEventListener('popstate', fire);
}
