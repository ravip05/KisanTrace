# Testing Strategy

## Frameworks
- **Unit Tests:** Vitest (for model utility functions and sync logic).
- **E2E Tests:** Playwright (focusing on the Service Worker / Offline lifecycle).
- **Manual Verification:** Android Chrome "Add to Home Screen" testing.

## Rules & Requirements
- **Coverage:** 80% coverage on sync and inference utility functions.
- **Offline Verification:** Playwright tests must simulate "offline" mode to verify the PWA loads from cache.
- **Accuracy Testing:** A dedicated `npm run test:accuracy` script to run the LiteRT model against a validation dataset of 500 field images.

## Execution
- **Run all:** `npm test`
- **Run accuracy pass:** `npm run test:accuracy`
- **Single file:** `npx vitest path/to/file.test.ts`
