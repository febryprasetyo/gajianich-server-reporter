import fs from 'fs';
import path from 'path';
import { AggregatedWeeklyMetrics } from '../aggregator/dataAggregator.js';
import { AiAuditAnalysisResult } from '../ai/ruleBasedFallback.js';
import { queryDb } from '../config/db.js';
import { loadConfig } from '../config/env.js';

export interface ArchivalResult {
  reportId: number;
  pdfFileName: string;
  pdfFilePath: string;
  fileSizeBytes: number;
}

export async function archiveWeeklyReport(
  data: AggregatedWeeklyMetrics,
  analysis: AiAuditAnalysisResult,
  pdfBuffer: Buffer,
  generatedBy = 'GEMINI_AI_SCHEDULER'
): Promise<ArchivalResult> {
  const config = loadConfig();
  const storageDir = config.storageReportsDir;

  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const pdfFileName = `Laporan-Mingguan-${data.server.code}-${data.period.week}.pdf`;
  const pdfFilePath = path.join(storageDir, pdfFileName);

  fs.writeFileSync(pdfFilePath, pdfBuffer);
  const fileSizeBytes = pdfBuffer.length;

  const insertSql = `
    INSERT INTO server_weekly_reports (
      server_id,
      period_week,
      start_date,
      end_date,
      status,
      executive_summary,
      incident_rca,
      recommendations,
      pdf_file_name,
      pdf_file_path,
      file_size_bytes,
      generated_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id
  `;

  const rows = await queryDb(insertSql, [
    data.server.id,
    data.period.week,
    data.period.startDate,
    data.period.endDate,
    analysis.overallStatus,
    analysis.executiveSummary,
    analysis.incidentRca,
    JSON.stringify(analysis.recommendations),
    pdfFileName,
    pdfFilePath,
    fileSizeBytes,
    generatedBy,
  ]);

  const reportId = Number(rows[0]?.id || 0);

  return {
    reportId,
    pdfFileName,
    pdfFilePath,
    fileSizeBytes,
  };
}
