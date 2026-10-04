#!/usr/bin/env bash
# gh-pages ブランチへの公開・削除を行う（GitHub Actions から実行する想定）
#
# 使い方:
#   scripts/gh-pages.sh deploy <src-dir> <dest>   src-dir の内容を dest に公開する
#   scripts/gh-pages.sh remove <dest>             dest を削除する
#
# dest は "." （本番。pr-* ディレクトリは残す）または "pr-<番号>" （PR プレビュー）
# 本番デプロイと複数の PR プレビューが同時に push しても失敗しないよう、競合時は最新を取り直して再試行する

set -euo pipefail

mode="${1:?mode を指定してください（deploy / remove）}"
case "$mode" in
  deploy)
    src="$(cd "${2:?src-dir を指定してください}" && pwd)"
    dest="${3:?dest を指定してください}"
    ;;
  remove)
    dest="${2:?dest を指定してください}"
    ;;
  *)
    echo "不明な mode です: $mode" >&2
    exit 1
    ;;
esac

if [[ ! "$dest" =~ ^(\.|pr-[0-9]+)$ ]]; then
  echo "dest が不正です: $dest" >&2
  exit 1
fi
if [[ "$mode" == "remove" && "$dest" == "." ]]; then
  echo "本番（.）は削除できません" >&2
  exit 1
fi

branch="gh-pages"
workdir="$(mktemp -d)"
tmp_branch="$branch-tmp-$$"
cleanup() {
  git worktree remove --force "$workdir" 2>/dev/null || rm -rf "$workdir"
  git branch -D "$tmp_branch" >/dev/null 2>&1 || true
}
trap cleanup EXIT
git_commit() {
  git -C "$workdir" \
    -c user.name="github-actions[bot]" \
    -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
    commit -q -m "$1"
}

prepare_worktree() {
  cleanup
  if git ls-remote --exit-code --heads origin "$branch" >/dev/null; then
    git fetch -q --depth=1 origin "$branch"
    git worktree add -q --detach "$workdir" FETCH_HEAD
  else
    # gh-pages ブランチがまだ無い場合は空の履歴から作る
    git worktree add -q --orphan -b "$tmp_branch" "$workdir"
  fi
}

apply_changes() {
  if [[ "$mode" == "remove" ]]; then
    rm -rf "${workdir:?}/$dest"
  elif [[ "$dest" == "." ]]; then
    # 本番: PR プレビュー（pr-*）以外を入れ替える
    find "$workdir" -mindepth 1 -maxdepth 1 ! -name .git ! -name 'pr-*' -exec rm -rf {} +
    cp -R "$src"/. "$workdir"/
  else
    rm -rf "${workdir:?}/$dest"
    mkdir -p "$workdir/$dest"
    cp -R "$src"/. "$workdir/$dest"/
  fi
  # Jekyll の処理を無効化する
  touch "$workdir/.nojekyll"
}

for attempt in 1 2 3 4 5; do
  prepare_worktree
  apply_changes
  git -C "$workdir" add -A
  if git -C "$workdir" diff --cached --quiet; then
    echo "変更がないためスキップします"
    exit 0
  fi
  git_commit "deploy: ${mode} ${dest} (${GITHUB_SHA:-local})"
  if git -C "$workdir" push -q origin "HEAD:refs/heads/$branch"; then
    echo "gh-pages への ${mode} が完了しました（${dest}）"
    exit 0
  fi
  echo "push に失敗しました。再試行します（${attempt} 回目）" >&2
  sleep $((attempt * 3))
done

echo "gh-pages への push に失敗しました" >&2
exit 1
