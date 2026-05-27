# AGENTS.md

> Project status: **active development**. Core features are implemented; iterating on new functionality.

## Project overview

A Chrome browser extension to help users **learn English by highlighting words on any webpage**.

**Core features:**
- **Highlight words** on any page based on user-managed word lists
- **Categories**: words belong to categories (e.g. "GRE", "business") with custom highlight colors
- **Collection**: select text and save it with source URL, title, and context snippet
- **Dictionary lookup**: click highlighted words to see definitions (iCiba, Youdao, FreeDictionary APIs)
- **System word library**: admin-managed master word lists (GRE vocabulary, etc.) separate from user data
- **AI analysis**: deep word analysis (meaning, examples, roots, synonyms, memory tips) via configurable AI API
- **Domain tracking**: track which websites words/collections came from for filtering

**Architecture:** Dual-storage (offline-first chrome.storage.local + optional backend sync to MySQL).

## Tech stack

| Layer | Stack |
|-------|-------|
| Extension | TypeScript, Vite + `@crxjs/vite-plugin`, Manifest V3 |
| Popup/Options UI | Vue 3 (`<script setup>` + Composition API) |
| Content scripts | Vanilla TypeScript (no framework — minimal footprint) |
| Backend | Python 3.11+, FastAPI, SQLAlchemy, MySQL |
| Auth | GitHub OAuth, custom OAuth2 providers, JWT |

## Project layout

```
words/
├── src/
│   ├── background/index.ts      # Service worker: messaging hub, storage, dictionary lookup
│   ├── content/
│   │   ├── index.ts             # Content script entry
│   │   ├── highlighter.ts       # DOM word highlighting
│   │   ├── collector.ts         # Selection → save (extracts domain from URL)
│   │   └── definition-card.ts   # Popup card with dict + AI analysis
│   ├── popup/                   # Vue 3 toolbar popup
│   ├── options/                 # Vue 3 options page
│   └── shared/
│       ├── types.ts             # Word, Collection, SystemWord, AIAnalysisResult, etc.
│       ├── storage.ts           # Typed chrome.storage.local wrappers
│       ├── messaging.ts         # Typed message contracts
│       ├── api.ts               # Backend API client (sync, AI, system words)
│       └── dictionary.ts        # Dictionary API queries
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app factory
│   │   ├── config.py            # Settings from env (incl. AI_API_URL, AI_API_KEY)
│   │   ├── models/              # SQLAlchemy: User, Word, Collection, SystemWord, AIAnalysis
│   │   ├── schemas/             # Pydantic DTOs
│   │   ├── routers/
│   │   │   ├── auth.py          # OAuth login flows
│   │   │   ├── sync.py          # Upload/download user data
│   │   │   ├── system_words.py  # System word library CRUD
│   │   │   ├── words.py         # Combined query (user + system), domain filtering
│   │   │   └── ai.py            # AI analysis endpoint
│   │   └── services/
│   │       └── ai.py            # OpenAI-compatible API calls + caching
│   └── schema.sql               # Full MySQL DDL
└── public/_locales/             # i18n (en, zh_CN)
```

## Build / run commands

**Frontend (extension):**
```bash
cd words
npm install
npm run dev      # watch build → dist/
npm run build    # production build
```
Load unpacked: `chrome://extensions` → Developer mode → **Load unpacked** → select `dist/`

**Backend:**
```bash
cd words/backend
uv sync                    # or: pip install -r requirements.txt
uv run python main.py      # starts on http://localhost:8000
```
- API docs: http://localhost:8000/docs
- Apply schema: run `schema.sql` against MySQL

**Always run `npm run build`** after non-trivial frontend changes to catch TypeScript/manifest errors.

## Key conventions

### CSS isolation
Every class injected into host pages MUST be prefixed `wl-` (word-learn). See [src/styles/highlight.css](src/styles/highlight.css).

### Content script safety
- Walk text nodes only; skip `<script>`, `<style>`, `<textarea>`, `<input>`, `contenteditable`
- Never use `innerHTML` on host page content
- Construct DOM with `document.createElement` / `createTextNode`

### Storage shape
```ts
interface Word {
  text: string;
  categoryId: string;
  domain?: string;    // extracted hostname
  addedAt: number;
}
interface Collection {
  id: string;
  text: string;
  sourceUrl: string;  // REQUIRED — core product requirement
  sourceTitle: string;
  domain?: string;    // extracted hostname for filtering
  context?: string;
  collectedAt: number;
}
```

### Messaging
All `chrome.runtime.sendMessage` payloads go through typed helpers in [src/shared/messaging.ts](src/shared/messaging.ts). No untyped `any`.

### Backend API patterns
- Auth: Bearer token in `Authorization` header
- All user data endpoints require authentication
- System word endpoints (`/api/system/*`) are public read, admin write
- AI endpoint caches results in `ai_analyses` table (configurable TTL)

## Pitfalls

- **MV3 service workers are ephemeral** — persist state to `chrome.storage`, not memory
- **Content scripts can't access `chrome.tabs`** — route via background worker
- **Cross-origin iframes**: content script runs with `all_frames: true`; capture `location.href` from the frame, not parent
- **SPA navigation**: use `MutationObserver` + `history.pushState` patches for re-highlighting
- **AI requires config**: set `AI_API_URL` and `AI_API_KEY` env vars in backend

## Environment variables (backend)

```bash
# Required
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=xxx
MYSQL_DATABASE=words

# Optional OAuth
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Optional AI analysis
AI_API_URL=https://api.openai.com/v1  # or custom endpoint
AI_API_KEY=sk-...
AI_MODEL=gpt-4o-mini
```

## When in doubt

Ask before:
- Changing build toolchain or swapping Vue 3 / Vite
- Adding runtime dependencies to content scripts (keep bundle minimal)
- Introducing new network calls (extension should work offline-first)
- Modifying database schema (coordinate with frontend types)
