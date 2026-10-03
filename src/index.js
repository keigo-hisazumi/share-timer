// サーバーの起動エントリーポイント

import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTimerServer } from './server.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const defaultDataFile = fileURLToPath(new URL('../data/state.json', import.meta.url));
// DATA_FILE に空文字を指定すると永続化を無効にする
const dataFile = process.env.DATA_FILE === '' ? null : path.resolve(process.env.DATA_FILE ?? defaultDataFile);

let adminPassword = process.env.ADMIN_PASSWORD;
if (!adminPassword) {
  // パスワード未設定のまま管理操作を誰でも行える状態にしないよう、起動ごとにランダム生成する
  adminPassword = randomBytes(9).toString('base64url');
  console.warn('ADMIN_PASSWORD が未設定のため、一時的な管理パスワードを生成しました。');
  console.warn(`管理パスワード: ${adminPassword}`);
}

const server = createTimerServer({ adminPassword, dataFile });

server.listen(port, host, () => {
  console.log(`タイマー画面: http://localhost:${port}/`);
  console.log(`管理画面:     http://localhost:${port}/admin`);
});

function shutdown() {
  server.close();
  // SSE の接続が残っていると close が完了しないため強制的に切断する
  server.closeAllConnections();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
