import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface AppConfig {
  databaseUrl: string;
  geminiApiKey: string;
  storageReportsDir: string;
}

export function loadConfig(): AppConfig {
  const databaseUrl = (
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5433/ams_dev_db'
  ).trim();

  const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim();

  const storageReportsDir = (
    process.env.STORAGE_REPORTS_DIR ||
    path.resolve(process.cwd(), '../storage/reports')
  ).trim();

  return {
    databaseUrl,
    geminiApiKey,
    storageReportsDir,
  };
}
