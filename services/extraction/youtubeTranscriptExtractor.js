import {
  YoutubeTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
} from 'youtube-transcript';
import { AppError } from '../../constants/errors.js';
import { LIMITS, normalizeContent } from '../../utils/content.js';
import { isYouTubeHostname } from '../../utils/url.js';

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeId(value) {
  const trimmed = String(value).trim();
  const url = new URL(!trimmed.includes('://') && !/\s/.test(trimmed) ? `https://${trimmed}` : trimmed);
  if (!['http:', 'https:'].includes(url.protocol) || !isYouTubeHostname(url.hostname)) return null;

  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  let id = null;
  if (hostname === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || null;
  else if (url.pathname.replace(/\/+$/, '') === '/watch') id = url.searchParams.get('v');
  else id = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1] || null;

  return id && VIDEO_ID_PATTERN.test(id) ? id : null;
}

async function fetchYouTubeMetadata(id, fetchImpl, signal) {
  const response = await fetchImpl(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`, {
    signal,
    headers: { accept: 'application/json' },
  });
  if (!response.ok) return null;
  const data = await response.json();
  return {
    title: normalizeContent(data?.title || '', 180) || null,
    channelName: normalizeContent(data?.author_name || '', 120) || null,
  };
}

function transcriptError(error) {
  if (error instanceof YoutubeTranscriptVideoUnavailableError || error?.name === 'YoutubeTranscriptVideoUnavailableError') {
    return new AppError('This YouTube video is unavailable or private.', { status: 422, code: 'YOUTUBE_VIDEO_UNAVAILABLE' });
  }
  if (error instanceof YoutubeTranscriptDisabledError || error instanceof YoutubeTranscriptNotAvailableError ||
      ['YoutubeTranscriptDisabledError', 'YoutubeTranscriptNotAvailableError', 'YoutubeTranscriptNotAvailableLanguageError'].includes(error?.name)) {
    return new AppError('This video has no transcript or captions available.', { status: 422, code: 'YOUTUBE_TRANSCRIPT_UNAVAILABLE' });
  }
  if (error instanceof YoutubeTranscriptTooManyRequestError || error?.name === 'YoutubeTranscriptTooManyRequestError') {
    return new AppError('YouTube temporarily blocked transcript retrieval. Please try again later.', { status: 503, code: 'YOUTUBE_TRANSCRIPT_TEMPORARILY_UNAVAILABLE' });
  }
  if (error?.name === 'AbortError') return new AppError('YouTube took too long to respond.', { status: 504, code: 'YOUTUBE_TIMEOUT' });
  return new AppError('We could not retrieve this video transcript. Please try again.', { status: 502, code: 'YOUTUBE_TRANSCRIPT_FAILED' });
}

function joinTranscript(segments) {
  let result = '';
  for (const segment of Array.isArray(segments) ? segments : []) {
    const text = normalizeContent(segment?.text || '', LIMITS.content);
    if (!text) continue;
    const remaining = LIMITS.content - result.length - (result ? 1 : 0);
    if (remaining <= 0) break;
    result += `${result ? ' ' : ''}${text.slice(0, remaining)}`;
  }
  return normalizeContent(result);
}

export function createYouTubeExtractor({ transcriptClient = YoutubeTranscript, fetchImpl = fetch } = {}) {
  return async function extractYouTubeTranscript(value) {
    let id;
    try { id = parseYouTubeId(value); } catch { id = null; }
    if (!id) throw new AppError('Enter a valid YouTube video URL.', { status: 400, code: 'INVALID_YOUTUBE_URL' });

    const trimmed = String(value).trim();
    const originalUrl = new URL(!trimmed.includes('://') ? `https://${trimmed}` : trimmed).href;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const timedFetch = (url, options = {}) => fetchImpl(url, { ...options, signal: controller.signal });

    try {
      const [segments, metadata] = await Promise.all([
        transcriptClient.fetchTranscript(id, { fetch: timedFetch }),
        fetchYouTubeMetadata(id, timedFetch, controller.signal).catch(() => null),
      ]);
      const content = joinTranscript(segments);
      if (!content) throw new YoutubeTranscriptNotAvailableError(id);

      const title = metadata?.title || 'YouTube video';
      const channelName = metadata?.channelName || null;
      return {
        sourceType: 'youtube',
        title,
        content,
        channelName,
        source: { type: 'youtube', url: originalUrl, title, domain: 'youtube.com', channelName },
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw transcriptError(error);
    } finally {
      clearTimeout(timeout);
    }
  };
}
