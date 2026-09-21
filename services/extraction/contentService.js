import { AppError } from '../../constants/errors.js';
import { normalizeContent } from '../../utils/content.js';

export function createContentService({ articleExtractor, youtubeExtractor }) {
  return {
    async extractContent({ sourceType, input }) {
      if (sourceType === 'topic') return { sourceType, title: 'Topic', content: normalizeContent(input), source: null };
      if (sourceType === 'article') return articleExtractor(input);
      if (sourceType === 'youtube') return youtubeExtractor(input);
      throw new AppError('Unsupported source type.', { status: 400, code: 'VALIDATION_ERROR' });
    }
  };
}
