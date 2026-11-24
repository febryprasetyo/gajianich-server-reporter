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

  const pdfFileName =
    data.scopeType === 'CLUSTER'
      ? `Laporan-Mingguan-Cluster-Fleet-${data.period.week}.pdf`
      : `Laporan-Mingguan-${data.server.code}-${data.period.week}.pdf`;
  const pdfFilePath = path.join(storageDir, pdfFileName);

  fs.writeFileSync(pdfFilePath, pdfBuffer);
  const fileSizeBytes = pdfBuffer.length;

  // Sinkronisasi otomatis ke direktori backend data/reports agar bisa diakses container backend
  const backendDataReportsDir = '/home/fastpec/code/ams-app/backend/data/reports';
  try {
    if (!fs.existsSync(backendDataReportsDir)) {
      fs.mkdirSync(backendDataReportsDir, { recursive: true });
    }
    fs.writeFileSync(path.join(backendDataReportsDir, pdfFileName), pdfBuffer);
  } catch {
    // Non-fatal if permission or path differs
  }

  const insertSql = `
    INSERT INTO server_weekly_reports (
      server_id,
      scope_type,
      period_week,
      start_date,
      end_date,
      status,
      sla_percent,
      executive_summary,
      incident_rca,
      service_availability,
      resource_metrics,
      database_middleware,
      security_audit,
      backup_dr,
      incidents_maintenance,
      action_items,
      recommendations,
      pdf_file_name,
      pdf_file_path,
      file_size_bytes,
      generated_by
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
    )
    RETURNING id
  `;

  const serverIdVal = data.scopeType === 'CLUSTER' || !data.server.id ? null : data.server.id;

  const rows = await queryDb(insertSql, [
    serverIdVal,
    data.scopeType || 'NODE',
    data.period.week,
    data.period.startDate,
    data.period.endDate,
    analysis.overallStatus,
    analysis.slaPercent || '99.90',
    analysis.executiveSummary,
    analysis.incidentRca,
    JSON.stringify(analysis.serviceAvailability || {}),
    JSON.stringify(analysis.resourceMetrics || {}),
    JSON.stringify(analysis.databaseMiddleware || {}),
    JSON.stringify(analysis.securityAudit || {}),
    JSON.stringify(analysis.backupDr || {}),
    JSON.stringify(analysis.incidentsMaintenance || []),
    JSON.stringify(analysis.actionItems || []),
    JSON.stringify(analysis.recommendations || []),
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
