// タイマー表示画面（URL の ?id= に表示 ID を指定して開く）

import { isConfigured } from './firebase.js';
import { displayTitle, formatDuration } from './format.js';
import { isViewId } from './ids.js';
import { connectTimer } from './sync.js';
import { NOT_CONFIGURED_MESSAGE, idFromLocation, showNotice } from './ui.js';

/** 一瞬の切断で表示がちらつかないよう、この時間以上切断が続いたら表示する */
const DISCONNECT_NOTICE_DELAY_MS = 3000;

const timerEl = document.getElementById('timer');
const titleEl = document.getElementById('title');
const connectionEl = document.getElementById('connection');
const noticeEl = document.getElementById('notice');

function start(viewId) {
  let disconnectTimer = null;
  const timer = connectTimer(viewId, {
    onState: (state) => {
      if (!state) {
        showNotice('タイマーが見つかりません。表示 ID を確認してください。');
        return;
      }
      noticeEl.hidden = true;
      // タイトルは利用者の入力なので textContent で表示する
      titleEl.textContent = displayTitle(state);
      document.title = `${displayTitle(state)} - Share Timer`;
    },
    onConnection: (connected) => {
      clearTimeout(disconnectTimer);
      if (connected) {
        connectionEl.hidden = true;
      } else {
        disconnectTimer = setTimeout(() => {
          connectionEl.hidden = false;
        }, DISCONNECT_NOTICE_DELAY_MS);
      }
    },
    onError: () => showNotice('タイマーの読み込みに失敗しました。データベースのルール設定を確認してください。'),
  });

  let lastText = '';
  function render() {
    const state = timer.getState();
    const remaining = timer.getRemainingMs();
    if (state && remaining !== null) {
      // 計測中に 0 になった時点で終了表示にする
      const status = state.status === 'running' && remaining <= 0 ? 'finished' : state.status;
      const text = formatDuration(remaining);
      if (text !== lastText) {
        timerEl.textContent = text;
        // 桁数に応じて文字サイズを調整する
        timerEl.dataset.long = String(text.length > 5);
        lastText = text;
      }
      timerEl.dataset.status = status;
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

const viewId = idFromLocation().toLowerCase();
if (!isConfigured) {
  showNotice(NOT_CONFIGURED_MESSAGE);
} else if (!isViewId(viewId)) {
  showNotice('表示 ID が正しくありません。URL を確認してください。');
} else {
  start(viewId);
}

// クリックで全画面表示を切り替える
document.querySelector('.viewer-main').addEventListener('click', () => {
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  } else {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }
});
