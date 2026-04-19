import type { Category, Word } from '@/shared/types';

const HL_CLASS = 'wl-hl';
export const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEXTAREA',
  'INPUT',
  'SELECT',
  'OPTION',
  'CODE',
  'PRE',
  'IFRAME',
]);

interface CompiledWord {
  text: string;
  categoryId: string;
}

let compiledRegex: RegExp | null = null;
let wordIndex: Map<string, CompiledWord> = new Map();
let categoryColors: Map<string, string> = new Map();

export function setData(words: Word[], categories: Category[]): void {
  categoryColors = new Map(categories.map((c) => [c.id, c.color]));
  wordIndex = new Map();
  for (const w of words) {
    const key = w.text.toLowerCase();
    if (!key) continue;
    wordIndex.set(key, { text: w.text, categoryId: w.categoryId });
  }
  if (wordIndex.size === 0) {
    compiledRegex = null;
    return;
  }
  // Sort longer phrases first so multi-word entries beat single-word ones.
  const escaped = [...wordIndex.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex);
  // \b works only on ASCII; for our English-learning use case that's acceptable.
  compiledRegex = new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'gi');
}

export function hasData(): boolean {
  return compiledRegex !== null;
}

export function clearHighlights(root: ParentNode = document.body): void {
  const spans = root.querySelectorAll(`span.${HL_CLASS}`);
  spans.forEach((span) => {
    const parent = span.parentNode;
    if (!parent) return;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    parent.removeChild(span);
    parent.normalize();
  });
}

export function highlight(root: Node = document.body): void {
  if (!compiledRegex || !root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.closest(`.${HL_CLASS}`)) return NodeFilter.FILTER_REJECT;
      if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const targets: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) targets.push(n as Text);

  for (const textNode of targets) {
    processTextNode(textNode);
  }
}

function processTextNode(node: Text): void {
  if (!compiledRegex) return;
  const value = node.nodeValue ?? '';
  compiledRegex.lastIndex = 0;
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  const frag = document.createDocumentFragment();
  let matched = false;

  while ((match = compiledRegex.exec(value)) !== null) {
    matched = true;
    const start = match.index;
    const end = start + match[0].length;
    if (start > lastIndex) {
      frag.appendChild(document.createTextNode(value.slice(lastIndex, start)));
    }
    const word = wordIndex.get(match[0].toLowerCase());
    const span = document.createElement('span');
    span.className = HL_CLASS;
    if (word) {
      const color = categoryColors.get(word.categoryId);
      if (color) span.style.setProperty('--wl-color', color);
      span.dataset.wlCategory = word.categoryId;
    }
    span.appendChild(document.createTextNode(match[0]));
    frag.appendChild(span);
    lastIndex = end;
  }

  if (!matched) return;
  if (lastIndex < value.length) {
    frag.appendChild(document.createTextNode(value.slice(lastIndex)));
  }
  node.parentNode?.replaceChild(frag, node);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
