import { send } from '@/shared/messaging';
import { t } from '@/shared/i18n';

const CONTEXT_RADIUS = 80;

/**
 * 从 URL 提取域名
 */
function extractDomain(url: string): string | undefined {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    return undefined;
  }
}

/**
 * Listen for keyboard shortcuts on selections:
 *   Alt+S → save selection as a Collection (with source URL + context).
 *   Alt+W → add selection to the highlight word list (dictionary).
 * Both also reachable via right-click context menu (handled in background).
 */
export function installCollector(): void {
  document.addEventListener('keydown', (e) => {
    if (!e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 's') void collectSelection();
    else if (key === 'w') void addSelectionAsWord();
  });
}

async function addSelectionAsWord(): Promise<void> {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  const text = sel.toString().trim();
  if (!text) return;
  const range = sel.getRangeAt(0);
  const domain = extractDomain(location.href);
  const res = await send({ type: 'addWord', text, domain });
  if (res.ok) {
    flashFeedback(range, res.added ? t('feedback_wordAdded') : t('feedback_wordExists'));
  }
}

async function collectSelection(): Promise<void> {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  const text = sel.toString().trim();
  if (!text) return;

  const range = sel.getRangeAt(0);
  const context = buildContext(range, text);
  const domain = extractDomain(location.href);

  // IMPORTANT: capture URL/title from THIS frame, not the top window.
  await send({
    type: 'collect',
    payload: {
      text,
      sourceUrl: location.href,
      sourceTitle: document.title,
      context,
      domain,
    },
  });
  flashFeedback(range, t('feedback_saved'));
}

function buildContext(range: Range, selectedText: string): string {
  const container = range.commonAncestorContainer;
  const block =
    (container.nodeType === Node.ELEMENT_NODE
      ? (container as Element)
      : container.parentElement
    )?.closest('p, li, blockquote, article, section, div') ?? null;
  const fullText = (block?.textContent ?? selectedText).replace(/\s+/g, ' ').trim();
  const idx = fullText.toLowerCase().indexOf(selectedText.toLowerCase());
  if (idx < 0) return fullText.slice(0, CONTEXT_RADIUS * 2);
  const start = Math.max(0, idx - CONTEXT_RADIUS);
  const end = Math.min(fullText.length, idx + selectedText.length + CONTEXT_RADIUS);
  return (start > 0 ? '…' : '') + fullText.slice(start, end) + (end < fullText.length ? '…' : '');
}

function flashFeedback(range: Range, message: string): void {
  try {
    const rect = range.getBoundingClientRect();
    const tip = document.createElement('div');
    tip.className = 'wl-flash';
    tip.textContent = message;
    Object.assign(tip.style, {
      position: 'fixed',
      left: `${rect.left}px`,
      top: `${Math.max(0, rect.top - 24)}px`,
      background: 'rgba(0,0,0,0.8)',
      color: '#fff',
      font: '12px/1.2 system-ui, sans-serif',
      padding: '2px 6px',
      borderRadius: '3px',
      zIndex: '2147483647',
      pointerEvents: 'none',
      transition: 'opacity 200ms',
    } satisfies Partial<CSSStyleDeclaration>);
    document.documentElement.appendChild(tip);
    setTimeout(() => {
      tip.style.opacity = '0';
    }, 600);
    setTimeout(() => tip.remove(), 1000);
  } catch {
    /* ignore */
  }
}
