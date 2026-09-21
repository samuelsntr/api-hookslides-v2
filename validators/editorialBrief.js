import { z } from 'zod';
import { LIMITS } from '../utils/content.js';

const field = () => z.string().trim().min(1).max(LIMITS.briefField);

export const editorialBriefSchema = z.object({
  coreIdea: field(),
  audienceProblem: field(),
  promise: field(),
  angle: field(),
  keyInsights: z.array(field()).min(1).max(LIMITS.briefListMax),
  evidence: z.array(field()).max(LIMITS.briefListMax),
  emotionalShift: field(),
  slidePlan: z.array(field()).length(6),
  ctaDirection: field(),
}).strict();

export const validateEditorialBrief = (value) => {
  const result = editorialBriefSchema.safeParse(value);
  return result.success
    ? { success: true, data: result.data, error: null }
    : { success: false, data: null, error: result.error };
};
