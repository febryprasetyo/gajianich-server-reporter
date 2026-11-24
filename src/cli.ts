import { aggregateWeeklyData, aggregateClusterWeeklyData } from './aggregator/dataAggregator.js';
import { analyzeWeeklyMetrics } from './ai/geminiAnalyst.js';
import { renderHtmlTemplate } from './generator/template.js';
import { renderPdfFromHtml } from './generator/pdfRenderer.js';
import { archiveWeeklyReport } from './storage/archiver.js';
import { queryDb, getDbPool } from './config/db.js';

export async function generateReportForServer(
  serverIdentifier: string | number,
  generatedBy = 'CLI_MANUAL_TRIGGER'
) {
  console.log(`\n======================================================`);
  console.log(`[GAJIANICH Reporter] Memulai pembuatan laporan mingguan`);
  console.log(`Target Server: ${serverIdentifier}`);
  console.log(`======================================================`);

  console.log(`-> 1. Ekstraksi dan agregasi data 7 hari dari database PostgreSQL...`);
  const data = await aggregateWeeklyData(serverIdentifier);
  console.log(`   ✓ Data berhasil diekstrak untuk server: ${data.server.name} (${data.server.code})`);
  console.log(`   ✓ Periode: ${data.period.week} (${data.period.startDate} s/d ${data.period.endDate})`);
  console.log(`   ✓ Sampel telemetri: ${data.metrics.sampleCount} rekaman`);

  console.log(`-> 2. Menjalankan analisis audit 8 bagian (Gemini 2.5 Flash / Rule-Based)...`);
  const analysis = await analyzeWeeklyMetrics(data);
  console.log(`   ✓ Status Audit: ${analysis.overallStatus} (SLA: ${analysis.slaPercent}%)`);
  console.log(`   ✓ Ringkasan: ${analysis.executiveSummary.slice(0, 80)}...`);

  console.log(`-> 3. Merender template HTML & CSS Sophos Enterprise...`);
  const html = renderHtmlTemplate(data, analysis);

  console.log(`-> 4. Men-generate dokumen PDF A4 via Puppeteer Headless...`);
  const pdfBuffer = await renderPdfFromHtml(html);
  console.log(`   ✓ PDF berhasil dibuat (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

  console.log(`-> 5. Menyimpan file PDF fisik dan mencatat metadata ke database...`);
  const archive = await archiveWeeklyReport(data, analysis, pdfBuffer, generatedBy);
  console.log(`   ✓ Tersimpan di: ${archive.pdfFilePath}`);
  console.log(`   ✓ ID Database: ${archive.reportId}`);
  console.log(`======================================================`);
  console.log(`[GAJIANICH Reporter] Laporan selesai dengan sukses!\n`);

  return archive;
}

export async function generateReportForCluster(generatedBy = 'CLI_MANUAL_TRIGGER') {
  console.log(`\n======================================================`);
  console.log(`[GAJIANICH Reporter] Memulai pembuatan laporan mingguan CLUSTER`);
  console.log(`Cakupan: Seluruh Node Server (Cluster Fleet)`);
  console.log(`======================================================`);

  console.log(`-> 1. Ekstraksi dan agregasi data cluster 7 hari dari PostgreSQL...`);
  const data = await aggregateClusterWeeklyData();
  console.log(`   ✓ Data berhasil diekstrak untuk cluster: ${data.server.specs}`);
  console.log(`   ✓ Periode: ${data.period.week} (${data.period.startDate} s/d ${data.period.endDate})`);

  console.log(`-> 2. Menjalankan analisis audit 8 bagian (Gemini 2.5 Flash / Rule-Based)...`);
  const analysis = await analyzeWeeklyMetrics(data);
  console.log(`   ✓ Status Audit: ${analysis.overallStatus} (SLA: ${analysis.slaPercent}%)`);
  console.log(`   ✓ Ringkasan: ${analysis.executiveSummary.slice(0, 80)}...`);

  console.log(`-> 3. Merender template HTML & CSS Sophos Enterprise...`);
  const html = renderHtmlTemplate(data, analysis);

  console.log(`-> 4. Men-generate dokumen PDF A4 via Puppeteer Headless...`);
  const pdfBuffer = await renderPdfFromHtml(html);
  console.log(`   ✓ PDF berhasil dibuat (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

  console.log(`-> 5. Menyimpan file PDF fisik dan mencatat metadata ke database...`);
  const archive = await archiveWeeklyReport(data, analysis, pdfBuffer, generatedBy);
  console.log(`   ✓ Tersimpan di: ${archive.pdfFilePath}`);
  console.log(`   ✓ ID Database: ${archive.reportId}`);
  console.log(`======================================================`);
  console.log(`[GAJIANICH Reporter] Laporan cluster selesai dengan sukses!\n`);

  return archive;
}

async function main() {
  const args = process.argv.slice(2);
  let serverArg = '';
  const isCluster = args.includes('--cluster');

  for (const arg of args) {
    if (arg.startsWith('--server=')) {
      serverArg = arg.replace('--server=', '').trim();
    }
  }

  try {
    if (isCluster) {
      await generateReportForCluster('CLI_ON_DEMAND');
    } else if (serverArg) {
      await generateReportForServer(serverArg, 'CLI_ON_DEMAND');
    } else {
      console.log(`[GAJIANICH Reporter] Mode All Servers: Mencari semua server aktif di database...`);
      const servers = await queryDb<{ id: string; hostname: string }>(
        `SELECT id, hostname FROM servers WHERE status = 'Online' OR status IS NULL LIMIT 20`
      );

      if (servers.length === 0) {
        console.log(`[GAJIANICH Reporter] Tidak ada server aktif ditemukan di database.`);
        process.exit(0);
      }

      console.log(`Ditemukan ${servers.length} server.`);
      for (const s of servers) {
        try {
          await generateReportForServer(s.id, 'CLI_SCHEDULER_ALL');
        } catch (err: any) {
          console.error(`Gagal membuat laporan untuk server ${s.hostname} (${s.id}):`, err?.message || err);
        }
      }
    }
  } catch (err: any) {
    console.error(`[GAJIANICH Reporter Error]`, err);
    process.exit(1);
  } finally {
    await getDbPool().end();
  }
}

if (process.argv[1] && (process.argv[1].endsWith('cli.ts') || process.argv[1]?.endsWith('cli.js'))) {
  void main();
}
