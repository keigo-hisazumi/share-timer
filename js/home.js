// トップページ

import { isConfigured } from './firebase.js';
import { createTimer } from './store.js';
import { NOT_CONFIGURED_MESSAGE, errorMessage, showMessage, showNotice } from './ui.js';

const createButton = document.getElementById('create');

if (!isConfigured) {
  showNotice(NOT_CONFIGURED_MESSAGE);
  createButton.disabled = true;
}

// 管理 ID と表示 ID を発行してタイマーを作成し、管理画面へ移動する
createButton.addEventListener('click', async () => {
  createButton.disabled = true;
  createButton.textContent = '作成中…';
  try {
    const { manageId } = await createTimer();
    location.assign(`manage/?id=${encodeURIComponent(manageId)}`);
  } catch (err) {
    showMessage(errorMessage(err));
    createButton.disabled = false;
    createButton.textContent = '自分のタイマーを作成する';
  }
});
