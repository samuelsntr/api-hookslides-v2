export const LIMITS = {
  input: 10000,
  content: 50000,
  remoteDocumentBytes: 2_000_000,
  heading: 160,
  body: 1000,
  summary: 2000,
  briefField: 300,
  briefListMax: 6,
};

export function normalizeContent(text, maxLength = LIMITS.content) {
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;

  const candidate = normalized.slice(0, maxLength + 1);
  const lastBoundary = Math.max(candidate.lastIndexOf('. '), candidate.lastIndexOf('! '), candidate.lastIndexOf('? '), candidate.lastIndexOf(' '));
  return candidate.slice(0, lastBoundary > maxLength * 0.8 ? lastBoundary + 1 : maxLength).trim();
}

// strip markdown code fences (```json ... ```) and leading prose so JSON.parse() works
// ponytail: regex-based extraction; if a model ever nests JSON in prose, switch to brace-matching
export function extractJson(text) {
  const fenced = String(text).match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : String(text);
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  return start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
}
