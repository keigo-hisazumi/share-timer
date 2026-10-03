// トップ画面（タイマー表示のみ）

import { isConfigured } from './firebase.js';
import { formatDuration } from './format.js';
import { connectTimer } from './sync.js';

/** 一瞬の切断で表示がちらつかないよう、この時間以上切断が続いたら表示する */
const DISCONNECT_NOTICE_DELAY_MS = 3000;

const timerEl = document.getElementById('timer');
const connectionEl = document.getElementById('connection');
const noticeEl = document.getElementById('notice');

function showNotice(text) {
  noticeEl.textContent = text;
  noticeEl.hidden = false;
}

function start() {
  let disconnectTimer = null;
  const timer = connectTimer({
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

if (isConfigured) {
  start();
} else {
  showNotice('Firebase が未設定です。README の「Firebase の設定」を参照してください。');
}

// クリックで全画面表示を切り替える
document.querySelector('.viewer-main').addEventListener('click', () => {
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  } else {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }
});
