import { defineConfig } from '@vite-pwa/assets-generator/config'

// iOS のホーム画面用アイコンと Android のマスカブルアイコンの余白を塗る色（アイコンの背景色）
const background = '#0f172a'

export default defineConfig({
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']], padding: 0 },
    maskable: { sizes: [512], padding: 0.1, resizeOptions: { background } },
    apple: { sizes: [180], padding: 0, resizeOptions: { background } },
  },
  images: ['public/icon.svg'],
})
