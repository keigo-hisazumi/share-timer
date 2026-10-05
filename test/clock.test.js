import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { offsetFromSample, pickBestOffset } from '../public/js/clock.js';

describe('offsetFromSample', () => {
  it('送信と応答の中間をサーバー時刻とみなして時刻差を求める', () => {
    // 端末の時計がサーバーより 2 秒遅れている場合
    const result = offsetFromSample({ sentAt: 10_000, receivedAt: 10_200, serverTime: 12_100 });
    assert.equal(result.offset, 2_000);
    assert.equal(result.rtt, 200);
  });
});

describe('pickBestOffset', () => {
  it('往復時間が最短の計測を採用する', () => {
    const result = pickBestOffset([
      { sentAt: 0, receivedAt: 3_000, serverTime: 3_500 },
      { sentAt: 5_000, receivedAt: 5_100, serverTime: 6_050 },
      { sentAt: 8_000, receivedAt: 8_400, serverTime: 9_000 },
    ]);
    assert.deepEqual(result, { offset: 1_000, rtt: 100 });
  });

  it('不正な計測は無視し、有効な計測がなければ null を返す', () => {
    assert.equal(pickBestOffset([]), null);
    assert.equal(
      pickBestOffset([null, { sentAt: 0, receivedAt: 100, serverTime: null }, { sentAt: 100, receivedAt: 0, serverTime: 50 }]),
      null,
    );
    assert.deepEqual(pickBestOffset([null, { sentAt: 0, receivedAt: 100, serverTime: 1_050 }]), { offset: 1_000, rtt: 100 });
  });
});
