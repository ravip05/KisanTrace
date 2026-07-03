import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' registers the SW and lets us control the update UI ourselves.
      // The custom SW file (src/sw.ts) handles the SKIP_WAITING message.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: 'auto',

      // These are the assets Workbox will pre-cache on install.
      // The AI model is the most critical asset — it MUST be available offline.
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'apple-touch-icon.png',
        'icons/*.png',
        'models/*.tflite',   // <-- The entire AI model is pre-cached here
        'diseases/*.json',   // <-- Treatment content pre-cached here
      ],

      manifest: {
        name: 'Kisan-Trace',
        short_name: 'KisanTrace',
        description: 'Offline-first AI crop disease diagnosis for Indian farmers',
        theme_color: '#2D5016',
        background_color: '#FAF7F2',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'hi',
        categories: ['agriculture', 'health', 'utilities'],
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },

      workbox: {
        // Workbox's Stale-While-Revalidate strategy for the app shell.
        // The app always serves from cache immediately (fast), then checks
        // for an update in the background.
        runtimeCaching: [
          {
            // Cache the AI model with a CacheFirst strategy.
            // The model is versioned via its filename (e.g., model_v1_int8.tflite),
            // so it will only be re-fetched when the filename changes.
            urlPattern: /\/models\/.+\.tflite$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'kisan-trace-model-cache',
              expiration: {
                maxEntries: 2, // Keep current + 1 previous version
                maxAgeSeconds: 60 * 60 * 24 * 90, // 90 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache treatment JSON data (diseases/*.json) with CacheFirst.
            // This is the offline "knowledge base" for treatment recommendations.
            urlPattern: /\/diseases\/.+\.json$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'kisan-trace-content-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // NetworkFirst for any API calls (metadata sync to our backend).
            // If the network fails, serve the last cached response.
            urlPattern: /^https:\/\/api\.kisan-trace\..*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'kisan-trace-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              networkTimeoutSeconds: 10, // Fallback to cache if server takes > 10s
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],

        // Files to exclude from pre-caching (node_modules dev artifacts, etc.)
        globIgnores: ['**/node_modules/**/*', '**/.vite/**/*'],

        // Skip waiting — force new SW to activate immediately when the user
        // taps "Update Now" in our custom update prompt UI.
        skipWaiting: false, // We handle this manually via the UI (see edge case 6.7)
        clientsClaim: true,
      },

      // DevOptions: Disable SW in dev mode to avoid stale cache issues
      devOptions: {
        enabled: false,
      },
    }),
  ],

  // Vite handles WASM and Worker bundling.
  optimizeDeps: {
    include: ['@litertjs/core'],
  },

  server: {
    headers: {
      // COOP and COEP headers are required for SharedArrayBuffer,
      // which WASM/XNNPACK uses for multi-threaded inference.
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  worker: {
    format: 'es',
  },
})
