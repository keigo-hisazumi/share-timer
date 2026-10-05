// Service Worker（PWA 用）
//
// - 画面（HTML / CSS / JS / アイコン）をキャッシュし、オフラインでも起動できるようにする
// - 同一オリジンのファイルはネットワーク優先（更新をすぐ反映し、失敗時のみキャッシュを返す）
// - バージョン付き URL の Firebase SDK（gstatic）はキャッシュ優先
// - タイマーの同期（Realtime Database）は扱わない
//
// BUILD_ID はビルド時（scripts/build.js）に置き換わり、デプロイごとに Service Worker が更新される。

const BUILD_ID = 'dev';

const scopeUrl = new URL(self.registration.scope);
// 本番と PR プレビュー（pr-<番号>/）は同じオリジンでキャッシュを共有するため、スコープごとに名前を分ける
const CACHE_PREFIX = `share-timer:${scopeUrl.pathname}:`;
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_ID}`;

const APP_SHELL = [
  './',
  'index.html',
  'admin/',
  'admin/index.html',
  'css/style.css',
  'js/admin.js',
  'js/clock.js',
  'js/config.js',
  'js/firebase.js',
  'js/format.js',
  'js/pwa.js',
  'js/sync.js',
  'js/timer.js',
  'js/viewer.js',
  'favicon.svg',
  'manifest.webmanifest',
  'admin/manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
].map((file) => new URL(file, scopeUrl).href);

const FIREBASE_SDK_ORIGIN = 'https://www.gstatic.com';
const FIREBASE_SDK_PATH = '/firebasejs/';

/** 本番スコープ配下の PR プレビュー（pr-<番号>/）は各プレビュー自身の Service Worker に任せる */
function isOtherScope(url) {
  const relative = url.pathname.slice(scopeUrl.pathname.length);
  return /^pr-[0-9]+(\/|$)/.test(relative);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // 最新のファイルを取得するため HTTP キャッシュを使わない
      await cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' })));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

/** ネットワーク優先。成功したらキャッシュを更新し、失敗したらキャッシュを返す */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      // 未キャッシュのページはタイマー画面で代用する
      const fallback = await cache.match(new URL('./', scopeUrl).href);
      if (fallback) return fallback;
    }
    throw error;
  }
}

/** キャッシュ優先（バージョン付きで内容が変わらない URL 向け） */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === FIREBASE_SDK_ORIGIN && url.pathname.startsWith(FIREBASE_SDK_PATH)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.origin !== scopeUrl.origin || !url.pathname.startsWith(scopeUrl.pathname) || isOtherScope(url)) {
    return;
  }
  event.respondWith(networkFirst(request));
});
