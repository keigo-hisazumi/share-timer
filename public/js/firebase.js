// Firebase の初期化（アプリ本体と Realtime Database）
//
// SDK は CDN（gstatic）から ES Modules として読み込むため、npm パッケージへの依存はない。

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  get,
  getDatabase,
  limitToLast,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';

import config from './config.js';

/** Firebase の設定が埋め込まれているか */
export const isConfigured = Boolean(config.firebase);

/** タイマーのデータを保存するデータベース上の起点（本番は空。PR プレビューでは previews/pr-<番号>） */
export const dataRoot = config.dataRoot;

export const app = isConfigured ? initializeApp(config.firebase) : null;
export const db = app ? getDatabase(app) : null;

/** 起点からの相対パスをデータベース上のパスに変換する */
export function dataPath(path) {
  return dataRoot ? `${dataRoot}/${path}` : path;
}

/** 起点の参照（複数のパスをまとめて書き込むときに使う） */
export function rootRef() {
  return dataRoot ? ref(db, dataRoot) : ref(db);
}

export { get, limitToLast, onValue, orderByChild, push, query, ref, remove, serverTimestamp, set, update };
