import { send } from '@/shared/messaging';
import { clearHighlights, hasData, highlight, setData, SKIP_TAGS } from './highlighter';
import { installCollector } from './collector';

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
  await refresh();

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'wordsUpdated') void refresh();
  });

  // SPA navigation: re-highlight on history changes.
  patchHistory();
  window.addEventListener('wl:locationchange', () => {
    void refresh();
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
