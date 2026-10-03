// 管理画面

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

import { app, db, get, isConfigured, ref, runTransaction, timerPath } from './firebase.js';
import { formatDuration, toDurationMs } from './format.js';
import { connectTimer } from './sync.js';
import { TimerError, applyAction, parseState, validateDuration } from './timer.js';

const STATUS_LABELS = {
  idle: '待機中',
  running: '計測中',
  paused: '一時停止中',
  finished: '終了',
};

/** Firebase Authentication のエラーコードに対応するメッセージ */
const AUTH_ERROR_MESSAGES = {
  'auth/invalid-credential': 'メールアドレスまたはパスワードが正しくありません',
  'auth/invalid-email': 'メールアドレスの形式が正しくありません',
  'auth/user-disabled': 'このアカウントは無効化されています',
  'auth/too-many-requests': '試行回数が多すぎます。しばらく待ってから再度お試しください',
  'auth/network-request-failed': 'ネットワークに接続できません',
};

const $ = (id) => document.getElementById(id);
const timerEl = $('timer');
const statusLabel = $('status-label');
const durationLabel = $('duration-label');
const noticeEl = $('notice');
const loginForm = $('login-form');
const controls = $('controls');
const accountEl = $('account');
const messageEl = $('message');

let messageTimer = null;
function showMessage(text) {
  messageEl.textContent = text;
  messageEl.hidden = false;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => {
    messageEl.hidden = true;
  }, 4000);
}

/**
 * 案内を表示する（parts は文字列、または {code: 文字列} でコード表示）
 */
function showNotice(...parts) {
  noticeEl.replaceChildren(
    ...parts.map((part) => {
      if (typeof part === 'string') return document.createTextNode(part);
      const code = document.createElement('code');
      code.textContent = part.code;
      return code;
    }),
  );
  noticeEl.hidden = false;
}

function hideNotice() {
  noticeEl.hidden = true;
}

function errorMessage(err) {
  if (err instanceof TimerError) return err.message;
  if (AUTH_ERROR_MESSAGES[err?.code]) return AUTH_ERROR_MESSAGES[err.code];
  if (String(err?.code ?? err?.message).toLowerCase().includes('permission')) {
    return 'このアカウントにはタイマーを操作する権限がありません';
  }
  return `エラーが発生しました（${err?.code ?? err?.message ?? err}）`;
}

function setDurationInputs(durationMs) {
  const totalSeconds = Math.round(durationMs / 1000);
  $('hours').value = Math.floor(totalSeconds / 3600);
  $('minutes').value = Math.floor((totalSeconds % 3600) / 60);
  $('seconds').value = totalSeconds % 60;
}

function start() {
  const auth = getAuth(app);
  const timerRef = ref(db, timerPath);

  // --- 表示 ---

  let initialized = false;
  let connected = false;
  const timer = connectTimer({
    onState: (state) => {
      durationLabel.textContent = `設定時間 ${formatDuration(state.durationMs)}`;
      if (!initialized) {
        // 初回のみ現在の設定時間を入力欄へ反映する
        setDurationInputs(state.durationMs);
        initialized = true;
      }
    },
    onConnection: (value) => {
      connected = value;
    },
    onError: (err) => showMessage(errorMessage(err)),
  });

  function render() {
    const state = timer.getState();
    const remaining = timer.getRemainingMs();
    if (state && remaining !== null) {
      const status = state.status === 'running' && remaining <= 0 ? 'finished' : state.status;
      timerEl.textContent = formatDuration(remaining);
      timerEl.dataset.status = status;
      statusLabel.textContent = connected ? STATUS_LABELS[status] : '再接続中…';
      statusLabel.dataset.status = connected ? status : 'offline';
      for (const button of document.querySelectorAll('[data-action]')) {
        const action = button.dataset.action;
        button.disabled =
          (action === 'start' && status === 'running') ||
          (action === 'pause' && status !== 'running') ||
          (action === 'reset' && status === 'idle');
      }
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  // --- 操作 ---

  /**
   * 操作をトランザクションで適用する（複数の管理者が同時に操作しても状態が壊れないようにする）
   */
  async function sendAction(action) {
    try {
      if (action.type === 'set') validateDuration(action.durationMs);
      await runTransaction(timerRef, (current) => applyAction(parseState(current), action, timer.serverNow()));
    } catch (err) {
      showMessage(errorMessage(err));
    }
  }

  for (const button of document.querySelectorAll('[data-action]')) {
    button.addEventListener('click', () => sendAction({ type: button.dataset.action }));
  }

  $('duration-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const durationMs = toDurationMs($('hours').value, $('minutes').value, $('seconds').value);
    sendAction({ type: 'set', durationMs });
  });

  for (const button of document.querySelectorAll('[data-preset]')) {
    button.addEventListener('click', () => {
      const durationMs = Number(button.dataset.preset) * 1000;
      setDurationInputs(durationMs);
      sendAction({ type: 'set', durationMs });
    });
  }

  // --- ログイン ---

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, $('email').value, $('password').value);
      $('password').value = '';
      messageEl.hidden = true;
    } catch (err) {
      showMessage(errorMessage(err));
    }
  });

  $('logout').addEventListener('click', () => signOut(auth));

  onAuthStateChanged(auth, async (user) => {
    hideNotice();
    loginForm.hidden = Boolean(user);
    accountEl.hidden = !user;
    controls.hidden = true;
    if (!user) return;

    $('account-email').textContent = `${user.email} でログイン中`;
    // 管理者として登録されているか確認する（/admins/{uid} が true のユーザーのみ操作可能）
    let isAdmin = false;
    try {
      isAdmin = (await get(ref(db, `admins/${user.uid}`))).val() === true;
    } catch {
      isAdmin = false;
    }
    if (isAdmin) {
      controls.hidden = false;
    } else {
      showNotice(
        'このアカウントは管理者として登録されていません。Firebase コンソールの Realtime Database で ',
        { code: `admins/${user.uid}` },
        ' に true を設定してください。',
      );
    }
  });
}

if (isConfigured) {
  start();
} else {
  showNotice('Firebase が未設定です。README の「Firebase の設定」を参照してください。');
  statusLabel.textContent = '未設定';
}
