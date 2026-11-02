# Share Timer

ログイン不要で誰でもカウントダウンタイマーを作成し、**同期された残り時間** をほかの人と共有できるアプリです。タイマーごとに管理用 ID と表示用 ID を発行し、管理画面で操作した内容が表示画面を開いている全員に反映されます。

- 本番: <https://keigo-hisazumi.github.io/share-timer/>

## 主な機能

- ログインなしでタイマーを作成でき、タイマーごとに管理用 ID と共有用の表示 ID を発行
- 管理画面から、タイトル・時間設定・スタート・一時停止・リセットを操作
- タイトルが未記入のタイマーは設定時間をタイトルとして表示
- タイマー一覧で、これまでに作成されたタイマーのタイトルと設定時間を表示し、選ぶと表示画面を開く
- 表示 ID（または表示画面の URL）を入力して表示画面を直接開ける
- 表示画面はクリックで全画面表示を切り替え
- 時間は時・分・秒で指定（最大 99:59:59）でき、1 / 3 / 5 / 10 / 30 / 60 分のプリセットも選べる
- 端末の時計がずれていても、サーバー時刻で補正して全員が同じ残り時間を表示
- PWA としてホーム画面に追加でき、オフラインでも画面自体は起動

## 使い方

1. トップページで「自分のタイマーを作成する」を押すと、新しいタイマーの管理画面が開く
2. 管理画面でタイトルを入力して「保存」し、時・分・秒を入力するかプリセットを選んで「設定」を押す
3. 管理画面に表示される表示 ID（または「表示画面の URL をコピー」でコピーした URL）を見てほしい人に伝える
4. 「スタート」「一時停止」「リセット」で操作すると、表示画面を開いている全員の表示に反映される
5. 見る側はトップページの「ほかの人のタイマーを見に行く」からタイマー一覧を開き、一覧から選ぶか表示 ID を入力する

管理画面の URL（管理用 ID）を知っている人は誰でもタイマーを操作できます。管理用 ID はほかの人に教えず、あとで操作できるようにブックマークなどで保管してください（再発行はできません）。

| パス | 内容 |
| --- | --- |
| `/` | トップページ。「自分のタイマーを作成する」「ほかの人のタイマーを見に行く」の 2 つのボタン |
| `/list/` | タイマー一覧。作成されたタイマーのタイトルと設定時間の一覧と、表示 ID の入力欄 |
| `/manage/?id=<管理用 ID>` | タイマー管理画面。タイトル・時間設定・スタート・一時停止・リセットを操作 |
| `/view/?id=<表示 ID>` | タイマー表示画面。タイマーを大きく表示し、クリックで全画面表示を切り替え |

## ID の仕組み

- 管理用 ID: 英数字と `-` `_` の 20 文字（推測できない長さ）。タイマーの操作に使う秘密の ID
- 表示 ID: 英小文字と数字の 8 文字（`0` `1` `i` `l` `o` は紛らわしいため使わない）。手入力しやすい公開の ID
- データベース上では次のように保存します
  - `timers/<表示 ID>`: タイマーの状態とタイトル。誰でも読める
  - `manage/<管理用 ID>`: 表示 ID と状態のバージョン。管理用 ID を知っている人だけが読み書きできる（一覧は取得できない）
  - `views/<表示 ID>`: 管理用 ID。誰も読めず、セキュリティルールが持ち主の確認にだけ使う
- タイマーを更新するときは `timers/<表示 ID>` と `manage/<管理用 ID>/version` を同じバージョンで同時に書き込みます。セキュリティルール（[`database.rules.json`](./database.rules.json)）は `views/<表示 ID>` が指す管理用 ID のバージョンと一致することを確認するため、管理用 ID を知らない人はタイマーを書き換えられません
- タイマーの削除はできません

## PWA（ホーム画面への追加）

アプリ全体を PWA としてインストールできます（Chrome / Edge のアドレスバーのインストールボタン、iOS Safari の「共有 → ホーム画面に追加」など）。

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
- 同じタイマーを複数の管理画面から同時に操作した場合、後から書き込んだ側はバージョンの不一致で拒否されるため、最新の状態を読み直して操作をやり直します

## Firebase の設定（初回のみ）

1. [Firebase コンソール](https://console.firebase.google.com/) でプロジェクトを作成する（無料の Spark プランで動作します）
2. **Build → Realtime Database** でデータベースを作成する（ロケーションは任意。例: `asia-southeast1`）
3. Realtime Database の **ルール** タブに [`database.rules.json`](./database.rules.json) の内容を貼り付けて公開する
4. **プロジェクトの設定 → マイアプリ** でウェブアプリを追加し、表示される `firebaseConfig` の値を JSON にする

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

ローカル確認用のデータを本番と分けたい場合は `DATA_ROOT=previews/pr-0 npm run dev` のように指定できます。

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
  index.html            トップページ
  list/                 タイマー一覧画面
  manage/               タイマー管理画面
  view/                 タイマー表示画面
  js/                   画面のスクリプト（同期・時刻補正・タイマー計算・ID 発行など）
  css/                  スタイル
  icons/                PWA のアイコン
  sw.js                 Service Worker
  manifest.webmanifest  PWA の manifest
scripts/                ビルド・ローカル配信・gh-pages へのデプロイのスクリプト
test/                   node:test のテスト
database.rules.json     Realtime Database のセキュリティルール
```

## デプロイ

- `main` への PR マージ時（または Actions の **Deploy to GitHub Pages** の手動実行）に `deploy.yml` がビルドし、`gh-pages` ブランチのルートへ本番を公開します（`pr-*` は残します）
- PR ごとに `pr-preview.yml` がプレビューを `gh-pages` の `pr-<番号>/` に公開し、URL と QR コードを PR にコメントします。PR クローズ時に削除します
- PR プレビューは Firebase 上で本番とは別のパス（`previews/pr-<番号>/`）を使うため、プレビューで作成・操作したタイマーは本番には影響しません。フォークからの PR はプレビューの対象外です

初回のみ次の設定が必要です。

1. GitHub の **Settings → Secrets and variables → Actions → Variables** で、リポジトリ変数 `FIREBASE_CONFIG` に上記の JSON を登録する（Firebase コンソールに表示される `const firebaseConfig = { ... };` 形式をそのまま貼り付けても構いません）
2. **Settings → Pages** で **Source** を「Deploy from a branch」、ブランチを `gh-pages` / `/ (root)` にする

## 開発ルール

開発ルールは [AGENTS.md](./AGENTS.md) を参照してください。
貢献の手順は [CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。

## ライセンス

MIT
