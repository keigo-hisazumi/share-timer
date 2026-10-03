import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  TimerError,
  applyAction,
  createInitialState,
  getRemainingMs,
  isValidState,
  normalize,
} from '../src/timer.js';

describe('applyAction', () => {
  it('set で時間を設定すると待機状態になる', () => {
    const state = applyAction(createInitialState(), { type: 'set', durationMs: 90_000 }, 0);
    assert.equal(state.status, 'idle');
    assert.equal(state.durationMs, 90_000);
    assert.equal(state.remainingMs, 90_000);
    assert.equal(state.version, 1);
  });

  it('不正な時間は拒否する', () => {
    const initial = createInitialState();
    for (const durationMs of [0, 500, 1500, -1000, 100 * 3600 * 1000, '60000', null]) {
      assert.throws(() => applyAction(initial, { type: 'set', durationMs }, 0), TimerError);
    }
  });

  it('start → pause → start で残り時間が引き継がれる', () => {
    let state = applyAction(createInitialState(), { type: 'set', durationMs: 60_000 }, 0);
    state = applyAction(state, { type: 'start' }, 1_000);
    assert.equal(state.status, 'running');
    assert.equal(state.endsAt, 61_000);
    assert.equal(getRemainingMs(state, 11_000), 50_000);

    state = applyAction(state, { type: 'pause' }, 11_000);
    assert.equal(state.status, 'paused');
    assert.equal(state.remainingMs, 50_000);
    assert.equal(getRemainingMs(state, 99_000), 50_000);

    state = applyAction(state, { type: 'start' }, 20_000);
    assert.equal(state.endsAt, 70_000);
  });

  it('終了予定時刻を過ぎると finished になる', () => {
    let state = applyAction(createInitialState(), { type: 'set', durationMs: 10_000 }, 0);
    state = applyAction(state, { type: 'start' }, 0);
    assert.equal(normalize(state, 9_999).status, 'running');
    const finished = normalize(state, 10_000);
    assert.equal(finished.status, 'finished');
    assert.equal(finished.remainingMs, 0);
  });

  it('終了後の start は設定時間から再開する', () => {
    let state = applyAction(createInitialState(), { type: 'set', durationMs: 10_000 }, 0);
    state = applyAction(state, { type: 'start' }, 0);
    state = applyAction(state, { type: 'start' }, 20_000);
    assert.equal(state.status, 'running');
    assert.equal(state.endsAt, 30_000);
  });

  it('reset で設定時間に戻る', () => {
    let state = applyAction(createInitialState(), { type: 'set', durationMs: 10_000 }, 0);
    state = applyAction(state, { type: 'start' }, 0);
    state = applyAction(state, { type: 'reset' }, 3_000);
    assert.equal(state.status, 'idle');
    assert.equal(state.remainingMs, 10_000);
    assert.equal(state.endsAt, null);
  });

  it('意味のない操作では状態を変えない', () => {
    const idle = createInitialState();
    assert.equal(applyAction(idle, { type: 'pause' }, 0), idle);
    const running = applyAction(idle, { type: 'start' }, 0);
    assert.equal(applyAction(running, { type: 'start' }, 1_000), running);
  });

  it('不明な操作は拒否する', () => {
    assert.throws(() => applyAction(createInitialState(), { type: 'explode' }, 0), TimerError);
    assert.throws(() => applyAction(createInitialState(), null, 0), TimerError);
  });
});

describe('isValidState', () => {
  it('正しい状態を受け付け、壊れた値を拒否する', () => {
    const state = createInitialState();
    assert.equal(isValidState(state), true);
    assert.equal(isValidState(applyAction(state, { type: 'start' }, 0)), true);
    assert.equal(isValidState(null), false);
    assert.equal(isValidState({ ...state, status: 'unknown' }), false);
    assert.equal(isValidState({ ...state, status: 'running', endsAt: null }), false);
  });
});
