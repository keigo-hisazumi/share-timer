import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MANAGE_ID_LENGTH,
  VIEW_ID_ALPHABET,
  VIEW_ID_LENGTH,
  createManageId,
  createViewId,
  isManageId,
  isViewId,
  parseViewIdInput,
  randomId,
} from '../public/js/ids.js';

describe('ID の生成', () => {
  it('管理 ID は 20 文字で、形式チェックを通る', () => {
    for (let i = 0; i < 100; i++) {
      const id = createManageId();
      assert.equal(id.length, MANAGE_ID_LENGTH);
      assert.ok(isManageId(id), id);
    }
  });

  it('表示 ID は 8 文字で、紛らわしい文字を含まない', () => {
    for (let i = 0; i < 100; i++) {
      const id = createViewId();
      assert.equal(id.length, VIEW_ID_LENGTH);
      assert.ok(isViewId(id), id);
      assert.doesNotMatch(id, /[01ilo]/);
    }
  });

  it('文字種の数の倍数に収まらない乱数は捨てる（偏りを出さない）', () => {
    // 31 文字の場合、248 以上の値は捨てられる
    const bytes = [255, 248, 0, 30, 31, 247];
    const fill = (array) => {
      array.fill(0);
      array.set(bytes.slice(0, array.length));
      return array;
    };
    assert.equal(randomId(4, VIEW_ID_ALPHABET, fill), [0, 30, 0, 247 % 31].map((n) => VIEW_ID_ALPHABET[n]).join(''));
  });
});

describe('ID の形式チェック', () => {
  it('不正な管理 ID を拒否する', () => {
    for (const value of ['', 'short', 'a'.repeat(21), `${'a'.repeat(19)}/`, null, 123]) {
      assert.equal(isManageId(value), false, String(value));
    }
  });

  it('不正な表示 ID を拒否する', () => {
    for (const value of ['', 'abcd234', 'abcd23456', 'ABCD2345', 'abcd2340', 'abcdlio2', null]) {
      assert.equal(isViewId(value), false, String(value));
    }
  });
});

describe('parseViewIdInput', () => {
  it('前後の空白・大文字・ハイフンを許容する', () => {
    assert.equal(parseViewIdInput('  ABCD-2345 '), 'abcd2345');
  });

  it('表示画面の URL から ID を取り出す', () => {
    assert.equal(parseViewIdInput('https://example.com/share-timer/view/?id=abcd2345'), 'abcd2345');
  });

  it('形式が正しくなければ null を返す', () => {
    assert.equal(parseViewIdInput('abc'), null);
    assert.equal(parseViewIdInput(''), null);
    assert.equal(parseViewIdInput(undefined), null);
  });
});
