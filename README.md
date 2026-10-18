# Share Timer

Web サイトにアクセスした全員が、**同期されたカウントダウンタイマー** を見られるアプリです。タイマーの操作（時間設定・スタート・一時停止・リセット）は管理画面からのみ行えます。

- 本番: <https://keigo-hisazumi.github.io/share-timer/>
- 管理画面: <https://keigo-hisazumi.github.io/share-timer/admin/>

## 主な機能

- アクセスした全員の画面に同じ残り時間のカウントダウンを表示
- タイマー画面はクリックで全画面表示を切り替え
- 管理者アカウントでログインした管理画面から、時間設定・スタート・一時停止・リセットを操作
- 時間は時・分・秒で指定（最大 99:59:59）でき、1 / 3 / 5 / 10 / 30 / 60 分のプリセットも選べる
- 端末の時計がずれていても、サーバー時刻で補正して全員が同じ残り時間を表示
- タイマー画面・管理画面をそれぞれ PWA としてホーム画面に追加でき、オフラインでも画面自体は起動

## 使い方

1. 管理画面（`/admin/`）を開き、管理者アカウントのメールアドレスとパスワードでログインする
2. 「時間設定」で時・分・秒を入力するかプリセットを選び、「設定」を押す（タイマーは停止状態でその時間にリセットされます）
3. 「スタート」「一時停止」「リセット」で操作すると、タイマー画面（`/`）を開いている全員の表示に反映される

| パス | 内容 |
| --- | --- |
| `/` | タイマーのみを大きく表示するトップ画面。クリックで全画面表示を切り替え |
| `/admin/` | 管理画面。管理者アカウントでログインし、時間設定・スタート・一時停止・リセットを操作 |

## PWA（ホーム画面への追加）

タイマー画面・管理画面はそれぞれ PWA としてインストールできます（Chrome / Edge のアドレスバーのインストールボタン、iOS Safari の「共有 → ホーム画面に追加」など）。

- タイマー画面は全画面表示（`display: fullscreen`）で起動するため、会場のディスプレイやタブレットでの常時表示に向いています
- 管理画面は別アプリ（`admin/manifest.webmanifest`）としてインストールでき、ホーム画面から直接操作できます
- Service Worker（[`public/sw.js`](./public/sw.js)）が画面のファイルと Firebase SDK をキャッシュするため、オフラインでも画面自体は起動します（タイマーの同期にはネット接続が必要です）
  - 同一オリジンのファイルはネットワーク優先で取得するため、デプロイ後の更新はすぐ反映されます
  - キャッシュ名はビルドごとに変わり（`scripts/build.js` が `BUILD_ID` を埋め込む）、古いキャッシュは自動で削除されます
  - 本番と PR プレビュー（`pr-<番号>/`）はキャッシュを分けて管理します
- アイコンは `public/icons/` にあります（`favicon.svg` と同じ意匠。`icon-maskable-512.png` は Android のアダプティブアイコン用）

## 同期の仕組み

- タイマーの状態は Firebase Realtime Database に「終了予定時刻（サーバー時刻）」として保存します
- 閲覧者のブラウザはデータベースの変更をリアルタイムに受け取り、手元で残り時間を描画します
- サーバーとの時刻差で補正するため、端末の時計がずれていても全員が同じ残り時間を表示します
  - 時刻差は `/clockSync` にサーバー時刻を書き込んで読み戻す往復計測（NTP と同じ考え方）で求め、接続時と 10 分ごとに計測し直します
  - Firebase の `.info/serverTimeOffset` は接続時に 1 回だけ推定されるため数秒ずれることがあり、計測できない場合の予備としてのみ使います
  - `/clockSync` はサーバー時刻（数値）しか書き込めず、計測後すぐに削除されます
- 管理画面の操作はトランザクションで書き込むため、複数の管理者が同時に操作しても状態が壊れません
- 書き込みはセキュリティルール（[`database.rules.json`](./database.rules.json)）で `/admins/<UID>` が `true` のユーザーだけに制限しています

## Firebase の設定（初回のみ）

1. [Firebase コンソール](https://console.firebase.google.com/) でプロジェクトを作成する（無料の Spark プランで動作します）
2. **Build → Realtime Database** でデータベースを作成する（ロケーションは任意。例: `asia-southeast1`）
3. Realtime Database の **ルール** タブに [`database.rules.json`](./database.rules.json) の内容を貼り付けて公開する
4. **Build → Authentication** を開始し、**Sign-in method** で「メール / パスワード」を有効にする
5. Authentication の **Users** タブで管理者ユーザーを追加し、表示される **ユーザー UID** を控える
6. Realtime Database の **データ** タブで `admins` → `<ユーザー UID>` に `true`（boolean）を追加する
   - 管理画面にログインして権限がない場合も、設定すべきパスが表示されます
7. Authentication の **Settings → 承認済みドメイン** に `keigo-hisazumi.github.io` を追加する
8. **プロジェクトの設定 → マイアプリ** でウェブアプリを追加し、表示される `firebaseConfig` の値を JSON にする

```json
{
  "apiKey": "...",
  "authDomain": "<project>.firebaseapp.com",
  "databaseURL": "https://<project>-default-rtdb.<region>.firebasedatabase.app",
  "projectId": "<project>",
  "storageBucket": "<project>.firebasestorage.app",
  "messagingSenderId": "...",
  "appId": "..."
}
```

> Firebase のウェブ設定はブラウザに配信される公開情報で、秘密情報ではありません。アクセス制御はセキュリティルールで行います。

## 技術スタック

- HTML / CSS / JavaScript（ES Modules、フレームワーク・ビルドツールなし）
- Firebase Realtime Database（タイマーの同期）
- Firebase Authentication（管理者のメール / パスワード認証）
- Firebase SDK は CDN（gstatic）から読み込み、npm のランタイム依存なし
- Service Worker / Web App Manifest（PWA）
- Node.js 製のビルド・ローカル配信スクリプト（`scripts/`）
- ESLint、`node:test`
- GitHub Pages（`gh-pages` ブランチ）

## 開発

### 必要な環境

- Node.js 20 以上（`package.json` の `engines`。CI は Node.js 22）

### Firebase 設定の読み込み

リポジトリ直下に `firebase-config.json`（上記の JSON。`.gitignore` 済み）を置くか、環境変数 `FIREBASE_CONFIG` を指定します。未設定でもビルドは成功し、画面には「Firebase が未設定です」と表示されます。

ローカルで確認する場合は、Authentication の承認済みドメインに `localhost` が含まれていることを確認してください（既定で含まれています）。ローカル確認用のデータベースパスを分けたい場合は `TIMER_PATH=previews/pr-0/timer npm run dev` のように指定できます。

### コマンド

```bash
npm ci
npm run dev   # dist/ をビルドして http://localhost:3000/ で配信
npm run lint  # ESLint と database.rules.json の構文チェック
npm test      # テスト（node:test）
npm run build # dist/ を生成
```

## ディレクトリ構成

```text
public/                 配信するファイル一式（ビルド時に dist/ へコピー）
  index.html            タイマー画面
  admin/                管理画面と管理画面用の manifest
  js/                   画面のスクリプト（同期・時刻補正・タイマー計算など）
  css/                  スタイル
  icons/                PWA のアイコン
  sw.js                 Service Worker
  manifest.webmanifest  タイマー画面の manifest
scripts/                ビルド・ローカル配信・gh-pages へのデプロイのスクリプト
test/                   node:test のテスト
database.rules.json     Realtime Database のセキュリティルール
```

## デプロイ

- `main` への PR マージ時（または Actions の **Deploy to GitHub Pages** の手動実行）に `deploy.yml` がビルドし、`gh-pages` ブランチのルートへ本番を公開します（`pr-*` は残します）
- PR ごとに `pr-preview.yml` がプレビューを `gh-pages` の `pr-<番号>/` に公開し、URL と QR コードを PR にコメントします。PR クローズ時に削除します
- PR プレビューは Firebase 上で本番とは別のパス（`previews/pr-<番号>/timer`）を使うため、プレビューで操作しても本番のタイマーには影響しません。フォークからの PR はプレビューの対象外です

初回のみ次の設定が必要です。

1. GitHub の **Settings → Secrets and variables → Actions → Variables** で、リポジトリ変数 `FIREBASE_CONFIG` に上記の JSON を登録する（Firebase コンソールに表示される `const firebaseConfig = { ... };` 形式をそのまま貼り付けても構いません）
2. **Settings → Pages** で **Source** を「Deploy from a branch」、ブランチを `gh-pages` / `/ (root)` にする

## 開発ルール

開発ルールは [AGENTS.md](./AGENTS.md) を参照してください。
貢献の手順は [CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。

## ライセンス

MIT
