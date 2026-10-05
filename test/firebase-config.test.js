import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseFirebaseConfig } from '../scripts/firebase-config.js';

const expected = {
  apiKey: 'test-api-key',
  authDomain: 'example.firebaseapp.com',
  databaseURL: 'https://example-default-rtdb.firebaseio.com',
  projectId: 'example',
  storageBucket: 'example.firebasestorage.app',
  messagingSenderId: '1234567890',
  appId: '1:1234567890:web:abcdef',
};

describe('parseFirebaseConfig', () => {
  it('JSON 形式を読み込める', () => {
    assert.deepEqual(parseFirebaseConfig(JSON.stringify(expected), 'test'), expected);
  });

  it('Firebase コンソールの JavaScript スニペット形式を読み込める', () => {
    const snippet = `// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "test-api-key",
  authDomain: "example.firebaseapp.com",
  databaseURL: "https://example-default-rtdb.firebaseio.com",
  projectId: "example",
  storageBucket: "example.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};`;
    assert.deepEqual(parseFirebaseConfig(snippet, 'test'), expected);
  });

  it('シングルクォート・末尾カンマ・コメントを許容する', () => {
    const snippet = `{
  apiKey: 'test-api-key', // コメント
  authDomain: 'example.firebaseapp.com',
  /* ブロックコメント */
  databaseURL: 'https://example-default-rtdb.firebaseio.com',
  projectId: 'example',
  storageBucket: 'example.firebasestorage.app',
  messagingSenderId: '1234567890',
  appId: '1:1234567890:web:abcdef',
}`;
    assert.deepEqual(parseFirebaseConfig(snippet, 'test'), expected);
  });

  it('解釈できない文字列はエラーにする', () => {
    assert.throws(() => parseFirebaseConfig('not a config', 'test'), /読み込めません/);
    assert.throws(() => parseFirebaseConfig('[1, 2]', 'test'), /オブジェクト形式/);
  });

  it('必須項目が欠けている場合はエラーにする', () => {
    const { appId, ...rest } = expected;
    assert.throws(() => parseFirebaseConfig(JSON.stringify(rest), 'test'), /appId/);
  });
});
