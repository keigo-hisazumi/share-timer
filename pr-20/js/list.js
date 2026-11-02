// タイマー一覧画面

import { dataPath, db, isConfigured, limitToLast, onValue, orderByChild, query, ref } from './firebase.js';
import { displayTitle, formatDuration } from './format.js';
import { parseViewIdInput } from './ids.js';
import { parseState } from './timer.js';
import { NOT_CONFIGURED_MESSAGE, showMessage, showNotice } from './ui.js';

/** 一覧に表示する件数（新しいものから） */
const LIST_LIMIT = 200;

const STATUS_LABELS = {
  idle: '待機中',
  running: '計測中',
  paused: '一時停止中',
  finished: '終了',
};

const listEl = document.getElementById('timer-list');
const listStatus = document.getElementById('list-status');

function viewUrl(viewId) {
  return `../view/?id=${encodeURIComponent(viewId)}`;
}

/** 一覧の 1 行を作る（タイトルは利用者の入力なので textContent で表示する） */
function renderItem(viewId, state, now) {
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.href = viewUrl(viewId);
  link.className = 'timer-list-link';

  const title = document.createElement('span');
  title.className = 'timer-list-title';
  title.textContent = displayTitle(state);

  const meta = document.createElement('span');
  meta.className = 'timer-list-meta';
  const duration = document.createElement('span');
  duration.textContent = `設定時間 ${formatDuration(state.durationMs)}`;
  const status = document.createElement('span');
  const finished = state.status === 'finished' || (state.status === 'running' && state.endsAt <= now);
  const statusKey = finished ? 'finished' : state.status;
  status.className = 'badge';
  status.dataset.status = statusKey;
  status.textContent = STATUS_LABELS[statusKey];
  meta.append(duration, status);

  link.append(title, meta);
  item.append(link);
  return item;
}

function start() {
  const timersQuery = query(ref(db, dataPath('timers')), orderByChild('createdAt'), limitToLast(LIST_LIMIT));
  onValue(
    timersQuery,
    (snapshot) => {
      const items = [];
      snapshot.forEach((child) => {
        items.push([child.key, parseState(child.val())]);
      });
      // 新しく作成されたものを上に表示する
      items.reverse();
      const now = Date.now();
      listEl.replaceChildren(...items.map(([viewId, state]) => renderItem(viewId, state, now)));
      listStatus.hidden = items.length > 0;
      listStatus.textContent = 'まだタイマーがありません。';
    },
    () => {
      listStatus.textContent = 'タイマーの一覧を読み込めませんでした。';
    },
  );
}

document.getElementById('id-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const viewId = parseViewIdInput(document.getElementById('view-id').value);
  if (!viewId) {
    showMessage('表示 ID の形式が正しくありません（英数字 8 文字）');
    return;
  }
  location.assign(viewUrl(viewId));
});

if (isConfigured) {
  start();
} else {
  showNotice(NOT_CONFIGURED_MESSAGE);
  listStatus.hidden = true;
}
