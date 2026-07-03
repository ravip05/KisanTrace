/// <reference lib="webworker" />
/// <reference types="vite-plugin-pwa/info" />
/// <reference types="vite/client" />

/**
 * sw.ts — Kisan-Trace Service Worker
 *
 * This file handles the custom Service Worker lifecycle events.
 * The heavy caching strategies (CacheFirst for .tflite, NetworkFirst for API)
 * are defined and injected by Workbox via vite-plugin-pwa / vite.config.ts.
 *
 * This file only handles the manual "Skip Waiting" flow to address
 * Edge Case 6.7: Service Worker Update Conflicts.
 *
 * --- DO NOT MODIFY WITHOUT EXPLICIT APPROVAL ---
 * Changing this file can break the entire offline-first experience.
 */

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

// Inject precache manifest (populated by Workbox at build time)
// This includes all app shell assets, the AI model, and disease JSON files.
declare const self: ServiceWorkerGlobalScope

// Clean up caches from old SW versions on activation
cleanupOutdatedCaches()

// Register all pre-cached assets from the Vite build manifest
precacheAndRoute(self.__WB_MANIFEST)

// --- EDGE CASE 6.7: Manual Update Prompt ---
// When the new SW has downloaded and is waiting, we send a message to all
// active browser clients so the React UI can show the "Update Ready" modal.
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    // The user tapped "Update Now" in the UI. Activate this new SW immediately.
    self.skipWaiting()
  }
})

// Claim all open tabs immediately after activation so the new SW takes control
// without requiring the user to reload the page again.
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim())
})
