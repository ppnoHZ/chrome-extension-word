# Word Learn

A Chrome (Manifest V3) extension that helps you learn English by **highlighting words** on any webpage and **collecting** selected text/snippets together with the source URL.

See [AGENTS.md](AGENTS.md) for architecture, conventions, and pitfalls.

## Quick start

```bash
npm install
npm run dev      # watch build to dist/
# or
npm run build    # production build
```

Then load the extension:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` folder

## Usage

- Click the toolbar icon to open the popup. Add words and pick a category.
- Right-click selected text → **Word Learn: collect "..."** to save a snippet (source URL is recorded).
- Or select text and press **Alt+S** to collect.
- Open the options page to manage categories, colors, the highlight list, and review/export collections.

## Stack

TypeScript · Vite · `@crxjs/vite-plugin` · Vue 3 (popup/options) · vanilla TS (content scripts) · `chrome.storage.local`.
