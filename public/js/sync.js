// サーバーとの状態同期・時刻同期を行うクライアント側モジュール

import { remainingAt } from './format.js';

const CLOCK_SAMPLES = 5;
const CLOCK_RESYNC_INTERVAL_MS = 60_000;

/**
 * サーバー時刻と端末時刻の差（ミリ秒）を計測する
 *
 * 複数回リクエストし、往復時間（RTT）が最も短いサンプルを採用する（NTP と同様の考え方）
 */
async function measureClockOffset() {
  let best = null;
  for (let i = 0; i < CLOCK_SAMPLES; i += 1) {
    const sentAt = Date.now();
    const res = await fetch('/api/time', { cache: 'no-store' });
    const receivedAt = Date.now();
    if (!res.ok) continue;
    const { serverNow } = await res.json();
    const rtt = receivedAt - sentAt;
    if (!best || rtt < best.rtt) {
      best = { rtt, offset: serverNow + rtt / 2 - receivedAt };
    }
  }
  if (!best) throw new Error('時刻同期に失敗しました');
  return best.offset;
}

/**
 * タイマーの状態をサーバーと同期する
 *
 * @param {object} handlers
 * @param {(state: object) => void} [handlers.onState] 状態が更新されたとき
 * @param {(connected: boolean) => void} [handlers.onConnection] 接続状態が変わったとき
 */
export function connectTimer({ onState = () => {}, onConnection = () => {} } = {}) {
  let offset = 0;
  let state = null;

  async function syncClock() {
    try {
      offset = await measureClockOffset();
    } catch {
      // 失敗した場合は前回の値を使い続け、次回の再同期に任せる
    }
  }
  syncClock();
  setInterval(syncClock, CLOCK_RESYNC_INTERVAL_MS);

  // EventSource は切断されても自動で再接続する
  const source = new EventSource('/api/events');
  source.addEventListener('state', (event) => {
    const data = JSON.parse(event.data);
    state = data.state;
    onState(state);
  });
  source.addEventListener('open', () => {
    onConnection(true);
    syncClock();
  });
  source.addEventListener('error', () => onConnection(false));

  return {
    /** 最新の状態（未受信なら null） */
    getState: () => state,
    /** 推定サーバー時刻 */
    serverNow: () => Date.now() + offset,
    /** 現在の残り時間（未受信なら null） */
    getRemainingMs: () => (state ? remainingAt(state, Date.now() + offset) : null),
  };
}
