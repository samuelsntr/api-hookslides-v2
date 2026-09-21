# HookSlides AI server

## Setup

```bash
cd server
cp .env.example .env
npm install
npm run migrate
npm test
npm start
```

Set at least one of `GROQ_API_KEY` or `OPENAI_API_KEY`. Groq is primary when configured; OpenAI is fallback. `DATABASE_PATH` defaults to `./data/hookslides.sqlite`.

## Endpoints

- `POST /api/generate` — `{ input, sourceType, strategy, template, language? }`
- `POST /api/extract` — `{ input, sourceType }`
- `GET /api/history?page=1&limit=20`
- `GET /api/history/:id`
- `DELETE /api/history/:id`
- `GET /api/history/:id/editor` (Creator/Pro)
- `PATCH /api/history/:id/editor` (Creator/Pro, revision protected)
- `GET /health`

Supported source types: `topic`, `article`, `youtube`. Article extraction uses Mozilla Readability after a size-limited, public-URL-only fetch. YouTube extraction uses the free `youtube-transcript` InnerTube/web fallback and accepts watch, short-link, Shorts, and embed URLs. Supported strategies: `viral_hook`, `storytelling`, `actionable_value`. Templates: `template_1`, `template_2`, `template_3`, `template_4`.

Generated URL-based carousels include a `source` object with the original normalized URL, source title, publisher domain, and (for YouTube when available) channel name. Topic carousels return `source: null`.

`language` accepts `english` (default) or `indonesian`. The selected language is enforced throughout summarization, editorial planning, slides, captions, and hashtags.

History is anonymous. Authentication, payments, background jobs, editable layouts, and export rendering are outside this MVP.
