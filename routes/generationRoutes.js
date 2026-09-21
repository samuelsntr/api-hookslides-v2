import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { generateRequestSchema } from '../validators/requests.js';
export const createGenerationRoutes = (controller) => Router().post('/generate', validate(generateRequestSchema), controller.generate);
