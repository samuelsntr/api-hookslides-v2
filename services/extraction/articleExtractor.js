import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { AppError } from '../../constants/errors.js';
import { LIMITS, normalizeContent } from '../../utils/content.js';
import { displayHostname, isAllowedRemoteUrl, parseHttpUrl } from '../../utils/url.js';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

async function readLimitedText(response, maxBytes) {
  const declaredLength = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new AppError('This article is too large to process.', { status: 413, code: 'ARTICLE_TOO_LARGE' });

  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new AppError('This article is too large to process.', { status: 413, code: 'ARTICLE_TOO_LARGE' });
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new AppError('This article is too large to process.', { status: 413, code: 'ARTICLE_TOO_LARGE' });
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function articleErrorForStatus(status) {
  if (status === 404 || status === 410) return new AppError('The article could not be found.', { status: 422, code: 'ARTICLE_NOT_FOUND' });
  if ([401, 403, 429].includes(status)) return new AppError('This website blocked access to the article.', { status: 422, code: 'ARTICLE_ACCESS_DENIED' });
  return new AppError('The article could not be downloaded.', { status: 422, code: 'ARTICLE_FETCH_FAILED' });
}

function cleanTitle(value) {
  return normalizeContent(value || 'Untitled article', 180);
}

export function createArticleExtractor({ fetchImpl = fetch, validateUrl = isAllowedRemoteUrl } = {}) {
  return async function extractArticle(url) {
    const originalUrl = parseHttpUrl(url);
    if (!originalUrl || !(await validateUrl(originalUrl))) throw new AppError('Enter a valid public article URL.', { status: 400, code: 'INVALID_URL' });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      let currentUrl = originalUrl;
      let response;

      for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
        response = await fetchImpl(currentUrl, {
          signal: controller.signal,
          redirect: 'manual',
          headers: {
            accept: 'text/html,application/xhtml+xml;q=0.9',
            'accept-language': 'en-US,en;q=0.8',
            'user-agent': 'Mozilla/5.0 (compatible; HookSlides/1.0; +https://hookslides.ai)',
          },
        });

        if (!REDIRECT_STATUSES.has(response.status)) break;
        if (redirects === MAX_REDIRECTS) throw new AppError('The article redirected too many times.', { status: 422, code: 'ARTICLE_REDIRECT_ERROR' });
        const location = response.headers.get('location');
        if (!location) throw new AppError('The article returned an invalid redirect.', { status: 422, code: 'ARTICLE_REDIRECT_ERROR' });
        const nextUrl = new URL(location, currentUrl);
        if (!(await validateUrl(nextUrl))) throw new AppError('The article redirected to an unsafe URL.', { status: 400, code: 'INVALID_URL' });
        await response.body?.cancel();
        currentUrl = nextUrl;
      }

      if (!response?.ok) throw articleErrorForStatus(response?.status);
      const contentType = response.headers.get('content-type')?.toLowerCase() || '';
      if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        throw new AppError('This URL does not point to a supported HTML article.', { status: 422, code: 'ARTICLE_UNSUPPORTED_CONTENT' });
      }

      const html = await readLimitedText(response, LIMITS.remoteDocumentBytes);
      if (/cf-chl-|cdn-cgi\/challenge-platform|class=["'][^"']*g-recaptcha|<title>\s*(?:just a moment|access denied)/i.test(html)) {
        throw new AppError('This website blocked access to the article.', { status: 422, code: 'ARTICLE_ACCESS_DENIED' });
      }
      const dom = new JSDOM(html, { url: currentUrl.href, contentType: 'text/html' });
      const document = dom.window.document;
      document.querySelectorAll('nav, aside, footer, form, dialog, [role="navigation"], [role="complementary"], [aria-hidden="true"], script, style, noscript, iframe').forEach((element) => element.remove());

      const article = new Readability(document, { charThreshold: 120, keepClasses: false }).parse();
      const content = normalizeContent(article?.textContent || '');
      if (content.length < 120) throw new AppError('We could not find enough readable article content on this page.', { status: 422, code: 'ARTICLE_CONTENT_NOT_FOUND' });

      const title = cleanTitle(article?.title || document.querySelector('meta[property="og:title"]')?.content || document.title);
      const author = normalizeContent(article?.byline || '', 160) || null;
      const publishedAt = document.querySelector('meta[property="article:published_time"], meta[name="date"], time[datetime]')?.getAttribute('content') ||
        document.querySelector('time[datetime]')?.getAttribute('datetime') || null;

      return {
        sourceType: 'article',
        title,
        content,
        author,
        publishedAt,
        source: { type: 'article', url: originalUrl.href, title, domain: displayHostname(currentUrl), channelName: null },
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error.name === 'AbortError') throw new AppError('The article took too long to respond.', { status: 422, code: 'ARTICLE_TIMEOUT' });
      throw new AppError('We could not retrieve this article. The site may be unavailable or blocking automated access.', { status: 422, code: 'ARTICLE_FETCH_FAILED' });
    } finally {
      clearTimeout(timeout);
    }
  };
}
