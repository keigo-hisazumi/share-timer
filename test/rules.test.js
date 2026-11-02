// database.rules.json の整合性テスト

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { MANAGE_ID_ALPHABET, VIEW_ID_ALPHABET, createManageId, createViewId } from '../public/js/ids.js';
import { MAX_TITLE_LENGTH } from '../public/js/timer.js';

const { rules } = JSON.parse(readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8'));

/** RTDB のルールに書かれた正規表現を取り出す */
function rulePattern(rule) {
  return new RegExp(rule.match(/matches\(\/(.+?)\/\)/)[1]);
}

describe('database.rules.json', () => {
  it('PR プレビューのルールは本番と同じ内容になっている', () => {
    for (const key of ['timers', 'views', 'manage']) {
      assert.deepEqual(rules.previews.$preview[key], rules[key], `${key} のルールが本番と異なります`);
    }
  });

  it('ID の形式がクライアントの生成する ID と一致する', () => {
    const viewPattern = rulePattern(rules.views.$viewId['.validate']);
    const managePattern = rulePattern(rules.manage.$manageId['.validate']);
    for (let i = 0; i < 100; i++) {
      assert.match(createViewId(), viewPattern);
      assert.match(createManageId(), managePattern);
    }
    // 文字種のすべての文字を受け付ける
    assert.match(VIEW_ID_ALPHABET.slice(0, 8), viewPattern);
    assert.match(MANAGE_ID_ALPHABET.slice(-20), managePattern);
  });

  it('タイトルの最大文字数がクライアントと一致する', () => {
    assert.ok(rules.timers.$viewId.title['.validate'].includes(`length <= ${MAX_TITLE_LENGTH}`));
  });
});
