# Share Timer

Web サイトにアクセスした全員が、**同期されたカウントダウンタイマー** を見られるアプリです。
タイマーの操作（時間設定・スタート・一時停止・リセット）は管理画面からのみ行えます。

## 画面構成

| URL | 内容 |
| --- | --- |
| `/` | タイマーのみを大きく表示するトップ画面。クリックで全画面表示を切り替え |
| `/admin` | 管理画面。管理パスワードでログインし、時間設定・スタート・一時停止・リセットを操作 |

## 起動方法

Node.js 20 以上が必要です。外部の npm パッケージには依存していません。

```bash
ADMIN_PASSWORD=your-password npm start
```

- タイマー画面: http://localhost:3000/
- 管理画面: http://localhost:3000/admin

### 環境変数

| 変数名 | 既定値 | 説明 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | （起動ごとにランダム生成） | 管理操作用のパスワード。未設定の場合は起動ログに一時パスワードを表示 |
| `PORT` | `3000` | 待ち受けポート |
| `HOST` | `0.0.0.0` | 待ち受けアドレス |
| `DATA_FILE` | `data/state.json` | タイマー状態の保存先。空文字を指定すると保存しない（再起動で初期化） |

### 開発用コマンド

```bash
npm run dev   # ファイル変更時に自動再起動
npm run lint  # 構文チェック
npm test      # テスト（node:test）
```

## 同期の仕組み

- サーバーはタイマーの状態を「終了予定時刻（サーバー時刻）」として保持します
- 閲覧者は Server-Sent Events（`/api/events`）で状態の変更をリアルタイムに受け取ります
- 各ブラウザは `/api/time` で端末とサーバーの時刻差を計測・補正し、手元で残り時間を描画します。
  そのため端末の時計がずれていても全員が同じ残り時間を表示します
- 途中からアクセスした人や、通信が切れて再接続した人にも最新の状態が送られます

## API

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| `GET` | `/api/events` | 不要 | 状態変更の SSE ストリーム |
| `GET` | `/api/state` | 不要 | 現在の状態 |
| `GET` | `/api/time` | 不要 | サーバー時刻（時刻同期用） |
| `POST` | `/api/auth` | 必要 | パスワードの確認 |
| `POST` | `/api/control` | 必要 | 操作。`{"type":"set","durationMs":300000}` / `{"type":"start"}` / `{"type":"pause"}` / `{"type":"reset"}` |

認証は `Authorization: Bearer <ADMIN_PASSWORD>` ヘッダーで行います。同一 IP から 10 分間に 10 回認証に失敗すると一時的に拒否されます。

## デプロイ時の注意

- 常時起動する Node.js サーバーが必要です（GitHub Pages などの静的ホスティングでは動作しません）。
  そのため、テンプレートに含まれていた GitHub Pages 向けの `deploy.yml` / `pr-preview.yml` ワークフローは削除しています
- 状態はサーバー 1 台のメモリとファイルで管理しているため、複数台へのスケールアウトには対応していません
- パスワードを平文で送信するため、公開環境では必ず HTTPS で配信してください
- nginx などのリバースプロキシ配下に置く場合は、SSE のためにバッファリングとタイムアウトに注意してください

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
