// 実行時設定
//
// このファイルはビルド時（scripts/build.js）に環境変数 FIREBASE_CONFIG / TIMER_PATH の値で上書きされる。
// firebase が null の場合は「未設定」の案内を表示する。
export default {
  firebase: null,
  timerPath: 'timer',
};
