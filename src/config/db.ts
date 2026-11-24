import { Pool } from 'pg';
import { loadConfig } from './env.js';

let poolInstance: Pool | null = null;

export function getDbPool(): Pool {
  if (!poolInstance) {
    const config = loadConfig();
    poolInstance = new Pool({
      connectionString: config.databaseUrl,
      max: 10,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
    });
    poolInstance.on('error', (err) => {
      console.error('[DB Pool Error]', err);
    });
  }
  return poolInstance;
}

export async function queryDb<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const pool = getDbPool();
  const res = await pool.query(sql, params);
  return res.rows as T[];
}
