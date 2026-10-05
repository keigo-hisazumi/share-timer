// dist/ を配信するローカル確認用の静的ファイルサーバー

import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT ?? 3000);

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
};

async function resolveFile(pathname) {
  const filePath = path.join(distDir, decodeURIComponent(pathname));
  // dist/ の外へのアクセスを防ぐ
  if (!filePath.startsWith(distDir)) return null;
  try {
    const info = await stat(filePath);
    return info.isDirectory() ? path.join(filePath, 'index.html') : filePath;
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const filePath = await resolveFile(pathname);
  try {
    if (!filePath) throw new Error('not found');
    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ページが見つかりません');
  }
});

server.listen(port, () => {
  console.log(`タイマー画面: http://localhost:${port}/`);
  console.log(`管理画面:     http://localhost:${port}/admin/`);
});
