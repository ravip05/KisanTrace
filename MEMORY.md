# System Memory & Context 🧠
<!--
AGENTS: Update this file after every major milestone, structural change, or resolved bug.
DO NOT delete historical context if it is still relevant. Compress older completed items.
-->

## 🏗️ Active Phase & Goal
**Current Task:** Phase 2 COMPLETE — Core Diagnostic Loop is functional.
**Next Steps:**
1. Provision IndiaAI Compute GPU for ML backend.
2. Implement Auth middleware for sync endpoints.
3. Optimize PWA asset caching for extreme low bandwidth.

## 📂 Architectural Decisions
- 2026-05-15 - Chose React + Vite for the PWA core due to excellent WASM and Service Worker support.
- 2026-05-15 - Decided on RxDB for local storage to handle reactive sync with the backend.
- 2026-05-15 - RxDB sync protocol: LWW (Last Writer Wins) for MVP. UUIDv7 ensures idempotent upserts.
- 2026-05-15 - ML export pipeline: PyTorch → ONNX (opset 17) → TFLite INT8 (with calibration dataset).
- 2026-05-15 - Server-api sync checkpoint uses server-side `updated_at` timestamp (not client `scannedAt`) to avoid clock skew gaps.

## 🐛 Known Issues & Quirks
- Vite 8 requires Node 22.12+; current machine is on 22.11.0. Pinned to Vite 5.
- IndiaAI Compute access not yet provisioned — ML training routes are placeholders.
- No auth on sync endpoints yet — to be added in Phase 2.

## 📜 Completed Phases
- [x] Part 1: Deep Research
- [x] Part 2: Product Requirements Document (PRD)
- [x] Part 3: Technical Design Document
- [x] Initial scaffold (client PWA + server-api + ml-pipeline)
- [x] Database schema creation (RxDB client + Postgres server)
- [x] Bold Earthy UI Layout (Home, Scanner, Report screens)
- [x] AI Inference integration (LiteRT WASM Web Worker)
- [x] RxDB Sync Service (connect client to server-api endpoints)
- [x] Phase 2: Core Diagnostic Loop
- [x] Real-time WebRTC Camera Viewfinder
- [x] Laplacian Variance Blur Detection
- [x] Dynamic Offline Report Generation (JSON knowledge base)
- [x] Reactive Scan History Screen

