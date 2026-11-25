import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const PORT = Number(process.env.REPORTER_PORT || 5055);
const HOST = process.env.REPORTER_HOST || '0.0.0.0';
const ROOT_DIR = path.resolve(__dirname, '..');

function sendJson(res: http.ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(res, 200, { ok: true, service: 'gajianich-server-reporter' });
  }

  if (req.method === 'POST' && req.url === '/generate') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 64 * 1024) {
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const args: string[] = [];

        if (parsed?.scope === 'CLUSTER' || parsed?.cluster === true) {
          args.push('--cluster');
        } else if (parsed?.serverId !== undefined && parsed?.serverId !== null && String(parsed.serverId).trim() !== '') {
          args.push(`--server=${String(parsed.serverId).trim()}`);
        }

        const distCli = path.join(ROOT_DIR, 'dist', 'cli.js');
        const srcCli = path.join(ROOT_DIR, 'src', 'cli.ts');
        const tsxBin = path.join(ROOT_DIR, 'node_modules', '.bin', 'tsx');

        const useDist = fs.existsSync(distCli);
        const runner = useDist ? 'node' : tsxBin;
        const target = useDist ? distCli : srcCli;

        if (!fs.existsSync(target)) {
          return sendJson(res, 500, { success: false, message: 'Reporter CLI entry not found' });
        }

        const child = spawn(runner, [target, ...args], {
          cwd: ROOT_DIR,
          stdio: ['ignore', 'inherit', 'inherit'],
        });

        child.on('error', (err) => {
          console.error('[Reporter Service] Failed to spawn CLI:', err.message);
        });

        return sendJson(res, 202, {
          success: true,
          message: 'Proses generate laporan mingguan telah dimulai di latar belakang.',
          args,
        });
      } catch (err: any) {
        return sendJson(res, 400, { success: false, message: err?.message || 'Invalid JSON payload' });
      }
    });
    return;
  }

  return sendJson(res, 404, { success: false, message: 'Not Found' });
});

server.listen(PORT, HOST, () => {
  console.log(`[GAJIANICH Reporter Service] Listening on http://${HOST}:${PORT}`);
});
