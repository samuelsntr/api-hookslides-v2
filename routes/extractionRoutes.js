import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { extractRequestSchema } from '../validators/requests.js';
export const createExtractionRoutes = (controller) => Router().post('/extract', validate(extractRequestSchema), controller.extract);
