// PWA 関連ファイル（manifest / Service Worker）の整合性テスト

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));

/** sw.js の APP_SHELL に列挙されたパスを取り出す */
function readAppShell() {
  const source = readFileSync(path.join(publicDir, 'sw.js'), 'utf8');
  const list = source.match(/const APP_SHELL = \[([\s\S]*?)\]/)[1];
  return [...list.matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

describe('manifest.webmanifest', () => {
  for (const file of ['manifest.webmanifest', 'admin/manifest.webmanifest']) {
    it(`${file} のアイコンがすべて存在し、192px・512px・maskable を含む`, () => {
      const manifest = JSON.parse(readFileSync(path.join(publicDir, file), 'utf8'));
      const baseDir = path.dirname(path.join(publicDir, file));
      for (const icon of manifest.icons) {
        assert.ok(existsSync(path.join(baseDir, icon.src)), `${icon.src} が見つかりません`);
      }
      const sizes = manifest.icons.map((icon) => icon.sizes);
      assert.ok(sizes.includes('192x192'));
      assert.ok(sizes.includes('512x512'));
      assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));
      assert.equal(manifest.start_url, './');
    });
  }
});

describe('Service Worker のキャッシュ対象', () => {
  it('列挙したファイルがすべて存在する', () => {
    for (const file of readAppShell()) {
      const target = file.endsWith('/') ? path.join(file, 'index.html') : file;
      assert.ok(existsSync(path.join(publicDir, target)), `${file} が見つかりません`);
    }
  });

  it('public/js のすべてのファイルを含む（オフラインで import が欠けないように）', () => {
    const shell = readAppShell();
    for (const name of readdirSync(path.join(publicDir, 'js'))) {
      assert.ok(shell.includes(`js/${name}`), `js/${name} が APP_SHELL にありません`);
    }
  });
});
