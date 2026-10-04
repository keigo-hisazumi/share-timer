import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatDuration, remainingAt, toDurationMs } from '../public/js/format.js';

describe('formatDuration', () => {
  it('1 時間未満は MM:SS で表示する', () => {
    assert.equal(formatDuration(0), '00:00');
    assert.equal(formatDuration(5 * 60 * 1000), '05:00');
    assert.equal(formatDuration(59 * 60 * 1000 + 59 * 1000), '59:59');
  });

  it('1 時間以上は H:MM:SS で表示する', () => {
    assert.equal(formatDuration(3600 * 1000), '1:00:00');
    assert.equal(formatDuration((99 * 3600 + 59 * 60 + 59) * 1000), '99:59:59');
  });

  it('端数の秒は切り上げる', () => {
    assert.equal(formatDuration(300), '00:01');
    assert.equal(formatDuration(9_001), '00:10');
    assert.equal(formatDuration(-5), '00:00');
  });
});

describe('remainingAt', () => {
  it('計測中は終了予定時刻から計算する', () => {
    assert.equal(remainingAt({ status: 'running', endsAt: 10_000, remainingMs: 10_000 }, 4_000), 6_000);
    assert.equal(remainingAt({ status: 'running', endsAt: 10_000, remainingMs: 10_000 }, 12_000), 0);
    assert.equal(remainingAt({ status: 'paused', endsAt: null, remainingMs: 3_000 }, 99_000), 3_000);
  });
});

describe('toDurationMs', () => {
  it('時・分・秒をミリ秒に変換する', () => {
    assert.equal(toDurationMs('1', '2', '3'), 3_723_000);
    assert.equal(toDurationMs('', '5', ''), 300_000);
  });
});
