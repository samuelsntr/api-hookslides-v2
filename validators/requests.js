import { z } from 'zod';
import { LANGUAGES, SLIDE_TYPES, SOURCE_TYPES, STRATEGIES, TEMPLATES } from '../constants/values.js';
import { PLANS } from '../constants/plans.js';
import { LIMITS } from '../utils/content.js';

const base = z.object({ input: z.string().trim().min(1).max(LIMITS.input), sourceType: z.enum(SOURCE_TYPES) }).strict();
export const generateRequestSchema = base.extend({
  strategy: z.enum(STRATEGIES),
  template: z.enum(TEMPLATES),
  language: z.enum(LANGUAGES).optional().default('english'),
});
export const extractRequestSchema = base;
export const historyQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) }).strict();
export const idParamSchema = z.object({ id: z.string().uuid() }).strict();
export const adminUserPlanSchema = z.object({ plan: z.enum(PLANS) }).strict();
export const adminCarouselQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(200).optional(),
  sourceType: z.enum(SOURCE_TYPES).optional(),
  strategy: z.enum(STRATEGIES).optional(),
  userId: z.string().trim().max(100).optional(),
  visibility: z.enum(['all', 'visible', 'hidden']).default('all'),
}).strict();

const editableSlideSchema = z.object({
  type: z.string(),
  heading: z.string().trim().min(1).max(LIMITS.heading),
  body: z.string().trim().min(1).max(LIMITS.body),
}).strict();

export const editorUpdateSchema = z.object({
  slides: z.array(editableSlideSchema).length(6),
  expectedRevision: z.number().int().min(1),
}).strict().superRefine((value, ctx) => {
  value.slides.forEach((slide, index) => {
    if (slide.type !== SLIDE_TYPES[index]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['slides', index, 'type'], message: `Expected ${SLIDE_TYPES[index]}` });
    }
  });
});
