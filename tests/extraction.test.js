import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentService } from '../services/extraction/contentService.js';
import { createArticleExtractor } from '../services/extraction/articleExtractor.js';
import { parseYouTubeId, createYouTubeExtractor } from '../services/extraction/youtubeTranscriptExtractor.js';
import { LIMITS } from '../utils/content.js';

const VIDEO_ID = 'dQw4w9WgXcQ';
const metadataFetch = async () => new Response(JSON.stringify({ title: 'A useful video', author_name: 'Example Channel' }), {
  status: 200,
  headers: { 'content-type': 'application/json' },
});

test('dispatches topic without network and without attribution', async () => {
  const service = createContentService({ articleExtractor: () => assert.fail(), youtubeExtractor: () => assert.fail() });
  const result = await service.extractContent({ sourceType: 'topic', input: '  hello   world ' });
  assert.equal(result.content, 'hello world');
  assert.equal(result.source, null);
});

test('extracts a normal article and removes page chrome', async () => {
  const html = `<!doctype html><html><head><title>Useful article</title></head><body>
    <nav>Navigation should disappear</nav>
    <main><article><h1>Useful article</h1><p>${'A meaningful article sentence with useful detail. '.repeat(8)}</p></article></main>
    <aside>Recommended stories should disappear</aside><footer>Cookie settings should disappear</footer>
  </body></html>`;
  const extract = createArticleExtractor({
    validateUrl: async () => true,
    fetchImpl: async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }),
  });
  const result = await extract('https://example.com/story');
  assert.equal(result.title, 'Useful article');
  assert.match(result.content, /meaningful article sentence/);
  assert.doesNotMatch(result.content, /Navigation|Recommended|Cookie/);
  assert.deepEqual(result.source, {
    type: 'article', url: 'https://example.com/story', title: 'Useful article', domain: 'example.com', channelName: null,
  });
});

test('truncates a long article before it reaches AI', async () => {
  const html = `<html><head><title>Long article</title></head><body><article><h1>Long article</h1><p>${'substantial content '.repeat(10_000)}</p></article></body></html>`;
  const extract = createArticleExtractor({
    validateUrl: async () => true,
    fetchImpl: async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }),
  });
  const result = await extract('https://example.com/long');
  assert.ok(result.content.length <= LIMITS.content);
  assert.ok(result.content.length > LIMITS.content * 0.8);
});

test('reports blocked and unsupported article responses clearly', async () => {
  const blocked = createArticleExtractor({ validateUrl: async () => true, fetchImpl: async () => new Response('', { status: 403 }) });
  await assert.rejects(() => blocked('https://example.com/blocked'), (error) => error.code === 'ARTICLE_ACCESS_DENIED' && error.status === 422);

  const unsupported = createArticleExtractor({
    validateUrl: async () => true,
    fetchImpl: async () => new Response('%PDF', { status: 200, headers: { 'content-type': 'application/pdf' } }),
  });
  await assert.rejects(() => unsupported('https://example.com/file.pdf'), (error) => error.code === 'ARTICLE_UNSUPPORTED_CONTENT');
});

test('rejects invalid and private article URLs before fetching', async () => {
  const extract = createArticleExtractor({ fetchImpl: async () => assert.fail('must not fetch') });
  await assert.rejects(() => extract('not a URL'), (error) => error.code === 'INVALID_URL');
  await assert.rejects(() => extract('http://127.0.0.1/private'), (error) => error.code === 'INVALID_URL');
});

test('parses common YouTube URL forms and rejects other hosts', () => {
  assert.equal(parseYouTubeId(`https://www.youtube.com/watch?v=${VIDEO_ID}&t=4`), VIDEO_ID);
  assert.equal(parseYouTubeId(`https://youtu.be/${VIDEO_ID}?si=abc`), VIDEO_ID);
  assert.equal(parseYouTubeId(`youtube.com/shorts/${VIDEO_ID}`), VIDEO_ID);
  assert.equal(parseYouTubeId(`https://youtube.com/embed/${VIDEO_ID}`), VIDEO_ID);
  assert.equal(parseYouTubeId(`https://youtube.com.evil.test/watch?v=${VIDEO_ID}`), null);
  assert.equal(parseYouTubeId('https://youtube.com/watch?v=short'), null);
});

test('joins transcript segments and returns video attribution', async () => {
  const extract = createYouTubeExtractor({
    transcriptClient: { fetchTranscript: async () => [{ text: 'one' }, { text: 'two' }] },
    fetchImpl: metadataFetch,
  });
  const result = await extract(`https://youtu.be/${VIDEO_ID}`);
  assert.equal(result.content, 'one two');
  assert.deepEqual(result.source, {
    type: 'youtube', url: `https://youtu.be/${VIDEO_ID}`, title: 'A useful video', domain: 'youtube.com', channelName: 'Example Channel',
  });
});

test('uses Supadata transcripts when configured', async () => {
  let legacyCalls = 0;
  const requests = [];
  const extract = createYouTubeExtractor({
    supadataApiKey: 'test-key',
    transcriptClient: { fetchTranscript: async () => { legacyCalls += 1; return [{ text: 'legacy' }]; } },
    fetchImpl: async (url, options = {}) => {
      requests.push({ url: String(url), apiKey: options.headers?.['x-api-key'] });
      if (String(url).startsWith('https://api.supadata.ai/')) {
        return new Response(JSON.stringify({ content: [{ text: 'managed transcript' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return metadataFetch();
    },
  });

  const result = await extract(`https://youtube.com/watch?v=${VIDEO_ID}`);

  assert.equal(result.content, 'managed transcript');
  assert.equal(legacyCalls, 0);
  assert.deepEqual(requests[0], {
    url: `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${VIDEO_ID}`)}&text=false`,
    apiKey: 'test-key',
  });
});

test('falls back to the existing extractor when Supadata times out', async () => {
  const extract = createYouTubeExtractor({
    supadataApiKey: 'test-key',
    providerTimeoutMs: 1,
    logger: { warn() {}, info() {} },
    transcriptClient: { fetchTranscript: async () => [{ text: 'legacy after timeout' }] },
    fetchImpl: async (url, options = {}) => {
      if (!String(url).startsWith('https://api.supadata.ai/')) return metadataFetch();
      return new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
      });
    },
  });

  const result = await extract(`https://youtube.com/watch?v=${VIDEO_ID}`);

  assert.equal(result.content, 'legacy after timeout');
});

test('falls back to the existing extractor when Supadata is temporarily unavailable', async () => {
  const warnings = [];
  const extract = createYouTubeExtractor({
    supadataApiKey: 'test-key',
    logger: { warn(fields, message) { warnings.push({ fields, message }); }, info() {} },
    transcriptClient: { fetchTranscript: async () => [{ text: 'legacy fallback' }] },
    fetchImpl: async (url) => String(url).startsWith('https://api.supadata.ai/')
      ? new Response(JSON.stringify({ error: 'temporarily unavailable' }), { status: 503 })
      : metadataFetch(),
  });

  const result = await extract(`https://youtube.com/watch?v=${VIDEO_ID}`);

  assert.equal(result.content, 'legacy fallback');
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].fields.provider, 'supadata');
  assert.equal(warnings[0].fields.status, 503);
  assert.equal(warnings[0].fields.videoIdSuffix, VIDEO_ID.slice(-4));
  assert.equal(warnings[0].message, 'YouTube transcript provider failed; trying fallback');
  assert.equal('apiKey' in warnings[0].fields, false);
});

test('does not fall back when Supadata confirms captions are unavailable', async () => {
  let legacyCalls = 0;
  const extract = createYouTubeExtractor({
    supadataApiKey: 'test-key',
    transcriptClient: { fetchTranscript: async () => { legacyCalls += 1; return [{ text: 'must not be used' }]; } },
    fetchImpl: async (url) => String(url).startsWith('https://api.supadata.ai/')
      ? new Response(JSON.stringify({ error: 'Transcript not available' }), { status: 404 })
      : metadataFetch(),
  });

  await assert.rejects(
    () => extract(`https://youtube.com/watch?v=${VIDEO_ID}`),
    (error) => error.code === 'YOUTUBE_TRANSCRIPT_UNAVAILABLE' && error.status === 422,
  );
  assert.equal(legacyCalls, 0);
});

test('truncates very long transcripts', async () => {
  const extract = createYouTubeExtractor({
    transcriptClient: { fetchTranscript: async () => Array.from({ length: 5000 }, () => ({ text: 'a useful transcript segment with several words' })) },
    fetchImpl: metadataFetch,
  });
  const result = await extract(`https://youtube.com/watch?v=${VIDEO_ID}`);
  assert.ok(result.content.length <= LIMITS.content);
  assert.ok(result.content.length > LIMITS.content * 0.8);
});

test('reports unavailable videos and missing transcripts', async () => {
  for (const [name, code] of [
    ['YoutubeTranscriptVideoUnavailableError', 'YOUTUBE_VIDEO_UNAVAILABLE'],
    ['YoutubeTranscriptDisabledError', 'YOUTUBE_TRANSCRIPT_UNAVAILABLE'],
  ]) {
    const failure = new Error('expected failure');
    failure.name = name;
    const extract = createYouTubeExtractor({
      transcriptClient: { fetchTranscript: async () => { throw failure; } },
      fetchImpl: metadataFetch,
    });
    await assert.rejects(() => extract(`https://youtube.com/watch?v=${VIDEO_ID}`), (error) => error.code === code);
  }
});

test('reports an unexpected transcript retrieval failure', async () => {
  const extract = createYouTubeExtractor({
    transcriptClient: { fetchTranscript: async () => { throw new Error('upstream changed'); } },
    fetchImpl: metadataFetch,
  });
  await assert.rejects(() => extract(`https://youtube.com/watch?v=${VIDEO_ID}`), (error) => error.code === 'YOUTUBE_TRANSCRIPT_FAILED');
});

test('rejects invalid and unsupported video URLs', async () => {
  const extract = createYouTubeExtractor({ transcriptClient: { fetchTranscript: async () => assert.fail() }, fetchImpl: metadataFetch });
  await assert.rejects(() => extract('https://vimeo.com/123'), (error) => error.code === 'INVALID_YOUTUBE_URL');
  await assert.rejects(() => extract('not a URL'), (error) => error.code === 'INVALID_YOUTUBE_URL');
});
