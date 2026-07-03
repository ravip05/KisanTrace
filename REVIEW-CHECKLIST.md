# REVIEW-CHECKLIST.md

## General Quality
- [ ] Code is readable and follows project conventions.
- [ ] No `any` types used; strict TypeScript enforced.
- [ ] No console logs or debug statements in production code.
- [ ] Error handling is consistent and user-friendly.

## PWA & Offline
- [ ] Service worker caches all required assets for offline use.
- [ ] AI Model is pre-cached and available without network.
- [ ] App loads and functions in Airplane Mode.
- [ ] RxDB writes are successful without internet.

## UI/UX
- [ ] Design matches "Bold, Earthy, Farmer-friendly" vibe.
- [ ] High contrast for sunlight readability (WCAG AA).
- [ ] Single-thumb navigation targets are appropriately sized.
- [ ] Responsive on small Android screens.

## Performance
- [ ] Model inference time < 4 seconds on low-end target.
- [ ] Initial bundle size stays within targets.
- [ ] No memory leaks in the camera/inference loop.

## Security
- [ ] No PII or images uploaded without consent.
- [ ] Backend API uses appropriate authentication for sync.
- [ ] Input validation applied to all sync payloads.

## Verification
- [ ] `npm run lint` passes.
- [ ] `npm test` passes.
- [ ] Manual verification on a mobile browser/device (if possible).
