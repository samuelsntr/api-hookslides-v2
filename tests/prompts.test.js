import test from 'node:test';
import assert from 'node:assert/strict';
import { OUTPUT_RULES } from '../prompts/outputRules.js';
import { STRATEGY_GUIDELINES } from '../prompts/strategyGuidelines.js';
import { STRATEGIES } from '../constants/values.js';
import { buildEditorialBriefPrompt } from '../prompts/editorialBriefPrompt.js';
import { buildCarouselPrompt } from '../prompts/generateCarouselPrompt.js';
import { buildSummarizePrompt } from '../prompts/summarizePrompt.js';

test('output rules cover source-grounding and voice', () => {
  assert.match(OUTPUT_RULES, /untrusted/i);
  assert.match(OUTPUT_RULES, /warm/i);
  assert.match(OUTPUT_RULES, /Instagram/i);
});

test('output rules require an explicit label for added general context', () => {
  assert.match(OUTPUT_RULES, /explicitly labeled/i);
  assert.match(OUTPUT_RULES, /Context:/);
});

test('every strategy has guidelines', () => {
  for (const strategy of STRATEGIES) {
    assert.equal(typeof STRATEGY_GUIDELINES[strategy], 'string');
    assert.ok(STRATEGY_GUIDELINES[strategy].length > 0);
  }
});

test('editorial brief prompt embeds summary and strategy rules', () => {
  const prompt = buildEditorialBriefPrompt({ summary: 'A source summary.', strategy: 'storytelling' });
  assert.match(prompt, /A source summary\./);
  assert.match(prompt, /Storytelling/);
  assert.match(prompt, /slidePlan/);
});

test('carousel prompt embeds the brief fields and strategy rules', () => {
  const brief = {
    coreIdea: 'Core idea text', audienceProblem: 'Problem text', promise: 'Promise text',
    angle: 'Angle text', keyInsights: ['Insight A'], evidence: ['Evidence A'],
    emotionalShift: 'from A to B', slidePlan: ['a', 'b', 'c', 'd', 'e', 'f'], ctaDirection: 'Do X'
  };
  const prompt = buildCarouselPrompt({ brief, strategy: 'actionable_value', template: 'template_2' });
  assert.match(prompt, /Core idea text/);
  assert.match(prompt, /Actionable Value/);
  assert.match(prompt, /template_2/);
  assert.match(prompt, /hook.*context.*value.*value.*takeaway.*cta/is);
});

test('carousel prompt marks the editorial brief as untrusted', () => {
  const brief = {
    coreIdea: 'Core idea text', audienceProblem: 'Problem text', promise: 'Promise text',
    angle: 'Angle text', keyInsights: ['Insight A'], evidence: ['Evidence A'],
    emotionalShift: 'from A to B', slidePlan: ['a', 'b', 'c', 'd', 'e', 'f'], ctaDirection: 'Do X'
  };
  const prompt = buildCarouselPrompt({ brief, strategy: 'actionable_value', template: 'template_2' });
  assert.match(prompt, /untrusted/i);
  assert.match(prompt, /editorial brief/i);
});

test('Indonesian is enforced across every AI prompt stage', () => {
  const brief = {
    coreIdea: 'Ide utama', audienceProblem: 'Masalah', promise: 'Janji', angle: 'Sudut pandang',
    keyInsights: ['Wawasan'], evidence: ['Bukti'], emotionalShift: 'dari A ke B',
    slidePlan: ['a', 'b', 'c', 'd', 'e', 'f'], ctaDirection: 'Lakukan ini'
  };
  const summarize = buildSummarizePrompt({ content: 'Sumber', language: 'indonesian' });
  const editorial = buildEditorialBriefPrompt({ summary: 'Ringkasan', strategy: 'storytelling', language: 'indonesian' });
  const carousel = buildCarouselPrompt({ brief, strategy: 'storytelling', template: 'template_1', language: 'indonesian' });

  for (const prompt of [summarize, editorial, carousel]) {
    assert.match(prompt, /Bahasa Indonesia/);
    assert.match(prompt, /natural Bahasa Indonesia/);
  }
  assert.match(carousel, /JSON property names.*English/i);
});
