import OpenAI from 'openai';
import { buildSummarizePrompt } from '../../prompts/summarizePrompt.js';
import { buildEditorialBriefPrompt } from '../../prompts/editorialBriefPrompt.js';
import { buildCarouselPrompt } from '../../prompts/generateCarouselPrompt.js';

export function createOpenAIProvider({ apiKey, model = 'gpt-4o-mini' }) {
  const client = new OpenAI({ apiKey });
  const complete = async (prompt) => (await client.chat.completions.create({ model, temperature: 0.7, messages: [{ role: 'user', content: prompt }] })).choices[0]?.message?.content || '';
  return {
    summarize: (input) => complete(buildSummarizePrompt(typeof input === 'string' ? { content: input } : input)),
    createEditorialBrief: (input) => complete(buildEditorialBriefPrompt(input)),
    generateCarousel: (input) => complete(buildCarouselPrompt(input))
  };
}
