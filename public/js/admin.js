// 管理画面

import { formatDuration, toDurationMs } from './format.js';
import { connectTimer } from './sync.js';

const PASSWORD_KEY = 'share-timer:admin-password';

const STATUS_LABELS = {
  idle: '待機中',
  running: '計測中',
  paused: '一時停止中',
  finished: '終了',
};

const $ = (id) => document.getElementById(id);
const timerEl = $('timer');
const statusLabel = $('status-label');
const durationLabel = $('duration-label');
const loginForm = $('login-form');
const controls = $('controls');
const messageEl = $('message');

// パスワードはタブを閉じると消えるよう sessionStorage に保持する
function loadPassword() {
  try {
    return sessionStorage.getItem(PASSWORD_KEY);
  } catch {
    return null;
  }
}
function savePassword(value) {
  try {
    if (value) sessionStorage.setItem(PASSWORD_KEY, value);
    else sessionStorage.removeItem(PASSWORD_KEY);
  } catch {
    // 保存できない環境ではメモリ上でのみ保持する
  }
}
let password = loadPassword();

let messageTimer = null;
function showMessage(text, type = 'error') {
  messageEl.textContent = text;
  messageEl.dataset.type = type;
  messageEl.hidden = false;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => {
    messageEl.hidden = true;
  }, 4000);
}

function setLoggedIn(loggedIn) {
  loginForm.hidden = loggedIn;
  controls.hidden = !loggedIn;
}

/**
 * 認証付きで API を呼び出す
 */
async function callApi(pathname, body) {
  const res = await fetch(pathname, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${password}`,
    },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    password = null;
    savePassword(null);
    setLoggedIn(false);
  }
  if (!res.ok) {
    throw new Error(data.error ?? `エラーが発生しました（${res.status}）`);
  }
  return data;
}

async function sendAction(action) {
  try {
    await callApi('/api/control', action);
  } catch (err) {
    showMessage(err.message);
  }
}

// --- ログイン ---

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  password = $('password').value;
  try {
    await callApi('/api/auth');
    savePassword(password);
    $('password').value = '';
    setLoggedIn(true);
  } catch (err) {
    showMessage(err.message);
  }
});

$('logout').addEventListener('click', () => {
  password = null;
  savePassword(null);
  setLoggedIn(false);
});

if (password) {
  // 保存済みのパスワードがまだ有効か確認する
  setLoggedIn(true);
  callApi('/api/auth').catch((err) => showMessage(err.message));
} else {
  setLoggedIn(false);
}

// --- 操作 ---

for (const button of document.querySelectorAll('[data-action]')) {
  button.addEventListener('click', () => sendAction({ type: button.dataset.action }));
}

function setDurationInputs(durationMs) {
  const totalSeconds = Math.round(durationMs / 1000);
  $('hours').value = Math.floor(totalSeconds / 3600);
  $('minutes').value = Math.floor((totalSeconds % 3600) / 60);
  $('seconds').value = totalSeconds % 60;
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
