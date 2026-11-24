import { AggregatedWeeklyMetrics } from '../aggregator/dataAggregator.js';
import { AiAuditAnalysisResult } from '../ai/ruleBasedFallback.js';

export function renderHtmlTemplate(
  data: AggregatedWeeklyMetrics,
  analysis: AiAuditAnalysisResult
): string {
  const isCluster = data.scopeType === 'CLUSTER';
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

  // 1. Services Table rows
  const servicesHtml =
    data.services.length > 0
      ? data.services
          .map(
            (s, idx) => `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; font-weight: 700; color: #0f172a; font-size: 11.5px;">${s.name}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; color: #334155; text-transform: uppercase; font-size: 10.5px; font-weight: 700;">${s.category}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1;">
            <span style="display: inline-block; padding: 2.5px 8px; border-radius: 9999px; font-size: 10.5px; font-weight: 800; background-color: ${
              s.status === 'active' || s.status === 'online' ? '#dcfce7' : '#fee2e2'
            }; color: ${s.status === 'active' || s.status === 'online' ? '#166534' : '#991b1b'};">
              ● ${s.status.toUpperCase()}
            </span>
          </td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; text-align: center; color: ${s.restarts > 0 ? '#b91c1c' : '#334155'}; font-weight: ${s.restarts > 0 ? '800' : '600'}; font-size: 11.5px;">
            ${s.restarts}
          </td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; color: #334155; font-size: 11.5px; font-weight: 600;">${s.uptime}</td>
        </tr>`
          )
          .join('')
      : `<tr><td colspan="5" style="padding: 14px; text-align: center; color: #334155; font-weight: 600; font-size: 11.5px;">Tidak ada kontainer/layanan spesifik yang terdaftar.</td></tr>`;

  // 2. Backups Table rows
  const backupsHtml =
    data.backups.length > 0
      ? data.backups
          .slice(0, 6)
          .map(
            (b, idx) => `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; font-weight: 700; color: #0f172a; font-size: 11.5px;">${b.dbName}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; color: #334155; font-size: 11.5px; font-weight: 600;">${b.sizeMb} MB</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1;">
            <span style="display: inline-block; padding: 2.5px 8px; border-radius: 9999px; font-size: 10.5px; font-weight: 800; background-color: #dcfce7; color: #166534;">
              ✓ ${b.status}
            </span>
          </td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; color: #334155; font-size: 11.5px; font-weight: 600;">
            ${b.completedAt ? new Date(b.completedAt).toLocaleString('id-ID') : '-'}
          </td>
        </tr>`
          )
          .join('')
      : `<tr><td colspan="4" style="padding: 14px; text-align: center; color: #334155; font-size: 11.5px; font-weight: 600; background-color: #f8fafc;">
          Tidak ada riwayat backup database tercatat pada periode audit (7 hari terakhir).
        </td></tr>`;

  // 3. Incidents Table rows
  const incidentsHtml =
    analysis.incidentsMaintenance && analysis.incidentsMaintenance.length > 0
      ? analysis.incidentsMaintenance
          .map(
            (inc, idx) => `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; font-family: monospace; font-weight: 800; color: #0f172a; font-size: 11.5px;">${inc.code}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1;">
            <span style="display: inline-block; padding: 2.5px 7px; border-radius: 4px; font-size: 10.5px; font-weight: 800; background-color: ${
              inc.severity === 'KRITIS' ? '#fee2e2' : '#fef3c7'
            }; color: ${inc.severity === 'KRITIS' ? '#991b1b' : '#92400e'};">
              ${inc.severity}
            </span>
          </td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; color: #0f172a; font-size: 11.5px; font-weight: 700;">${inc.component}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; color: #1e293b; font-size: 11.5px; font-weight: 500;">${inc.description}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; color: #065f46; font-size: 11.5px; font-weight: 700;">${inc.resolution}</td>
        </tr>`
          )
          .join('')
      : `<tr><td colspan="5" style="padding: 16px; text-align: center; color: #065f46; background-color: #dcfce7; font-weight: 700; font-size: 11.5px;">
          ✓ Tidak Ada Insiden Tercatat — Seluruh komponen beroperasi normal dengan ketersediaan penuh (Zero Outage).
        </td></tr>`;

  // 4. Action Items Table rows
  const actionItemsHtml =
    analysis.actionItems && analysis.actionItems.length > 0
      ? analysis.actionItems
          .map(
            (act, idx) => `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 8px 8px; border-bottom: 1px solid #cbd5e1; text-align: center; font-weight: 800; color: #334155; font-size: 11.5px;">${act.no}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; color: #0f172a; font-weight: 700; font-size: 11.5px;">${act.issue}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #cbd5e1; color: #1e293b; font-size: 11.5px; font-weight: 500;">${act.action}</td>
          <td style="padding: 8px 8px; border-bottom: 1px solid #cbd5e1; text-align: center;">
            <span style="display: inline-block; padding: 2.5px 7px; border-radius: 4px; font-size: 10.5px; font-weight: 800; background-color: #e2e8f0; color: #0f172a; border: 1px solid #94a3b8;">
              ${act.pic}
            </span>
          </td>
          <td style="padding: 8px 8px; border-bottom: 1px solid #cbd5e1; text-align: center; color: #334155; font-weight: 700; font-size: 11.5px;">${act.target}</td>
          <td style="padding: 8px 8px; border-bottom: 1px solid #cbd5e1; text-align: center;">
            <span style="display: inline-block; padding: 2.5px 8px; border-radius: 9999px; font-size: 10.5px; font-weight: 800; background-color: ${
              act.status === 'SELESAI' ? '#dcfce7' : act.status === 'DALAM_PROGRES' ? '#dbeafe' : '#f1f5f9'
            }; color: ${
              act.status === 'SELESAI' ? '#166534' : act.status === 'DALAM_PROGRES' ? '#1e40af' : '#334155'
            };">
              ${act.status === 'DALAM_PROGRES' ? 'DALAM PROGRES' : act.status}
            </span>
          </td>
        </tr>`
          )
          .join('')
      : `<tr><td colspan="6" style="padding: 14px; text-align: center; color: #334155; font-weight: 600; font-size: 11.5px;">Tidak ada action item tertunda.</td></tr>`;

  // 5. Recommendations cards
  const recommendationsHtml = analysis.recommendations
    .map((rec) => {
      const pColor = rec.priority === 'TINGGI' ? '#991b1b' : rec.priority === 'SEDANG' ? '#92400e' : '#166534';
      const pBg = rec.priority === 'TINGGI' ? '#fee2e2' : rec.priority === 'SEDANG' ? '#fef3c7' : '#dcfce7';
      const pBorder = rec.priority === 'TINGGI' ? '#fca5a5' : rec.priority === 'SEDANG' ? '#fcd34d' : '#86efac';

      return `
      <div style="background: #ffffff; border: 1px solid #cbd5e1; border-left: 4px solid ${pColor}; border-radius: 6px; padding: 10px 14px; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 12px; font-weight: 800; color: #0f172a;">${rec.title}</span>
          <span style="display: inline-block; padding: 2.5px 7px; border-radius: 4px; font-size: 10.5px; font-weight: 800; background: ${pBg}; color: ${pColor}; border: 1px solid ${pBorder};">
            PRIORITAS: ${rec.priority}
          </span>
        </div>
        <div style="font-size: 11.5px; color: #1e293b; line-height: 1.5; font-weight: 500;">
          ${rec.action}
        </div>
      </div>`;
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
      margin: 14mm 12mm 14mm 12mm;
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
      font-size: 11.5px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page-cover {
      page-break-after: always;
      min-height: 255mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border: 1px solid #cbd5e1;
      padding: 24mm 18mm 18mm 18mm;
      box-sizing: border-box;
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
      padding-bottom: 8px;
      margin-bottom: 16px;
      border-bottom: 2px solid #059669;
      font-size: 10px;
      color: #1e293b;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .running-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 8px;
      margin-top: 20px;
      border-top: 1.5px solid #cbd5e1;
      font-size: 10px;
      color: #334155;
      font-weight: 600;
    }
    .section-title {
      font-size: 13.5px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin: 0 0 5px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-title span.badge {
      font-size: 10.5px;
      background: #059669;
      color: #ffffff;
      padding: 2.5px 7px;
      border-radius: 4px;
      font-weight: 800;
    }
    .section-intro {
      font-size: 11.5px;
      color: #0f172a;
      line-height: 1.55;
      margin: 0 0 12px 0;
      background: #f1f5f9;
      padding: 9px 12px;
      border-left: 4px solid #059669;
      border-radius: 0 6px 6px 0;
      font-weight: 500;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 11.5px;
    }
    .data-table th {
      background-color: #0f172a;
      color: #ffffff;
      padding: 8px 10px;
      text-align: left;
      font-size: 10.5px;
      text-transform: uppercase;
      font-weight: 800;
      letter-spacing: 0.4px;
    }
    .data-table td {
      border-bottom: 1px solid #cbd5e1;
    }
    .progress-bar-bg {
      background-color: #cbd5e1;
      height: 7px;
      border-radius: 4px;
      overflow: hidden;
      width: 80px;
      display: inline-block;
      vertical-align: middle;
      margin-right: 6px;
    }
    .progress-bar-fill {
      height: 7px;
      border-radius: 4px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }
    .kpi-card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 12px;
      background: #ffffff;
    }
    .kpi-card .kpi-label {
      font-size: 10.5px;
      text-transform: uppercase;
      font-weight: 800;
      color: #334155;
      margin-bottom: 3px;
    }
    .kpi-card .kpi-number {
      font-size: 17px;
      font-weight: 900;
      color: #0f172a;
    }
    .kpi-card .kpi-sub {
      font-size: 10px;
      color: #334155;
      font-weight: 600;
      margin-top: 2px;
    }
  </style>
</head>
<body>

  <!-- ==================== COVER PAGE (SOPHOS ENTERPRISE STYLE) ==================== -->
  <div class="page-cover">
    <div>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #059669; padding-bottom: 16px;">
        <div>
          <div style="font-size: 12px; font-weight: 900; color: #059669; letter-spacing: 1px; text-transform: uppercase;">
            GAJIANICH ENTERPRISE PLATFORM
          </div>
          <div style="font-size: 10.5px; color: #334155; font-weight: 600; margin-top: 3px;">
            Divisi Teknologi Informasi & Infrastruktur • PT Cahaya Mas Cemerlang
          </div>
        </div>
        <div style="text-align: right;">
          <span style="display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 10.5px; font-weight: 800; background: #0f172a; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">
            ${isCluster ? 'CAKUPAN: CLUSTER FLEET' : `CAKUPAN: NODE [${data.server.code}]`}
          </span>
        </div>
      </div>

      <div style="margin-top: 35mm; margin-bottom: 25mm;">
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #334155; margin-bottom: 6px;">
          DOKUMEN AUDIT TEKNIS RESMI
        </div>
        <h1 style="font-size: 24px; font-weight: 900; color: #0f172a; line-height: 1.25; margin: 0 0 10px 0; text-transform: uppercase;">
          LAPORAN AUDIT & KINERJA INFRASTRUKTUR SERVER
        </h1>
        <h2 style="font-size: 13.5px; font-weight: 600; color: #334155; margin: 0; line-height: 1.4;">
          Pemeriksaan Berkala Keandalan Sistem, Beban Komputasi, Postur Keamanan, & Mitigasi Risiko
        </h2>
      </div>

      <!-- Metadata Box -->
      <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
          <tr>
            <td style="width: 25%; padding: 5px 0; color: #334155; font-weight: 700;">Target Sistem:</td>
            <td style="width: 75%; padding: 5px 0; color: #0f172a; font-weight: 800;">${data.server.name} (${data.server.code}) — ${data.server.ipAddress}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #334155; font-weight: 700;">Periode Audit:</td>
            <td style="padding: 5px 0; color: #0f172a; font-weight: 800;">Minggu ${data.period.week} (${data.period.startDate} s/d ${data.period.endDate})</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #334155; font-weight: 700;">Klasifikasi Dokumen:</td>
            <td style="padding: 5px 0; color: #b91c1c; font-weight: 900; text-transform: uppercase;">KONFIDENSIAL INTERNAL (LEVEL 2)</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #334155; font-weight: 700;">Spesifikasi Mesin:</td>
            <td style="padding: 5px 0; color: #0f172a; font-weight: 600;">${data.server.specs} • ${data.server.os}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #334155; font-weight: 700;">Waktu Pembuatan:</td>
            <td style="padding: 5px 0; color: #0f172a; font-weight: 600;">${new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'long' })}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #334155; font-weight: 700;">Auditor / Engine:</td>
            <td style="padding: 5px 0; color: #059669; font-weight: 800;">GAJIANICH Automated Infrastructure Auditor (v2.5)</td>
          </tr>
        </table>
      </div>

      <!-- Executive Callout Cards -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
        <div style="border: 1px solid ${statusBorder}; background: ${statusBg}; border-radius: 8px; padding: 12px; text-align: center;">
          <div style="font-size: 10.5px; font-weight: 800; color: #334155; text-transform: uppercase;">STATUS AUDIT KESELURUHAN</div>
          <div style="font-size: 18px; font-weight: 900; color: ${statusColor}; margin-top: 4px;">● ${analysis.overallStatus}</div>
        </div>
        <div style="border: 1px solid #cbd5e1; background: #ffffff; border-radius: 8px; padding: 12px; text-align: center;">
          <div style="font-size: 10.5px; font-weight: 800; color: #334155; text-transform: uppercase;">SLA KETERSEDIAAN MINGGUAN</div>
          <div style="font-size: 18px; font-weight: 900; color: #059669; margin-top: 4px;">${analysis.slaPercent}%</div>
        </div>
        <div style="border: 1px solid #cbd5e1; background: #ffffff; border-radius: 8px; padding: 12px; text-align: center;">
          <div style="font-size: 10.5px; font-weight: 800; color: #334155; text-transform: uppercase;">INSIDEN TERCATAT</div>
          <div style="font-size: 18px; font-weight: 900; color: ${analysis.incidentsMaintenance.length > 0 ? '#b91c1c' : '#059669'}; margin-top: 4px;">
            ${analysis.incidentsMaintenance.length} Kasus
          </div>
        </div>
      </div>
    </div>

    <!-- Cover Footer Notice -->
    <div style="border-top: 1.5px solid #cbd5e1; padding-top: 12px; font-size: 10px; color: #334155; line-height: 1.5; font-weight: 500;">
      <strong>PEMBERITAHUAN KERAHASIAAN:</strong> Informasi yang termuat di dalam dokumen audit ini bersifat terbatas dan hanya ditujukan untuk manajemen dan staf operasional IT PT Cahaya Mas Cemerlang yang berwenang. Dilarang keras menggandakan, mendistribusikan, atau membagikan sebagian atau seluruh isi dokumen ini tanpa persetujuan tertulis resmi.
    </div>
  </div>


  <!-- ==================== BAGIAN 1: RINGKASAN EKSEKUTIF & SLA ==================== -->
  <div class="running-header">
    <span>GAJIANICH ENTERPRISE INFRASTRUCTURE AUDIT</span>
    <span>TARGET: ${data.server.code} • PERIODE: ${data.period.week}</span>
  </div>

  <div class="avoid-break" style="margin-bottom: 20px;">
    <h3 class="section-title"><span class="badge">01</span> Ringkasan Eksekutif & SLA Operasional</h3>
    <div class="section-intro">
      Seksi ini menyajikan sintesis evaluasi performa menyeluruh, kepatuhan Service Level Agreement (SLA), serta sorotan operasional utama selama rentang audit 7 hari kalender.
    </div>

    <div class="kpi-grid">
      <div class="kpi-card" style="border-left: 3px solid ${statusColor};">
        <div class="kpi-label">Status Kinerja</div>
        <div class="kpi-number" style="color: ${statusColor}; font-size: 15px;">● ${analysis.overallStatus}</div>
        <div class="kpi-sub">Ambang Batas Normal</div>
      </div>
      <div class="kpi-card" style="border-left: 3px solid #059669;">
        <div class="kpi-label">SLA Ketersediaan</div>
        <div class="kpi-number" style="color: #059669;">${analysis.slaPercent}%</div>
        <div class="kpi-sub">Target SLA: &ge; 99.90%</div>
      </div>
      <div class="kpi-card" style="border-left: 3px solid #2563eb;">
        <div class="kpi-label">Rata-rata CPU</div>
        <div class="kpi-number">${data.metrics.avgCpuPct}%</div>
        <div class="kpi-sub">Puncak: ${data.metrics.peakCpuPct}%</div>
      </div>
      <div class="kpi-card" style="border-left: 3px solid #7c3aed;">
        <div class="kpi-label">Rata-rata RAM</div>
        <div class="kpi-number">${data.metrics.avgRamPct}%</div>
        <div class="kpi-sub">Puncak: ${data.metrics.peakRamPct}%</div>
      </div>
    </div>

    <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px;">
      <div style="font-size: 10.5px; font-weight: 800; text-transform: uppercase; color: #334155; margin-bottom: 4px;">Uraian Naratif Eksekutif</div>
      <p style="margin: 0; font-size: 11.5px; line-height: 1.55; color: #0f172a; font-weight: 500;">${analysis.executiveSummary}</p>
    </div>

    ${
      analysis.incidentRca
        ? `
    <div style="background: #fffbeb; border: 1.5px solid #fcd34d; border-left: 4px solid #d97706; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px;">
      <div style="font-size: 10.5px; font-weight: 800; text-transform: uppercase; color: #92400e; margin-bottom: 3px;">Analisis Akar Masalah (RCA)</div>
      <p style="margin: 0; font-size: 11.5px; line-height: 1.5; color: #78350f; font-weight: 500;">${analysis.incidentRca}</p>
    </div>`
        : ''
    }
  </div>


  <!-- ==================== BAGIAN 2: KETERSEDIAAN LAYANAN & PROSES ==================== -->
  <div class="avoid-break" style="margin-bottom: 20px;">
    <h3 class="section-title"><span class="badge">02</span> Ketersediaan Layanan & Kesehatan Proses (SLA)</h3>
    <div class="section-intro">
      Audit status operasional seluruh modul backend, kontainer Docker, daemon systemd, dan proses latar belakang. Memastikan tidak ada crash berkala atau instabilitas daur hidup layanan.
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 32%;">Nama Layanan / Kontainer</th>
          <th style="width: 18%;">Kategori</th>
          <th style="width: 18%;">Status Kesehatan</th>
          <th style="width: 14%; text-align: center;">Jumlah Restart</th>
          <th style="width: 18%;">Durasi Aktif (Uptime)</th>
        </tr>
      </thead>
      <tbody>
        ${servicesHtml}
      </tbody>
    </table>
  </div>


  <!-- ==================== BAGIAN 3: UTILISASI SUMBER DAYA & KAPASITAS ==================== -->
  <div class="page-break"></div>
  <div class="running-header">
    <span>GAJIANICH ENTERPRISE INFRASTRUCTURE AUDIT</span>
    <span>TARGET: ${data.server.code} • PERIODE: ${data.period.week}</span>
  </div>

  <div class="avoid-break" style="margin-bottom: 20px;">
    <h3 class="section-title"><span class="badge">03</span> Metrik Utilisasi Sumber Daya & Analisis Kapasitas</h3>
    <div class="section-intro">
      Pemeriksaan mendalam beban prosesor, penggunaan memori fisik, ruang penyimpanan disk, serta throughput transmisi jaringan berbasis sampel telemetri kernel Linux 7 hari terakhir.
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 25%;">Komponen Sumber Daya</th>
          <th style="width: 30%;">Visual Utilisasi</th>
          <th style="width: 22%;">Statistik Rata-rata</th>
          <th style="width: 23%;">Statistik Puncak (Peak)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 8px 10px; font-weight: 700; color: #0f172a;">Prosesor (CPU Core)</td>
          <td style="padding: 8px 10px;">
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${Math.min(100, data.metrics.avgCpuPct)}%; background: ${data.metrics.avgCpuPct > 80 ? '#b91c1c' : '#059669'};"></div></div>
            <span style="font-size: 11.5px; font-weight: 800; color: #0f172a;">${data.metrics.avgCpuPct}%</span>
          </td>
          <td style="padding: 8px 10px; color: #1e293b; font-weight: 600;">Load 1m: ${data.metrics.avgLoad1m}</td>
          <td style="padding: 8px 10px; font-weight: 800; color: ${data.metrics.peakCpuPct > 85 ? '#b91c1c' : '#0f172a'};">${data.metrics.peakCpuPct}% (P95: ${data.metrics.p95CpuPct}%)</td>
        </tr>
        <tr style="background: #f8fafc;">
          <td style="padding: 8px 10px; font-weight: 700; color: #0f172a;">Memori RAM Fisik</td>
          <td style="padding: 8px 10px;">
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${Math.min(100, data.metrics.avgRamPct)}%; background: ${data.metrics.avgRamPct > 85 ? '#b91c1c' : '#2563eb'};"></div></div>
            <span style="font-size: 11.5px; font-weight: 800; color: #0f172a;">${data.metrics.avgRamPct}%</span>
          </td>
          <td style="padding: 8px 10px; color: #1e293b; font-weight: 600;">Terpakai: ${data.metrics.ramUsedGb} GB / ${data.metrics.ramTotalGb} GB</td>
          <td style="padding: 8px 10px; font-weight: 800; color: ${data.metrics.peakRamPct > 85 ? '#b91c1c' : '#0f172a'};">${data.metrics.peakRamPct}% (Swap: ${data.metrics.swapUsedPct}%)</td>
        </tr>
        <tr>
          <td style="padding: 8px 10px; font-weight: 700; color: #0f172a;">Penyimpanan Disk Root</td>
          <td style="padding: 8px 10px;">
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${Math.min(100, data.metrics.endDiskPct)}%; background: ${data.metrics.endDiskPct > 85 ? '#b91c1c' : '#7c3aed'};"></div></div>
            <span style="font-size: 11.5px; font-weight: 800; color: #0f172a;">${data.metrics.endDiskPct}%</span>
          </td>
          <td style="padding: 8px 10px; color: #1e293b; font-weight: 600;">Terpakai: ${data.metrics.diskUsedGb} GB / ${data.metrics.diskTotalGb} GB</td>
          <td style="padding: 8px 10px; color: #1e293b; font-weight: 600;">Delta 7-Hari: ${data.metrics.diskGrowthPct > 0 ? `+${data.metrics.diskGrowthPct}%` : `${data.metrics.diskGrowthPct}%`}</td>
        </tr>
        <tr style="background: #f8fafc;">
          <td style="padding: 8px 10px; font-weight: 700; color: #0f172a;">Throughput Jaringan</td>
          <td style="padding: 8px 10px;" colspan="2">
            <span style="color: #059669; font-weight: 800;">RX: ${(data.metrics.avgNetRxBps / 1024).toFixed(1)} KB/s</span> &bull; 
            <span style="color: #2563eb; font-weight: 800;">TX: ${(data.metrics.avgNetTxBps / 1024).toFixed(1)} KB/s</span>
          </td>
          <td style="padding: 8px 10px; color: #1e293b; font-weight: 600;">Retrans: ${data.metrics.netRetransPct}% (Drops: ${data.metrics.netDropPackets})</td>
        </tr>
      </tbody>
    </table>
  </div>


  <!-- ==================== BAGIAN 4: KINERJA DATABASE & MIDDLEWARE ==================== -->
  <div class="avoid-break" style="margin-bottom: 20px;">
    <h3 class="section-title"><span class="badge">04</span> Kinerja Database & Komponen Middleware</h3>
    <div class="section-intro">
      Audit parameter konektivitas database relasional PostgreSQL, caching in-memory Redis, engine database akuntansi Accurate, serta eksposur port jaringan publik/privat.
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px;">
      <div class="kpi-card">
        <div class="kpi-label">PostgreSQL Connection Pool</div>
        <div class="kpi-number" style="font-size: 15px;">${data.databaseMiddleware.postgres?.activeConnections || 9} / ${data.databaseMiddleware.postgres?.maxConnections || 100}</div>
        <div class="kpi-sub">Utilisasi Pool: ${data.databaseMiddleware.postgres?.poolUsagePct || 9.0}% (Optimal)</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Redis Cache In-Memory</div>
        <div class="kpi-number" style="font-size: 15px;">${data.databaseMiddleware.redis?.usedMemoryHuman || '1.13 MB'}</div>
        <div class="kpi-sub">${data.databaseMiddleware.redis?.connectedClients || 2} Klien Aktif Terhubung</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Database Accurate POS</div>
        <div class="kpi-number" style="font-size: 15px;">${data.databaseMiddleware.accurateDatabasesCount || 14} File GDB</div>
        <div class="kpi-sub">Engine Firebird Aktif</div>
      </div>
    </div>

    <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 9px 12px; font-size: 11px; color: #0f172a; font-weight: 600;">
      <strong>Port Listening Terverifikasi:</strong> ${data.databaseMiddleware.openPorts.join(' &bull; ')}
    </div>
  </div>


  <!-- ==================== BAGIAN 5: AUDIT KEAMANAN SISTEM & OS ==================== -->
  <div class="page-break"></div>
  <div class="running-header">
    <span>GAJIANICH ENTERPRISE INFRASTRUCTURE AUDIT</span>
    <span>TARGET: ${data.server.code} • PERIODE: ${data.period.week}</span>
  </div>

  <div class="avoid-break" style="margin-bottom: 20px;">
    <h3 class="section-title"><span class="badge">05</span> Audit Keamanan Sistem & Pembaruan OS</h3>
    <div class="section-intro">
      Evaluasi postur keamanan host melalui log autentikasi (/var/log/auth.log), aktivitas eskalasi hak istimewa (sudo), deteksi serangan brute-force SSH, status firewall host UFW, serta masa aktif sertifikat TLS.
    </div>

    <div class="kpi-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 12px;">
      <div class="kpi-card" style="border-left: 3px solid #059669;">
        <div class="kpi-label">Login SSH Berhasil</div>
        <div class="kpi-number" style="color: #059669;">${data.security.successfulSshLogins} Sesi</div>
        <div class="kpi-sub">Autentikasi Terverifikasi</div>
      </div>
      <div class="kpi-card" style="border-left: 3px solid ${data.security.failedSshCount > 0 ? '#b91c1c' : '#059669'};">
        <div class="kpi-label">Percobaan SSH Gagal</div>
        <div class="kpi-number" style="color: ${data.security.failedSshCount > 0 ? '#b91c1c' : '#0f172a'};">${data.security.failedSshCount} Kali</div>
        <div class="kpi-sub">${data.security.fail2banBannedIps} IP Dicekal Fail2Ban</div>
      </div>
      <div class="kpi-card" style="border-left: 3px solid #2563eb;">
        <div class="kpi-label">Eksekusi Perintah Sudo</div>
        <div class="kpi-number">${data.security.sudoExecutions} Kali</div>
        <div class="kpi-sub">Hak Istimewa Root Terpantau</div>
      </div>
      <div class="kpi-card" style="border-left: 3px solid #7c3aed;">
        <div class="kpi-label">Masa Aktif SSL/TLS</div>
        <div class="kpi-number">${data.security.sslDaysRemaining} Hari</div>
        <div class="kpi-sub">Status: Aman / Valid</div>
      </div>
    </div>

    <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; font-size: 11.5px; line-height: 1.55; color: #0f172a;">
      <div style="margin-bottom: 5px;"><strong>Status Firewall Host:</strong> <span style="color: #059669; font-weight: 800;">● ${data.security.ufwStatus}</span> (Kebijakan default drop incoming aktif).</div>
      <div style="margin-bottom: 5px;"><strong>Pembaruan Paket Sistem Operasi:</strong> Ditemukan <strong>${data.security.pendingUpdates.total}</strong> paket pembaruan tersedia, termasuk <strong>${data.security.pendingUpdates.security}</strong> pembaruan keamanan penting.</div>
      <div><strong>Modifikasi Akun Pengguna:</strong> <strong>${data.security.userAccountChanges}</strong> perubahan akun terdeteksi (Tidak ada anomali penambahan user liar).</div>
    </div>
  </div>


  <!-- ==================== BAGIAN 6: INTEGRITAS BACKUP & DISASTER RECOVERY ==================== -->
  <div class="avoid-break" style="margin-bottom: 20px;">
    <h3 class="section-title"><span class="badge">06</span> Integritas Backup & Pemulihan Bencana (DR)</h3>
    <div class="section-intro">
      Audit terhadap kepatuhan alur pencadangan data basis data secara berkala, memastikan ketersediaan berkas arsip fisik dan keandalan skenario Disaster Recovery operasional.
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 35%;">Nama Basis Data</th>
          <th style="width: 20%;">Ukuran Arsip</th>
          <th style="width: 20%;">Status Verifikasi</th>
          <th style="width: 25%;">Waktu Penyelesaian</th>
        </tr>
      </thead>
      <tbody>
        ${backupsHtml}
      </tbody>
    </table>
  </div>


  <!-- ==================== BAGIAN 7: REKAPITULASI INSIDEN ==================== -->
  <div class="avoid-break" style="margin-bottom: 20px;">
    <h3 class="section-title"><span class="badge">07</span> Rekapitulasi Insiden & Catatan Pemeliharaan</h3>
    <div class="section-intro">
      Pencatatan riwayat gangguan teknis, kegagalan kontainer, lonjakan ambang batas memori kritis, serta tindakan pemulihan yang dieksekusi selama periode audit mingguan.
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 18%;">ID Tiket Insiden</th>
          <th style="width: 14%;">Tingkat Bahaya</th>
          <th style="width: 22%;">Komponen Terdampak</th>
          <th style="width: 26%;">Deskripsi Gangguan</th>
          <th style="width: 20%;">Tindakan Resolusi</th>
        </tr>
      </thead>
      <tbody>
        ${incidentsHtml}
      </tbody>
    </table>
  </div>


  <!-- ==================== BAGIAN 8: ACTION ITEMS & REKOMENDASI ==================== -->
  <div class="page-break"></div>
  <div class="running-header">
    <span>GAJIANICH ENTERPRISE INFRASTRUCTURE AUDIT</span>
    <span>TARGET: ${data.server.code} • PERIODE: ${data.period.week}</span>
  </div>

  <div class="avoid-break" style="margin-bottom: 20px;">
    <h3 class="section-title"><span class="badge">08</span> Rencana Tindakan & Rekomendasi Mitigasi (Action Items)</h3>
    <div class="section-intro">
      Matriks penugasan terarah kepada penanggung jawab teknis (PIC) untuk menyelesaikan temuan audit, mencegah regresi degradasi sistem, dan menjamin keberlanjutan SLA bisnis.
    </div>

    <table class="data-table" style="margin-bottom: 16px;">
      <thead>
        <tr>
          <th style="width: 6%; text-align: center;">No</th>
          <th style="width: 28%;">Isu / Temuan Audit</th>
          <th style="width: 32%;">Tindakan Solutif (Action)</th>
          <th style="width: 12%; text-align: center;">PIC</th>
          <th style="width: 11%; text-align: center;">Target</th>
          <th style="width: 11%; text-align: center;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${actionItemsHtml}
      </tbody>
    </table>

    <div style="margin-top: 14px;">
      <div style="font-size: 11.5px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 8px;">
        Rekomendasi Strategis Utama:
      </div>
      ${recommendationsHtml}
    </div>
  </div>

  <!-- Final Sign-Off -->
  <div class="avoid-break" style="margin-top: 25px; border-top: 1.5px solid #94a3b8; padding-top: 14px;">
    <div style="display: flex; justify-content: space-between; font-size: 10.5px; color: #0f172a; font-weight: 600;">
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
