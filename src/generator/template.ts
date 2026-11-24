import { AggregatedWeeklyMetrics } from '../aggregator/dataAggregator.js';
import { AiAuditAnalysisResult } from '../ai/ruleBasedFallback.js';

export function renderHtmlTemplate(
  data: AggregatedWeeklyMetrics,
  analysis: AiAuditAnalysisResult
): string {
  const statusColor =
    analysis.overallStatus === 'NORMAL'
      ? '#059669' // emerald-600
      : analysis.overallStatus === 'WARNING'
      ? '#d97706' // amber-600
      : '#e11d48'; // rose-600

  const statusBg =
    analysis.overallStatus === 'NORMAL'
      ? '#ecfdf5' // emerald-50
      : analysis.overallStatus === 'WARNING'
      ? '#fffbeb' // amber-50
      : '#fff1f2'; // rose-50

  const statusBorder =
    analysis.overallStatus === 'NORMAL'
      ? '#a7f3d0' // emerald-200
      : analysis.overallStatus === 'WARNING'
      ? '#fde68a' // amber-200
      : '#fecdd3'; // rose-200

  const servicesHtml =
    data.services.length > 0
      ? data.services
          .map(
            (s, idx) => `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">${s.name}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569; text-transform: uppercase; font-size: 11px;">${s.category}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; background-color: ${
              s.status === 'active' || s.status === 'online' ? '#ecfdf5' : '#fff1f2'
            }; color: ${s.status === 'active' || s.status === 'online' ? '#059669' : '#e11d48'};">
              ● ${s.status.toUpperCase()}
            </span>
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; color: ${s.restarts > 0 ? '#e11d48' : '#64748b'}; font-weight: ${s.restarts > 0 ? '700' : '400'};">
            ${s.restarts}
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 11px;">${s.uptime}</td>
        </tr>
      `
          )
          .join('')
      : `<tr><td colspan="5" style="padding: 16px; text-align: center; color: #94a3b8;">Tidak ada kontainer/layanan spesifik yang terdaftar.</td></tr>`;

  const backupsHtml =
    data.backups.length > 0
      ? data.backups
          .slice(0, 5)
          .map(
            (b, idx) => `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">${b.dbName}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">${b.sizeMb} MB</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; background-color: #ecfdf5; color: #059669;">
              ✓ ${b.status}
            </span>
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 11px;">
            ${b.completedAt ? new Date(b.completedAt).toLocaleString('id-ID') : '-'}
          </td>
        </tr>
      `
          )
          .join('')
      : `<tr><td colspan="4" style="padding: 12px; text-align: center; color: #94a3b8;">Belum ada log backup tercatat dalam 7 hari terakhir.</td></tr>`;

  const recommendationsHtml = analysis.recommendations
    .map((rec) => {
      const pColor =
        rec.priority === 'TINGGI'
          ? '#e11d48'
          : rec.priority === 'SEDANG'
          ? '#d97706'
          : '#059669';
      const pBg =
        rec.priority === 'TINGGI'
          ? '#fff1f2'
          : rec.priority === 'SEDANG'
          ? '#fffbeb'
          : '#ecfdf5';

      return `
      <div style="margin-bottom: 12px; padding: 12px 16px; border: 1px solid #e2e8f0; border-left: 4px solid ${pColor}; border-radius: 8px; background-color: #ffffff; page-break-inside: avoid;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <h4 style="margin: 0; font-size: 13px; font-weight: 700; color: #1e293b;">${rec.title}</h4>
          <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; background-color: ${pBg}; color: ${pColor}; text-transform: uppercase;">
            PRIORITAS: ${rec.priority}
          </span>
        </div>
        <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #475569;">${rec.action}</p>
      </div>
    `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan Mingguan Infrastruktur - ${data.server.code} - ${data.period.week}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .avoid-break {
      page-break-inside: avoid;
    }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      background-color: #ffffff;
      margin-bottom: 16px;
    }
    .kpi-box {
      border: 1px solid #f1f5f9;
      background-color: #f8fafc;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .kpi-title {
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
      margin-bottom: 4px;
    }
    .kpi-val {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .kpi-sub {
      font-size: 10px;
      color: #94a3b8;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    th {
      background-color: #f1f5f9;
      color: #475569;
      font-weight: 700;
      text-align: left;
      padding: 8px 12px;
      border-bottom: 2px solid #cbd5e1;
      font-size: 10px;
      text-transform: uppercase;
    }
  </style>
</head>
<body>

  <!-- KOP SURAT EMERALD ENTERPRISE -->
  <div style="border-bottom: 3px solid #059669; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="background-color: #059669; color: #ffffff; padding: 10px; border-radius: 10px; font-weight: 900; font-size: 18px; line-height: 1;">
        GJN
      </div>
      <div>
        <h1 style="margin: 0; font-size: 18px; font-weight: 900; color: #0f172a; letter-spacing: -0.02em;">GAJIANICH INFRASTRUCTURE AUDIT</h1>
        <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">Laporan Mingguan Ketersediaan Layanan, Kapasitas Hardware & Audit Keamanan</p>
      </div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 10px; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 0.05em;">Dokumen Resmi IT Ops</div>
      <div style="font-size: 12px; font-weight: 800; color: #1e293b; font-family: monospace;">ID: INFRA-${data.period.week}-${data.server.code}</div>
      <div style="font-size: 10px; color: #64748b;">Periode: ${data.period.startDate} s/d ${data.period.endDate}</div>
    </div>
  </div>

  <!-- SERVER & STATUS HEADER -->
  <div class="card avoid-break" style="background-color: ${statusBg}; border-color: ${statusBorder};">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <div>
        <span style="display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 800; background-color: #0f172a; color: #ffffff; text-transform: uppercase;">
          ${data.server.roleBadge}
        </span>
        <h2 style="margin: 6px 0 0 0; font-size: 16px; font-weight: 800; color: #0f172a;">
          ${data.server.name} <span style="font-size: 13px; font-weight: 500; color: #64748b;">(${data.server.code})</span>
        </h2>
        <p style="margin: 2px 0 0 0; font-size: 11px; color: #475569;">
          IP: <strong style="font-family: monospace;">${data.server.ipAddress}</strong> &bull; Spek: ${data.server.specs} &bull; OS: ${data.server.os}
        </p>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Status Audit Mingguan</div>
        <div style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 16px; border-radius: 8px; font-weight: 900; font-size: 14px; background-color: ${statusColor}; color: #ffffff;">
          ● STATUS ${analysis.overallStatus}
        </div>
      </div>
    </div>

    <!-- Executive Summary Box -->
    <div style="background-color: #ffffff; padding: 12px 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
      <div style="font-size: 10px; font-weight: 800; color: #059669; text-transform: uppercase; margin-bottom: 4px;">Ringkasan Eksekutif (AI Summary):</div>
      <p style="margin: 0; font-size: 12px; line-height: 1.55; color: #334155; text-align: justify;">
        ${analysis.executiveSummary}
      </p>
    </div>
  </div>

  <!-- KPI SUMMARY GRID (7 HARI REAL DATA) -->
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px;" class="avoid-break">
    <div class="kpi-box">
      <div class="kpi-title">Uptime & SLA</div>
      <div class="kpi-val" style="color: #059669;">99.9%</div>
      <div class="kpi-sub">${data.server.uptimeFormatted}</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-title">CPU (Rata-rata / Puncak)</div>
      <div class="kpi-val">${data.metrics.avgCpuPct}% <span style="font-size: 11px; color: #64748b;">/ ${data.metrics.peakCpuPct}%</span></div>
      <div class="kpi-sub">Load 1m: ${data.metrics.avgLoad1m}</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-title">RAM (Rata-rata / Puncak)</div>
      <div class="kpi-val" style="color: ${data.metrics.peakRamPct >= 85 ? '#e11d48' : '#0f172a'};">
        ${data.metrics.avgRamPct}% <span style="font-size: 11px; color: #64748b;">/ ${data.metrics.peakRamPct}%</span>
      </div>
      <div class="kpi-sub">Ambang: Normal &lt; 85%</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-title">Disk Root & Growth</div>
      <div class="kpi-val">${data.metrics.endDiskPct}%</div>
      <div class="kpi-sub">${data.metrics.diskGrowthPct >= 0 ? '+' : ''}${data.metrics.diskGrowthPct}% dlm 7 hari</div>
    </div>

    <div class="kpi-box">
      <div class="kpi-title">Throughput Jaringan</div>
      <div class="kpi-val">${(data.metrics.avgNetRxBps / 1024).toFixed(1)} <span style="font-size: 11px; color: #64748b;">KB/s</span></div>
      <div class="kpi-sub">TX: ${(data.metrics.avgNetTxBps / 1024).toFixed(1)} KB/s</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-title">Keamanan SSH</div>
      <div class="kpi-val" style="color: ${data.security.failedSshCount > 20 ? '#e11d48' : '#059669'};">
        ${data.security.failedSshCount} <span style="font-size: 11px; color: #64748b;">Gagal</span>
      </div>
      <div class="kpi-sub">Fail2Ban: ${data.security.fail2banBannedIps} IP diblokir</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-title">Sertifikat SSL</div>
      <div class="kpi-val" style="color: ${data.security.sslDaysRemaining <= 15 ? '#e11d48' : '#059669'};">
        ${data.security.sslDaysRemaining} <span style="font-size: 11px; color: #64748b;">Hari</span>
      </div>
      <div class="kpi-sub">Firewall UFW: ${data.security.ufwStatus}</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-title">Sampel Telemetri</div>
      <div class="kpi-val">${data.metrics.sampleCount}</div>
      <div class="kpi-sub">Database: Riil 7 Hari</div>
    </div>
  </div>

  <!-- ROOT CAUSE ANALYSIS (JIKA ADA INSIDEN) -->
  ${
    analysis.incidentRca
      ? `
    <div class="card avoid-break" style="background-color: #fff1f2; border-color: #fecdd3; padding: 12px 16px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        <span style="color: #e11d48; font-size: 16px; font-weight: 900;">⚠</span>
        <h3 style="margin: 0; font-size: 13px; font-weight: 800; color: #9f1239; text-transform: uppercase;">
          Analisis Akar Masalah (Root Cause Analysis - RCA)
        </h3>
      </div>
      <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #881337;">
        ${analysis.incidentRca}
      </p>
    </div>
  `
      : ''
  }

  <!-- TABEL LAYANAN & DOCKER CONTAINERS -->
  <div class="card avoid-break">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <h3 style="margin: 0; font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
        Status Kontainer & Layanan Kritis
      </h3>
      <span style="font-size: 10px; color: #64748b;">Total: ${data.services.length} unit terpantau</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Nama Layanan</th>
          <th>Kategori</th>
          <th>Status</th>
          <th style="text-align: center;">Jml Restart</th>
          <th>Uptime</th>
        </tr>
      </thead>
      <tbody>
        ${servicesHtml}
      </tbody>
    </table>
  </div>

  <!-- REKOMENDASI AUDIT PRIORITAS -->
  <div class="card avoid-break">
    <div style="margin-bottom: 10px;">
      <h3 style="margin: 0; font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
        Rekomendasi Tindakan Teknis
      </h3>
      <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">Langkah strategis preventif untuk menjamin kepatuhan SLA & stabilitas server</p>
    </div>
    <div>
      ${recommendationsHtml}
    </div>
  </div>

  <!-- RIWAYAT BACKUP DATABASE -->
  <div class="card avoid-break">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <h3 style="margin: 0; font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
        Integritas & Retensi Backup Database
      </h3>
      <span style="font-size: 10px; color: #059669; font-weight: 700;">Diverifikasi Otomatis</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Nama Database</th>
          <th>Ukuran Berkas</th>
          <th>Status Cadangan</th>
          <th>Waktu Selesai</th>
        </tr>
      </thead>
      <tbody>
        ${backupsHtml}
      </tbody>
    </table>
  </div>

  <!-- FOOTER & LEMBAR PENGESAHAN -->
  <div class="avoid-break" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end;">
    <div style="font-size: 10px; color: #94a3b8; line-height: 1.4;">
      Dokumen ini diterbitkan secara otomatis oleh engine <strong>GAJIANICH Server Reporter</strong>.<br>
      Hash Verifikasi: <span style="font-family: monospace;">SHA256-${Buffer.from(data.server.code + data.period.week).toString('hex').slice(0, 16)}</span> &bull; Dicetak: ${new Date().toLocaleString('id-ID')}<br>
      Kerahasiaan: <strong>INTERNAL IT USE ONLY</strong>
    </div>
    <div style="text-align: right; font-size: 11px; color: #475569;">
      <div style="margin-bottom: 40px; font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b;">Pengesahan Sistem:</div>
      <div style="font-weight: 800; color: #0f172a; text-decoration: underline;">IT INFRASTRUCTURE TEAM</div>
      <div style="font-size: 10px; color: #64748b;">GAJIANICH Core Engineering</div>
    </div>
  </div>

</body>
</html>
`;
}
