export const LANGUAGE_GUIDELINES = {
  english: `Output language: English.
- Write all summaries, editorial-brief values, slide headings, slide body copy, captions, and natural-language hashtags in fluent English.`,
  indonesian: `Output language: Bahasa Indonesia.
- Write all summaries, editorial-brief values, slide headings, slide body copy, captions, and natural-language hashtags in fluent, natural Bahasa Indonesia.
- Use contemporary Indonesian that is clear to a broad audience. Avoid stiff word-for-word translation and unnecessary English jargon.
- Keep JSON property names and required slide type values (hook, context, value, takeaway, cta) exactly as specified in English.`,
};

export function languageGuidelines(language = 'english') {
  return LANGUAGE_GUIDELINES[language] || LANGUAGE_GUIDELINES.english;
}
