// タイマー管理画面（URL の ?id= に管理 ID を指定して開く）

import { isConfigured } from './firebase.js';
import { displayTitle, formatDuration, toDurationMs } from './format.js';
import { isManageId } from './ids.js';
import { findViewId, updateTimer } from './store.js';
import { connectTimer } from './sync.js';
import { validateDuration } from './timer.js';
import { NOT_CONFIGURED_MESSAGE, copyText, errorMessage, idFromLocation, showMessage, showNotice } from './ui.js';

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
const titlePreview = $('title-preview');
const titleInput = $('title');

function setDurationInputs(durationMs) {
  const totalSeconds = Math.round(durationMs / 1000);
  $('hours').value = Math.floor(totalSeconds / 3600);
  $('minutes').value = Math.floor((totalSeconds % 3600) / 60);
  $('seconds').value = totalSeconds % 60;
}

function start(manageId, viewId) {
  const viewUrl = new URL(`../view/?id=${encodeURIComponent(viewId)}`, location.href).href;
  $('view-id').textContent = viewId;
  $('open-view').href = viewUrl;
  $('manage-id').textContent = manageId;
  $('copy-view-url').addEventListener('click', () => copyText(viewUrl, '表示画面の URL '));
  $('copy-manage-url').addEventListener('click', () => copyText(location.href, '管理画面の URL '));
  $('manage').hidden = false;

  // --- 表示 ---

  let initialized = false;
  let connected = false;
  const timer = connectTimer(viewId, {
    onState: (state) => {
      if (!state) {
        showNotice('タイマーが見つかりません。');
        return;
      }
      durationLabel.textContent = `設定時間 ${formatDuration(state.durationMs)}`;
      titlePreview.textContent = displayTitle(state);
      titleInput.placeholder = `未記入なら「${formatDuration(state.durationMs)}」`;
      document.title = `${displayTitle(state)} の管理 - Share Timer`;
      if (!initialized) {
        // 初回のみ現在の設定を入力欄へ反映する
        setDurationInputs(state.durationMs);
        titleInput.value = state.title;
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

  async function sendAction(action) {
    try {
      if (action.type === 'set') validateDuration(action.durationMs);
      await updateTimer(manageId, viewId, action, timer.serverNow);
      return true;
    } catch (err) {
      showMessage(errorMessage(err));
      return false;
    }
  }

  for (const button of document.querySelectorAll('[data-action]')) {
    button.addEventListener('click', () => sendAction({ type: button.dataset.action }));
  }

  $('title-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (await sendAction({ type: 'title', title: titleInput.value })) {
      titleInput.value = titleInput.value.trim();
      showMessage('タイトルを保存しました', { ok: true });
    }
  });

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
}

async function main() {
  if (!isConfigured) {
    showNotice(NOT_CONFIGURED_MESSAGE);
    return;
  }
  const manageId = idFromLocation();
  if (!isManageId(manageId)) {
    showNotice('管理用 ID が正しくありません。URL を確認してください。');
    return;
  }
  let viewId;
  try {
    viewId = await findViewId(manageId);
  } catch (err) {
    showNotice(errorMessage(err));
    return;
  }
  if (!viewId) {
    showNotice('この管理用 ID のタイマーは見つかりません。URL を確認してください。');
    return;
  }
  start(manageId, viewId);
}

main();
