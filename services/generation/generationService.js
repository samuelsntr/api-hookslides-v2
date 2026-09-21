import { AppError, PLAN_LIMITS } from '../../constants/errors.js';
import { validateCarousel } from '../../validators/carousel.js';
import { validateEditorialBrief } from '../../validators/editorialBrief.js';
import { extractJson, normalizeContent } from '../../utils/content.js';

export function createGenerationService({ contentService, aiService, historyRepository, clock = () => new Date(), createId }) {
  return {
    async generate({ input, sourceType, strategy, template, language = 'english', userId, plan = 'free' }) {
      const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
      if (limit !== Infinity && historyRepository.countThisMonth(userId) >= limit) {
        throw new AppError('Monthly carousel generation limit reached.', {
          status: 429,
          code: 'GENERATION_LIMIT_REACHED',
          details: { usage: `${limit}/${limit}` },
        });
      }

      const extracted = await contentService.extractContent({ sourceType, input });
      const contentForAi = extracted.source
        ? normalizeContent(`Source title: ${extracted.title || extracted.source.title}. ${extracted.content}`)
        : extracted.content;
      const summary = await aiService.summarize({ content: contentForAi, language });

      let briefJson;
      try { briefJson = JSON.parse(extractJson(await aiService.createEditorialBrief({ summary, strategy, language }))); }
      catch { throw new AppError('AI returned invalid editorial brief.', { status: 502, code: 'AI_OUTPUT_ERROR' }); }
      const briefResult = validateEditorialBrief(briefJson);
      if (!briefResult.success) throw new AppError('AI returned invalid editorial brief.', { status: 502, code: 'AI_OUTPUT_ERROR' });

      let generated;
      try { generated = JSON.parse(extractJson(await aiService.generateCarousel({ brief: briefResult.data, strategy, template, language }))); }
      catch { throw new AppError('AI returned invalid carousel data.', { status: 502, code: 'AI_OUTPUT_ERROR' }); }
      const result = validateCarousel({ ...generated, sourceType, strategy, template, language });
      if (!result.success) throw new AppError('AI returned invalid carousel data.', { status: 502, code: 'AI_OUTPUT_ERROR' });

      const now = clock().toISOString();
      const record = {
        id: createId(),
        userId,
        ...result.data,
        originalInput: input,
        extractedContent: extracted.content,
        source: extracted.source || null,
        createdAt: now,
        updatedAt: now,
      };
      historyRepository.createCarouselIfAllowed(record, plan);
      return record;
    }
  };
}
