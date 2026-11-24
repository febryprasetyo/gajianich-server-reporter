import { generateReportForServer } from './cli.js';
import { queryDb, getDbPool } from './config/db.js';

export async function runWeeklyAuditJob() {
  console.log(`[GAJIANICH Reporter Scheduler] Memulai pekerjaan audit mingguan otomatis...`);
  try {
    const servers = await queryDb<{ id: string; hostname: string }>(
      `SELECT id, hostname FROM servers WHERE status = 'Online' OR status IS NULL`
    );

    for (const s of servers) {
      try {
        await generateReportForServer(s.id, 'GEMINI_AI_SCHEDULER');
      } catch (err: any) {
        console.error(`Gagal membuat laporan untuk server ${s.hostname}:`, err?.message || err);
      }
    }
  } finally {
    await getDbPool().end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  void runWeeklyAuditJob();
}
