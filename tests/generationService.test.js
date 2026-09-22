import test from 'node:test';
import assert from 'node:assert/strict';
import { createGenerationService } from '../services/generation/generationService.js';

const slides = [['hook', 'h'], ['context', 'c'], ['value', 'v1'], ['value', 'v2'], ['takeaway', 't'], ['cta', 'cta']].map(([type, heading]) => ({ type, heading, body: 'body' }));

const brief = {
  coreIdea: 'idea', audienceProblem: 'problem', promise: 'promise', angle: 'angle',
  keyInsights: ['insight'], evidence: ['evidence'], emotionalShift: 'from x to y',
  slidePlan: ['a', 'b', 'c', 'd', 'e', 'f'], ctaDirection: 'do it'
};

test('runs pipeline through editorial brief before generating slides', async () => {
  const calls = [];
  const service = createGenerationService({
    contentService: { extractContent: async () => { calls.push('extract'); return { title: 'Example', content: 'content', source: { type: 'article', url: 'https://example.com', title: 'Example', domain: 'example.com', channelName: null } }; } },
    aiService: {
      summarize: async ({ content, language }) => { calls.push('summarize'); assert.match(content, /^Source title: Example\./); assert.equal(language, 'indonesian'); return 'summary'; },
      createEditorialBrief: async ({ language }) => { calls.push('brief'); assert.equal(language, 'indonesian'); return JSON.stringify(brief); },
      generateCarousel: async ({ language }) => { calls.push('generate'); assert.equal(language, 'indonesian'); return JSON.stringify({ title: 'Title', summary: 'Summary', slides, captionIdeas: ['Caption one', 'Caption two'], hashtags: ['#tag1', '#tag2'] }); }
    },
    historyRepository: { countThisMonth: () => 0, createCarouselIfAllowed: (record) => { calls.push('save'); return record; } },
    clock: () => new Date('2026-08-05T00:00:00.000Z'), createId: () => 'id'
  });
  const result = await service.generate({ input: 'https://example.com', sourceType: 'article', strategy: 'viral_hook', template: 'template_1', language: 'indonesian' });
  assert.deepEqual(calls, ['extract', 'summarize', 'brief', 'generate', 'save']);
  assert.equal(result.slides.length, 6);
  assert.equal(result.source.url, 'https://example.com');
  assert.equal(result.language, 'indonesian');
});

test('invalid editorial brief stops before generating or saving', async () => {
  const calls = [];
  const service = createGenerationService({
    contentService: { extractContent: async () => ({ content: 'content' }) },
    aiService: {
      summarize: async () => 'summary',
      createEditorialBrief: async () => JSON.stringify({ coreIdea: 'only this field' }),
      generateCarousel: async () => { calls.push('generate'); return '{}'; }
    },
    historyRepository: { countThisMonth: () => 0, createCarouselIfAllowed: () => { calls.push('save'); } },
    clock: () => new Date('2026-08-05T00:00:00.000Z'), createId: () => 'id'
  });
  await assert.rejects(
    () => service.generate({ input: 'input', sourceType: 'topic', strategy: 'viral_hook', template: 'template_1' }),
    (error) => error.code === 'AI_OUTPUT_ERROR'
  );
  assert.deepEqual(calls, []);
});

test('free user at monthly limit is rejected before any AI calls', async () => {
  const calls = [];
  const service = createGenerationService({
    contentService: { extractContent: async () => { calls.push('extract'); return { content: 'content' }; } },
    aiService: { summarize: async () => { calls.push('summarize'); return 'summary'; } },
    historyRepository: { countThisMonth: () => 5, createCarouselIfAllowed: () => { calls.push('save'); } },
    clock: () => new Date('2026-08-05T00:00:00.000Z'), createId: () => 'id'
  });
  await assert.rejects(
    () => service.generate({ input: 'input', sourceType: 'topic', strategy: 'viral_hook', template: 'template_1', userId: 'u1', plan: 'free' }),
    (error) => error.code === 'GENERATION_LIMIT_REACHED' && error.status === 429 && error.details.usage === '5/5'
  );
  assert.deepEqual(calls, []);
});

test('premium user is never blocked regardless of usage', async () => {
  const calls = [];
  const service = createGenerationService({
    contentService: { extractContent: async () => { calls.push('extract'); return { content: 'content' }; } },
    aiService: {
      summarize: async () => { calls.push('summarize'); return 'summary'; },
      createEditorialBrief: async () => { calls.push('brief'); return JSON.stringify(brief); },
      generateCarousel: async () => { calls.push('generate'); return JSON.stringify({ title: 'Title', summary: 'Summary', slides, captionIdeas: ['Caption one', 'Caption two'], hashtags: ['#tag1', '#tag2'] }); }
    },
    historyRepository: { countThisMonth: () => 999, createCarouselIfAllowed: (record) => { calls.push('save'); return record; } },
    clock: () => new Date('2026-08-05T00:00:00.000Z'), createId: () => 'id'
  });
  const result = await service.generate({ input: 'input', sourceType: 'topic', strategy: 'viral_hook', template: 'template_1', userId: 'u1', plan: 'premium' });
  assert.deepEqual(calls, ['extract', 'summarize', 'brief', 'generate', 'save']);
  assert.equal(result.slides.length, 6);
});

test('Pro generation snapshots the default Brand Kit while opt-out preserves template defaults', async () => {
  const saved = [];
  const service = createGenerationService({
    contentService: { extractContent: async () => ({ content: 'content' }) },
    aiService: { summarize: async () => 'summary', createEditorialBrief: async () => JSON.stringify(brief), generateCarousel: async () => JSON.stringify({ title: 'Title', summary: 'Summary', slides, captionIdeas: ['Caption one', 'Caption two'], hashtags: ['#tag1', '#tag2'] }) },
    historyRepository: { countThisMonth: () => 0, createCarouselIfAllowed: (record) => saved.push(record) },
    brandRepository: { getSnapshot: () => ({ brandKitId: 'kit', brandKitRevision: 3, logoAssetId: 'logo', defaultTemplate: 'template_2', theme: { brandName: 'Acme', primaryColor: '#112233', secondaryColor: '#FFFFFF', accentColor: '#FF5500', headingFont: 'fraunces', bodyFont: 'inter', logoUrl: '/api/brand-assets/logo', showLogo: true } }) },
    clock: () => new Date('2026-09-22T00:00:00.000Z'), createId: () => `id-${saved.length}`
  });
  const branded = await service.generate({ input: 'topic', sourceType: 'topic', strategy: 'viral_hook', template: 'template_1', userId: 'u1', plan: 'pro' });
  assert.equal(branded.template, 'template_2');
  assert.equal(branded.brandKitRevision, 3);
  assert.equal(branded.brandTheme.brandName, 'Acme');
  const plain = await service.generate({ input: 'topic', sourceType: 'topic', strategy: 'viral_hook', template: 'template_1', brandKitMode: 'none', userId: 'u1', plan: 'pro' });
  assert.equal(plain.template, 'template_1');
  assert.equal(plain.brandTheme, null);
});
