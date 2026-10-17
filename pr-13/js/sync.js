// Firebase Realtime Database との状態同期・時刻同期を行うモジュール

import { pickBestOffset } from './clock.js';
import { db, get, onValue, push, ref, remove, serverTimestamp, set, timerPath } from './firebase.js';
import { remainingAt } from './format.js';
import { parseState } from './timer.js';

/** 時刻差の計測で書き込むデータベース上のパス（計測後すぐに削除する） */
const CLOCK_SYNC_PATH = 'clockSync';

/** 1 回の時刻合わせで行う計測の回数（往復時間が最短のものを採用する） */
const CLOCK_SAMPLE_COUNT = 5;

/** 端末の時計の進み・遅れに追従するため、定期的に時刻合わせをやり直す間隔 */
const CLOCK_RESYNC_INTERVAL_MS = 10 * 60 * 1000;

/**
 * サーバー時刻を書き込んで読み戻し、送信・応答時刻とあわせた計測結果を返す
 */
async function measureClock() {
  const sampleRef = push(ref(db, CLOCK_SYNC_PATH));
  const sentAt = Date.now();
  await set(sampleRef, serverTimestamp());
  const receivedAt = Date.now();
  try {
    // get() は購読していないパスならサーバーから取得するため、サーバーが記録した実際の値が得られる
    const serverTime = (await get(sampleRef)).val();
    return { sentAt, receivedAt, serverTime };
  } finally {
    remove(sampleRef).catch(() => {});
  }
}

/**
 * タイマーの状態をデータベースと同期する
 *
 * @param {object} handlers
 * @param {(state: object) => void} [handlers.onState] 状態が更新されたとき
 * @param {(connected: boolean) => void} [handlers.onConnection] 接続状態が変わったとき
 * @param {(error: Error) => void} [handlers.onError] 読み込みに失敗したとき
 */
export function connectTimer({ onState = () => {}, onConnection = () => {}, onError = () => {} } = {}) {
  // 「サーバー時刻 - 端末時刻」の差。端末の時計がずれていても補正できる
  // Firebase の推定値（sdkOffset）は数秒ずれることがあるため、自前の計測値（measuredOffset）があればそちらを使う
  let sdkOffset = 0;
  let measuredOffset = null;
  let state = null;

  let syncing = false;
  let warned = false;
  async function syncClock() {
    if (syncing) return;
    syncing = true;
    const samples = [];
    try {
      for (let i = 0; i < CLOCK_SAMPLE_COUNT; i++) {
        samples.push(await measureClock());
      }
    } catch (err) {
      // ルール未反映などで計測できない場合は Firebase の推定値で動作を続ける
      if (!warned) {
        console.warn('サーバー時刻の計測に失敗しました。Firebase の推定値で補正します', err);
        warned = true;
      }
    } finally {
      syncing = false;
    }
    const best = pickBestOffset(samples);
    if (best) measuredOffset = best.offset;
  }

  onValue(ref(db, '.info/serverTimeOffset'), (snapshot) => {
    sdkOffset = snapshot.val() ?? 0;
  });
  onValue(ref(db, '.info/connected'), (snapshot) => {
    const connected = snapshot.val() === true;
    // 接続（再接続）のたびに時刻を合わせ直す
    if (connected) syncClock();
    onConnection(connected);
  });
  setInterval(syncClock, CLOCK_RESYNC_INTERVAL_MS);
  onValue(
    ref(db, timerPath),
    (snapshot) => {
      state = parseState(snapshot.val());
      onState(state);
    },
    onError,
  );

  const serverNow = () => Date.now() + (measuredOffset ?? sdkOffset);

  return {
    /** 最新の状態（未受信なら null） */
    getState: () => state,
    /** 推定サーバー時刻 */
    serverNow,
    /** 現在の残り時間（未受信なら null） */
    getRemainingMs: () => (state ? remainingAt(state, serverNow()) : null),
  };
}
