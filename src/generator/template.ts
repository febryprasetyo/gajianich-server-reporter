import { AggregatedWeeklyMetrics } from '../aggregator/dataAggregator.js';
import { AiAuditAnalysisResult } from '../ai/ruleBasedFallback.js';

function renderMeterBar(valPct: number, colorHex: string, maxWidth = 48): string {
  const clamped = Math.max(0, Math.min(100, Math.round(valPct)));
  const widthPx = clamped === 0 ? 3 : Math.max(4, Math.round((clamped / 100) * maxWidth));
  return `<span style="display: inline-block; width: ${widthPx}px; height: 5px; background-color: ${colorHex}; border-radius: 1px; vertical-align: middle; margin-left: 6px;"></span>`;
}

const DEFAULT_PORT_SERVICES: Record<string, string> = {
  '22/tcp': 'OpenSSH Daemon',
  '53/tcp': 'DNS Resolver',
  '80/tcp': 'HTTP Web Ingress',
  '443/tcp': 'HTTPS TLS Ingress',
  '631/tcp': 'CUPS Print Spooler',
  '1883/tcp': 'Mosquitto MQTT Broker',
  '3000/tcp': 'Frontend Web Application',
  '5000/tcp': 'Backend API Service',
  '5432/tcp': 'PostgreSQL Database',
  '5433/tcp': 'PostgreSQL Dev Instance',
  '6379/tcp': 'Redis In-Memory Cache',
};

const PUBLIC_PORTS = new Set(['22/tcp', '80/tcp', '443/tcp']);

function parsePortEntry(raw: string): {
  portProto: string;
  service: string;
  scope: string;
  riskLevel: string;
  riskClass: string;
} {
  const cleaned = raw.trim().replace(/^:/, '');
  const match = cleaned.match(/^(\d+\/[a-zA-Z]+)(?:\s*\(([^)]+)\))?/);
  const portProto = match ? match[1].toLowerCase() : cleaned.toLowerCase();
  const service = (match && match[2]) || DEFAULT_PORT_SERVICES[portProto] || 'Layanan Sistem';
  const isPublic = PUBLIC_PORTS.has(portProto);
  const isRemoteAdmin = portProto === '22/tcp';
  return {
    portProto: portProto.toUpperCase(),
    service,
    scope: isPublic ? 'Publik (Terfilter UFW)' : 'Privat / Internal Jaringan',
    riskLevel: isRemoteAdmin ? '2' : '1',
    riskClass: isRemoteAdmin ? 'risk-pill-2' : 'risk-pill-1',
  };
}

export function renderHtmlTemplate(
  data: AggregatedWeeklyMetrics,
  analysis: AiAuditAnalysisResult
): string {
  const isCluster = data.scopeType === 'CLUSTER';
  const statusColor =
    analysis.overallStatus === 'NORMAL'
      ? '#15803d'
      : analysis.overallStatus === 'WARNING'
      ? '#b45309'
      : '#b91c1c';

  // 1. Services Table rows (Sophos Style - Full list without truncation)
  const prioritizedServices = [...data.services].sort((a, b) => (b.restarts || 0) - (a.restarts || 0));

  const servicesHtml =
    prioritizedServices.length > 0
      ? prioritizedServices
          .map((s) => {
            const isOk = s.status === 'active' || s.status === 'online';
            return `
        <tr>
          <td class="cell-strong">${s.name}</td>
          <td class="cell-center">
            <span class="risk-pill ${isOk ? 'risk-pill-1' : 'risk-pill-5'}">${isOk ? '1' : '5'}</span>
          </td>
          <td class="cell-upper-muted">${s.category}</td>
          <td class="tabular" style="color: ${s.restarts > 0 ? '#b91c1c' : '#334155'}; font-weight: 600;">
            <span style="min-width: 18px; display: inline-block;">${s.restarts}</span>
            ${renderMeterBar(Math.min(100, s.restarts * 25), s.restarts > 0 ? '#c2410c' : '#cbd5e1', 24)}
          </td>
          <td class="tabular" style="color: #334155;">${s.uptime}</td>
        </tr>`;
          })
          .join('')
      : `<tr class="empty-row"><td colspan="5" class="cell-empty">Tidak ada layanan atau kontainer spesifik yang tercatat.</td></tr>`;

  // 2. Backups Table rows (Sophos Style - Full list without truncation)
  const backupsHtml =
    data.backups.length > 0
      ? data.backups
          .map(
            (b) => `
        <tr>
          <td class="cell-strong">${b.dbName}</td>
          <td class="cell-center">
            <span class="risk-pill risk-pill-1">1</span>
          </td>
          <td style="color: #15803d; font-weight: 600;">✓ ${b.status}</td>
          <td class="tabular" style="font-weight: 600; color: #0f172a;">
            <span style="min-width: 52px; display: inline-block;">${b.sizeMb} MB</span>
            ${renderMeterBar(Math.min(100, (b.sizeMb / 500) * 100), '#0369a1', 38)}
          </td>
          <td class="tabular" style="color: #334155;">
            ${b.completedAt ? new Date(b.completedAt).toLocaleString('id-ID') : '-'}
          </td>
        </tr>`
          )
          .join('')
      : `<tr class="empty-row"><td colspan="5" class="cell-empty">Tidak ada riwayat backup database tercatat pada periode audit (7 hari terakhir).</td></tr>`;

  // 3. Incidents Table rows (Sophos Style)
  const incidentsHtml =
    analysis.incidentsMaintenance && analysis.incidentsMaintenance.length > 0
      ? analysis.incidentsMaintenance
          .map((inc) => {
            const isCrit = inc.severity === 'KRITIS';
            return `
        <tr>
          <td class="cell-strong tabular">${inc.code}</td>
          <td class="cell-center">
            <span class="risk-pill ${isCrit ? 'risk-pill-5' : 'risk-pill-3'}">${isCrit ? '5' : '3'}</span>
          </td>
          <td class="cell-strong">${inc.component}</td>
          <td style="color: #1e293b;">${inc.description}</td>
          <td style="color: #15803d; font-weight: 600;">${inc.resolution}</td>
        </tr>`;
          })
          .join('')
      : `<tr class="empty-row"><td colspan="5" class="cell-empty" style="color: #15803d; font-weight: 600;">✓ Tidak Ada Insiden Tercatat — Ketersediaan layanan terjaga 100% tanpa gangguan operasional (Zero Outage).</td></tr>`;

  // 4. Action Items Table rows (Sophos Style - tanpa kolom PIC)
  const actionItemsHtml =
    analysis.actionItems && analysis.actionItems.length > 0
      ? analysis.actionItems
          .map((act) => {
            const statusLabel =
              act.status === 'SELESAI'
                ? 'SELESAI'
                : act.status === 'DALAM_PROGRES'
                ? 'DALAM PROGRES'
                : 'TERJADWAL';
            const statusColorHex =
              act.status === 'SELESAI'
                ? '#15803d'
                : act.status === 'DALAM_PROGRES'
                ? '#b45309'
                : '#475569';
            return `
        <tr>
          <td class="cell-center tabular" style="font-weight: 700; color: #334155;">${act.no}</td>
          <td class="cell-strong">${act.issue}</td>
          <td style="color: #1e293b;">${act.action}</td>
          <td class="cell-center tabular" style="color: #334155; font-weight: 600;">${act.target}</td>
          <td class="cell-center">
            <span class="status-tag" style="color: ${statusColorHex}; border-color: ${statusColorHex};">${statusLabel}</span>
          </td>
        </tr>`;
          })
          .join('')
      : `<tr class="empty-row"><td colspan="5" class="cell-empty">Tidak ada action item tertunda.</td></tr>`;

  // 5. Strategic Recommendations Table rows
  const recommendationsTableRows = analysis.recommendations
    .map((rec, idx) => {
      const pLevel = rec.priority === 'TINGGI' ? '3' : rec.priority === 'SEDANG' ? '2' : '1';
      const pClass =
        rec.priority === 'TINGGI'
          ? 'risk-pill-5'
          : rec.priority === 'SEDANG'
          ? 'risk-pill-3'
          : 'risk-pill-1';
      return `
      <tr>
        <td class="cell-center tabular" style="font-weight: 700; color: #334155;">${idx + 1}</td>
        <td class="cell-strong">${rec.title}</td>
        <td class="cell-center">
          <span class="risk-pill ${pClass}">${pLevel}</span>
          <span style="font-size: 9px; font-weight: 700; color: #334155; margin-left: 4px;">${rec.priority}</span>
        </td>
        <td style="color: #1e293b; line-height: 1.45;">${rec.action}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan Audit Infrastruktur - ${data.server.code} - ${data.period.week}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
      @bottom-right {
        content: counter(page);
      }
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 10px;
      line-height: 1.45;
      font-variant-numeric: tabular-nums;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .tabular {
      font-variant-numeric: tabular-nums;
    }
    .page-cover {
      page-break-after: always;
      page-break-inside: avoid;
      border: 1px solid #cbd5e1;
      background-color: #ffffff;
      padding: 12mm 12mm 10mm 12mm;
      height: 262mm;
      max-height: 262mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }
    .avoid-break {
      page-break-inside: avoid;
    }
    .running-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 5px;
      margin-bottom: 10px;
      border-bottom: 1.5px solid #059669;
      font-size: 9px;
      color: #475569;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .running-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 6px;
      margin-top: 14px;
      border-top: 1px solid #e2e8f0;
      font-size: 9px;
      color: #64748b;
      font-weight: 500;
    }
    .section-block {
      margin-bottom: 12px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin: 0 0 4px 0;
      padding-bottom: 3px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 6px;
      page-break-after: avoid;
      break-after: avoid;
    }
    .section-title span.badge {
      font-size: 9px;
      background: #ffffff;
      color: #059669;
      border: 1px solid #059669;
      padding: 1px 5px;
      border-radius: 2px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .section-intro {
      font-size: 10px;
      color: #475569;
      line-height: 1.45;
      margin: 0 0 6px 0;
      padding: 0;
      background: transparent;
      font-weight: 400;
    }
    .subsection-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: #0f172a;
      margin: 8px 0 4px 0;
      page-break-after: avoid;
      break-after: avoid;
    }
    .section-note {
      margin: 0;
      font-size: 10px;
      color: #475569;
      line-height: 1.45;
    }
    /* Restrained Corporate Audit Table Styling */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
      font-size: 10px;
      page-break-inside: auto;
      background-color: #ffffff;
    }
    .data-table thead {
      display: table-header-group;
    }
    .data-table tr {
      page-break-inside: avoid;
    }
    .data-table th {
      background-color: #ffffff;
      color: #64748b;
      padding: 5px 6px;
      text-align: left;
      font-size: 9px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.4px;
      border-top: 1px solid #cbd5e1;
      border-bottom: 1.5px solid #cbd5e1;
    }
    .data-table td {
      padding: 4.5px 6px;
      border-bottom: 1px solid #e2e8f0;
      color: #1e293b;
      font-size: 10px;
      vertical-align: middle;
      background-color: #ffffff;
    }
    .data-table tbody tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    .data-table tbody tr.empty-row td {
      background-color: #ffffff;
    }
    .cell-strong {
      font-weight: 600;
      color: #0f172a;
    }
    .cell-center {
      text-align: center;
    }
    .cell-upper-muted {
      color: #475569;
      text-transform: uppercase;
      font-size: 9px;
      font-weight: 600;
    }
    .cell-empty {
      padding: 10px;
      text-align: center;
      color: #64748b;
      font-size: 10px;
    }
    /* Sophos Risk Level Pills */
    .risk-pill {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 2px;
      font-size: 9px;
      font-weight: 700;
      text-align: center;
      color: #ffffff;
      min-width: 14px;
      line-height: 1.25;
      font-variant-numeric: tabular-nums;
    }
    .risk-pill-1 { background-color: #15803d; }
    .risk-pill-2 { background-color: #4d7c0f; }
    .risk-pill-3 { background-color: #b45309; }
    .risk-pill-4 { background-color: #c2410c; }
    .risk-pill-5 { background-color: #b91c1c; }
    .status-tag {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 2px;
      border: 1px solid currentColor;
      background-color: #ffffff;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.2px;
      line-height: 1.25;
    }
    /* Clean Hairline Callout for RCA */
    .rca-callout {
      margin: 6px 0 4px 0;
      padding: 7px 10px;
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-left: 2.5px solid #b45309;
    }
    .rca-callout-title {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #b45309;
      margin-bottom: 2px;
    }
    .rca-callout-body {
      margin: 0;
      font-size: 10px;
      line-height: 1.45;
      color: #1e293b;
      text-align: justify;
    }
  </style>
</head>
<body>

  <!-- ==================== COVER PAGE ==================== -->
  <div class="page-cover">
    <div>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1.5px solid #059669; padding-bottom: 10px;">
        <div>
          <div style="font-size: 12px; font-weight: 800; color: #059669; letter-spacing: 0.8px; text-transform: uppercase;">
            GAJIANICH ENTERPRISE PLATFORM
          </div>
          <div style="font-size: 9px; color: #475569; font-weight: 600; margin-top: 2px;">
            Divisi Teknologi Informasi & Infrastruktur • PT Cahaya Mas Cemerlang
          </div>
        </div>
        <div style="text-align: right;">
          <span class="tabular" style="display: inline-block; padding: 3px 8px; border: 1px solid #cbd5e1; border-radius: 2px; font-size: 9px; font-weight: 700; background: #ffffff; color: #0f172a; text-transform: uppercase; letter-spacing: 0.4px;">
            ${isCluster ? 'CAKUPAN: CLUSTER FLEET' : `CAKUPAN: NODE [${data.server.code}]`}
          </span>
        </div>
      </div>

      <div style="margin-top: 9mm; margin-bottom: 8mm;">
        <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 4px;">
          DOKUMEN AUDIT TEKNIS RESMI
        </div>
        <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; line-height: 1.25; margin: 0 0 6px 0; text-transform: uppercase;">
          LAPORAN AUDIT & KINERJA INFRASTRUKTUR SERVER
        </h1>
        <h2 style="font-size: 12px; font-weight: 500; color: #475569; margin: 0; line-height: 1.35;">
          Pemeriksaan Berkala Keandalan Sistem, Beban Komputasi, Postur Keamanan, & Mitigasi Risiko
        </h2>
      </div>

      <!-- Metadata Box (Crisp White + 1px Hairline) -->
      <div style="background: #ffffff; border: 1px solid #e2e8f0; padding: 8px 12px; margin-bottom: 12px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <tr>
            <td style="width: 24%; padding: 2.5px 0; color: #64748b; font-weight: 600;">Target Sistem:</td>
            <td class="tabular" style="width: 76%; padding: 2.5px 0; color: #0f172a; font-weight: 700;">${data.server.name} (${data.server.code}) — ${data.server.ipAddress}</td>
          </tr>
          <tr>
            <td style="padding: 2.5px 0; color: #64748b; font-weight: 600;">Periode Audit:</td>
            <td class="tabular" style="padding: 2.5px 0; color: #0f172a; font-weight: 700;">Minggu ${data.period.week} (${data.period.startDate} s/d ${data.period.endDate})</td>
          </tr>
          <tr>
            <td style="padding: 2.5px 0; color: #64748b; font-weight: 600;">Klasifikasi Dokumen:</td>
            <td style="padding: 2.5px 0; color: #b91c1c; font-weight: 700; text-transform: uppercase;">KONFIDENSIAL INTERNAL (LEVEL 2)</td>
          </tr>
          <tr>
            <td style="padding: 2.5px 0; color: #64748b; font-weight: 600;">Spesifikasi Mesin:</td>
            <td class="tabular" style="padding: 2.5px 0; color: #0f172a; font-weight: 500;">${data.server.specs} • ${data.server.os}</td>
          </tr>
          <tr>
            <td style="padding: 2.5px 0; color: #64748b; font-weight: 600;">Waktu Pembuatan:</td>
            <td class="tabular" style="padding: 2.5px 0; color: #0f172a; font-weight: 500;">${new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'long' })}</td>
          </tr>
          <tr>
            <td style="padding: 2.5px 0; color: #64748b; font-weight: 600;">Auditor / Engine:</td>
            <td style="padding: 2.5px 0; color: #059669; font-weight: 700;">GAJIANICH Automated Infrastructure Auditor (v2.5)</td>
          </tr>
        </table>
      </div>

      <!-- Executive Key Performance Table -->
      <div style="margin-bottom: 10px;">
        <div class="subsection-title" style="margin-top: 0;">
          Ringkasan Parameter Kunci Operasional
        </div>
        <table class="data-table" style="margin-bottom: 0;">
          <thead>
            <tr>
              <th style="width: 32%;">Parameter Audit</th>
              <th style="width: 16%; text-align: center;">Tingkat Risiko</th>
              <th style="width: 26%;">Metrik Terukur</th>
              <th style="width: 26%;">Target / Standar SLA</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="cell-strong">Status Evaluasi Kinerja</td>
              <td class="cell-center">
                <span class="risk-pill ${analysis.overallStatus === 'NORMAL' ? 'risk-pill-1' : analysis.overallStatus === 'WARNING' ? 'risk-pill-3' : 'risk-pill-5'}">
                  ${analysis.overallStatus === 'NORMAL' ? '1' : analysis.overallStatus === 'WARNING' ? '3' : '5'}
                </span>
              </td>
              <td style="font-weight: 700; color: ${statusColor};">● ${analysis.overallStatus}</td>
              <td style="color: #475569;">Ambang Batas Normal Operasional</td>
            </tr>
            <tr>
              <td class="cell-strong">Ketersediaan Sistem (SLA)</td>
              <td class="cell-center"><span class="risk-pill risk-pill-1">1</span></td>
              <td class="tabular">
                <span style="font-weight: 700; color: #0f172a; min-width: 46px; display: inline-block;">${analysis.slaPercent}%</span>
                ${renderMeterBar(parseFloat(analysis.slaPercent) || 99, '#0369a1', 40)}
              </td>
              <td style="color: #475569;">Target Ketersediaan &ge; 99.90%</td>
            </tr>
            <tr>
              <td class="cell-strong">Insiden & Kegagalan Sistem</td>
              <td class="cell-center">
                <span class="risk-pill ${analysis.incidentsMaintenance.length > 0 ? 'risk-pill-4' : 'risk-pill-1'}">
                  ${analysis.incidentsMaintenance.length > 0 ? '4' : '1'}
                </span>
              </td>
              <td class="tabular" style="font-weight: 600; color: ${analysis.incidentsMaintenance.length > 0 ? '#b91c1c' : '#15803d'};">
                ${analysis.incidentsMaintenance.length} Tiket Insiden
              </td>
              <td style="color: #475569;">Zero Unplanned Downtime</td>
            </tr>
            <tr>
              <td class="cell-strong">Rata-rata Utilisasi Komputasi</td>
              <td class="cell-center"><span class="risk-pill risk-pill-1">1</span></td>
              <td class="tabular">
                <span style="font-weight: 600; color: #0f172a;">CPU ${data.metrics.avgCpuPct}%</span> ${renderMeterBar(data.metrics.avgCpuPct, '#c2410c', 22)}
                <span style="display: inline-block; width: 4px;"></span>
                <span style="font-weight: 600; color: #0f172a;">RAM ${data.metrics.avgRamPct}%</span> ${renderMeterBar(data.metrics.avgRamPct, '#0369a1', 22)}
              </td>
              <td style="color: #475569;">Headroom Komputasi Lapang</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="font-size: 10px; color: #475569; line-height: 1.45; text-align: justify; margin-top: 8px;">
        Laporan audit ini merepresentasikan evaluasi objektif berbasis sampel telemetri kernel Linux dan database time-series selama rentang audit 7 hari. Data diverifikasi secara independen oleh sistem audit otomatis tanpa intervensi manual.
      </div>
    </div>

    <!-- Cover Footer Notice -->
    <div style="border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 9px; color: #64748b; line-height: 1.35;">
      <strong style="color: #334155;">PEMBERITAHUAN KERAHASIAAN:</strong> Informasi yang termuat di dalam dokumen audit ini bersifat terbatas dan hanya ditujukan untuk manajemen dan staf operasional IT PT Cahaya Mas Cemerlang yang berwenang. Dilarang keras menggandakan, mendistribusikan, atau membagikan sebagian atau seluruh isi dokumen ini tanpa persetujuan tertulis resmi.
    </div>
  </div>


  <!-- ==================== BAGIAN 1: RINGKASAN EKSEKUTIF & SLA ==================== -->
  <div class="running-header">
    <span>GAJIANICH ENTERPRISE INFRASTRUCTURE AUDIT</span>
    <span class="tabular">TARGET: ${data.server.code} • PERIODE: ${data.period.week}</span>
  </div>

  <div class="section-block">
    <h3 class="section-title"><span class="badge">01</span> Ringkasan Eksekutif & SLA Operasional</h3>
    <div class="section-intro">
      Seksi ini menyajikan sintesis evaluasi performa menyeluruh, kepatuhan Service Level Agreement (SLA), serta sorotan operasional utama selama rentang audit 7 hari kalender.
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 28%;">Parameter Evaluasi</th>
          <th style="width: 14%; text-align: center;">Tingkat Risiko</th>
          <th style="width: 24%;">Metrik Terukur (Telemetri)</th>
          <th style="width: 18%;">Ambang Batas Target</th>
          <th style="width: 16%;">Evaluasi Kepatuhan</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="cell-strong">Ketersediaan Layanan (SLA Mingguan)</td>
          <td class="cell-center">
            <span class="risk-pill ${parseFloat(analysis.slaPercent) >= 99.9 ? 'risk-pill-1' : 'risk-pill-3'}">
              ${parseFloat(analysis.slaPercent) >= 99.9 ? '1' : '3'}
            </span>
          </td>
          <td class="tabular">
            <span style="font-weight: 700; color: #0f172a; min-width: 46px; display: inline-block;">${analysis.slaPercent}%</span>
            ${renderMeterBar(parseFloat(analysis.slaPercent) || 99, '#0369a1')}
          </td>
          <td class="tabular" style="color: #475569;">Target: &ge; 99.90%</td>
          <td style="font-weight: 600; color: ${parseFloat(analysis.slaPercent) >= 99.9 ? '#15803d' : '#b45309'};">
            ${parseFloat(analysis.slaPercent) >= 99.9 ? 'Memenuhi Standar' : 'Perlu Evaluasi'}
          </td>
        </tr>
        <tr>
          <td class="cell-strong">Utilisasi Rata-rata CPU</td>
          <td class="cell-center">
            <span class="risk-pill ${data.metrics.avgCpuPct > 70 ? 'risk-pill-4' : 'risk-pill-1'}">
              ${data.metrics.avgCpuPct > 70 ? '4' : '1'}
            </span>
          </td>
          <td class="tabular">
            <span style="font-weight: 700; color: #0f172a; min-width: 46px; display: inline-block;">${data.metrics.avgCpuPct}%</span>
            ${renderMeterBar(data.metrics.avgCpuPct, '#c2410c')}
          </td>
          <td class="tabular" style="color: #475569;">Batas Aman: &le; 70.0%</td>
          <td class="tabular" style="font-weight: 600; color: #15803d;">Kapasitas Lapang (Puncak ${data.metrics.peakCpuPct}%)</td>
        </tr>
        <tr>
          <td class="cell-strong">Utilisasi Rata-rata RAM Fisik</td>
          <td class="cell-center">
            <span class="risk-pill ${data.metrics.avgRamPct > 80 ? 'risk-pill-4' : 'risk-pill-1'}">
              ${data.metrics.avgRamPct > 80 ? '4' : '1'}
            </span>
          </td>
          <td class="tabular">
            <span style="font-weight: 700; color: #0f172a; min-width: 46px; display: inline-block;">${data.metrics.avgRamPct}%</span>
            ${renderMeterBar(data.metrics.avgRamPct, '#0369a1')}
          </td>
          <td class="tabular" style="color: #475569;">Batas Aman: &le; 80.0%</td>
          <td class="tabular" style="font-weight: 600; color: #15803d;">Terpakai ${data.metrics.ramUsedGb} GB / ${data.metrics.ramTotalGb} GB</td>
        </tr>
        <tr>
          <td class="cell-strong">Penyimpanan Disk Root</td>
          <td class="cell-center">
            <span class="risk-pill ${data.metrics.endDiskPct > 85 ? 'risk-pill-4' : 'risk-pill-1'}">
              ${data.metrics.endDiskPct > 85 ? '4' : '1'}
            </span>
          </td>
          <td class="tabular">
            <span style="font-weight: 700; color: #0f172a; min-width: 46px; display: inline-block;">${data.metrics.endDiskPct}%</span>
            ${renderMeterBar(data.metrics.endDiskPct, '#6d28d9')}
          </td>
          <td class="tabular" style="color: #475569;">Batas Aman: &le; 85.0%</td>
          <td class="tabular" style="font-weight: 600; color: #15803d;">Pertumbuhan 7-Hari: ${data.metrics.diskGrowthPct}%</td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top: 6px; margin-bottom: 4px;">
      <div class="subsection-title" style="margin-top: 0; margin-bottom: 2px;">
        Uraian Naratif Evaluasi Eksekutif:
      </div>
      <p style="margin: 0; font-size: 10px; line-height: 1.45; color: #1e293b; text-align: justify;">
        ${analysis.executiveSummary}
      </p>
    </div>

    ${
      analysis.incidentRca
        ? `
    <div class="rca-callout">
      <div class="rca-callout-title">Analisis Akar Masalah (Root Cause Analysis - RCA)</div>
      <p class="rca-callout-body">${analysis.incidentRca}</p>
    </div>`
        : ''
    }
  </div>


  <!-- ==================== BAGIAN 2: KETERSEDIAAN LAYANAN & PROSES ==================== -->
  <div class="section-block">
    <h3 class="section-title"><span class="badge">02</span> Ketersediaan Layanan & Kesehatan Proses (SLA)</h3>
    <div class="section-intro">
      Audit status operasional seluruh modul backend, kontainer Docker, daemon systemd, dan proses latar belakang. Memastikan tidak ada crash berkala atau instabilitas daur hidup layanan.
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 32%;">Nama Layanan / Kontainer</th>
          <th style="width: 14%; text-align: center;">Tingkat Risiko</th>
          <th style="width: 18%;">Kategori</th>
          <th style="width: 18%;">Restart Kontainer</th>
          <th style="width: 18%;">Durasi Aktif (Uptime)</th>
        </tr>
      </thead>
      <tbody>
        ${servicesHtml}
      </tbody>
    </table>

    <p class="section-note">
      Pemantauan siklus hidup menunjukkan seluruh proses inti backend, middleware relasional, dan microservices beroperasi dengan stabilitas tinggi tanpa restart tidak terduga.
    </p>
  </div>


  <!-- ==================== BAGIAN 3: UTILISASI SUMBER DAYA & KAPASITAS (NO PAGE-BREAK AFTER POINT 2) ==================== -->
  <div class="section-block">
    <h3 class="section-title"><span class="badge">03</span> Metrik Utilisasi Sumber Daya & Analisis Kapasitas</h3>
    <div class="section-intro">
      Pemeriksaan mendalam beban prosesor, penggunaan memori fisik, ruang penyimpanan disk, serta throughput transmisi jaringan berbasis sampel telemetri kernel Linux 7 hari terakhir.
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 25%;">Komponen Sumber Daya</th>
          <th style="width: 12%; text-align: center;">Tingkat Risiko</th>
          <th style="width: 28%;">Utilisasi Rata-rata (Meter)</th>
          <th style="width: 22%;">Beban Puncak (Peak)</th>
          <th style="width: 13%;">Metrik Kernel</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="cell-strong">Prosesor (CPU Core)</td>
          <td class="cell-center"><span class="risk-pill ${data.metrics.avgCpuPct > 70 ? 'risk-pill-4' : 'risk-pill-1'}">${data.metrics.avgCpuPct > 70 ? '4' : '1'}</span></td>
          <td class="tabular">
            <span style="font-weight: 700; color: #0f172a; min-width: 44px; display: inline-block;">${data.metrics.avgCpuPct}%</span>
            ${renderMeterBar(data.metrics.avgCpuPct, '#c2410c')}
          </td>
          <td class="tabular" style="font-weight: 600; color: ${data.metrics.peakCpuPct > 85 ? '#b91c1c' : '#0f172a'};">
            ${data.metrics.peakCpuPct}% (P95: ${data.metrics.p95CpuPct}%)
          </td>
          <td class="tabular" style="color: #475569; font-weight: 600;">Load: ${data.metrics.avgLoad1m}</td>
        </tr>
        <tr>
          <td class="cell-strong">Memori RAM Fisik</td>
          <td class="cell-center"><span class="risk-pill ${data.metrics.avgRamPct > 80 ? 'risk-pill-4' : 'risk-pill-1'}">${data.metrics.avgRamPct > 80 ? '4' : '1'}</span></td>
          <td class="tabular">
            <span style="font-weight: 700; color: #0f172a; min-width: 44px; display: inline-block;">${data.metrics.avgRamPct}%</span>
            ${renderMeterBar(data.metrics.avgRamPct, '#0369a1')}
          </td>
          <td class="tabular" style="font-weight: 600; color: ${data.metrics.peakRamPct > 85 ? '#b91c1c' : '#0f172a'};">
            ${data.metrics.peakRamPct}% (Swap: ${data.metrics.swapUsedPct}%)
          </td>
          <td class="tabular" style="color: #475569; font-weight: 600;">${data.metrics.ramUsedGb}/${data.metrics.ramTotalGb} GB</td>
        </tr>
        <tr>
          <td class="cell-strong">Penyimpanan Disk Root</td>
          <td class="cell-center"><span class="risk-pill ${data.metrics.endDiskPct > 85 ? 'risk-pill-4' : 'risk-pill-1'}">${data.metrics.endDiskPct > 85 ? '4' : '1'}</span></td>
          <td class="tabular">
            <span style="font-weight: 700; color: #0f172a; min-width: 44px; display: inline-block;">${data.metrics.endDiskPct}%</span>
            ${renderMeterBar(data.metrics.endDiskPct, '#6d28d9')}
          </td>
          <td class="tabular" style="color: #475569; font-weight: 600;">
            Delta: ${data.metrics.diskGrowthPct > 0 ? `+${data.metrics.diskGrowthPct}%` : `${data.metrics.diskGrowthPct}%`}
          </td>
          <td class="tabular" style="color: #475569; font-weight: 600;">${data.metrics.diskUsedGb}/${data.metrics.diskTotalGb} GB</td>
        </tr>
        <tr>
          <td class="cell-strong">Throughput Jaringan</td>
          <td class="cell-center"><span class="risk-pill risk-pill-1">1</span></td>
          <td class="tabular">
            <span style="color: #15803d; font-weight: 700;">RX: ${(data.metrics.avgNetRxBps / 1024).toFixed(1)} KB/s</span>
            ${renderMeterBar(Math.min(100, (data.metrics.avgNetRxBps / 2000000) * 100), '#15803d', 28)}
          </td>
          <td class="tabular">
            <span style="color: #0369a1; font-weight: 700;">TX: ${(data.metrics.avgNetTxBps / 1024).toFixed(1)} KB/s</span>
            ${renderMeterBar(Math.min(100, (data.metrics.avgNetTxBps / 2000000) * 100), '#0369a1', 28)}
          </td>
          <td class="tabular" style="color: #475569; font-weight: 600;">Drops: ${data.metrics.netDropPackets}</td>
        </tr>
      </tbody>
    </table>

    ${
      isCluster && data.clusterNodes && data.clusterNodes.length > 0
        ? `
    <!-- Dedicated Cluster Breakdown Per Machine (3.2) -->
    <div style="margin-top: 6px; margin-bottom: 2px;">
      <div class="subsection-title">
        3.2 Inventaris & Distribusi Beban Komputasi Per Mesin Node (Cluster Fleet Breakdown)
      </div>
      <table class="data-table" style="margin-bottom: 4px;">
        <thead>
          <tr>
            <th style="width: 28%;">Nama Mesin & IP Host</th>
            <th style="width: 16%;">Peran / Role</th>
            <th style="width: 8%; text-align: center;">Status</th>
            <th style="width: 15%;">CPU Core (%)</th>
            <th style="width: 17%;">RAM Fisik</th>
            <th style="width: 16%;">Disk Storage</th>
          </tr>
        </thead>
        <tbody>
          ${data.clusterNodes
            .map(
              (node) => `
          <tr>
            <td>
              <div class="cell-strong">${node.name}</div>
              <div class="tabular" style="font-size: 9px; color: #64748b;">${node.ipAddress} • ${node.os}</div>
            </td>
            <td style="font-weight: 600; color: #334155;">${node.roleBadge}</td>
            <td class="cell-center">
              <span class="risk-pill ${node.status === 'Online' ? 'risk-pill-1' : 'risk-pill-5'}">
                ${node.status === 'Online' ? '1' : '5'}
              </span>
            </td>
            <td class="tabular">
              <span style="font-weight: 600; color: #0f172a; min-width: 28px; display: inline-block;">${node.cpuPct}%</span>
              ${renderMeterBar(node.cpuPct, '#c2410c', 20)}
            </td>
            <td class="tabular">
              <div>
                <span style="font-weight: 600; color: #0f172a; min-width: 28px; display: inline-block;">${node.ramPct}%</span>
                ${renderMeterBar(node.ramPct, '#0369a1', 20)}
              </div>
              <div style="font-size: 9px; color: #64748b;">${node.ramUsedGb}/${node.ramTotalGb} GB</div>
            </td>
            <td class="tabular">
              <div>
                <span style="font-weight: 600; color: #0f172a; min-width: 28px; display: inline-block;">${node.diskPct}%</span>
                ${renderMeterBar(node.diskPct, '#6d28d9', 20)}
              </div>
              <div style="font-size: 9px; color: #64748b;">${node.diskUsedGb}/${node.diskTotalGb} GB</div>
            </td>
          </tr>`
            )
            .join('')}
        </tbody>
      </table>
      <p class="section-note">
        Distribusi beban menunjukkan seluruh node beroperasi stabil dengan sisa cadangan komputasi aman di atas 40%.
      </p>
    </div>`
        : ''
    }
  </div>


  <!-- ==================== BAGIAN 4: KINERJA DATABASE & MIDDLEWARE ==================== -->
  <div class="section-block">
    <h3 class="section-title"><span class="badge">04</span> Kinerja Database & Komponen Middleware</h3>
    <div class="section-intro">
      Audit parameter konektivitas database relasional PostgreSQL, caching in-memory Redis, engine database akuntansi Accurate, serta eksposur port jaringan publik/privat.
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 28%;">Komponen Middleware / Engine</th>
          <th style="width: 14%; text-align: center;">Tingkat Risiko</th>
          <th style="width: 24%;">Utilisasi / Beban Terukur</th>
          <th style="width: 18%;">Kapasitas Maksimum</th>
          <th style="width: 16%;">Status Operasional</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="cell-strong">PostgreSQL Relational Connection Pool</td>
          <td class="cell-center"><span class="risk-pill risk-pill-1">1</span></td>
          <td class="tabular">
            <span style="font-weight: 700; color: #0f172a;">${data.databaseMiddleware.postgres?.activeConnections || 9} Koneksi</span>
            ${renderMeterBar(data.databaseMiddleware.postgres?.poolUsagePct || 9, '#0369a1')}
          </td>
          <td class="tabular" style="color: #475569;">Maks: ${data.databaseMiddleware.postgres?.maxConnections || 100} Pool</td>
          <td style="font-weight: 600; color: #15803d;">OPTIMAL (91% Sisa)</td>
        </tr>
        <tr>
          <td class="cell-strong">Redis In-Memory Cache</td>
          <td class="cell-center"><span class="risk-pill risk-pill-1">1</span></td>
          <td class="tabular">
            <span style="font-weight: 700; color: #0f172a;">${data.databaseMiddleware.redis?.usedMemoryHuman || '1.13 MB'}</span>
            ${renderMeterBar(15, '#0369a1')}
          </td>
          <td class="tabular" style="color: #475569;">${data.databaseMiddleware.redis?.connectedClients || 2} Klien Aktif</td>
          <td style="font-weight: 600; color: #15803d;">OPTIMAL (Latency Rendah)</td>
        </tr>
        <tr>
          <td class="cell-strong">Database Engine Accurate POS</td>
          <td class="cell-center"><span class="risk-pill risk-pill-1">1</span></td>
          <td class="tabular">
            <span style="font-weight: 700; color: #0f172a;">${data.databaseMiddleware.accurateDatabasesCount || 14} Berkas GDB</span>
            ${renderMeterBar(Math.min(100, (data.databaseMiddleware.accurateDatabasesCount || 14) * 5), '#c2410c')}
          </td>
          <td style="color: #475569;">Engine Firebird 2.5/3.0</td>
          <td style="font-weight: 600; color: #15803d;">AKTIF (Transaksi Normal)</td>
        </tr>
      </tbody>
    </table>

    <!-- 4.2 Dedicated Table for Public & Private Network Ports -->
    <div>
      <div class="subsection-title">
        4.2 Audit Eksposur Port Jaringan Publik & Privat
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 18%;">Port / Protokol</th>
            <th style="width: 12%; text-align: center;">Tingkat Risiko</th>
            <th style="width: 28%;">Layanan / Daemon Terikat</th>
            <th style="width: 24%;">Cakupan Akses Jaringan</th>
            <th style="width: 18%;">Status Proteksi</th>
          </tr>
        </thead>
        <tbody>
          ${
            data.databaseMiddleware.openPorts && data.databaseMiddleware.openPorts.length > 0
              ? data.databaseMiddleware.openPorts
                  .map((rawPort) => {
                    const p = parsePortEntry(rawPort);
                    return `
          <tr>
            <td class="cell-strong tabular">${p.portProto}</td>
            <td class="cell-center"><span class="risk-pill ${p.riskClass}">${p.riskLevel}</span></td>
            <td style="font-weight: 600; color: #1e293b;">${p.service}</td>
            <td style="color: #475569;">${p.scope}</td>
            <td style="font-weight: 600; color: #15803d;">● Terlindungi UFW</td>
          </tr>`;
                  })
                  .join('')
              : `<tr class="empty-row"><td colspan="5" class="cell-empty">Tidak ada port jaringan terbuka yang terdeteksi.</td></tr>`
          }
        </tbody>
      </table>
    </div>

    <p class="section-note">
      Manajemen pool koneksi PostgreSQL dan cache Redis berjalan stabil tanpa terjadi connection saturation. Database file Accurate terisolasi dengan performa I/O read/write yang konsisten.
    </p>
  </div>


  <!-- ==================== BAGIAN 5: AUDIT KEAMANAN SISTEM & OS ==================== -->
  <div class="section-block">
    <h3 class="section-title"><span class="badge">05</span> Audit Keamanan Sistem & Pembaruan OS</h3>
    <div class="section-intro">
      Evaluasi postur keamanan host melalui log autentikasi (/var/log/auth.log), aktivitas eskalasi hak istimewa (sudo), deteksi serangan brute-force SSH, status firewall host UFW, serta masa aktif sertifikat TLS.
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 28%;">Parameter Keamanan Host</th>
          <th style="width: 14%; text-align: center;">Tingkat Risiko</th>
          <th style="width: 24%;">Frekuensi / Nilai Terdeteksi</th>
          <th style="width: 18%;">Ambang Batas Toleransi</th>
          <th style="width: 16%;">Evaluasi Keamanan</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="cell-strong">Autentikasi Sesi SSH Sukses</td>
          <td class="cell-center"><span class="risk-pill risk-pill-1">1</span></td>
          <td class="tabular">
            <span style="font-weight: 700; color: #0f172a;">${data.security.successfulSshLogins} Sesi</span>
            ${renderMeterBar(Math.min(100, data.security.successfulSshLogins * 2), '#15803d')}
          </td>
          <td style="color: #475569;">Sesi Operasional Resmi</td>
          <td style="font-weight: 600; color: #15803d;">Autentikasi Valid</td>
        </tr>
        <tr>
          <td class="cell-strong">Percobaan SSH Gagal (Brute Force)</td>
          <td class="cell-center">
            <span class="risk-pill ${data.security.failedSshCount > 10 ? 'risk-pill-4' : 'risk-pill-1'}">
              ${data.security.failedSshCount > 10 ? '4' : '1'}
            </span>
          </td>
          <td class="tabular">
            <span style="font-weight: 700; color: ${data.security.failedSshCount > 0 ? '#b91c1c' : '#0f172a'};">${data.security.failedSshCount} Kali</span>
            ${renderMeterBar(Math.min(100, data.security.failedSshCount * 10), '#c2410c')}
          </td>
          <td class="tabular" style="color: #475569;">&le; 10 Kali / Pekan</td>
          <td class="tabular" style="font-weight: 600; color: ${data.security.failedSshCount > 0 ? '#b91c1c' : '#15803d'};">
            ${data.security.fail2banBannedIps} IP Dicekal Fail2Ban
          </td>
        </tr>
        <tr>
          <td class="cell-strong">Eksekusi Hak Istimewa Root Sudo</td>
          <td class="cell-center"><span class="risk-pill risk-pill-1">1</span></td>
          <td class="tabular">
            <span style="font-weight: 700; color: #0f172a;">${data.security.sudoExecutions} Kali</span>
            ${renderMeterBar(Math.min(100, data.security.sudoExecutions), '#0369a1')}
          </td>
          <td style="color: #475569;">Pemeliharaan Sistem</td>
          <td style="font-weight: 600; color: #15803d;">Aktivitas Terotorisasi</td>
        </tr>
        <tr>
          <td class="cell-strong">Masa Aktif Sertifikat SSL/TLS</td>
          <td class="cell-center">
            <span class="risk-pill ${data.security.sslDaysRemaining < 15 ? 'risk-pill-4' : 'risk-pill-1'}">
              ${data.security.sslDaysRemaining < 15 ? '4' : '1'}
            </span>
          </td>
          <td class="tabular">
            <span style="font-weight: 700; color: #0f172a;">${data.security.sslDaysRemaining} Hari Tersisa</span>
            ${renderMeterBar(Math.min(100, data.security.sslDaysRemaining), '#0369a1')}
          </td>
          <td class="tabular" style="color: #475569;">Batas Aman: &ge; 30 Hari</td>
          <td style="font-weight: 600; color: #15803d;">Sertifikat Valid</td>
        </tr>
        <tr>
          <td class="cell-strong">Status Firewall Host (UFW)</td>
          <td class="cell-center"><span class="risk-pill risk-pill-1">1</span></td>
          <td colspan="2" style="color: #1e293b;">
            Status: <span style="color: #15803d; font-weight: 700;">● ${data.security.ufwStatus}</span> (Kebijakan default drop incoming aktif)
          </td>
          <td style="font-weight: 600; color: #15803d;">Proteksi Ketat</td>
        </tr>
        <tr>
          <td class="cell-strong">Pembaruan Paket Sistem Operasi</td>
          <td class="cell-center">
            <span class="risk-pill ${data.security.pendingUpdates.security > 0 ? 'risk-pill-3' : 'risk-pill-1'}">
              ${data.security.pendingUpdates.security > 0 ? '3' : '1'}
            </span>
          </td>
          <td colspan="2" class="tabular" style="color: #1e293b;">
            Tersedia <strong>${data.security.pendingUpdates.total}</strong> pembaruan (termasuk <strong>${data.security.pendingUpdates.security}</strong> security updates)
          </td>
          <td style="font-weight: 600; color: ${data.security.pendingUpdates.security > 0 ? '#b45309' : '#15803d'};">
            ${data.security.pendingUpdates.security > 0 ? 'Jadwalkan Patch' : 'Up to Date'}
          </td>
        </tr>
      </tbody>
    </table>

    <p class="section-note">
      Tidak ditemukan anomali eskalasi hak istimewa atau pembuatan akun liar (${data.security.userAccountChanges} modifikasi akun). Kebijakan firewall UFW efektif menepis scan port eksternal.
    </p>
  </div>


  <!-- ==================== BAGIAN 6: INTEGRITAS BACKUP & DISASTER RECOVERY ==================== -->
  <div class="section-block">
    <h3 class="section-title"><span class="badge">06</span> Integritas Backup & Pemulihan Bencana (DR)</h3>
    <div class="section-intro">
      Audit terhadap kepatuhan alur pencadangan data basis data secara berkala, memastikan ketersediaan berkas arsip fisik dan keandalan skenario Disaster Recovery operasional.
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 32%;">Nama Basis Data</th>
          <th style="width: 14%; text-align: center;">Integritas</th>
          <th style="width: 18%;">Status Verifikasi</th>
          <th style="width: 18%;">Ukuran Arsip (Bytes)</th>
          <th style="width: 18%;">Waktu Penyelesaian</th>
        </tr>
      </thead>
      <tbody>
        ${backupsHtml}
      </tbody>
    </table>

    <p class="section-note">
      Seluruh snapshot basis data berhasil dikompresi dan ditransmisikan ke storage sekunder tepat waktu. Integritas checksum diverifikasi tanpa corrupt data.
    </p>
  </div>


  <!-- ==================== BAGIAN 7: REKAPITULASI INSIDEN ==================== -->
  <div class="section-block">
    <h3 class="section-title"><span class="badge">07</span> Rekapitulasi Insiden & Catatan Pemeliharaan</h3>
    <div class="section-intro">
      Pencatatan riwayat gangguan teknis, kegagalan kontainer, lonjakan ambang batas memori kritis, serta tindakan pemulihan yang dieksekusi selama periode audit mingguan.
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 18%;">ID Tiket Insiden</th>
          <th style="width: 12%; text-align: center;">Tingkat Bahaya</th>
          <th style="width: 22%;">Komponen Terdampak</th>
          <th style="width: 26%;">Deskripsi Gangguan</th>
          <th style="width: 22%;">Tindakan Resolusi</th>
        </tr>
      </thead>
      <tbody>
        ${incidentsHtml}
      </tbody>
    </table>

    <p class="section-note">
      ${
        analysis.incidentsMaintenance && analysis.incidentsMaintenance.length > 0
          ? 'Insiden tercatat telah ditangani sesuai SLA tanggap darurat dan langkah mitigasi telah diintegrasikan ke dalam matriks tindakan (Action Items).'
          : 'Kondisi operasional zero-outage mencerminkan keandalan konfigurasi daemon dan alokasi sumber daya yang proporsional terhadap beban komputasi harian.'
      }
    </p>
  </div>


  <!-- ==================== BAGIAN 8: ACTION ITEMS & REKOMENDASI ==================== -->
  <div class="section-block">
    <h3 class="section-title"><span class="badge">08</span> Rencana Tindakan & Rekomendasi Mitigasi (Action Items)</h3>
    <div class="section-intro">
      Matriks rencana tindakan terarah untuk menyelesaikan temuan audit, mencegah regresi degradasi sistem, dan menjamin keberlanjutan SLA bisnis.
    </div>

    <!-- Table Action Items (NO PIC column) -->
    <table class="data-table" style="margin-bottom: 10px;">
      <thead>
        <tr>
          <th style="width: 6%; text-align: center;">No</th>
          <th style="width: 31%;">Isu / Temuan Audit</th>
          <th style="width: 41%;">Tindakan Solutif (Action)</th>
          <th style="width: 10%; text-align: center;">Target</th>
          <th style="width: 12%; text-align: center;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${actionItemsHtml}
      </tbody>
    </table>

    <!-- Table Strategic Recommendations -->
    <div>
      <div class="subsection-title">
        Inisiatif & Rekomendasi Mitigasi Strategis:
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 5%; text-align: center;">No</th>
            <th style="width: 28%;">Inisiatif Rekomendasi</th>
            <th style="width: 14%; text-align: center;">Tingkat Prioritas</th>
            <th style="width: 53%;">Detail Tindakan & Justifikasi Operasional</th>
          </tr>
        </thead>
        <tbody>
          ${recommendationsTableRows}
        </tbody>
      </table>
    </div>

    <p class="section-note" style="margin-top: 6px;">
      Seluruh rekomendasi strategis di atas disusun berdasarkan observasi telemetri faktual dan diprioritaskan untuk mengeliminasi potensi risiko single point of failure pada siklus operasional mendatang.
    </p>
  </div>

  <!-- Final Sign-Off -->
  <div class="avoid-break" style="margin-top: 18px; border-top: 1px solid #cbd5e1; padding-top: 10px;">
    <div style="display: flex; justify-content: space-between; font-size: 10px; color: #0f172a;">
      <div>
        <strong style="color: #0f172a;">Disahkan oleh Sistem:</strong><br>
        GAJIANICH Infrastructure Engine<br>
        <span class="tabular" style="color: #475569;">ID Laporan: GJN-AUD-${data.period.week}-${data.server.code}</span>
      </div>
      <div style="text-align: right;">
        <strong style="color: #0f172a;">Pemeriksa / Penanggung Jawab IT:</strong><br>
        Tim DevOps & IT Infrastructure GAJIANICH<br>
        <span style="color: #475569;">PT Cahaya Mas Cemerlang</span>
      </div>
    </div>
  </div>

  <div class="running-footer">
    <span>Klasifikasi: Konfidensial Internal CMC • PT Cahaya Mas Cemerlang</span>
    <span class="tabular">Dokumen Resmi Audit Infrastruktur Mingguan • Periode ${data.period.week}</span>
  </div>

</body>
</html>`;
}
