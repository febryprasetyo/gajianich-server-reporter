import { queryDb } from '../config/db.js';

export interface AggregatedWeeklyMetrics {
  server: {
    id: number;
    code: string;
    name: string;
    ipAddress: string;
    specs: string;
    os: string;
    serverType: string;
    provider: string;
    location: string;
    environment: string;
    roleBadge: string;
    uptimeSeconds: number;
    uptimeFormatted: string;
  };
  period: {
    week: string;
    startDate: string;
    endDate: string;
  };
  metrics: {
    avgCpuPct: number;
    peakCpuPct: number;
    avgRamPct: number;
    peakRamPct: number;
    startDiskPct: number;
    endDiskPct: number;
    diskGrowthPct: number;
    avgLoad1m: number;
    avgNetRxBps: number;
    avgNetTxBps: number;
    sampleCount: number;
  };
  services: Array<{
    name: string;
    category: string;
    status: string;
    restarts: number;
    uptime: string;
  }>;
  security: {
    failedSshCount: number;
    fail2banBannedIps: number;
    sslDaysRemaining: number;
    ufwStatus: string;
  };
  backups: Array<{
    dbName: string;
    status: string;
    sizeMb: number;
    completedAt: string;
  }>;
}

function getIsoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return '0 hari 0 jam';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${days} hari ${hours} jam ${mins} menit`;
}

export async function aggregateWeeklyData(serverIdentifier: string | number): Promise<AggregatedWeeklyMetrics> {
  const isNumeric = typeof serverIdentifier === 'number' || /^\d+$/.test(String(serverIdentifier).trim());

  const serverRows = await queryDb(
    `SELECT 
      id, hostname, name, ip_address, storage_spec as specs, os,
      server_type, provider, location, environment, role_badge,
      uptime_seconds, cpu_usage_pct, ram_usage_pct, disk_usage_pct,
      ssl_days_remaining, ufw_status, fail2ban_banned_ips, failed_ssh_count,
      unified_services
    FROM servers
    WHERE ${isNumeric ? 'id = $1' : 'hostname = $1 OR name = $1'}
    LIMIT 1`,
    [serverIdentifier]
  );

  if (!serverRows || serverRows.length === 0) {
    throw new Error(`Server tidak ditemukan dengan identifier: ${serverIdentifier}`);
  }

  const s = serverRows[0];
  const serverId = Number(s.id);

  const now = new Date();
  const endDateStr = now.toISOString().split('T')[0];
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startDateStr = sevenDaysAgo.toISOString().split('T')[0];
  const periodWeek = getIsoWeek(now);

  let aggRows = await queryDb(
    `SELECT 
      COUNT(*) as sample_count,
      COALESCE(AVG(CAST(cpu_usage_pct AS numeric)), 0) as avg_cpu,
      COALESCE(MAX(CAST(cpu_usage_pct AS numeric)), 0) as peak_cpu,
      COALESCE(AVG(CAST(ram_usage_pct AS numeric)), 0) as avg_ram,
      COALESCE(MAX(CAST(ram_usage_pct AS numeric)), 0) as peak_ram,
      COALESCE(AVG(CAST(load_avg_1m AS numeric)), 0) as avg_load,
      COALESCE(AVG(CAST(disk_usage_pct AS numeric)), 0) as avg_disk,
      COALESCE(AVG(net_rx_bps), 0) as avg_rx,
      COALESCE(AVG(net_tx_bps), 0) as avg_tx
    FROM server_metric_samples
    WHERE server_id = $1 AND recorded_at >= NOW() - INTERVAL '7 days'`,
    [serverId]
  );

  let agg = aggRows[0] || {};
  let sampleCount = Number(agg.sample_count) || 0;
  let sampleWindowMax: Date | null = null;

  // If no samples in strict calendar 7-days, inspect latest available recorded window
  if (sampleCount === 0) {
    const latestWindowRows = await queryDb(
      `SELECT MAX(recorded_at) as latest FROM server_metric_samples WHERE server_id = $1`,
      [serverId]
    );
    if (latestWindowRows[0]?.latest) {
      sampleWindowMax = new Date(latestWindowRows[0].latest);
      aggRows = await queryDb(
        `SELECT 
          COUNT(*) as sample_count,
          COALESCE(AVG(CAST(cpu_usage_pct AS numeric)), 0) as avg_cpu,
          COALESCE(MAX(CAST(cpu_usage_pct AS numeric)), 0) as peak_cpu,
          COALESCE(AVG(CAST(ram_usage_pct AS numeric)), 0) as avg_ram,
          COALESCE(MAX(CAST(ram_usage_pct AS numeric)), 0) as peak_ram,
          COALESCE(AVG(CAST(load_avg_1m AS numeric)), 0) as avg_load,
          COALESCE(AVG(CAST(disk_usage_pct AS numeric)), 0) as avg_disk,
          COALESCE(AVG(net_rx_bps), 0) as avg_rx,
          COALESCE(AVG(net_tx_bps), 0) as avg_tx
        FROM server_metric_samples
        WHERE server_id = $1 AND recorded_at >= $2::timestamp - INTERVAL '7 days' AND recorded_at <= $2::timestamp`,
        [serverId, sampleWindowMax.toISOString()]
      );
      agg = aggRows[0] || {};
      sampleCount = Number(agg.sample_count) || 0;
    }
  }

  let avgCpuPct = Number(Number(agg.avg_cpu || 0).toFixed(1));
  let peakCpuPct = Number(Number(agg.peak_cpu || 0).toFixed(1));
  let avgRamPct = Number(Number(agg.avg_ram || 0).toFixed(1));
  let peakRamPct = Number(Number(agg.peak_ram || 0).toFixed(1));
  let avgLoad1m = Number(Number(agg.avg_load || 0).toFixed(2));
  let avgNetRxBps = Number(Number(agg.avg_rx || 0).toFixed(0));
  let avgNetTxBps = Number(Number(agg.avg_tx || 0).toFixed(0));

  let startDiskPct = 0;
  let endDiskPct = 0;

  if (sampleCount > 0) {
    const whereClause = sampleWindowMax
      ? `server_id = $1 AND recorded_at >= '${new Date(sampleWindowMax.getTime() - 7 * 86400000).toISOString()}'::timestamp AND recorded_at <= '${sampleWindowMax.toISOString()}'::timestamp`
      : `server_id = $1 AND recorded_at >= NOW() - INTERVAL '7 days'`;

    const startDiskRows = await queryDb(
      `SELECT CAST(disk_usage_pct AS numeric) as disk_pct
       FROM server_metric_samples
       WHERE ${whereClause}
       ORDER BY recorded_at ASC LIMIT 1`,
      [serverId]
    );
    const endDiskRows = await queryDb(
      `SELECT CAST(disk_usage_pct AS numeric) as disk_pct
       FROM server_metric_samples
       WHERE ${whereClause}
       ORDER BY recorded_at DESC LIMIT 1`,
      [serverId]
    );

    startDiskPct = Number(Number(startDiskRows[0]?.disk_pct || 0).toFixed(1));
    endDiskPct = Number(Number(endDiskRows[0]?.disk_pct || 0).toFixed(1));
  } else {
    // If no samples in database at all, extract current real snapshot from server row
    avgCpuPct = Number(parseFloat(String(s.cpu_usage_pct || '0')).toFixed(1));
    peakCpuPct = avgCpuPct;
    avgRamPct = Number(parseFloat(String(s.ram_usage_pct || '0')).toFixed(1));
    peakRamPct = avgRamPct;
    startDiskPct = Number(parseFloat(String(s.disk_usage_pct || '0')).toFixed(1));
    endDiskPct = startDiskPct;
  }

  const diskGrowthPct = Number((endDiskPct - startDiskPct).toFixed(1));

  let unifiedServices: any[] = [];
  try {
    unifiedServices = typeof s.unified_services === 'string'
      ? JSON.parse(s.unified_services)
      : (s.unified_services || []);
  } catch {
    unifiedServices = [];
  }

  const services = Array.isArray(unifiedServices)
    ? unifiedServices.map((svc: any) => ({
        name: svc.name || svc.id || 'Unknown',
        category: svc.category || 'native',
        status: svc.status || 'active',
        restarts: Number(svc.restarts) || 0,
        uptime: svc.uptime || '-',
      }))
    : [];

  const backupRows = await queryDb(
    `SELECT db_name, size_mb, status, completed_at
     FROM db_backups
     WHERE server_id = $1 AND completed_at >= NOW() - INTERVAL '7 days'
     ORDER BY completed_at DESC LIMIT 10`,
    [serverId]
  );

  const backups = backupRows.map((b: any) => ({
    dbName: b.db_name || 'accurate_pos',
    status: b.status || 'Success',
    sizeMb: Number(parseFloat(String(b.size_mb || '0')).toFixed(1)),
    completedAt: b.completed_at ? new Date(b.completed_at).toISOString() : '',
  }));

  return {
    server: {
      id: serverId,
      code: s.hostname || 'srv-unknown',
      name: s.name || s.hostname || 'Server',
      ipAddress: s.ip_address || '127.0.0.1',
      specs: s.specs || 'N/A',
      os: s.os || 'Linux',
      serverType: s.server_type || 'Physical',
      provider: s.provider || 'On-Premise',
      location: s.location || 'Local Data Center',
      environment: s.environment || 'Production',
      roleBadge: s.role_badge || 'ACTIVE HOST',
      uptimeSeconds: Number(s.uptime_seconds) || 0,
      uptimeFormatted: formatUptime(Number(s.uptime_seconds) || 0),
    },
    period: {
      week: periodWeek,
      startDate: startDateStr,
      endDate: endDateStr,
    },
    metrics: {
      avgCpuPct,
      peakCpuPct,
      avgRamPct,
      peakRamPct,
      startDiskPct,
      endDiskPct,
      diskGrowthPct,
      avgLoad1m,
      avgNetRxBps,
      avgNetTxBps,
      sampleCount,
    },
    services,
    security: {
      failedSshCount: Number(s.failed_ssh_count) || 0,
      fail2banBannedIps: Number(s.fail2ban_banned_ips) || 0,
      sslDaysRemaining: Number(s.ssl_days_remaining) || 90,
      ufwStatus: s.ufw_status || 'Active',
    },
    backups,
  };
}
