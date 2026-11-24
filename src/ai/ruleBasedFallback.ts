import { AggregatedWeeklyMetrics } from '../aggregator/dataAggregator.js';

export interface AiAuditAnalysisResult {
  overallStatus: 'NORMAL' | 'WARNING' | 'CRITICAL';
  executiveSummary: string;
  incidentRca: string | null;
  recommendations: Array<{
    priority: 'TINGGI' | 'SEDANG' | 'RENDAH';
    title: string;
    action: string;
  }>;
}

export function generateRuleBasedAnalysis(data: AggregatedWeeklyMetrics): AiAuditAnalysisResult {
  const { metrics, security, services, server } = data;

  const restartsTotal = services.reduce((acc, s) => acc + (s.restarts || 0), 0);
  const isHighRam = metrics.peakRamPct >= 85;
  const isCriticalRam = metrics.peakRamPct >= 92;
  const isHighCpu = metrics.peakCpuPct >= 80;
  const isCriticalCpu = metrics.peakCpuPct >= 92;
  const isSshAttack = security.failedSshCount >= 25;
  const isCriticalSshAttack = security.failedSshCount >= 100;
  const isDiskSpike = metrics.diskGrowthPct >= 5;

  let overallStatus: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';
  if (isCriticalRam || isCriticalCpu || isCriticalSshAttack || restartsTotal >= 5) {
    overallStatus = 'CRITICAL';
  } else if (isHighRam || isHighCpu || isSshAttack || isDiskSpike || restartsTotal > 0 || security.sslDaysRemaining <= 14) {
    overallStatus = 'WARNING';
  }

  // Executive Summary (Formal Indonesian)
  let executiveSummary = '';
  if (overallStatus === 'NORMAL') {
    executiveSummary = `Infrastruktur node ${server.name} (${server.code}) beroperasi dalam kondisi prima dan stabil sepanjang periode ${data.period.week}. Rata-rata beban CPU tercatat di angka ${metrics.avgCpuPct}% dengan utilisasi RAM rata-rata ${metrics.avgRamPct}%. Seluruh layanan aplikasi dan kontainer aktif tanpa adanya insiden fatal, serta mekanisme backup berjalan sesuai SLA operasional.`;
  } else if (overallStatus === 'WARNING') {
    executiveSummary = `Infrastruktur node ${server.name} (${server.code}) secara umum beroperasi melayani traffic, namun membutuhkan perhatian operasional pada periode ${data.period.week}. Terdeteksi lonjakan penggunaan sumber daya (puncak RAM ${metrics.peakRamPct}%, puncak CPU ${metrics.peakCpuPct}%) serta ${restartsTotal > 0 ? `${restartsTotal} kali restart kontainer` : 'percobaan akses mencurigakan'}. Tindakan preventif disarankan untuk menjaga keandalan sistem.`;
  } else {
    executiveSummary = `Infrastruktur node ${server.name} (${server.code}) mengalami degradasi performa atau ancaman keamanan signifikan pada periode ${data.period.week}. Beban memori atau prosesor mencapai ambang batas kritis (puncak RAM ${metrics.peakRamPct}%, puncak CPU ${metrics.peakCpuPct}%), disertai ${restartsTotal >= 5 ? 'gangguan stabilitas kontainer berulang' : 'aktivitas brute-force login SSH yang masif'}. Diperlukan intervensi teknis segera.`;
  }

  // Incident Root Cause Analysis (RCA)
  let incidentRca: string | null = null;
  const rcaPoints: string[] = [];
  if (isHighRam || isCriticalRam) {
    rcaPoints.push(`Lonjakan utilisasi memori mencapai puncak ${metrics.peakRamPct}% (rata-rata ${metrics.avgRamPct}%). Diindikasikan adanya beban konkurensi database atau memory leak pada proses worker.`);
  }
  if (restartsTotal > 0) {
    rcaPoints.push(`Terdeteksi ${restartsTotal} kali siklus restart kontainer/layanan. Menandakan adanya crash proses atau penghentian paksa akibat alokasi memori (OOM Killer).`);
  }
  if (isSshAttack || isCriticalSshAttack) {
    rcaPoints.push(`Tercatat ${security.failedSshCount} kali percobaan login SSH gagal yang dicegat oleh Fail2Ban (${security.fail2banBannedIps} IP diblokir). Ini menunjukkan percobaan brute-force login dari luar jaringan.`);
  }
  if (isDiskSpike) {
    rcaPoints.push(`Pertumbuhan kapasitas storage root melonjak sebesar ${metrics.diskGrowthPct}% dalam 7 hari terakhir (saat ini ${metrics.endDiskPct}% terpakai).`);
  }

  if (rcaPoints.length > 0) {
    incidentRca = rcaPoints.join(' ');
  }

  // Recommendations
  const recommendations: Array<{ priority: 'TINGGI' | 'SEDANG' | 'RENDAH'; title: string; action: string }> = [];

  if (isHighRam || isCriticalRam) {
    recommendations.push({
      priority: isCriticalRam ? 'TINGGI' : 'SEDANG',
      title: 'Optimasi Alokasi RAM & Profiling Proses',
      action: 'Lakukan audit terhadap query database berat dan atur batas memory limit pada kontainer Docker untuk mencegah OOM.',
    });
  }

  if (restartsTotal > 0) {
    recommendations.push({
      priority: 'TINGGI',
      title: 'Investigasi Log Crash Kontainer',
      action: 'Periksa log container dengan perintah docker logs dan pastikan health check policy tidak memicu restart palsu.',
    });
  }

  if (isSshAttack || isCriticalSshAttack) {
    recommendations.push({
      priority: 'TINGGI',
      title: 'Perketat Kebijakan Keamanan Port SSH',
      action: 'Nonaktifkan password authentication pada sshd_config (wajibkan SSH Key) dan pertimbangkan ubah port default SSH.',
    });
  }

  if (metrics.endDiskPct >= 80) {
    recommendations.push({
      priority: metrics.endDiskPct >= 90 ? 'TINGGI' : 'SEDANG',
      title: 'Pembersihan Log & Rotasi Disk',
      action: 'Jalankan docker system prune dan rotasi log journald untuk membebaskan ruang penyimpanan sebelum mencapai batas 90%.',
    });
  }

  if (security.sslDaysRemaining <= 30) {
    recommendations.push({
      priority: security.sslDaysRemaining <= 10 ? 'TINGGI' : 'SEDANG',
      title: 'Pembaruan Sertifikat SSL/TLS',
      action: `Masa aktif SSL tersisa ${security.sslDaysRemaining} hari. Pastikan auto-renewal Certbot berjalan tanpa kendala DNS.`,
    });
  }

  // Baseline recommendations if empty
  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'SEDANG',
      title: 'Rutin Verifikasi Integritas Backup',
      action: 'Lakukan uji coba restore berkala dari file backup database mingguan ke server staging.',
    });
    recommendations.push({
      priority: 'RENDAH',
      title: 'Patching Paket Keamanan OS',
      action: 'Jalankan apt update && apt upgrade untuk memperbarui security patch kernel Linux.',
    });
    recommendations.push({
      priority: 'RENDAH',
      title: 'Pemeliharaan Log Telemetri',
      action: 'Pastikan agen pemantau terus mengirimkan sampel secara stabil sesuai jadwal berkala.',
    });
  }

  return {
    overallStatus,
    executiveSummary,
    incidentRca,
    recommendations: recommendations.slice(0, 3),
  };
}
