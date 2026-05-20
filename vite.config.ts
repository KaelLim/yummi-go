import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    // Allow the dev server to be reached through any *.trycloudflare.com
    // quick tunnel. Vite 8 blocks unknown hosts by default.
    allowedHosts: ['.trycloudflare.com'],
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      manifest: {
        name: 'Yummi Go 好味走走',
        short_name: 'Yummi Go',
        description: '蔬食挑戰 + 寵物陪伴',
        theme_color: '#1d5937',
        background_color: '#fef9ed',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff2}'],
        cleanupOutdatedCaches: true,
        // Skip the "wait for all tabs to close" install step so a fresh
        // deploy can take over an already-open tab on the user's next
        // navigation. clientsClaim makes the new SW assume control of
        // existing windows immediately. Trade-off: a user mid-task may
        // notice a one-time reload, but prototype iteration speed wins.
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tool\.tzuchi-org\.tw\/.*/,
            handler: 'NetworkFirst',
            options: { cacheName: 'drust-api', networkTimeoutSeconds: 5 },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/([abc]\.)?tile\.openstreetmap\.org\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'osm-tiles', expiration: { maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
});
