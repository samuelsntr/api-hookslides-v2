import { z } from 'zod';
import { LANGUAGES, SOURCE_TYPES, STRATEGIES, TEMPLATES } from '../constants/values.js';
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
export const adminUserPlanSchema = z.object({ plan: z.enum(['free', 'premium']) }).strict();
