// トップ画面（タイマー表示のみ）

import { formatDuration } from './format.js';
import { connectTimer } from './sync.js';

const timerEl = document.getElementById('timer');
const connectionEl = document.getElementById('connection');

const timer = connectTimer({
  onConnection: (connected) => {
    connectionEl.hidden = connected;
  },
});

let lastText = '';
function render() {
  const state = timer.getState();
  const remaining = timer.getRemainingMs();
  if (state && remaining !== null) {
    // 計測中に 0 になった時点で、サーバーからの通知を待たずに終了表示にする
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

// クリックで全画面表示を切り替える
document.querySelector('.viewer-main').addEventListener('click', () => {
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  } else {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }
});
