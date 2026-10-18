// 表示用の純粋関数（ブラウザとテストの両方から読み込む）

/**
 * サーバー時刻における残り時間（ミリ秒）を返す
 */
export function remainingAt(state, serverNow) {
  if (state.status === 'running') {
    return Math.max(0, state.endsAt - serverNow);
  }
  return state.remainingMs;
}

/**
 * ミリ秒を「MM:SS」または「H:MM:SS」形式に整形する
 *
 * カウントダウンの慣例に合わせ、端数の秒は切り上げる（残り 0.3 秒なら 00:01）
 */
export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * 時・分・秒の入力値をミリ秒に変換する
 */
export function toDurationMs(hours, minutes, seconds) {
  return ((Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60 + (Number(seconds) || 0)) * 1000;
}
