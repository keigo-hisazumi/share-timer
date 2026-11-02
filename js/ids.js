// タイマーの ID を扱う純粋関数群（ブラウザとテストの両方から読み込む）
//
// タイマーごとに 2 種類の ID を発行する。
// - 管理 ID: タイマーを操作するための秘密の ID。知っている人だけが操作できるため、推測できない長さにする
// - 表示 ID: タイマー表示画面を共有するための公開の ID。手入力しやすいよう短くし、紛らわしい文字（0 / 1 / i / l / o）を使わない

/** 管理 ID の文字種（URL にそのまま使える 64 文字） */
export const MANAGE_ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';

/** 管理 ID の長さ（64 文字 × 20 桁 = 120 ビット） */
export const MANAGE_ID_LENGTH = 20;

/** 表示 ID の文字種 */
export const VIEW_ID_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';

/** 表示 ID の長さ */
export const VIEW_ID_LENGTH = 8;

const MANAGE_ID_PATTERN = /^[-_0-9A-Za-z]{20}$/;
const VIEW_ID_PATTERN = /^[2-9a-hjkmnp-z]{8}$/;

/**
 * 指定した文字種からランダムな ID を生成する
 *
 * 偏りが出ないよう、文字種の数の倍数に収まらない乱数は捨てて引き直す。
 *
 * @param {number} length 桁数
 * @param {string} alphabet 文字種（256 文字以下）
 * @param {(bytes: Uint8Array) => Uint8Array} [fillRandom] 乱数で配列を埋める関数（テスト用に差し替え可能）
 */
export function randomId(length, alphabet, fillRandom = (bytes) => crypto.getRandomValues(bytes)) {
  const limit = 256 - (256 % alphabet.length);
  let id = '';
  while (id.length < length) {
    for (const byte of fillRandom(new Uint8Array(length * 2))) {
      if (byte >= limit) continue;
      id += alphabet[byte % alphabet.length];
      if (id.length === length) break;
    }
  }
  return id;
}

/** 管理 ID を新規に生成する */
export function createManageId(fillRandom) {
  return randomId(MANAGE_ID_LENGTH, MANAGE_ID_ALPHABET, fillRandom);
}

/** 表示 ID を新規に生成する */
export function createViewId(fillRandom) {
  return randomId(VIEW_ID_LENGTH, VIEW_ID_ALPHABET, fillRandom);
}

/** 管理 ID の形式として正しいか */
export function isManageId(value) {
  return typeof value === 'string' && MANAGE_ID_PATTERN.test(value);
}

/** 表示 ID の形式として正しいか */
export function isViewId(value) {
  return typeof value === 'string' && VIEW_ID_PATTERN.test(value);
}

/**
 * 入力欄に入力された表示 ID を正規化する（正しくなければ null）
 *
 * 前後の空白・大文字・区切りのハイフンを許容し、表示画面の URL を貼り付けた場合は ?id= の値を取り出す。
 */
export function parseViewIdInput(input) {
  let text = String(input ?? '').trim();
  const fromUrl = text.match(/[?&]id=([^&#]+)/);
  if (fromUrl) text = decodeURIComponent(fromUrl[1]);
  text = text.toLowerCase().replace(/[\s-]/g, '');
  return isViewId(text) ? text : null;
}
