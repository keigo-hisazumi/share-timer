// 同期カウントダウンタイマーの HTTP サーバー
//
// 外部依存なしで Node.js 標準モジュールのみを使用する。
// - 閲覧者には Server-Sent Events（SSE）で状態変更をリアルタイム配信する
// - 管理操作は管理パスワード付きの POST /api/control でのみ受け付ける

import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TimerError, applyAction, createInitialState, isValidState, normalize } from './timer.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

/** 配信する静的ファイルの一覧（パストラバーサルを防ぐため明示的に列挙する） */
const STATIC_FILES = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/admin': { file: 'admin.html', type: 'text/html; charset=utf-8' },
  '/css/style.css': { file: 'css/style.css', type: 'text/css; charset=utf-8' },
  '/js/format.js': { file: 'js/format.js', type: 'text/javascript; charset=utf-8' },
  '/js/sync.js': { file: 'js/sync.js', type: 'text/javascript; charset=utf-8' },
  '/js/viewer.js': { file: 'js/viewer.js', type: 'text/javascript; charset=utf-8' },
  '/js/admin.js': { file: 'js/admin.js', type: 'text/javascript; charset=utf-8' },
  '/favicon.svg': { file: 'favicon.svg', type: 'image/svg+xml' },
};

const MAX_BODY_BYTES = 1024;
const HEARTBEAT_INTERVAL_MS = 20_000;

/** 認証失敗の回数制限（総当たり対策） */
const AUTH_FAILURE_LIMIT = 10;
const AUTH_FAILURE_WINDOW_MS = 10 * 60 * 1000;

const COMMON_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
};

function sha256(value) {
  return createHash('sha256').update(value).digest();
}

/**
 * 永続化ファイルから状態を読み込む（存在しない・壊れている場合は null）
 */
function loadState(dataFile) {
  if (!dataFile) return null;
  try {
    const value = JSON.parse(readFileSync(dataFile, 'utf8'));
    return isValidState(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * 状態をファイルへ保存する（一時ファイル経由で書き込み、途中で落ちても壊れないようにする）
 */
function saveState(dataFile, state) {
  if (!dataFile) return;
  try {
    mkdirSync(path.dirname(dataFile), { recursive: true });
    const tmp = `${dataFile}.tmp`;
    writeFileSync(tmp, JSON.stringify(state));
    renameSync(tmp, dataFile);
  } catch (err) {
    console.error('状態の保存に失敗しました:', err);
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    ...COMMON_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new TimerError('リクエストが大きすぎます'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * タイマーサーバーを生成する
 *
 * @param {object} options
 * @param {string} options.adminPassword 管理操作用のパスワード
 * @param {string|null} [options.dataFile] 状態を永続化するファイルパス（null なら永続化しない）
 * @param {() => number} [options.now] 現在時刻を返す関数（テスト用）
 */
export function createTimerServer({ adminPassword, dataFile = null, now = Date.now }) {
  if (!adminPassword) {
    throw new Error('adminPassword を指定してください');
  }
  const passwordHash = sha256(adminPassword);

  let state = loadState(dataFile) ?? createInitialState();
  /** @type {Set<http.ServerResponse>} SSE で接続中のクライアント */
  const clients = new Set();
  /** @type {Map<string, {count: number, resetAt: number}>} */
  const authFailures = new Map();
  let finishTimer = null;

  function snapshot() {
    return { state, serverNow: now() };
  }

  function broadcast() {
    const payload = `event: state\ndata: ${JSON.stringify(snapshot())}\n\n`;
    for (const client of clients) {
      client.write(payload);
    }
  }

  // 終了予定時刻に finished への遷移を全員へ通知する
  function scheduleFinish() {
    clearTimeout(finishTimer);
    finishTimer = null;
    if (state.status !== 'running') return;
    // setTimeout の上限（約 24.8 日）を超えないよう分割して待つ
    const delay = Math.min(Math.max(0, state.endsAt - now()), 2 ** 31 - 1);
    finishTimer = setTimeout(() => {
      updateState(normalize(state, now()));
    }, delay);
    finishTimer.unref?.();
  }

  function updateState(next) {
    const changed = next !== state;
    state = next;
    scheduleFinish();
    if (changed) {
      saveState(dataFile, state);
      broadcast();
    }
  }

  function isRateLimited(ip) {
    const entry = authFailures.get(ip);
    if (!entry) return false;
    if (now() >= entry.resetAt) {
      authFailures.delete(ip);
      return false;
    }
    return entry.count >= AUTH_FAILURE_LIMIT;
  }

  function recordAuthFailure(ip) {
    const entry = authFailures.get(ip);
    if (!entry || now() >= entry.resetAt) {
      authFailures.set(ip, { count: 1, resetAt: now() + AUTH_FAILURE_WINDOW_MS });
    } else {
      entry.count += 1;
    }
  }

  function isAuthorized(req) {
    const header = req.headers.authorization ?? '';
    const match = /^Bearer (.+)$/.exec(header);
    if (!match) return false;
    return timingSafeEqual(sha256(match[1]), passwordHash);
  }

  /**
   * 認証を確認し、失敗した場合はエラーレスポンスを返して false を返す
   */
  function authenticate(req, res) {
    const ip = req.socket.remoteAddress ?? 'unknown';
    if (isRateLimited(ip)) {
      sendJson(res, 429, { error: '認証の失敗が多すぎます。しばらく待ってから再度お試しください' });
      return false;
    }
    if (!isAuthorized(req)) {
      recordAuthFailure(ip);
      sendJson(res, 401, { error: 'パスワードが正しくありません' });
      return false;
    }
    authFailures.delete(ip);
    return true;
  }

  async function handleControl(req, res) {
    if (!authenticate(req, res)) return;

    let action;
    try {
      action = JSON.parse(await readBody(req));
    } catch (err) {
      const message = err instanceof TimerError ? err.message : 'リクエストの形式が不正です';
      sendJson(res, 400, { error: message });
      return;
    }

    try {
      updateState(applyAction(state, action, now()));
    } catch (err) {
      if (err instanceof TimerError) {
        sendJson(res, 400, { error: err.message });
        return;
      }
      throw err;
    }
    sendJson(res, 200, snapshot());
  }

  function handleEvents(req, res) {
    res.writeHead(200, {
      ...COMMON_HEADERS,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      // リバースプロキシ（nginx 等）でのバッファリングを無効化する
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 2000\n\n');
    res.write(`event: state\ndata: ${JSON.stringify(snapshot())}\n\n`);
    clients.add(res);

    const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_INTERVAL_MS);
    req.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(res);
    });
  }

  async function handleStatic(res, entry) {
    try {
      const body = await readFile(path.join(PUBLIC_DIR, entry.file));
      res.writeHead(200, {
        ...COMMON_HEADERS,
        'Content-Type': entry.type,
        'Cache-Control': 'no-cache',
      });
      res.end(body);
    } catch {
      sendJson(res, 500, { error: 'ファイルの読み込みに失敗しました' });
    }
  }

  async function handleRequest(req, res) {
    const { pathname } = new URL(req.url, 'http://localhost');
    const method = req.method;

    if (pathname === '/api/events' && method === 'GET') {
      handleEvents(req, res);
      return;
    }
    if (pathname === '/api/state' && method === 'GET') {
      sendJson(res, 200, snapshot());
      return;
    }
    if (pathname === '/api/time' && method === 'GET') {
      sendJson(res, 200, { serverNow: now() });
      return;
    }
    if (pathname === '/api/auth') {
      if (method !== 'POST') {
        sendJson(res, 405, { error: 'POST で送信してください' });
        return;
      }
      // 管理画面のログイン時にパスワードを確認するためのエンドポイント
      if (authenticate(req, res)) sendJson(res, 200, { ok: true });
      return;
    }
    if (pathname === '/api/control') {
      if (method !== 'POST') {
        sendJson(res, 405, { error: 'POST で送信してください' });
        return;
      }
      await handleControl(req, res);
      return;
    }

    const entry = STATIC_FILES[pathname];
    if (entry && (method === 'GET' || method === 'HEAD')) {
      await handleStatic(res, entry);
      return;
    }
    sendJson(res, 404, { error: 'ページが見つかりません' });
  }

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error(err);
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'サーバーエラーが発生しました' });
      } else {
        res.end();
      }
    });
  });

  // 起動時点で計測中なら終了通知を予約する（永続化からの復帰時など）
  updateState(normalize(state, now()));

  server.on('close', () => {
    clearTimeout(finishTimer);
  });

  return server;
}
