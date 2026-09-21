export function toCarousel(row) {
  if (!row) return null;
  return {
    id: row.id, title: row.title, sourceType: row.source_type,
    originalInput: row.original_input, extractedContent: row.extracted_content,
    source: row.source_json ? JSON.parse(row.source_json) : null,
    strategy: row.strategy, template: row.template, language: row.language || 'english', slides: JSON.parse(row.slides_json),
    summary: row.summary, captionIdeas: JSON.parse(row.caption_ideas_json || '[]'), hashtags: JSON.parse(row.hashtags_json || '[]'), createdAt: row.created_at, updatedAt: row.updated_at
  };
}
