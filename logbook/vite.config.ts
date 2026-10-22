import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative base so the build works from any sub-path (e.g. GitHub Pages /map/logbook/).
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Logbook',
        short_name: 'Logbook',
        description: 'Workout and nutrition logbook',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0A0A0B',
        theme_color: '#0A0A0B',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Cache Open Food Facts product lookups so scanned items work offline later.
            urlPattern: /^https:\/\/(world|fr)\.openfoodfacts\.org\/api\/.*/,
            handler: 'NetworkFirst',
            options: { cacheName: 'off-api', networkTimeoutSeconds: 6, expiration: { maxEntries: 300 } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
