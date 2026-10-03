// Firebase Realtime Database との状態同期・時刻同期を行うモジュール

import { db, onValue, ref, timerPath } from './firebase.js';
import { remainingAt } from './format.js';
import { parseState } from './timer.js';

/**
 * タイマーの状態をデータベースと同期する
 *
 * @param {object} handlers
 * @param {(state: object) => void} [handlers.onState] 状態が更新されたとき
 * @param {(connected: boolean) => void} [handlers.onConnection] 接続状態が変わったとき
 * @param {(error: Error) => void} [handlers.onError] 読み込みに失敗したとき
 */
export function connectTimer({ onState = () => {}, onConnection = () => {}, onError = () => {} } = {}) {
  // Firebase が計測した「サーバー時刻 - 端末時刻」の差。端末の時計がずれていても補正できる
  let offset = 0;
  let state = null;

  onValue(ref(db, '.info/serverTimeOffset'), (snapshot) => {
    offset = snapshot.val() ?? 0;
  });
  onValue(ref(db, '.info/connected'), (snapshot) => {
    onConnection(snapshot.val() === true);
  });
  onValue(
    ref(db, timerPath),
    (snapshot) => {
      state = parseState(snapshot.val());
      onState(state);
    },
    onError,
  );

  const serverNow = () => Date.now() + offset;

  return {
    /** 最新の状態（未受信なら null） */
    getState: () => state,
    /** 推定サーバー時刻 */
    serverNow,
    /** 現在の残り時間（未受信なら null） */
    getRemainingMs: () => (state ? remainingAt(state, serverNow()) : null),
  };
}
