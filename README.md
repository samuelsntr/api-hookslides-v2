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

`UPLOADS_PATH` defaults to `./uploads`. Brand logos are validated and normalized into `UPLOADS_PATH/brand-logos`. In production this directory must be mounted on persistent storage and included in backups; it must not be an ephemeral container filesystem.

## Endpoints

- `POST /api/generate` — `{ input, sourceType, strategy, template, language? }`
- `POST /api/extract` — `{ input, sourceType }`
- `GET /api/history?page=1&limit=20`
- `GET /api/history/:id`
- `DELETE /api/history/:id`
- `GET /api/history/:id/editor` (Creator/Pro)
- `PATCH /api/history/:id/editor` (Creator/Pro, revision protected)
- `GET /api/brand-kit` (Pro)
- `PUT /api/brand-kit` (Pro)
- `POST /api/brand-kit/logo` (Pro, multipart `logo`, 2 MB maximum)
- `DELETE /api/brand-kit/logo` (Pro)
- `GET /api/brand-assets/:id` (authenticated owner)
- `GET /health`

Supported source types: `topic`, `article`, `youtube`. Article extraction uses Mozilla Readability after a size-limited, public-URL-only fetch. YouTube extraction uses the free `youtube-transcript` InnerTube/web fallback and accepts watch, short-link, Shorts, and embed URLs. Supported strategies: `viral_hook`, `storytelling`, `actionable_value`. Templates: `template_1`, `template_2`, `template_3`, `template_4`.

Generated URL-based carousels include a `source` object with the original normalized URL, source title, publisher domain, and (for YouTube when available) channel name. Topic carousels return `source: null`.

`language` accepts `english` (default) or `indonesian`. The selected language is enforced throughout summarization, editorial planning, slides, captions, and hashtags.

Brand Kit settings are snapshotted into each generated carousel. Later Brand Kit changes therefore affect new carousels only. Logo files use immutable asset IDs so older carousel snapshots remain stable.
