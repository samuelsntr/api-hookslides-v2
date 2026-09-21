import { AppError } from '../../constants/errors.js';

export function createAiService({ primary, fallback, logger = console }) {
  async function call(method, input) {
    try { return await primary[method](input); }
    catch (primaryError) {
      logger.warn({ provider: 'primary', method }, 'AI provider failed; trying fallback');
      if (!fallback) throw new AppError('AI provider unavailable.', { status: 502, code: 'AI_PROVIDER_ERROR' });
      try { return await fallback[method](input); }
      catch { throw new AppError('AI provider unavailable.', { status: 502, code: 'AI_PROVIDER_ERROR' }); }
    }
  }
  return {
    summarize: (content) => call('summarize', content),
    createEditorialBrief: (input) => call('createEditorialBrief', input),
    generateCarousel: (input) => call('generateCarousel', input)
  };
}
