// サーバーとの時刻差の推定を扱う純粋関数群（ブラウザとテストの両方から読み込む）
//
// Firebase の .info/serverTimeOffset は接続時のハンドシェイク 1 回分だけで計算され、
// 通信遅延やページ読み込み中の処理待ちがそのまま誤差になる（再接続まで更新もされない）。
// そのため端末ごとに数秒ずれることがあり、再読み込みした画面だけ表示がずれる原因になる。
// ここでは NTP と同じ考え方で、往復時間が分かっている計測から時刻差を推定する。

/**
 * 1 回の計測結果から時刻差と往復時間を求める
 *
 * サーバー時刻は送信から応答までの間のどこかで記録されるため、その中間とみなす。
 * 誤差は最大でも往復時間の半分になる。
 *
 * @param {{sentAt: number, receivedAt: number, serverTime: number}} sample
 *   sentAt / receivedAt は端末時刻、serverTime はサーバーが記録した時刻（いずれもエポックミリ秒）
 * @returns {{offset: number, rtt: number}} offset は「サーバー時刻 - 端末時刻」
 */
export function offsetFromSample({ sentAt, receivedAt, serverTime }) {
  return {
    offset: serverTime - (sentAt + receivedAt) / 2,
    rtt: receivedAt - sentAt,
  };
}

/**
 * 複数の計測結果から最も信頼できる時刻差を選ぶ
 *
 * 往復時間が短いほど誤差の上限が小さいため、往復時間が最短の計測を採用する。
 * 不正な計測（数値でない・往復時間が負）は無視し、有効な計測がなければ null を返す。
 */
export function pickBestOffset(samples) {
  let best = null;
  for (const sample of samples) {
    if (![sample?.sentAt, sample?.receivedAt, sample?.serverTime].every(Number.isFinite)) continue;
    const result = offsetFromSample(sample);
    if (result.rtt < 0) continue;
    if (!best || result.rtt < best.rtt) best = result;
  }
  return best;
}
