// すべての JavaScript ファイルの構文チェックを行う（外部依存なしの簡易 Lint）

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';

const TARGET_DIRS = ['public', 'scripts', 'test'];

function collect(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collect(fullPath);
    return entry.name.endsWith('.js') ? [fullPath] : [];
  });
}

const files = TARGET_DIRS.flatMap(collect);
let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) failed = true;
}

if (failed) {
  console.error('構文エラーが見つかりました');
  process.exit(1);
}
console.log(`${files.length} 件のファイルの構文チェックに成功しました`);
