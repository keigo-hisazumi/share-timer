# Share Timer

Web サイトにアクセスした全員が、**同期されたカウントダウンタイマー** を見られるアプリです。
タイマーの操作（時間設定・スタート・一時停止・リセット）は管理画面からのみ行えます。

GitHub Pages で配信する静的サイトで、タイマーの同期と管理者認証には Firebase（Realtime Database / Authentication）を使います。

- 本番: https://keigo-hisazumi.github.io/share-timer/
- 管理画面: https://keigo-hisazumi.github.io/share-timer/admin/
- PR プレビュー: `https://keigo-hisazumi.github.io/share-timer/pr-<PR番号>/`（PR にコメントで URL が投稿されます）

## 画面構成

| パス | 内容 |
| --- | --- |
| `/` | タイマーのみを大きく表示するトップ画面。クリックで全画面表示を切り替え |
| `/admin/` | 管理画面。管理者アカウントでログインし、時間設定・スタート・一時停止・リセットを操作 |

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

## GitHub Pages での公開

1. GitHub の **Settings → Secrets and variables → Actions → Variables** で、リポジトリ変数 `FIREBASE_CONFIG` に上記の JSON を登録する（Firebase コンソールに表示される `const firebaseConfig = { ... };` 形式をそのまま貼り付けても構いません）
2. `main` へのマージ（または Actions の **Deploy to GitHub Pages** を手動実行）で `gh-pages` ブランチに公開される
3. **Settings → Pages** で **Source** を「Deploy from a branch」、ブランチを `gh-pages` / `/ (root)` にする（初回のみ）

| ワークフロー | 内容 |
| --- | --- |
| `deploy.yml` | `main` へのプッシュで `gh-pages` のルートに本番を公開（`pr-*` は残す） |
| `pr-preview.yml` | PR ごとに `gh-pages` の `pr-<番号>/` へプレビューを公開し、URL と QR コードをコメント。PR クローズ時に削除 |

- PR プレビューは Firebase 上で本番とは別のパス（`previews/pr-<番号>/timer`）を使うため、プレビューで操作しても本番のタイマーには影響しません
- フォークからの PR はプレビューの対象外です
- `FIREBASE_CONFIG` が未登録の場合もビルドは成功し、画面には「Firebase が未設定です」と表示されます

## ローカルでの確認

Node.js 20 以上が必要です。外部の npm パッケージには依存していません。

```bash
# リポジトリ直下に firebase-config.json（上記の JSON。.gitignore 済み）を置くか、環境変数 FIREBASE_CONFIG を指定する
npm run dev   # dist/ をビルドして http://localhost:3000/ で配信
npm run lint  # 構文チェック
npm test      # テスト（node:test）
npm run build # dist/ を生成
```

ローカルで確認する場合は、Authentication の承認済みドメインに `localhost` が含まれていることを確認してください（既定で含まれています）。
ローカル確認用のデータベースパスを分けたい場合は `TIMER_PATH=previews/pr-0/timer npm run dev` のように指定できます。

## AI アシスタント運用方針

このテンプレートは **Claude をメインの AI アシスタント** として利用し、**Cursor / GitHub Copilot をサブツール** として併用するワークフローを想定しています。開発ルールの **正本は [`AGENTS.md`](./AGENTS.md)** で、各ツール向けの指示書はそれを参照する構成です。

| ツール | ファイル | 役割 |
| --- | --- | --- |
| 汎用 AI エージェント | [`AGENTS.md`](./AGENTS.md) | **正本**。すべてのルールはここに集約 |
| Claude Code | [`CLAUDE.md`](./CLAUDE.md) | `AGENTS.md` を参照 |
| Cursor | [`.cursor/rules/project.mdc`](./.cursor/rules/project.mdc) | `AGENTS.md` を参照 |
| GitHub Copilot | [`.github/copilot-instructions.md`](./.github/copilot-instructions.md) | `AGENTS.md` を参照 |

## 含まれるもの

### AI 向け指示書
- `AGENTS.md` — **正本**（汎用 AI エージェント向け）
- `CLAUDE.md` — Claude Code 向け（`AGENTS.md` を参照）
- `.cursor/rules/project.mdc` — Cursor 向け（`AGENTS.md` を参照）
- `.github/copilot-instructions.md` — GitHub Copilot 向け（`AGENTS.md` を参照）
- `.github/copilot-setup-steps.yml` — Copilot Coding Agent のビルド環境（日本語フォント）

### Issue / PR
- `.github/ISSUE_TEMPLATE/` — バグ報告 / 機能要望 / 質問テンプレート
- `.github/PULL_REQUEST_TEMPLATE.md` — PR テンプレート（日本語）
- `.github/CODEOWNERS` — レビュー自動アサイン
- `CONTRIBUTING.md` / `SECURITY.md` — 貢献ガイドとセキュリティポリシー

### CI/CD
- `.github/workflows/ci.yml` — push / PR 時の lint / typecheck / test / build（言語非依存の雛形）
- `.github/workflows/actionlint.yml` — workflow 自体の Lint
- `.github/workflows/codeql.yml` — セキュリティスキャン（言語確定後に有効化）
- `.github/workflows/release-drafter.yml` + `.github/release-drafter.yml` — リリースノート自動生成
- `.github/workflows/screenshot.yml` — PR スクリーンショット用 Playwright 雛形
- `.github/dependabot.yml` — 依存関係の自動更新

### 環境差異の吸収
- `.editorconfig` — エディタ間のインデント／改行統一
- `.gitattributes` — テキスト/バイナリ・改行コードの正規化
- `.gitignore` — OS / 言語 / ビルド成果物
- `.vscode/extensions.json`, `.vscode/settings.json` — VSCode 推奨拡張・設定

### その他
- `LICENSE` — MIT

## 使い方

1. このテンプレートから新しいリポジトリを作成（GitHub の **Use this template** ボタン、または clone）。
2. `README.md`、`CODEOWNERS`、`LICENSE` のプロジェクト名や著作権者を書き換える。
3. 言語/フレームワークが決まったら以下を有効化:
   - `.github/workflows/ci.yml` の TODO コメントを実コマンドに差し替え
   - `.github/workflows/codeql.yml` の `if: ${{ false }}` を外し、`matrix.language` を設定
   - `.github/workflows/screenshot.yml` の `if: ${{ false }}` を外し、Playwright を導入
   - `.github/dependabot.yml` の対応する `package-ecosystem` のコメントアウトを外す
4. **リポジトリ作成後の手動設定**（テンプレートに含められないため `README` で案内）:
   - `main` ブランチ保護ルールを設定（PR 必須、CI パス必須、force push 禁止）
   - GitHub Actions の権限を `Read and write` 許可（Release Drafter 用）
   - Secret スキャン / Dependabot Alerts を有効化

## VSCode 環境

VSCode をエディタとして使うワークフローを想定しています。`.vscode/extensions.json` に記載の拡張をインストールすると、Lint / Format / Spell check が即座に動きます。

## ライセンス

MIT
