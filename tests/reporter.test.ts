import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateWeeklyData } from '../src/aggregator/dataAggregator.js';
import { generateRuleBasedAnalysis } from '../src/ai/ruleBasedFallback.js';
import { renderHtmlTemplate } from '../src/generator/template.js';
import { getDbPool } from '../src/config/db.js';

test('DataAggregator extracts real database metrics for existing server', async () => {
  // srv-dev-cmc is an existing registered server in PostgreSQL
  const data = await aggregateWeeklyData('srv-dev-cmc');

  assert.ok(data, 'Aggregated data should exist');
  assert.equal(data.server.code, 'srv-dev-cmc');
  assert.match(data.period.week, /^\d{4}-W\d{2}$/, 'Period week must be in ISO format YYYY-Www');
  assert.equal(typeof data.metrics.avgCpuPct, 'number');
  assert.equal(typeof data.metrics.avgRamPct, 'number');
  assert.equal(typeof data.metrics.endDiskPct, 'number');
  assert.equal(typeof data.metrics.sampleCount, 'number');
  assert.ok(Array.isArray(data.services), 'Services should be an array');
  assert.ok(Array.isArray(data.backups), 'Backups should be an array');
});

test('RuleBasedFallback produces structured audit summary and 3 recommendations', async () => {
  const data = await aggregateWeeklyData('srv-dev-cmc');
  const analysis = generateRuleBasedAnalysis(data);

  assert.ok(['NORMAL', 'WARNING', 'CRITICAL'].includes(analysis.overallStatus), 'Status must be valid enum');
  assert.ok(analysis.executiveSummary.length > 50, 'Executive summary must be substantial');
  assert.ok(analysis.executiveSummary.includes(data.server.name) || analysis.executiveSummary.includes(data.server.code));
  assert.equal(analysis.recommendations.length, 3, 'Must contain exactly 3 prioritized recommendations');

  for (const rec of analysis.recommendations) {
    assert.ok(['TINGGI', 'SEDANG', 'RENDAH'].includes(rec.priority));
    assert.ok(rec.title.length > 0);
    assert.ok(rec.action.length > 0);
  }
});

test('Template generates Emerald Enterprise print-ready A4 HTML layout', async () => {
  const data = await aggregateWeeklyData('srv-dev-cmc');
  const analysis = generateRuleBasedAnalysis(data);
  const html = renderHtmlTemplate(data, analysis);

  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('GAJIANICH INFRASTRUCTURE AUDIT'));
  assert.ok(html.includes(data.server.code));
  assert.ok(html.includes(analysis.overallStatus));
  assert.ok(html.includes('size: A4 portrait;'));
  assert.ok(html.includes('margin: 15mm;'));
  assert.ok(html.includes('page-break-inside: avoid;'));

  await getDbPool().end();
});
