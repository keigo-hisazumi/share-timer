// public/ を dist/ にコピーし、実行時設定（js/config.js）を生成する
//
// 環境変数:
//   FIREBASE_CONFIG  Firebase のウェブアプリ設定（JSON。Firebase コンソールの JavaScript スニペット形式も可）。
//                    未指定ならリポジトリ直下の firebase-config.json を読む
//   DATA_ROOT        タイマーのデータを保存するデータベース上の起点（既定値: 空 = ルート。PR プレビューでは previews/pr-<番号>）

import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseFirebaseConfig } from './firebase-config.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const publicDir = path.join(root, 'public');
const distDir = path.join(root, 'dist');
const localConfigFile = path.join(root, 'firebase-config.json');

/** 許可するデータベース上の起点（本番 = 空 or PR プレビュー） */
const DATA_ROOT_PATTERN = /^(|previews\/pr-[0-9]+)$/;

function loadFirebaseConfig() {
  let source;
  let text = process.env.FIREBASE_CONFIG?.trim();
  if (text) {
    source = '環境変数 FIREBASE_CONFIG';
  } else if (existsSync(localConfigFile)) {
    text = readFileSync(localConfigFile, 'utf8');
    source = 'firebase-config.json';
  } else {
    return null;
  }

  const config = parseFirebaseConfig(text, source);
  console.log(`Firebase の設定を ${source} から読み込みました`);
  return config;
}

const dataRoot = process.env.DATA_ROOT ?? '';
if (!DATA_ROOT_PATTERN.test(dataRoot)) {
  throw new Error(`DATA_ROOT が不正です: ${dataRoot}`);
}

const firebase = loadFirebaseConfig();
if (!firebase) {
  console.warn('警告: Firebase の設定がないため、画面には「未設定」の案内が表示されます');
}

rmSync(distDir, { recursive: true, force: true });
cpSync(publicDir, distDir, { recursive: true });
writeFileSync(
  path.join(distDir, 'js', 'config.js'),
  `// scripts/build.js により自動生成\nexport default ${JSON.stringify({ firebase, dataRoot }, null, 2)};\n`,
);
// Service Worker のキャッシュ名にビルド ID を埋め込み、デプロイごとに更新されるようにする
const buildId = (process.env.GITHUB_SHA?.slice(0, 12) || 'local') + '-' + Date.now().toString(36);
const swFile = path.join(distDir, 'sw.js');
writeFileSync(swFile, readFileSync(swFile, 'utf8').replace("const BUILD_ID = 'dev';", `const BUILD_ID = '${buildId}';`));
// GitHub Pages で Jekyll の処理を無効化する
writeFileSync(path.join(distDir, '.nojekyll'), '');

console.log(`dist/ を生成しました（dataRoot: ${dataRoot || '(ルート)'}, buildId: ${buildId}）`);
