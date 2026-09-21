import { OUTPUT_RULES } from './outputRules.js';
import { STRATEGY_GUIDELINES } from './strategyGuidelines.js';
import { languageGuidelines } from './languageGuidelines.js';

export function buildEditorialBriefPrompt({ summary, strategy, language = 'english' }) {
  return `You are an expert Instagram carousel editor. Using the source summary below, produce an editorial brief for a carousel. Return valid JSON only, with exactly these keys: coreIdea, audienceProblem, promise, angle, keyInsights (array), evidence (array), emotionalShift, slidePlan (array of exactly 6 short strings describing the purpose of each slide: hook, context, value 1, value 2, takeaway, cta), ctaDirection.

${OUTPUT_RULES}

${languageGuidelines(language)}

${STRATEGY_GUIDELINES[strategy]}

<SOURCE_SUMMARY>
${summary}
</SOURCE_SUMMARY>`;
}
