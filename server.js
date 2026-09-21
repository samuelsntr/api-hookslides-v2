import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { createDatabase } from './database/connection.js';
import { runMigrations } from './database/migrate.js';
import { createHistoryRepository } from './services/history/historyRepository.js';
import { createArticleExtractor } from './services/extraction/articleExtractor.js';
import { createYouTubeExtractor } from './services/extraction/youtubeTranscriptExtractor.js';
import { createContentService } from './services/extraction/contentService.js';
import { createGroqProvider } from './services/ai/groqProvider.js';
import { createOpenAIProvider } from './services/ai/openaiProvider.js';
import { createAiService } from './services/ai/aiService.js';
import { createGenerationService } from './services/generation/generationService.js';
import { createId } from './utils/ids.js';
import { createApp } from './app.js';

const db = createDatabase(env.databasePath);
runMigrations(db);
const history = createHistoryRepository(db);
const content = createContentService({ articleExtractor: createArticleExtractor(), youtubeExtractor: createYouTubeExtractor() });
const primary = env.groqApiKey ? createGroqProvider({ apiKey: env.groqApiKey, model: env.groqModel }) : createOpenAIProvider({ apiKey: env.openaiApiKey });
const fallback = env.groqApiKey && env.openaiApiKey ? createOpenAIProvider({ apiKey: env.openaiApiKey }) : null;
const ai = createAiService({ primary, fallback, logger });
const generation = createGenerationService({ contentService: content, aiService: ai, historyRepository: history, createId });
const app = createApp({ database: db, services: { generation, extraction: content, history } });
const server = app.listen(env.port, () => logger.info({ port: env.port }, 'HookSlides server listening'));

const shutdown = () => server.close(() => { db.close(); process.exit(0); });
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
