import express from 'express';
import cors from 'cors';
import { auth as requireAuth } from './middleware/auth.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createAuthRepository } from './services/auth.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { requestId } from './middleware/requestId.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createGenerationRoutes } from './routes/generationRoutes.js';
import { createExtractionRoutes } from './routes/extractionRoutes.js';
import { createHistoryRoutes } from './routes/historyRoutes.js';
import { createGenerationController } from './controllers/generationController.js';
import { createExtractionController } from './controllers/extractionController.js';
import { createHistoryController } from './controllers/historyController.js';
import { createAdminRoutes } from './routes/adminRoutes.js';
import { createAdminController } from './controllers/adminController.js';

export function createApp({ services = {}, database } = {}) {
  const app = express();
  app.locals.services = services;
  app.locals.database = database;
  app.use(helmet());
  app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173', credentials: true }));
  app.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }));
  app.use(express.json({ limit: '256kb' }));
  if (database) {
    app.use(createAuthRoutes(createAuthRepository(database), database));
    app.use('/api', createAdminRoutes(createAdminController(database)));
  }
  app.use(requestId);
  app.get('/health', (req, res) => res.json({ success: true, message: 'OK', data: { status: 'ok' } }));
  if (services.generation && services.extraction && services.history) {
    app.use('/api', requireAuth({ db: database }));
    app.use('/api', createGenerationRoutes(createGenerationController(services.generation)));
    app.use('/api', createExtractionRoutes(createExtractionController(services.extraction)));
    app.use('/api', createHistoryRoutes(createHistoryController(services.history)));
  }
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
