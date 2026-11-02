// 画面共通の表示部品（お知らせ・一時メッセージ・エラーメッセージ）

import { TimerError } from './timer.js';

let messageTimer = null;

/**
 * 画面下部に一時的なメッセージを表示する
 *
 * @param {string} text
 * @param {{ok?: boolean}} [options] ok が true なら成功の色で表示する
 */
export function showMessage(text, { ok = false } = {}) {
  const el = document.getElementById('message');
  el.textContent = text;
  el.dataset.ok = String(ok);
  el.hidden = false;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => {
    el.hidden = true;
  }, 4000);
}

/** 画面内のお知らせ欄に文章を表示する */
export function showNotice(text) {
  const el = document.getElementById('notice');
  el.textContent = text;
  el.hidden = false;
}

/** Firebase が未設定のときの案内文 */
export const NOT_CONFIGURED_MESSAGE = 'Firebase が未設定です。README の「Firebase の設定」を参照してください。';

/** エラーを利用者向けのメッセージに変換する */
export function errorMessage(err) {
  if (err instanceof TimerError) return err.message;
  if (String(err?.code ?? err?.message).toLowerCase().includes('permission')) {
    return '書き込みが拒否されました。時間をおいて再度お試しください';
  }
  return `エラーが発生しました（${err?.code ?? err?.message ?? err}）`;
}

/** URL のクエリ文字列から id を取り出す */
export function idFromLocation() {
  return new URLSearchParams(location.search).get('id') ?? '';
}

/** 文字列をクリップボードにコピーし、結果をメッセージで知らせる */
export async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    showMessage(`${label}をコピーしました`, { ok: true });
  } catch {
    // クリップボードが使えない環境では選択できる形で表示する
    window.prompt(`${label}をコピーしてください`, text);
  }
}
