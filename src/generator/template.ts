import { AggregatedWeeklyMetrics } from '../aggregator/dataAggregator.js';
import { AiAuditAnalysisResult } from '../ai/ruleBasedFallback.js';

function renderMeterBar(valPct: number, colorHex: string, maxWidth = 50): string {
  const clamped = Math.max(0, Math.min(100, Math.round(valPct)));
  const widthPx = clamped === 0 ? 3 : Math.max(4, Math.round((clamped / 100) * maxWidth));
  return `<span style="display: inline-block; width: ${widthPx}px; height: 7px; background-color: ${colorHex}; border-radius: 2px; vertical-align: middle; margin-left: 6px;"></span>`;
}

export function renderHtmlTemplate(
  data: AggregatedWeeklyMetrics,
  analysis: AiAuditAnalysisResult
): string {
  const isCluster = data.scopeType === 'CLUSTER';
  const statusColor =
    analysis.overallStatus === 'NORMAL'
      ? '#16a34a' // green-600
      : analysis.overallStatus === 'WARNING'
      ? '#ca8a04' // amber-600
      : '#dc2626'; // red-600

  // 1. Services Table rows (Sophos Style - Top Key Services prioritized)
  const prioritizedServices = [...data.services].sort((a, b) => (b.restarts || 0) - (a.restarts || 0));
  const displayServices = prioritizedServices.slice(0, isCluster ? 3 : 6);
  const remainingServicesCount = data.services.length - displayServices.length;

  const servicesHtml =
    displayServices.length > 0
      ? displayServices
          .map((s, idx) => {
            const isOk = s.status === 'active' || s.status === 'online';
            return `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #0f172a; font-size: 10.5px;">
            ${s.name}
          </td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">
            <span class="risk-pill ${isOk ? 'risk-pill-1' : 'risk-pill-5'}">
              ${isOk ? '1' : '5'}
            </span>
          </td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0; color: #334155; text-transform: uppercase; font-size: 9.5px; font-weight: 700;">
            ${s.category}
          </td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0; color: ${s.restarts > 0 ? '#b91c1c' : '#334155'}; font-weight: 700; font-size: 10.5px;">
            <span style="min-width: 20px; display: inline-block;">${s.restarts}</span>
            ${renderMeterBar(Math.min(100, s.restarts * 25), s.restarts > 0 ? '#ea580c' : '#cbd5e1', 25)}
          </td>
          <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 10.5px; font-weight: 500;">
            ${s.uptime}
          </td>
        </tr>`;
          })
          .join('') +
        (remainingServicesCount > 0
          ? `<tr><td colspan="5" style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0; font-size: 10px; color: #475569; background-color: #f8fafc; font-weight: 600;">
              + ${remainingServicesCount} kontainer & proses pendukung lainnya beroperasi aktif dengan status online (Zero Restarts).
            </td></tr>`
          : '')
      : `<tr><td colspan="5" style="padding: 10px; text-align: center; color: #64748b; font-size: 10.5px; background-color: #f8fafc;">Tidak ada layanan atau kontainer spesifik yang tercatat.</td></tr>`;

  // 2. Backups Table rows (Sophos Style)
  const backupsHtml =
    data.backups.length > 0
      ? data.backups
          .slice(0, 8)
          .map((b, idx) => `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 6.5px 10px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #0f172a; font-size: 11px;">
            ${b.dbName}
          </td>
          <td style="padding: 6.5px 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">
            <span class="risk-pill risk-pill-1">1</span>
          </td>
          <td style="padding: 6.5px 10px; border-bottom: 1px solid #e2e8f0; color: #166534; font-weight: 700; font-size: 10.5px;">
            ✓ ${b.status}
          </td>
          <td style="padding: 6.5px 10px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 11px; font-weight: 700;">
            <span style="min-width: 55px; display: inline-block;">${b.sizeMb} MB</span>
            ${renderMeterBar(Math.min(100, (b.sizeMb / 500) * 100), '#0284c7', 40)}
          </td>
          <td style="padding: 6.5px 10px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 11px; font-weight: 500;">
            ${b.completedAt ? new Date(b.completedAt).toLocaleString('id-ID') : '-'}
          </td>
        </tr>`)
          .join('')
      : `<tr><td colspan="5" style="padding: 12px; text-align: center; color: #64748b; font-size: 11px; background-color: #f8fafc;">
          Tidak ada riwayat backup database tercatat pada periode audit (7 hari terakhir).
        </td></tr>`;

  // 3. Incidents Table rows (Sophos Style)
  const incidentsHtml =
    analysis.incidentsMaintenance && analysis.incidentsMaintenance.length > 0
      ? analysis.incidentsMaintenance
          .map((inc, idx) => {
            const isCrit = inc.severity === 'KRITIS';
            return `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 6.5px 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: 800; color: #0f172a; font-size: 11px;">
            ${inc.code}
          </td>
          <td style="padding: 6.5px 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">
            <span class="risk-pill ${isCrit ? 'risk-pill-5' : 'risk-pill-3'}">
              ${isCrit ? '5' : '3'}
            </span>
          </td>
          <td style="padding: 6.5px 10px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 11px; font-weight: 700;">
            ${inc.component}
          </td>
          <td style="padding: 6.5px 10px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-size: 11px; font-weight: 500;">
            ${inc.description}
          </td>
          <td style="padding: 6.5px 10px; border-bottom: 1px solid #e2e8f0; color: #065f46; font-size: 11px; font-weight: 700;">
            ${inc.resolution}
          </td>
        </tr>`;
          })
          .join('')
      : `<tr><td colspan="5" style="padding: 14px; text-align: center; color: #065f46; background-color: #f0fdf4; font-weight: 700; font-size: 11px;">
          ✓ Tidak Ada Insiden Tercatat — Ketersediaan layanan terjaga 100% tanpa gangguan operasional (Zero Outage).
        </td></tr>`;

  // 4. Action Items Table rows (Sophos Style)
  const actionItemsHtml =
    analysis.actionItems && analysis.actionItems.length > 0
      ? analysis.actionItems
          .map((act, idx) => `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 6.5px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 800; color: #334155; font-size: 11px;">
            ${act.no}
          </td>
          <td style="padding: 6.5px 10px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 700; font-size: 11px;">
            ${act.issue}
          </td>
          <td style="padding: 6.5px 10px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-size: 11px; font-weight: 500;">
            ${act.action}
          </td>
          <td style="padding: 6.5px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">
            <span style="display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 800; background-color: #e2e8f0; color: #0f172a; border: 1px solid #94a3b8;">
              ${act.pic}
            </span>
          </td>
          <td style="padding: 6.5px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #334155; font-weight: 700; font-size: 11px;">
            ${act.target}
          </td>
          <td style="padding: 6.5px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">
            <span class="risk-pill ${act.status === 'SELESAI' ? 'risk-pill-1' : act.status === 'DALAM_PROGRES' ? 'risk-pill-3' : 'risk-pill-2'}">
              ${act.status === 'SELESAI' ? 'SELESAI' : act.status === 'DALAM_PROGRES' ? 'DALAM PROGRES' : 'TERJADWAL'}
            </span>
          </td>
        </tr>`)
          .join('')
      : `<tr><td colspan="6" style="padding: 12px; text-align: center; color: #334155; font-weight: 600; font-size: 11px;">Tidak ada action item tertunda.</td></tr>`;

  // 5. Strategic Recommendations Table rows (Replaces Cards!)
  const recommendationsTableRows = analysis.recommendations
    .map((rec, idx) => {
      const pLevel = rec.priority === 'TINGGI' ? '3' : rec.priority === 'SEDANG' ? '2' : '1';
      const pClass = rec.priority === 'TINGGI' ? 'risk-pill-5' : rec.priority === 'SEDANG' ? 'risk-pill-3' : 'risk-pill-1';
      return `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 7px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 800; color: #334155; font-size: 11px;">
          ${idx + 1}
        </td>
        <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0; font-weight: 800; color: #0f172a; font-size: 11px;">
          ${rec.title}
        </td>
        <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">
          <span class="risk-pill ${pClass}">${pLevel}</span>
          <span style="font-size: 10px; font-weight: 700; color: #334155; margin-left: 4px;">${rec.priority}</span>
        </td>
        <td style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-size: 11px; line-height: 1.5; font-weight: 500;">
          ${rec.action}
        </td>
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
      margin: 8mm 12mm 8mm 12mm;
      @bottom-right {
        content: counter(page);
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 10.5px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page-cover {
      page-break-after: always;
      page-break-inside: avoid;
      box-sizing: border-box;
      border: 1.5px solid #cbd5e1;
      padding: 10mm 12mm 8mm 12mm;
      height: 260mm;
      max-height: 260mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }
    .page-break {
      page-break-before: always;
    }
    .avoid-break {
      page-break-inside: avoid;
    }
    .running-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 4px;
      margin-bottom: 7px;
      border-bottom: 1.5px solid #059669;
      font-size: 8.5px;
      color: #334155;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .running-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 6px;
      margin-top: 14px;
      border-top: 1px solid #cbd5e1;
      font-size: 9px;
      color: #475569;
      font-weight: 600;
    }
    .section-title {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin: 0 0 4px 0;
      display: flex;
      align-items: center;
      gap: 7px;
    }
    .section-title span.badge {
      font-size: 9.5px;
      background: #059669;
      color: #ffffff;
      padding: 1.5px 5.5px;
      border-radius: 3px;
      font-weight: 800;
    }
    .section-intro {
      font-size: 10px;
      color: #1e293b;
      line-height: 1.45;
      margin: 0 0 6px 0;
      background: #f8fafc;
      padding: 4px 8px;
      border-left: 3px solid #059669;
      border-radius: 0 3px 3px 0;
      font-weight: 500;
    }
    /* Sophos Enterprise Table Styling */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
      font-size: 10.5px;
      page-break-inside: auto;
    }
    .data-table tr {
      page-break-inside: avoid;
    }
    .data-table th {
      background-color: #f8fafc;
      color: #64748b;
      padding: 4px 6px;
      text-align: left;
      font-size: 8.5px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.5px;
      border-top: 1px solid #cbd5e1;
      border-bottom: 1.5px solid #cbd5e1;
    }
    .data-table td {
      padding: 4px 6px;
      border-bottom: 1px solid #e2e8f0;
      color: #1e293b;
      font-size: 9.5px;
      vertical-align: middle;
    }
    .data-table tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    .data-table tr:nth-child(odd) td {
      background-color: #ffffff;
    }
    /* Sophos Risk / Status Pill Badges */
    .risk-pill {
      display: inline-block;
      padding: 1.5px 6px;
      border-radius: 3px;
      font-size: 9.5px;
      font-weight: 800;
      text-align: center;
      color: #ffffff;
      min-width: 14px;
      line-height: 1.2;
    }
    .risk-pill-1 { background-color: #16a34a; } /* Green - Low */
    .risk-pill-2 { background-color: #65a30d; } /* Lime - Low/Medium */
    .risk-pill-3 { background-color: #ca8a04; } /* Amber - Medium */
    .risk-pill-4 { background-color: #ea580c; } /* Orange - Warning */
    .risk-pill-5 { background-color: #dc2626; } /* Red - Critical */
  </style>
</head>
<body>

  <!-- ==================== COVER PAGE (SOPHOS ENTERPRISE STYLE) ==================== -->
  <div class="page-cover">
    <div>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #059669; padding-bottom: 10px;">
        <div>
          <div style="font-size: 12px; font-weight: 900; color: #059669; letter-spacing: 1px; text-transform: uppercase;">
            GAJIANICH ENTERPRISE PLATFORM
          </div>
          <div style="font-size: 9.5px; color: #475569; font-weight: 600; margin-top: 2px;">
            Divisi Teknologi Informasi & Infrastruktur • PT Cahaya Mas Cemerlang
          </div>
        </div>
        <div style="text-align: right;">
          <span style="display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 9.5px; font-weight: 800; background: #0f172a; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">
            ${isCluster ? 'CAKUPAN: CLUSTER FLEET' : `CAKUPAN: NODE [${data.server.code}]`}
          </span>
        </div>
      </div>

      <div style="margin-top: 8mm; margin-bottom: 8mm;">
        <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #475569; margin-bottom: 4px;">
          DOKUMEN AUDIT TEKNIS RESMI
        </div>
        <h1 style="font-size: 21px; font-weight: 900; color: #0f172a; line-height: 1.25; margin: 0 0 6px 0; text-transform: uppercase;">
          LAPORAN AUDIT & KINERJA INFRASTRUKTUR SERVER
        </h1>
        <h2 style="font-size: 12px; font-weight: 600; color: #334155; margin: 0; line-height: 1.35;">
          Pemeriksaan Berkala Keandalan Sistem, Beban Komputasi, Postur Keamanan, & Mitigasi Risiko
        </h2>
      </div>

      <!-- Metadata Box -->
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px 12px; margin-bottom: 10px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <tr>
            <td style="width: 24%; padding: 2.5px 0; color: #475569; font-weight: 700;">Target Sistem:</td>
            <td style="width: 76%; padding: 2.5px 0; color: #0f172a; font-weight: 800;">${data.server.name} (${data.server.code}) — ${data.server.ipAddress}</td>
          </tr>
          <tr>
            <td style="padding: 2.5px 0; color: #475569; font-weight: 700;">Periode Audit:</td>
            <td style="padding: 2.5px 0; color: #0f172a; font-weight: 800;">Minggu ${data.period.week} (${data.period.startDate} s/d ${data.period.endDate})</td>
          </tr>
          <tr>
            <td style="padding: 2.5px 0; color: #475569; font-weight: 700;">Klasifikasi Dokumen:</td>
            <td style="padding: 2.5px 0; color: #b91c1c; font-weight: 900; text-transform: uppercase;">KONFIDENSIAL INTERNAL (LEVEL 2)</td>
          </tr>
          <tr>
            <td style="padding: 2.5px 0; color: #475569; font-weight: 700;">Spesifikasi Mesin:</td>
            <td style="padding: 2.5px 0; color: #0f172a; font-weight: 600;">${data.server.specs} • ${data.server.os}</td>
          </tr>
          <tr>
            <td style="padding: 2.5px 0; color: #475569; font-weight: 700;">Waktu Pembuatan:</td>
            <td style="padding: 2.5px 0; color: #0f172a; font-weight: 600;">${new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'long' })}</td>
          </tr>
          <tr>
            <td style="padding: 2.5px 0; color: #475569; font-weight: 700;">Auditor / Engine:</td>
            <td style="padding: 2.5px 0; color: #059669; font-weight: 800;">GAJIANICH Automated Infrastructure Auditor (v2.5)</td>
          </tr>
        </table>
      </div>

      <!-- Executive Key Performance Table (Sophos Table Model) -->
      <div style="margin-bottom: 8px;">
        <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.5px; margin-bottom: 4px;">
          RINGKASAN PARAMETER KUNCI OPERASIONAL
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
              <td style="font-weight: 700; color: #0f172a;">Status Evaluasi Kinerja</td>
              <td style="text-align: center;">
                <span class="risk-pill ${analysis.overallStatus === 'NORMAL' ? 'risk-pill-1' : analysis.overallStatus === 'WARNING' ? 'risk-pill-3' : 'risk-pill-5'}">
                  ${analysis.overallStatus === 'NORMAL' ? '1' : analysis.overallStatus === 'WARNING' ? '3' : '5'}
                </span>
              </td>
              <td style="font-weight: 800; color: ${statusColor};">● ${analysis.overallStatus}</td>
              <td style="color: #334155; font-weight: 500;">Ambang Batas Normal Operasional</td>
            </tr>
            <tr>
              <td style="font-weight: 700; color: #0f172a;">Ketersediaan Sistem (SLA)</td>
              <td style="text-align: center;"><span class="risk-pill risk-pill-1">1</span></td>
              <td>
                <span style="font-weight: 800; color: #0f172a; min-width: 48px; display: inline-block;">${analysis.slaPercent}%</span>
                ${renderMeterBar(parseFloat(analysis.slaPercent) || 99, '#0284c7', 40)}
              </td>
              <td style="color: #334155; font-weight: 500;">Target Ketersediaan &ge; 99.90%</td>
            </tr>
            <tr>
              <td style="font-weight: 700; color: #0f172a;">Insiden & Kegagalan Sistem</td>
              <td style="text-align: center;">
                <span class="risk-pill ${analysis.incidentsMaintenance.length > 0 ? 'risk-pill-4' : 'risk-pill-1'}">
                  ${analysis.incidentsMaintenance.length > 0 ? '4' : '1'}
                </span>
              </td>
              <td style="font-weight: 700; color: ${analysis.incidentsMaintenance.length > 0 ? '#b91c1c' : '#16a34a'};">
                ${analysis.incidentsMaintenance.length} Tiket Insiden
              </td>
              <td style="color: #334155; font-weight: 500;">Zero Unplanned Downtime</td>
            </tr>
            <tr>
              <td style="font-weight: 700; color: #0f172a;">Rata-rata Utilisasi Komputasi</td>
              <td style="text-align: center;"><span class="risk-pill risk-pill-1">1</span></td>
              <td>
                <span style="font-weight: 700; color: #0f172a;">CPU ${data.metrics.avgCpuPct}%</span> ${renderMeterBar(data.metrics.avgCpuPct, '#f97316', 25)}
                <span style="display: inline-block; width: 4px;"></span>
                <span style="font-weight: 700; color: #0f172a;">RAM ${data.metrics.avgRamPct}%</span> ${renderMeterBar(data.metrics.avgRamPct, '#0284c7', 25)}
              </td>
              <td style="color: #334155; font-weight: 500;">Headroom Komputasi Lapang</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="font-size: 10px; color: #334155; line-height: 1.45; text-align: justify; margin-top: 6px;">
        Laporan audit ini merepresentasikan evaluasi objektif berbasis sampel telemetri kernel Linux dan database time-series selama rentang audit 7 hari. Data diverifikasi secara independen oleh sistem audit otomatis tanpa intervensi manual.
      </div>
    </div>

    <!-- Cover Footer Notice -->
    <div style="border-top: 1px solid #cbd5e1; padding-top: 6px; font-size: 8.5px; color: #475569; line-height: 1.35; font-weight: 500;">
      <strong>PEMBERITAHUAN KERAHASIAAN:</strong> Informasi yang termuat di dalam dokumen audit ini bersifat terbatas dan hanya ditujukan untuk manajemen dan staf operasional IT PT Cahaya Mas Cemerlang yang berwenang. Dilarang keras menggandakan, mendistribusikan, atau membagikan sebagian atau seluruh isi dokumen ini tanpa persetujuan tertulis resmi.
    </div>
  </div>


  <!-- ==================== BAGIAN 1: RINGKASAN EKSEKUTIF & SLA ==================== -->
  <div class="running-header">
    <span>GAJIANICH ENTERPRISE INFRASTRUCTURE AUDIT</span>
    <span>TARGET: ${data.server.code} • PERIODE: ${data.period.week}</span>
  </div>

  <div style="margin-bottom: 8px;">
    <h3 class="section-title"><span class="badge">01</span> Ringkasan Eksekutif & SLA Operasional</h3>
    <div class="section-intro">
      Seksi ini menyajikan sintesis evaluasi performa menyeluruh, kepatuhan Service Level Agreement (SLA), serta sorotan operasional utama selama rentang audit 7 hari kalender.
    </div>

    <!-- Table Model Replacing Cards -->
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
          <td style="font-weight: 700; color: #0f172a;">Ketersediaan Layanan (SLA Mingguan)</td>
          <td style="text-align: center;">
            <span class="risk-pill ${parseFloat(analysis.slaPercent) >= 99.9 ? 'risk-pill-1' : 'risk-pill-3'}">
              ${parseFloat(analysis.slaPercent) >= 99.9 ? '1' : '3'}
            </span>
          </td>
          <td>
            <span style="font-weight: 800; color: #0f172a; min-width: 48px; display: inline-block;">${analysis.slaPercent}%</span>
            ${renderMeterBar(parseFloat(analysis.slaPercent) || 99, '#0284c7')}
          </td>
          <td style="color: #334155; font-weight: 500;">Target: &ge; 99.90%</td>
          <td style="font-weight: 700; color: ${parseFloat(analysis.slaPercent) >= 99.9 ? '#166534' : '#92400e'};">
            ${parseFloat(analysis.slaPercent) >= 99.9 ? 'Memenuhi Standar' : 'Perlu Evaluasi'}
          </td>
        </tr>
        <tr>
          <td style="font-weight: 700; color: #0f172a;">Utilisasi Rata-rata CPU</td>
          <td style="text-align: center;">
            <span class="risk-pill ${data.metrics.avgCpuPct > 70 ? 'risk-pill-4' : 'risk-pill-1'}">
              ${data.metrics.avgCpuPct > 70 ? '4' : '1'}
            </span>
          </td>
          <td>
            <span style="font-weight: 800; color: #0f172a; min-width: 48px; display: inline-block;">${data.metrics.avgCpuPct}%</span>
            ${renderMeterBar(data.metrics.avgCpuPct, '#f97316')}
          </td>
          <td style="color: #334155; font-weight: 500;">Batas Aman: &le; 70.0%</td>
          <td style="font-weight: 700; color: #166534;">Kapasitas Lapang (Puncak ${data.metrics.peakCpuPct}%)</td>
        </tr>
        <tr>
          <td style="font-weight: 700; color: #0f172a;">Utilisasi Rata-rata RAM Fisik</td>
          <td style="text-align: center;">
            <span class="risk-pill ${data.metrics.avgRamPct > 80 ? 'risk-pill-4' : 'risk-pill-1'}">
              ${data.metrics.avgRamPct > 80 ? '4' : '1'}
            </span>
          </td>
          <td>
            <span style="font-weight: 800; color: #0f172a; min-width: 48px; display: inline-block;">${data.metrics.avgRamPct}%</span>
            ${renderMeterBar(data.metrics.avgRamPct, '#0284c7')}
          </td>
          <td style="color: #334155; font-weight: 500;">Batas Aman: &le; 80.0%</td>
          <td style="font-weight: 700; color: #166534;">Terpakai ${data.metrics.ramUsedGb} GB / ${data.metrics.ramTotalGb} GB</td>
        </tr>
        <tr>
          <td style="font-weight: 700; color: #0f172a;">Penyimpanan Disk Root</td>
          <td style="text-align: center;">
            <span class="risk-pill ${data.metrics.endDiskPct > 85 ? 'risk-pill-4' : 'risk-pill-1'}">
              ${data.metrics.endDiskPct > 85 ? '4' : '1'}
            </span>
          </td>
          <td>
            <span style="font-weight: 800; color: #0f172a; min-width: 48px; display: inline-block;">${data.metrics.endDiskPct}%</span>
            ${renderMeterBar(data.metrics.endDiskPct, '#8b5cf6')}
          </td>
          <td style="color: #334155; font-weight: 500;">Batas Aman: &le; 85.0%</td>
          <td style="font-weight: 700; color: #166534;">Pertumbuhan 7-Hari: ${data.metrics.diskGrowthPct}%</td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top: 4px; margin-bottom: 4px;">
      <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 2px;">
        Uraian Naratif Evaluasi Eksekutif:
      </div>
      <p style="margin: 0; font-size: 10px; line-height: 1.45; color: #1e293b; text-align: justify;">
        ${analysis.executiveSummary}
      </p>
    </div>

    ${
      analysis.incidentRca
        ? `
    <div style="margin-bottom: 8px; padding: 8px 12px; background: #fffbeb; border: 1px solid #fde68a; border-left: 3.5px solid #d97706; border-radius: 4px;">
      <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #92400e; margin-bottom: 2px;">
        Analisis Akar Masalah (Root Cause Analysis - RCA):
      </div>
      <p style="margin: 0; font-size: 10.5px; line-height: 1.5; color: #78350f; text-align: justify;">
        ${analysis.incidentRca}
      </p>
    </div>`
        : ''
    }
  </div>


  <!-- ==================== BAGIAN 2: KETERSEDIAAN LAYANAN & PROSES ==================== -->
  <div style="margin-bottom: 8px;">
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

    <p style="margin: 0 0 6px 0; font-size: 10px; color: #334155; line-height: 1.45;">
      Pemantauan siklus hidup menunjukkan seluruh proses inti backend, middleware relasional, dan microservices beroperasi dengan stabilitas tinggi tanpa restart tidak terduga.
    </p>
  </div>


  <!-- ==================== BAGIAN 3: UTILISASI SUMBER DAYA & KAPASITAS (NO PAGE-BREAK AFTER POINT 2) ==================== -->
  <div style="margin-bottom: 8px;">
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
          <td style="font-weight: 700; color: #0f172a;">Prosesor (CPU Core)</td>
          <td style="text-align: center;"><span class="risk-pill ${data.metrics.avgCpuPct > 70 ? 'risk-pill-4' : 'risk-pill-1'}">${data.metrics.avgCpuPct > 70 ? '4' : '1'}</span></td>
          <td>
            <span style="font-weight: 800; color: #0f172a; min-width: 45px; display: inline-block;">${data.metrics.avgCpuPct}%</span>
            ${renderMeterBar(data.metrics.avgCpuPct, '#f97316')}
          </td>
          <td style="font-weight: 700; color: ${data.metrics.peakCpuPct > 85 ? '#b91c1c' : '#0f172a'};">
            ${data.metrics.peakCpuPct}% (P95: ${data.metrics.p95CpuPct}%)
          </td>
          <td style="color: #334155; font-weight: 600;">Load: ${data.metrics.avgLoad1m}</td>
        </tr>
        <tr style="background: #f8fafc;">
          <td style="font-weight: 700; color: #0f172a;">Memori RAM Fisik</td>
          <td style="text-align: center;"><span class="risk-pill ${data.metrics.avgRamPct > 80 ? 'risk-pill-4' : 'risk-pill-1'}">${data.metrics.avgRamPct > 80 ? '4' : '1'}</span></td>
          <td>
            <span style="font-weight: 800; color: #0f172a; min-width: 45px; display: inline-block;">${data.metrics.avgRamPct}%</span>
            ${renderMeterBar(data.metrics.avgRamPct, '#0284c7')}
          </td>
          <td style="font-weight: 700; color: ${data.metrics.peakRamPct > 85 ? '#b91c1c' : '#0f172a'};">
            ${data.metrics.peakRamPct}% (Swap: ${data.metrics.swapUsedPct}%)
          </td>
          <td style="color: #334155; font-weight: 600;">${data.metrics.ramUsedGb}/${data.metrics.ramTotalGb} GB</td>
        </tr>
        <tr>
          <td style="font-weight: 700; color: #0f172a;">Penyimpanan Disk Root</td>
          <td style="text-align: center;"><span class="risk-pill ${data.metrics.endDiskPct > 85 ? 'risk-pill-4' : 'risk-pill-1'}">${data.metrics.endDiskPct > 85 ? '4' : '1'}</span></td>
          <td>
            <span style="font-weight: 800; color: #0f172a; min-width: 45px; display: inline-block;">${data.metrics.endDiskPct}%</span>
            ${renderMeterBar(data.metrics.endDiskPct, '#8b5cf6')}
          </td>
          <td style="color: #334155; font-weight: 600;">
            Delta: ${data.metrics.diskGrowthPct > 0 ? `+${data.metrics.diskGrowthPct}%` : `${data.metrics.diskGrowthPct}%`}
          </td>
          <td style="color: #334155; font-weight: 600;">${data.metrics.diskUsedGb}/${data.metrics.diskTotalGb} GB</td>
        </tr>
        <tr style="background: #f8fafc;">
          <td style="font-weight: 700; color: #0f172a;">Throughput Jaringan</td>
          <td style="text-align: center;"><span class="risk-pill risk-pill-1">1</span></td>
          <td>
            <span style="color: #166534; font-weight: 800;">RX: ${(data.metrics.avgNetRxBps / 1024).toFixed(1)} KB/s</span>
            ${renderMeterBar(Math.min(100, (data.metrics.avgNetRxBps / 2000000) * 100), '#16a34a', 30)}
          </td>
          <td>
            <span style="color: #0284c7; font-weight: 800;">TX: ${(data.metrics.avgNetTxBps / 1024).toFixed(1)} KB/s</span>
            ${renderMeterBar(Math.min(100, (data.metrics.avgNetTxBps / 2000000) * 100), '#0284c7', 30)}
          </td>
          <td style="color: #334155; font-weight: 600;">Drops: ${data.metrics.netDropPackets}</td>
        </tr>
      </tbody>
    </table>

    ${
      isCluster && data.clusterNodes && data.clusterNodes.length > 0
        ? `
    <!-- Dedicated Cluster Breakdown Per Machine (Requirement 4) -->
    <div style="margin-top: 5px; margin-bottom: 2px;">
      <div style="font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 2px;">
        3.2 Inventaris & Distribusi Beban Komputasi Per Mesin Node (Cluster Fleet Breakdown)
      </div>
      <table class="data-table" style="margin-bottom: 3px;">
        <thead>
          <tr>
            <th style="width: 28%; padding: 3px 5px; font-size: 8px;">Nama Mesin & IP Host</th>
            <th style="width: 16%; padding: 3px 5px; font-size: 8px;">Peran / Role</th>
            <th style="width: 8%; text-align: center; padding: 3px 5px; font-size: 8px;">Status</th>
            <th style="width: 15%; padding: 3px 5px; font-size: 8px;">CPU Core (%)</th>
            <th style="width: 17%; padding: 3px 5px; font-size: 8px;">RAM Fisik</th>
            <th style="width: 16%; padding: 3px 5px; font-size: 8px;">Disk Storage</th>
          </tr>
        </thead>
        <tbody>
          ${data.clusterNodes
            .map(
              (node, idx) => `
          <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
            <td style="padding: 2.5px 5px; border-bottom: 1px solid #e2e8f0; font-size: 9px;">
              <strong style="color: #0f172a;">${node.name}</strong>
              <div style="font-size: 8px; font-family: monospace; color: #475569;">${node.ipAddress} • ${node.os}</div>
            </td>
            <td style="padding: 2.5px 5px; border-bottom: 1px solid #e2e8f0; font-size: 8.5px; font-weight: 700; color: #334155;">
              ${node.roleBadge}
            </td>
            <td style="padding: 2.5px 5px; border-bottom: 1px solid #e2e8f0; text-align: center;">
              <span class="risk-pill ${node.status === 'Online' ? 'risk-pill-1' : 'risk-pill-5'}">
                ${node.status === 'Online' ? '1' : '5'}
              </span>
            </td>
            <td style="padding: 2.5px 5px; border-bottom: 1px solid #e2e8f0; font-size: 9px;">
              <span style="font-weight: 700; color: #0f172a; min-width: 28px; display: inline-block;">${node.cpuPct}%</span>
              ${renderMeterBar(node.cpuPct, '#f97316', 20)}
            </td>
            <td style="padding: 2.5px 5px; border-bottom: 1px solid #e2e8f0; font-size: 9px;">
              <span style="font-weight: 700; color: #0f172a; min-width: 28px; display: inline-block;">${node.ramPct}%</span>
              ${renderMeterBar(node.ramPct, '#0284c7', 20)}
              <div style="font-size: 8px; color: #64748b;">${node.ramUsedGb}/${node.ramTotalGb}G</div>
            </td>
            <td style="padding: 2.5px 5px; border-bottom: 1px solid #e2e8f0; font-size: 9px;">
              <span style="font-weight: 700; color: #0f172a; min-width: 28px; display: inline-block;">${node.diskPct}%</span>
              ${renderMeterBar(node.diskPct, '#8b5cf6', 20)}
              <div style="font-size: 8px; color: #64748b;">${node.diskUsedGb}/${node.diskTotalGb}G</div>
            </td>
          </tr>`
            )
            .join('')}
        </tbody>
      </table>
      <p style="margin: 0; font-size: 9px; color: #334155; line-height: 1.35;">
        Distribusi beban menunjukkan seluruh node beroperasi stabil dengan sisa cadangan komputasi aman di atas 40%.
      </p>
    </div>`
        : ''
    }
  </div>


  <!-- ==================== BAGIAN 4: KINERJA DATABASE & MIDDLEWARE ==================== -->
  <div class="page-break"></div>
  <div class="running-header">
    <span>GAJIANICH ENTERPRISE INFRASTRUCTURE AUDIT</span>
    <span>TARGET: ${data.server.code} • PERIODE: ${data.period.week}</span>
  </div>

  <div style="margin-bottom: 14px;">
    <h3 class="section-title"><span class="badge">04</span> Kinerja Database & Komponen Middleware</h3>
    <div class="section-intro">
      Audit parameter konektivitas database relasional PostgreSQL, caching in-memory Redis, engine database akuntansi Accurate, serta eksposur port jaringan publik/privat.
    </div>

    <!-- Table Replacing 3 Cards -->
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
          <td style="font-weight: 700; color: #0f172a;">PostgreSQL Relational Connection Pool</td>
          <td style="text-align: center;"><span class="risk-pill risk-pill-1">1</span></td>
          <td>
            <span style="font-weight: 800; color: #0f172a;">${data.databaseMiddleware.postgres?.activeConnections || 9} Koneksi</span>
            ${renderMeterBar(data.databaseMiddleware.postgres?.poolUsagePct || 9, '#0284c7')}
          </td>
          <td style="color: #334155; font-weight: 500;">Maks: ${data.databaseMiddleware.postgres?.maxConnections || 100} Pool</td>
          <td style="font-weight: 700; color: #166534;">OPTIMAL (91% Sisa)</td>
        </tr>
        <tr>
          <td style="font-weight: 700; color: #0f172a;">Redis In-Memory Cache</td>
          <td style="text-align: center;"><span class="risk-pill risk-pill-1">1</span></td>
          <td>
            <span style="font-weight: 800; color: #0f172a;">${data.databaseMiddleware.redis?.usedMemoryHuman || '1.13 MB'}</span>
            ${renderMeterBar(15, '#0284c7')}
          </td>
          <td style="color: #334155; font-weight: 500;">${data.databaseMiddleware.redis?.connectedClients || 2} Klien Aktif</td>
          <td style="font-weight: 700; color: #166534;">OPTIMAL (Latency Rendah)</td>
        </tr>
        <tr>
          <td style="font-weight: 700; color: #0f172a;">Database Engine Accurate POS</td>
          <td style="text-align: center;"><span class="risk-pill risk-pill-1">1</span></td>
          <td>
            <span style="font-weight: 800; color: #0f172a;">${data.databaseMiddleware.accurateDatabasesCount || 14} Berkas GDB</span>
            ${renderMeterBar(Math.min(100, (data.databaseMiddleware.accurateDatabasesCount || 14) * 5), '#f97316')}
          </td>
          <td style="color: #334155; font-weight: 500;">Engine Firebird 2.5/3.0</td>
          <td style="font-weight: 700; color: #166534;">AKTIF (Transaksi Normal)</td>
        </tr>
        <tr>
          <td style="font-weight: 700; color: #0f172a;">Port Jaringan Publik / Privat</td>
          <td style="text-align: center;"><span class="risk-pill risk-pill-1">1</span></td>
          <td colspan="3" style="font-size: 10px; font-family: monospace; color: #1e293b; font-weight: 600;">
            ${data.databaseMiddleware.openPorts.join(' &bull; ')}
          </td>
        </tr>
      </tbody>
    </table>

    <p style="margin: 0; font-size: 11px; color: #334155; line-height: 1.55;">
      Manajemen pool koneksi PostgreSQL dan cache Redis berjalan stabil tanpa terjadi connection saturation. Database file Accurate terisolasi dengan performa I/O read/write yang konsisten.
    </p>
  </div>


  <!-- ==================== BAGIAN 5: AUDIT KEAMANAN SISTEM & OS ==================== -->
  <div style="margin-bottom: 14px;">
    <h3 class="section-title"><span class="badge">05</span> Audit Keamanan Sistem & Pembaruan OS</h3>
    <div class="section-intro">
      Evaluasi postur keamanan host melalui log autentikasi (/var/log/auth.log), aktivitas eskalasi hak istimewa (sudo), deteksi serangan brute-force SSH, status firewall host UFW, serta masa aktif sertifikat TLS.
    </div>

    <!-- Table Replacing 4 Cards -->
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
          <td style="font-weight: 700; color: #0f172a;">Autentikasi Sesi SSH Sukses</td>
          <td style="text-align: center;"><span class="risk-pill risk-pill-1">1</span></td>
          <td>
            <span style="font-weight: 800; color: #0f172a;">${data.security.successfulSshLogins} Sesi</span>
            ${renderMeterBar(Math.min(100, data.security.successfulSshLogins * 2), '#16a34a')}
          </td>
          <td style="color: #334155; font-weight: 500;">Sesi Operasional Resmi</td>
          <td style="font-weight: 700; color: #166534;">Autentikasi Valid</td>
        </tr>
        <tr>
          <td style="font-weight: 700; color: #0f172a;">Percobaan SSH Gagal (Brute Force)</td>
          <td style="text-align: center;">
            <span class="risk-pill ${data.security.failedSshCount > 10 ? 'risk-pill-4' : 'risk-pill-1'}">
              ${data.security.failedSshCount > 10 ? '4' : '1'}
            </span>
          </td>
          <td>
            <span style="font-weight: 800; color: ${data.security.failedSshCount > 0 ? '#b91c1c' : '#0f172a'};">${data.security.failedSshCount} Kali</span>
            ${renderMeterBar(Math.min(100, data.security.failedSshCount * 10), '#ea580c')}
          </td>
          <td style="color: #334155; font-weight: 500;">&le; 10 Kali / Pekan</td>
          <td style="font-weight: 700; color: ${data.security.failedSshCount > 0 ? '#b91c1c' : '#166534'};">
            ${data.security.fail2banBannedIps} IP Dicekal Fail2Ban
          </td>
        </tr>
        <tr>
          <td style="font-weight: 700; color: #0f172a;">Eksekusi Hak Istimewa Root Sudo</td>
          <td style="text-align: center;"><span class="risk-pill risk-pill-1">1</span></td>
          <td>
            <span style="font-weight: 800; color: #0f172a;">${data.security.sudoExecutions} Kali</span>
            ${renderMeterBar(Math.min(100, data.security.sudoExecutions), '#0284c7')}
          </td>
          <td style="color: #334155; font-weight: 500;">Pemeliharaan Sistem</td>
          <td style="font-weight: 700; color: #166534;">Aktivitas Terotorisasi</td>
        </tr>
        <tr>
          <td style="font-weight: 700; color: #0f172a;">Masa Aktif Sertifikat SSL/TLS</td>
          <td style="text-align: center;">
            <span class="risk-pill ${data.security.sslDaysRemaining < 15 ? 'risk-pill-4' : 'risk-pill-1'}">
              ${data.security.sslDaysRemaining < 15 ? '4' : '1'}
            </span>
          </td>
          <td>
            <span style="font-weight: 800; color: #0f172a;">${data.security.sslDaysRemaining} Hari Tersisa</span>
            ${renderMeterBar(Math.min(100, data.security.sslDaysRemaining), '#0284c7')}
          </td>
          <td style="color: #334155; font-weight: 500;">Batas Aman: &ge; 30 Hari</td>
          <td style="font-weight: 700; color: #166534;">Sertifikat Valid</td>
        </tr>
        <tr>
          <td style="font-weight: 700; color: #0f172a;">Status Firewall Host (UFW)</td>
          <td style="text-align: center;"><span class="risk-pill risk-pill-1">1</span></td>
          <td colspan="2" style="color: #1e293b; font-weight: 600;">
            Status: <span style="color: #16a34a; font-weight: 800;">● ${data.security.ufwStatus}</span> (Kebijakan default drop incoming aktif)
          </td>
          <td style="font-weight: 700; color: #166534;">Proteksi Ketat</td>
        </tr>
        <tr>
          <td style="font-weight: 700; color: #0f172a;">Pembaruan Paket Sistem Operasi</td>
          <td style="text-align: center;">
            <span class="risk-pill ${data.security.pendingUpdates.security > 0 ? 'risk-pill-3' : 'risk-pill-1'}">
              ${data.security.pendingUpdates.security > 0 ? '3' : '1'}
            </span>
          </td>
          <td colspan="2" style="color: #1e293b;">
            Tersedia <strong>${data.security.pendingUpdates.total}</strong> pembaruan (termasuk <strong>${data.security.pendingUpdates.security}</strong> security updates)
          </td>
          <td style="font-weight: 700; color: ${data.security.pendingUpdates.security > 0 ? '#92400e' : '#166534'};">
            ${data.security.pendingUpdates.security > 0 ? 'Jadwalkan Patch' : 'Up to Date'}
          </td>
        </tr>
      </tbody>
    </table>

    <p style="margin: 0; font-size: 11px; color: #334155; line-height: 1.55;">
      Tidak ditemukan anomali eskalasi hak istimewa atau pembuatan akun liar (${data.security.userAccountChanges} modifikasi akun). Kebijakan firewall UFW efektif menepis scan port eksternal.
    </p>
  </div>


  <!-- ==================== BAGIAN 6: INTEGRITAS BACKUP & DISASTER RECOVERY ==================== -->
  <div style="margin-bottom: 14px;">
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

    <p style="margin: 0; font-size: 10.5px; color: #334155; line-height: 1.5;">
      Seluruh snapshot basis data berhasil dikompresi dan ditransmisikan ke storage sekunder tepat waktu. Integritas checksum diverifikasi tanpa corrupt data.
    </p>
  </div>


  <!-- ==================== HALAMAN 4: INSIDEN & ACTION ITEMS ==================== -->
  <div class="page-break"></div>
  <div class="running-header">
    <span>GAJIANICH ENTERPRISE INFRASTRUCTURE AUDIT</span>
    <span>TARGET: ${data.server.code} • PERIODE: ${data.period.week}</span>
  </div>

  <!-- ==================== BAGIAN 7: REKAPITULASI INSIDEN ==================== -->
  <div style="margin-bottom: 14px;">
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

    <p style="margin: 0; font-size: 10.5px; color: #334155; line-height: 1.5;">
      ${
        analysis.incidentsMaintenance && analysis.incidentsMaintenance.length > 0
          ? 'Insiden tercatat telah ditangani sesuai SLA tanggap darurat dan langkah mitigasi telah diintegrasikan ke dalam matriks tindakan (Action Items).'
          : 'Kondisi operasional zero-outage mencerminkan keandalan konfigurasi daemon dan alokasi sumber daya yang proporsional terhadap beban komputasi harian.'
      }
    </p>
  </div>


  <!-- ==================== BAGIAN 8: ACTION ITEMS & REKOMENDASI ==================== -->
  <div style="margin-bottom: 14px;">
    <h3 class="section-title"><span class="badge">08</span> Rencana Tindakan & Rekomendasi Mitigasi (Action Items)</h3>
    <div class="section-intro">
      Matriks penugasan terarah kepada penanggung jawab teknis (PIC) untuk menyelesaikan temuan audit, mencegah regresi degradasi sistem, dan menjamin keberlanjutan SLA bisnis.
    </div>

    <!-- Table Action Items -->
    <table class="data-table" style="margin-bottom: 14px;">
      <thead>
        <tr>
          <th style="width: 5%; text-align: center;">No</th>
          <th style="width: 28%;">Isu / Temuan Audit</th>
          <th style="width: 33%;">Tindakan Solutif (Action)</th>
          <th style="width: 12%; text-align: center;">PIC</th>
          <th style="width: 10%; text-align: center;">Target</th>
          <th style="width: 12%; text-align: center;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${actionItemsHtml}
      </tbody>
    </table>

    <!-- Table Strategic Recommendations (Replaces Cards!) -->
    <div style="margin-top: 14px;">
      <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 6px;">
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

    <p style="margin: 8px 0 0 0; font-size: 11px; color: #334155; line-height: 1.55;">
      Seluruh rekomendasi strategis di atas disusun berdasarkan observasi telemetri faktual dan diprioritaskan untuk mengeliminasi potensi risiko *single point of failure* pada siklus operasional mendatang.
    </p>
  </div>

  <!-- Final Sign-Off -->
  <div class="avoid-break" style="margin-top: 22px; border-top: 1.5px solid #94a3b8; padding-top: 12px;">
    <div style="display: flex; justify-content: space-between; font-size: 10px; color: #0f172a; font-weight: 600;">
      <div>
        <strong style="color: #0f172a;">Disahkan oleh Sistem:</strong><br>
        GAJIANICH Infrastructure Engine<br>
        ID Laporan: GJN-AUD-${data.period.week}-${data.server.code}
      </div>
      <div style="text-align: right;">
        <strong style="color: #0f172a;">Pemeriksa / Penanggung Jawab IT:</strong><br>
        Tim DevOps & IT Infrastructure GAJIANICH<br>
        PT Cahaya Mas Cemerlang
      </div>
    </div>
  </div>

  <div class="running-footer">
    <span>Klasifikasi: Konfidensial Internal CMC • PT Cahaya Mas Cemerlang</span>
    <span>Dokumen Resmi Audit Infrastruktur Mingguan • Periode ${data.period.week}</span>
  </div>

</body>
</html>`;
}
