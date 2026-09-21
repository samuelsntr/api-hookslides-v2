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
