// Firebase の初期化（アプリ本体と Realtime Database）
//
// SDK は CDN（gstatic）から ES Modules として読み込むため、npm パッケージへの依存はない。

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  get,
  getDatabase,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';

import config from './config.js';

/** Firebase の設定が埋め込まれているか */
export const isConfigured = Boolean(config.firebase);

/** タイマーの状態を保存するデータベース上のパス（PR プレビューでは本番と分ける） */
export const timerPath = config.timerPath;

export const app = isConfigured ? initializeApp(config.firebase) : null;
export const db = app ? getDatabase(app) : null;

export { get, onValue, push, ref, remove, runTransaction, serverTimestamp, set };
