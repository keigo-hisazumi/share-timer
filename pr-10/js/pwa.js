// PWA 用の Service Worker を登録する
//
// 画面本体（Firebase SDK の読み込み）が失敗しても登録できるよう、独立したモジュールとして読み込む。
// sw.js はサイトのルート（本番なら /share-timer/、PR プレビューなら /share-timer/pr-<番号>/）に置かれ、
// タイマー画面と管理画面の両方を制御する。

if ('serviceWorker' in navigator) {
  const swUrl = new URL('../sw.js', import.meta.url);
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl, { scope: new URL('./', swUrl).pathname }).catch((error) => {
      console.warn('Service Worker の登録に失敗しました', error);
    });
  });
}
