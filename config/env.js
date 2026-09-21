import 'dotenv/config';
import path from 'node:path';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_PATH: z.string().min(1).default('./data/hookslides.sqlite'),
  GROQ_API_KEY: z.string().trim().optional(),
  OPENAI_API_KEY: z.string().trim().optional(),
  GROQ_MODEL: z.string().min(1).default('llama-3.3-70b-versatile'),
  ADMIN_PASSWORD: z.string().trim().optional()
});

const parsed = schema.parse(process.env);
if (!parsed.GROQ_API_KEY && !parsed.OPENAI_API_KEY) {
  throw new Error('At least one AI provider API key is required.');
}

export const env = {
  port: parsed.PORT,
  databasePath: path.resolve(process.cwd(), parsed.DATABASE_PATH),
  groqApiKey: parsed.GROQ_API_KEY || null,
  openaiApiKey: parsed.OPENAI_API_KEY || null,
  groqModel: parsed.GROQ_MODEL,
  adminPassword: parsed.ADMIN_PASSWORD || 'secretadmin'
};
