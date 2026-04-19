# AGENTS.md

> Project status: **greenfield**. The workspace is empty. This document defines the intended architecture and conventions for the Chrome extension before code is written. Update it as decisions are made or change.

## Project overview

A Chrome browser extension to help users **learn English by highlighting words on any webpage**.

Core features:
- **Highlight words** on the current page based on user-managed word lists.
- **Categories**: words belong to categories (e.g. "GRE", "business", "phrasal verbs"); each category has its own highlight color.
- **Collection**: select text or a single word on a page and save it. The source URL, page title, and a short surrounding context snippet must be stored with each entry.
- **Review / management UI** in the extension popup or options page to browse, categorize, recolor, edit, and delete collected words.

The extension is a **personal English-learning tool**, not a commercial product. Optimize for simplicity and a clean local-first data model over scalability.

## Tech stack (decided)

- **Manifest V3** Chrome extension (MV2 is deprecated).
- **TypeScript** for all extension code — `strict: true` in `tsconfig.json`.
- **Vite** + `@crxjs/vite-plugin` for bundling the extension (HMR for popup/options, automatic manifest handling).
- **Vue 3** with `<script setup>` + Composition API for the popup and options UI. Use **Pinia** for shared state if the UI grows beyond a couple of views; otherwise plain `ref`/`reactive` is fine.
- Content scripts use **vanilla TypeScript + DOM APIs** — do *not* mount Vue inside host pages. Keep the injected footprint tiny and avoid style/runtime collisions.
- **chrome.storage.local** as the source of truth for word lists and collected entries. Avoid `localStorage` (not available in service workers and not synced with extension contexts).

## Suggested project layout

```
manifest.json              # MV3 manifest
src/
  background/              # service worker: messaging hub, storage orchestration
    index.ts
  content/                 # content scripts (vanilla TS, no Vue): DOM scanning + highlighting
    index.ts               #   entry; runs in every frame (all_frames: true)
    highlighter.ts         #   wraps matched words in <span class="wl-hl wl-cat-…">
    collector.ts           #   handles selection -> save message
  popup/                   # toolbar popup UI (Vue 3)
    index.html
    main.ts
    App.vue
  options/                 # full management UI (Vue 3): categories, lists, colors, export
    index.html
    main.ts
    App.vue
  shared/
    storage.ts             # typed wrappers around chrome.storage.local
    types.ts               # Word, Category, Collection types
    messaging.ts           # typed chrome.runtime message contracts
  styles/
    highlight.css          # injected highlight styles, scoped via wl- prefix
```

## Conventions

- **CSS isolation**: every class injected into pages MUST be prefixed `wl-` (word-learn) to avoid clashing with host page styles. Prefer a single injected stylesheet over inline styles.
- **DOM safety**: the highlighter must walk text nodes only (skip `<script>`, `<style>`, `<textarea>`, `<input>`, `contenteditable`). Never use `innerHTML` on host page content—construct nodes with `document.createTextNode` / `document.createElement`.
- **Word matching**: case-insensitive, whole-word (use `\b…\b` or Unicode-aware boundaries). Do not highlight inside already-highlighted spans (idempotent re-runs).
- **Performance**: throttle re-highlighting on DOM mutations with `MutationObserver` + a debounce (~250 ms). Bail out on pages with > N nodes to avoid jank.
- **Storage shape** (target):
  ```ts
  type Category = { id: string; name: string; color: string /* hex */ };
  type Word     = { text: string; categoryId: string; addedAt: number };
  type Collection = {
    id: string; text: string; categoryId?: string;
    sourceUrl: string; sourceTitle: string; context?: string; collectedAt: number;
  };
  ```
  **Every collection entry MUST persist `sourceUrl`** — this is a core product requirement.
- **Messaging**: all `chrome.runtime.sendMessage` payloads go through typed helpers in `shared/messaging.ts`. No untyped `any` messages.
- **i18n**: UI strings should support both English and Chinese (项目作者使用中文). Use `chrome.i18n` with `_locales/en` and `_locales/zh_CN` once the UI stabilizes.

## Build / run / test

To be defined when the stack is chosen. Once configured, document here:
- `npm run dev` — watch build to `dist/`
- `npm run build` — production build
- Load unpacked: `chrome://extensions` → Developer mode → **Load unpacked** → select `dist/`
- `npm test` — unit tests (recommend Vitest)

Agents should run the build after non-trivial changes to catch manifest/TS errors before handing control back.

## Pitfalls

- **MV3 service workers are ephemeral** — do not hold in-memory state; persist to `chrome.storage`.
- **Content scripts cannot access `chrome.tabs`** — route those calls via the background worker.
- **Host page CSP** can block injected `<style>` from remote URLs; ship CSS as an extension resource and inject via `chrome.scripting.insertCSS`.
- **Cross-origin iframes are in scope**: the content script is registered with `all_frames: true` and `match_origin_as_fallback: true`. Each frame runs its own highlighter instance, so:
  - Use `chrome.runtime.sendMessage` from frames to the background worker; never assume the top frame can reach a child frame's DOM.
  - When collecting a selection, capture `location.href` and `document.title` **from the frame that owns the selection**, then forward to the background worker — the top page's URL is often not what the user is actually reading.
  - Guard against running inside `about:blank` / `data:` frames where storage/messaging may be unavailable.
- **PDF viewer**: Chrome's built-in PDF viewer does not allow content-script injection; treat PDFs as out of scope unless explicitly requested.
- **Re-highlighting on SPA navigation**: many sites (YouTube, Twitter) do not fire full page loads. Listen to `MutationObserver` and `history.pushState` patches.

## When in doubt

Ask the user (project is in Chinese, replies in Chinese are welcome) before:
- changing the build toolchain or swapping out Vue 3 / Vite,
- adding runtime dependencies (especially anything that ships into content scripts — keep that bundle minimal),
- requesting broad host permissions (`<all_urls>` is acceptable for this use case but call it out),
- introducing remote network calls (the extension should work fully offline).
