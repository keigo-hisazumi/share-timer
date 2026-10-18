// タイマーの状態遷移を扱う純粋関数群（ブラウザとテストの両方から読み込む）
//
// 状態は「終了予定時刻（Firebase サーバー時刻のエポックミリ秒）」を保持する方式にしている。
// これによりクライアントは毎秒の通知を受け取らなくても、
// サーバーとの時刻差だけ補正すれば全員が同じ残り時間を表示できる。

/** 設定できる最大時間（99:59:59） */
export const MAX_DURATION_MS = (99 * 3600 + 59 * 60 + 59) * 1000;

/** 初期状態の時間（5 分） */
export const DEFAULT_DURATION_MS = 5 * 60 * 1000;

/** 操作が不正な場合に投げるエラー */
export class TimerError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TimerError';
  }
}

/**
 * 初期状態を生成する
 *
 * status は idle（未開始） / running（計測中） / paused（一時停止中） / finished（終了） のいずれか
 */
export function createInitialState(durationMs = DEFAULT_DURATION_MS) {
  return {
    status: 'idle',
    durationMs,
    remainingMs: durationMs,
    endsAt: null,
    version: 0,
  };
}

/**
 * 計測中かつ終了予定時刻を過ぎていれば finished に遷移させる
 */
export function normalize(state, now) {
  if (state.status === 'running' && now >= state.endsAt) {
    return {
      ...state,
      status: 'finished',
      remainingMs: 0,
      endsAt: null,
      version: state.version + 1,
    };
  }
  return state;
}

/**
 * 指定時刻における残り時間（ミリ秒）を返す
 */
export function getRemainingMs(state, now) {
  if (state.status === 'running') {
    return Math.max(0, state.endsAt - now);
  }
  return state.remainingMs;
}

/**
 * 設定時間の値を検証する
 */
export function validateDuration(durationMs) {
  if (!Number.isInteger(durationMs)) {
    throw new TimerError('時間は整数のミリ秒で指定してください');
  }
  if (durationMs < 1000 || durationMs > MAX_DURATION_MS) {
    throw new TimerError('時間は 1 秒以上 99:59:59 以下で指定してください');
  }
  if (durationMs % 1000 !== 0) {
    throw new TimerError('時間は秒単位で指定してください');
  }
}

/**
 * 操作を適用して新しい状態を返す（元の状態は変更しない）
 *
 * @param {object} current 現在の状態
 * @param {{type: string, durationMs?: number}} action 操作
 * @param {number} now サーバー時刻（エポックミリ秒）
 */
export function applyAction(current, action, now) {
  const state = normalize(current, now);
  const next = (patch) => ({ ...state, ...patch, version: state.version + 1 });

  switch (action?.type) {
    case 'set': {
      validateDuration(action.durationMs);
      // 時間を設定したら未開始状態に戻す
      return next({
        status: 'idle',
        durationMs: action.durationMs,
        remainingMs: action.durationMs,
        endsAt: null,
      });
    }
    case 'start': {
      if (state.status === 'running') {
        return state;
      }
      // 終了後のスタートは設定時間から再開する
      const remainingMs = state.status === 'finished' ? state.durationMs : state.remainingMs;
      return next({
        status: 'running',
        remainingMs,
        endsAt: now + remainingMs,
      });
    }
    case 'pause': {
      if (state.status !== 'running') {
        return state;
      }
      return next({
        status: 'paused',
        remainingMs: getRemainingMs(state, now),
        endsAt: null,
      });
    }
    case 'reset': {
      return next({
        status: 'idle',
        remainingMs: state.durationMs,
        endsAt: null,
      });
    }
    default:
      throw new TimerError('不明な操作です');
  }
}

/**
 * 永続化ファイルなどから読み込んだ値が状態として妥当か検証する
 */
export function isValidState(value) {
  if (!value || typeof value !== 'object') return false;
  const { status, durationMs, remainingMs, endsAt, version } = value;
  if (!['idle', 'running', 'paused', 'finished'].includes(status)) return false;
  if (!Number.isInteger(durationMs) || durationMs < 1000 || durationMs > MAX_DURATION_MS) return false;
  if (!Number.isFinite(remainingMs) || remainingMs < 0) return false;
  if (!Number.isInteger(version) || version < 0) return false;
  if (status === 'running') return Number.isFinite(endsAt);
  return endsAt === null;
}

/**
 * データベースから読み込んだ値を状態に変換する
 *
 * Firebase は null のフィールドを保存しないため endsAt を補い、
 * 値が未作成・不正な場合は初期状態を返す
 */
export function parseState(value) {
  if (!value || typeof value !== 'object') return createInitialState();
  const state = { ...value, endsAt: value.endsAt ?? null };
  return isValidState(state) ? state : createInitialState();
}
