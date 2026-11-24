import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateWeeklyData, aggregateClusterWeeklyData } from '../src/aggregator/dataAggregator.js';
import { generateRuleBasedAnalysis } from '../src/ai/ruleBasedFallback.js';
import { renderHtmlTemplate } from '../src/generator/template.js';
import { getDbPool } from '../src/config/db.js';

test('DataAggregator extracts real database metrics for existing server (Node Mode)', async () => {
  const data = await aggregateWeeklyData('srv-dev-cmc');

  assert.ok(data, 'Aggregated data should exist');
  assert.equal(data.scopeType, 'NODE');
  assert.equal(data.server.code, 'srv-dev-cmc');
  assert.match(data.period.week, /^\d{4}-W\d{2}$/, 'Period week must be in ISO format YYYY-Www');
  assert.equal(typeof data.metrics.avgCpuPct, 'number');
  assert.equal(typeof data.metrics.avgRamPct, 'number');
  assert.equal(typeof data.metrics.endDiskPct, 'number');
  assert.equal(typeof data.metrics.sampleCount, 'number');
  assert.ok(Array.isArray(data.services), 'Services should be an array');
  assert.ok(Array.isArray(data.backups), 'Backups should be an array');
  assert.ok(data.security, 'Security metrics should exist');
  assert.equal(typeof data.security.successfulSshLogins, 'number');
  assert.equal(typeof data.security.sudoExecutions, 'number');
});

test('DataAggregator extracts real cluster metrics (Cluster Mode)', async () => {
  const data = await aggregateClusterWeeklyData();

  assert.ok(data, 'Cluster aggregated data should exist');
  assert.equal(data.scopeType, 'CLUSTER');
  assert.equal(data.server.code, 'CLUSTER');
  assert.ok(data.server.name.includes('Cluster Fleet'));
  assert.equal(typeof data.metrics.avgCpuPct, 'number');
  assert.equal(typeof data.metrics.avgRamPct, 'number');
  assert.ok(Array.isArray(data.services));
});

test('RuleBasedFallback produces structured 8-section audit summary, SLA, and Action Items', async () => {
  const data = await aggregateWeeklyData('srv-dev-cmc');
  const analysis = generateRuleBasedAnalysis(data);

  assert.ok(['NORMAL', 'WARNING', 'CRITICAL'].includes(analysis.overallStatus), 'Status must be valid enum');
  assert.ok(typeof analysis.slaPercent === 'string' && parseFloat(analysis.slaPercent) >= 90, 'SLA percent must be >= 90%');
  assert.ok(analysis.executiveSummary.length > 50, 'Executive summary must be substantial');
  assert.equal(analysis.recommendations.length, 3, 'Must contain exactly 3 prioritized recommendations');
  assert.ok(Array.isArray(analysis.actionItems), 'Action items must be an array');
  assert.ok(analysis.actionItems.length >= 3, 'Must contain at least 3 action items');

  for (const act of analysis.actionItems) {
    assert.ok(['DevOps', 'Sysadmin', 'DBA', 'Backend Lead'].includes(act.pic), `PIC must be valid role: ${act.pic}`);
    assert.ok(['SELESAI', 'DALAM_PROGRES', 'TERJADWAL'].includes(act.status), `Status must be valid: ${act.status}`);
  }

  assert.ok(analysis.serviceAvailability, 'Service availability section must exist');
  assert.ok(analysis.resourceMetrics, 'Resource metrics section must exist');
  assert.ok(analysis.databaseMiddleware, 'Database middleware section must exist');
  assert.ok(analysis.securityAudit, 'Security audit section must exist');
  assert.ok(analysis.backupDr, 'Backup DR section must exist');
  assert.ok(Array.isArray(analysis.incidentsMaintenance), 'Incidents maintenance section must exist');
});

test('Template generates Sophos Enterprise print-ready A4 HTML layout with 8 sections', async () => {
  const data = await aggregateWeeklyData('srv-dev-cmc');
  const analysis = generateRuleBasedAnalysis(data);
  const html = renderHtmlTemplate(data, analysis);

  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('GAJIANICH ENTERPRISE INFRASTRUCTURE AUDIT'));
  assert.ok(html.includes('LAPORAN AUDIT & KINERJA INFRASTRUKTUR SERVER'));
  assert.ok(html.includes('Ringkasan Eksekutif & SLA Operasional'));
  assert.ok(html.includes('Ketersediaan Layanan & Kesehatan Proses (SLA)'));
  assert.ok(html.includes('Metrik Utilisasi Sumber Daya & Analisis Kapasitas'));
  assert.ok(html.includes('Kinerja Database & Komponen Middleware'));
  assert.ok(html.includes('Audit Keamanan Sistem & Pembaruan OS'));
  assert.ok(html.includes('Integritas Backup & Pemulihan Bencana (DR)'));
  assert.ok(html.includes('Rekapitulasi Insiden & Catatan Pemeliharaan'));
  assert.ok(html.includes('Rencana Tindakan & Rekomendasi Mitigasi (Action Items)'));
  assert.ok(html.includes('size: A4 portrait;'));
  assert.ok(html.includes('page-break-after: always;'));

  await getDbPool().end();
});
