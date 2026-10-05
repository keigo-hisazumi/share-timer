// public/ を dist/ にコピーし、実行時設定（js/config.js）を生成する
//
// 環境変数:
//   FIREBASE_CONFIG  Firebase のウェブアプリ設定（JSON。Firebase コンソールの JavaScript スニペット形式も可）。
//                    未指定ならリポジトリ直下の firebase-config.json を読む
//   TIMER_PATH       タイマーの状態を保存するデータベース上のパス（既定値: timer）

import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseFirebaseConfig } from './firebase-config.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const publicDir = path.join(root, 'public');
const distDir = path.join(root, 'dist');
const localConfigFile = path.join(root, 'firebase-config.json');

/** 許可するデータベースパス（本番 or PR プレビュー） */
const TIMER_PATH_PATTERN = /^(timer|previews\/pr-[0-9]+\/timer)$/;

function loadFirebaseConfig() {
  let source = null;
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

const timerPath = process.env.TIMER_PATH || 'timer';
if (!TIMER_PATH_PATTERN.test(timerPath)) {
  throw new Error(`TIMER_PATH が不正です: ${timerPath}`);
}

const firebase = loadFirebaseConfig();
if (!firebase) {
  console.warn('警告: Firebase の設定がないため、画面には「未設定」の案内が表示されます');
}

rmSync(distDir, { recursive: true, force: true });
cpSync(publicDir, distDir, { recursive: true });
writeFileSync(
  path.join(distDir, 'js', 'config.js'),
  `// scripts/build.js により自動生成\nexport default ${JSON.stringify({ firebase, timerPath }, null, 2)};\n`,
);
// GitHub Pages で Jekyll の処理を無効化する
writeFileSync(path.join(distDir, '.nojekyll'), '');

console.log(`dist/ を生成しました（timerPath: ${timerPath}）`);
