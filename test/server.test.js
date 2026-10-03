import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { createTimerServer } from '../src/server.js';

const PASSWORD = 'test-password';

/**
 * サーバーを起動してベース URL を返す
 */
async function startServer(options = {}) {
  const server = createTimerServer({ adminPassword: PASSWORD, ...options });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

function stopServer(server) {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
}

function control(baseUrl, body, password = PASSWORD) {
  return fetch(`${baseUrl}/api/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` },
    body: JSON.stringify(body),
  });
}

/**
 * SSE ストリームから state イベントを指定件数読み取る
 */
async function readStateEvents(response, count) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events = [];
  let buffer = '';
  while (events.length < count) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index;
    while ((index = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      if (block.startsWith('event: state\n')) {
        events.push(JSON.parse(block.split('\n')[1].slice('data: '.length)));
      }
    }
  }
  await reader.cancel();
  return events;
}

describe('タイマーサーバー', () => {
  let server;
  let baseUrl;

  before(async () => {
    ({ server, baseUrl } = await startServer());
  });

  after(() => stopServer(server));

  it('トップ画面と管理画面を配信する', async () => {
    const top = await fetch(`${baseUrl}/`);
    assert.equal(top.status, 200);
    assert.match(await top.text(), /id="timer"/);

    const admin = await fetch(`${baseUrl}/admin`);
    assert.equal(admin.status, 200);
    assert.match(await admin.text(), /タイマー管理/);
  });

  it('一覧にないパスは 404 を返す', async () => {
    const res = await fetch(`${baseUrl}/../package.json`);
    assert.equal(res.status, 404);
  });

  it('パスワードなし・誤りの操作は拒否する', async () => {
    const res = await fetch(`${baseUrl}/api/control`, {
      method: 'POST',
      body: JSON.stringify({ type: 'start' }),
    });
    assert.equal(res.status, 401);
    assert.equal((await control(baseUrl, { type: 'start' }, 'wrong')).status, 401);

    const auth = await fetch(`${baseUrl}/api/auth`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${PASSWORD}` },
    });
    assert.equal(auth.status, 200);
  });

  it('不正な操作は 400 を返す', async () => {
    assert.equal((await control(baseUrl, { type: 'set', durationMs: 0 })).status, 400);
    assert.equal((await control(baseUrl, { type: 'unknown' })).status, 400);
  });

  it('操作内容が SSE で閲覧者に配信される', async () => {
    const stream = await fetch(`${baseUrl}/api/events`);
    assert.equal(stream.headers.get('content-type'), 'text/event-stream; charset=utf-8');
    const eventsPromise = readStateEvents(stream, 3);

    const setRes = await control(baseUrl, { type: 'set', durationMs: 120_000 });
    assert.equal(setRes.status, 200);
    const startRes = await control(baseUrl, { type: 'start' });
    assert.equal(startRes.status, 200);

    const [initial, afterSet, afterStart] = await eventsPromise;
    assert.ok(Number.isFinite(initial.serverNow));
    assert.equal(afterSet.state.durationMs, 120_000);
    assert.equal(afterSet.state.status, 'idle');
    assert.equal(afterStart.state.status, 'running');
    assert.ok(afterStart.state.endsAt > afterStart.serverNow);

    const state = await (await fetch(`${baseUrl}/api/state`)).json();
    assert.equal(state.state.status, 'running');
  });
});

describe('永続化と認証制限', () => {
  it('状態をファイルに保存し、再起動後に復元する', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'share-timer-'));
    const dataFile = path.join(dir, 'state.json');
    try {
      const first = await startServer({ dataFile });
      await control(first.baseUrl, { type: 'set', durationMs: 42_000 });
      await stopServer(first.server);
      assert.equal(JSON.parse(readFileSync(dataFile, 'utf8')).durationMs, 42_000);

      const second = await startServer({ dataFile });
      const { state } = await (await fetch(`${second.baseUrl}/api/state`)).json();
      assert.equal(state.durationMs, 42_000);
      await stopServer(second.server);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('認証の失敗が続くと 429 を返す', async () => {
    const { server, baseUrl } = await startServer();
    try {
      for (let i = 0; i < 10; i += 1) {
        assert.equal((await control(baseUrl, { type: 'start' }, 'wrong')).status, 401);
      }
      assert.equal((await control(baseUrl, { type: 'start' })).status, 429);
    } finally {
      await stopServer(server);
    }
  });

  it('終了予定時刻になると finished を配信する', async () => {
    const { server, baseUrl } = await startServer();
    try {
      await control(baseUrl, { type: 'set', durationMs: 1_000 });
      const stream = await fetch(`${baseUrl}/api/events`);
      const eventsPromise = readStateEvents(stream, 3);
      await control(baseUrl, { type: 'start' });
      const events = await eventsPromise;
      assert.equal(events[2].state.status, 'finished');
    } finally {
      await stopServer(server);
    }
  });
});
