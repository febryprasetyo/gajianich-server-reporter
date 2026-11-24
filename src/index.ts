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
  } catch (err: any) {
    console.error(`[GAJIANICH Reporter Scheduler] Terjadi kesalahan:`, err?.message || err);
  }
}

export async function startReporterService() {
  const isDaemon = process.argv.includes('--daemon') || process.env.REPORTER_DAEMON === 'true';
  const intervalMs = Math.max(60000, Number(process.env.REPORTER_INTERVAL_MS) || 3600000);

  console.log(`[GAJIANICH Reporter] Inisialisasi service reporter audit server...`);
  await runWeeklyAuditJob();

  if (isDaemon) {
    console.log(`[GAJIANICH Reporter Daemon] Berjalan dalam mode daemon (interval: ${intervalMs / 1000}s). Menunggu siklus berikutnya...`);
    setInterval(async () => {
      await runWeeklyAuditJob();
    }, intervalMs);
  } else {
    console.log(`[GAJIANICH Reporter] Pekerjaan selesai.`);
    await getDbPool().end();
  }
}

if (process.argv[1] && (process.argv[1].endsWith('index.ts') || process.argv[1]?.endsWith('index.js'))) {
  void startReporterService();
}
