# AGENTS.md — Master Plan for Kisan-Trace

## Project Overview & Stack
**App:** Kisan-Trace
**Overview:** An offline-first, edge-AI diagnostic PWA designed for rural Indian farmers. It provides agronomist-level crop disease diagnosis on low-end Android devices entirely without internet connectivity using on-device inference (LiteRT/WASM).
**Stack:** React, Vite, Workbox (PWA), LiteRT (TFLite/WASM), RxDB (IndexedDB), Node.js (Express), PostgreSQL, Python/FastAPI (ML Training).
**Critical Constraints:** 
- Mobile-first, sunlight-readable design.
- Full offline functionality for AI diagnostics.
- Model size < 5MB; total app size < 8MB.
- Accuracy North Star: ≥85% on Indian field-condition images.

## Setup & Commands
- **Setup:** `npm install`
- **Development:** `npm run dev`
- **Testing:** `npm test`
- **Build:** `npm run build`
- **PWA Preview:** `npm run preview`

## Protected Areas
Do NOT modify these areas without explicit human approval:
- **ML Models:** `client/public/models/` (pre-trained .tflite files).
- **Service Worker:** `client/src/sw.js` (complex caching logic).
- **Inference Loop:** `client/src/ai/` (LiteRT WASM integration).
- **Infrastructure:** Dockerfiles and deployment workflows.

## Coding Conventions
- **Formatting:** ESLint + Prettier.
- **Architecture:** Feature-based folder organization. Separate AI logic from UI.
- **Type Safety:** Strict TypeScript. No `any`. Use `unknown` with type guards for external data.
- **Offline First:** All UI writes must go to RxDB first; sync happens in the background.

## Agent Behaviors
1. **Plan Before Execution:** ALWAYS propose a plan before changing more than one file.
2. **Refactor Over Rewrite:** Prefer incremental refactors.
3. **Context Compaction:** Write states to `MEMORY.md` regularly.
4. **Iterative Verification:** Run tests/linters after each change.
5. **Sunlight Test:** For UI changes, verify contrast ratios for outdoor sunlight readability.
6. **Edge Case Awareness:** Refer to `TechDesign-KisanTrace-MVP.md` Section 6 for resilience strategies.
