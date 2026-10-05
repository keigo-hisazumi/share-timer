// Firebase のウェブアプリ設定（文字列）を解釈する
//
// JSON に加えて、Firebase コンソールからそのまま貼り付けた JavaScript スニペット
//   const firebaseConfig = { apiKey: "...", ... };
// の形式も受け付ける（キーにクォートがない・シングルクォート・末尾カンマ・行コメントを許容）

/** Realtime Database を使うために必須の設定項目 */
export const REQUIRED_KEYS = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId'];

/** 1 文字のエスケープシーケンスと対応する文字 */
const SIMPLE_ESCAPES = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' };

/**
 * JavaScript の文字列リテラルの中身（クォートを除いた部分）のエスケープを解釈する
 * @param {string} body
 * @returns {string}
 */
function unescapeJsString(body) {
  return body.replace(/\\(?:u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|([\s\S]))/g, (_, unicode, hex, char) => {
    if (unicode) return String.fromCharCode(parseInt(unicode, 16));
    if (hex) return String.fromCharCode(parseInt(hex, 16));
    return SIMPLE_ESCAPES[char] ?? char;
  });
}

/**
 * JavaScript のオブジェクトリテラルを JSON 文字列に変換する
 * 文字列リテラルの中身（URL の // など）は書き換えない
 * @param {string} text
 * @returns {string}
 */
function objectLiteralToJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end < start) throw new Error('オブジェクトが見つかりません');

  const source = text.slice(start, end + 1);
  // 文字列・行コメント・ブロックコメント・識別子・その他の 1 文字に分割して処理する
  const tokenPattern = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\/\/[^\n]*|\/\*[\s\S]*?\*\/|[A-Za-z_$][\w$]*|[\s\S]/g;
  let out = '';
  for (const [token] of source.matchAll(tokenPattern)) {
    if (token.startsWith('//') || token.startsWith('/*')) continue;
    if (token.startsWith("'")) {
      // シングルクォート文字列のエスケープを解釈し、JSON の文字列として出力し直す
      out += JSON.stringify(unescapeJsString(token.slice(1, -1)));
    } else if (/^[A-Za-z_$]/.test(token) && !['true', 'false', 'null'].includes(token)) {
      // クォートのないキーをクォートする
      out += `"${token}"`;
    } else {
      out += token;
    }
  }
  // 末尾カンマを取り除く
  return out.replace(/,(\s*[}\]])/g, '$1');
}

/**
 * Firebase の設定文字列を解釈し、必須項目を検証する
 * @param {string} text 設定（JSON または JavaScript スニペット）
 * @param {string} source エラーメッセージに表示する読み込み元
 * @returns {Record<string, string>}
 */
export function parseFirebaseConfig(text, source) {
  let config;
  try {
    config = JSON.parse(text);
  } catch {
    try {
      config = JSON.parse(objectLiteralToJson(text));
    } catch {
      throw new Error(`${source} が JSON（または Firebase コンソールの設定スニペット）として読み込めません`);
    }
  }
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`${source} はオブジェクト形式で指定してください`);
  }
  const missing = REQUIRED_KEYS.filter((key) => typeof config[key] !== 'string' || !config[key]);
  if (missing.length > 0) {
    throw new Error(`${source} に必須の項目がありません: ${missing.join(', ')}`);
  }
  return config;
}
