import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { historyQuerySchema, idParamSchema } from '../validators/requests.js';
export const createHistoryRoutes = (controller) => Router()
  .get('/history', validate(historyQuerySchema, 'query'), controller.list)
  .get('/history/:id', validate(idParamSchema, 'params'), controller.get)
  .delete('/history/:id', validate(idParamSchema, 'params'), controller.remove);
