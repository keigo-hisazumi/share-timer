// タイマーの作成・更新（Firebase Realtime Database への書き込み）
//
// データベース上の構成（起点は firebase.js の dataRoot）:
//   timers/{表示 ID}  タイマーの状態とタイトル。誰でも読める（一覧・表示画面用）
//   manage/{管理 ID}  { viewId: 表示 ID, version: 状態のバージョン }。管理 ID を知っている人だけが読み書きできる
//   views/{表示 ID}   管理 ID。誰も読めず、セキュリティルールが持ち主の確認にだけ使う
//
// タイマーを更新するときは timers/{表示 ID} と manage/{管理 ID}/version を同じバージョンで同時に書き込む。
// ルールは views/{表示 ID} が指す管理 ID のバージョンと一致することを確認するため、
// 管理 ID を知らない人はタイマーを書き換えられない（詳しくは database.rules.json）。

import { dataPath, db, get, ref, rootRef, serverTimestamp, update } from './firebase.js';
import { createManageId, createViewId } from './ids.js';
import { applyAction, createInitialState, parseState } from './timer.js';

/** ID の衝突や同時操作で書き込みが拒否されたときにやり直す回数 */
const MAX_ATTEMPTS = 3;

function isPermissionError(err) {
  return String(err?.code ?? err?.message).toLowerCase().includes('permission');
}

/**
 * タイマーを新規作成し、管理 ID と表示 ID を返す
 */
export async function createTimer() {
  const initial = createInitialState();
  // Firebase は null を保存しないため、未開始の状態では endsAt を書き込まない
  delete initial.endsAt;
  let lastError;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const manageId = createManageId();
    const viewId = createViewId();
    try {
      await update(rootRef(), {
        [`views/${viewId}`]: manageId,
        [`manage/${manageId}`]: { viewId, version: initial.version },
        [`timers/${viewId}`]: { ...initial, createdAt: serverTimestamp() },
      });
      return { manageId, viewId };
    } catch (err) {
      // 表示 ID が既存のタイマーと衝突した場合は ID を発行し直す
      if (!isPermissionError(err)) throw err;
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * 管理 ID に対応する表示 ID を返す（存在しなければ null）
 */
export async function findViewId(manageId) {
  const value = (await get(ref(db, dataPath(`manage/${manageId}`)))).val();
  return typeof value?.viewId === 'string' ? value.viewId : null;
}

/**
 * 操作を適用してタイマーを更新する
 *
 * 別の画面と同時に操作して拒否された場合は、最新の状態を読み直してやり直す。
 *
 * @param {string} manageId
 * @param {string} viewId
 * @param {object} action timer.js の applyAction に渡す操作
 * @param {() => number} serverNow 推定サーバー時刻
 */
export async function updateTimer(manageId, viewId, action, serverNow) {
  const timerPath = `timers/${viewId}`;
  const versionPath = `manage/${manageId}/version`;
  let lastError;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const [timerSnapshot, versionSnapshot] = await Promise.all([
      get(ref(db, dataPath(timerPath))),
      get(ref(db, dataPath(versionPath))),
    ]);
    const current = parseState(timerSnapshot.val());
    const next = applyAction(current, action, serverNow());
    if (next === current) return;
    // 管理側のバージョンが先に進んでいても必ず両方より大きい値にそろえる
    const version = Math.max(next.version, (versionSnapshot.val() ?? 0) + 1);
    try {
      await update(rootRef(), {
        [`${timerPath}/title`]: next.title,
        [`${timerPath}/status`]: next.status,
        [`${timerPath}/durationMs`]: next.durationMs,
        [`${timerPath}/remainingMs`]: next.remainingMs,
        [`${timerPath}/endsAt`]: next.endsAt,
        [`${timerPath}/version`]: version,
        [versionPath]: version,
      });
      return;
    } catch (err) {
      if (!isPermissionError(err)) throw err;
      lastError = err;
    }
  }
  throw lastError;
}
