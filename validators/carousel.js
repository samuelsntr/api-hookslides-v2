import { z } from 'zod';
import { LANGUAGES, SLIDE_TYPES, SOURCE_TYPES, STRATEGIES, TEMPLATES } from '../constants/values.js';
import { LIMITS } from '../utils/content.js';

const slideSchema = z.object({
  type: z.string(),
  heading: z.string().trim().min(1).max(LIMITS.heading),
  body: z.string().trim().min(1).max(LIMITS.body)
}).strict();

export const carouselSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.heading),
  summary: z.string().trim().max(LIMITS.summary).nullable().optional(),
  captionIdeas: z.array(z.string().trim().min(1).max(LIMITS.summary)).min(2).max(3).optional().default([]),
  hashtags: z.array(z.string().regex(/^#[^\s#]+$/)).max(10).default([]),
  slides: z.array(slideSchema).length(6),
  sourceType: z.enum(SOURCE_TYPES),
  strategy: z.enum(STRATEGIES),
  template: z.enum(TEMPLATES),
  language: z.enum(LANGUAGES).default('english'),
}).strict().superRefine((value, ctx) => {
  value.slides.forEach((slide, index) => {
    if (slide.type !== SLIDE_TYPES[index]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['slides', index, 'type'], message: `Expected ${SLIDE_TYPES[index]}` });
  });
});

export const validateCarousel = (value) => {
  const result = carouselSchema.safeParse(value);
  return result.success ? { success: true, data: result.data, error: null } : { success: false, data: null, error: result.error };
};
