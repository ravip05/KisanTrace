# Product Requirements Document: Kisan-Trace MVP

**Product Name:** Kisan-Trace
**Problem Statement:** Rural Indian farmers have no access to agronomist-level crop disease diagnosis in areas with zero or low internet connectivity. Cloud-based AI tools like Plantix fail the moment you step into a "dead zone."
**MVP Goal:** Deliver a working offline-first PWA that a farmer on a ₹5,000 Android phone can open in a browser, point at a diseased crop leaf, and receive a disease name + treatment recommendation — entirely without an internet connection.
**Target Launch:** 10–12 weeks from project kickoff
**Document Status:** Draft — Ready for Technical Design
**Last Updated:** May 2026

---

## Target Users

### Primary User Profile
**Who:** Smallholder farmers in rural India (states like Andhra Pradesh, Odisha, Karnataka, Tamil Nadu)
**Device:** Low-cost Android smartphone (~₹4,000–₹6,000), 2–4GB RAM, Android 10+
**Problem:** Cannot get real-time crop disease diagnosis in the field — no agronomist nearby, and no consistent 4G signal
**Current Solution:** WhatsApp group photos sent to a local agricultural officer (slow, unreliable) or visual guesswork
**Why They'll Switch:** Kisan-Trace works *right now, right here* — no data needed, no waiting

### User Persona: Ravi (Primary)
- **Age:** 35, Groundnut farmer in Kurnool district, Andhra Pradesh
- **Tech Level:** Uses WhatsApp daily, can take photos, speaks Telugu — not comfortable with English UIs
- **Goals:** Identify if his groundnut crop has rust disease before it spreads to the full field
- **Frustrations:** Apps require internet; agricultural officers are 30km away; misdiagnosis leads to wrong pesticide spend

### User Persona: Secondary (Agricultural Extension Worker)
- **Who:** A state government krishi sevak (extension worker) who visits multiple farms per week
- **Need:** A trusted, fast diagnostic tool to validate their own recommendations in the field
- **Value:** Kisan-Trace acts as a second opinion that works in remote locations without a data plan

---

## User Journey

### The Story
Ravi notices yellowing spots on his groundnut leaves at 7am. He has no internet. He opens Kisan-Trace (already installed as a PWA from last week). He selects "Groundnut" from the crop list. He taps the camera icon, photographs the leaf, and waits 2–3 seconds. The app shows: **"Early Leaf Spot (Cercospora arachidicola)"** with a severity rating of **"Moderate"** and a treatment card: *"Apply Mancozeb 75% WP at 2g/litre. Spray in the evening."* Ravi follows the advice. The scan is saved locally. When Ravi reaches the village with Wi-Fi, the scan syncs silently to the cloud.

### Key Touchpoints
1. **Discovery:** Shared as a link via WhatsApp from an NGO or Krishi officer. No app store required.
2. **First Contact:** PWA install prompt on Android Chrome. Under 2MB initial download.
3. **Onboarding:** 3-screen tutorial (in Hindi/Telugu/English toggle) — Select crop → Take photo → Read result.
4. **Core Loop:** Open app → Select crop → Scan → Read diagnosis → Apply treatment.
5. **Retention:** Scan history stored locally (visible even offline). Gentle sync notification when online.

---

## MVP Features

### Core Features (Must Have — v1)

#### 1. Crop Selector
- **Description:** A simple, icon-driven screen to select the crop type before scanning. v1 supports 3 crops: Paddy (Rice), Tomato, Groundnut.
- **User Value:** Allows the AI model to narrow its classification scope and improve accuracy.
- **Success Criteria:**
  - Farmer can select a crop in under 5 seconds
  - Selection is visually distinct with crop illustrations (no text-only menus)
  - Selected crop persists as "last used" for repeat users
- **Priority:** P0 — Critical

#### 2. Offline Leaf Scanner (Edge AI Camera)
- **Description:** The core feature. A camera capture flow that runs the on-device AI model (MobileNetV3 student model, <5MB, in WASM/LiteRT) to classify the disease in 2–4 seconds on a low-end device.
- **User Value:** A farmer in a zero-connectivity field gets an instant, accurate diagnosis.
- **Success Criteria:**
  - Diagnosis is returned in ≤4 seconds on a 2GB RAM Android device
  - Model file loads fully from cache — zero network requests during inference
  - Works with gallery photo uploads *and* live camera capture
  - Gracefully handles blurry/dark photos with a "Please retake" prompt
- **Priority:** P0 — Critical

#### 3. Disease Report Card
- **Description:** A structured results screen showing: (a) Disease name in English + local vernacular, (b) Confidence score, (c) Severity level (Low/Moderate/High), (d) Treatment recommendations (organic + chemical options), (e) "When to consult an expert" advisory.
- **User Value:** Actionable next steps, not just a label. Farmer knows exactly what to buy and how to spray.
- **Success Criteria:**
  - Report card is generated fully offline (no API call for content)
  - Treatment content is pre-bundled with the PWA at install time
  - Displays confidence score clearly so farmers understand uncertainty
  - All critical text available in at least English and Hindi (v1)
- **Priority:** P0 — Critical

### Future Features (Not in MVP v1)
| Feature | Why Wait | Planned For |
|---------|----------|-------------|
| Scan History Sync to Cloud | Adds backend complexity; not needed for core value proof | Version 2 |
| Farmer Community Forums | High moderation cost; distraction from core loop | Version 3 |
| Weather Integration | Separate data layer; MVP stays focused on diagnosis | Version 2 |
| Multi-language (Telugu, Kannada, Tamil) | Translation cost; Hindi covers wide reach for v1 | Version 2 |
| Government Scheme Recommendations | Requires live data and state-level APIs | Version 3 |
| Expert Consultation Booking | Requires marketplace/network; post-validation | Version 3 |

---

## Success Metrics

### Primary Metric (North Star)
**AI Diagnosis Accuracy Rate:** ≥85% Top-1 accuracy on a held-out Indian field-image test set (not lab-clean PlantVillage images).

*Why this matters: A wrong diagnosis means wrong pesticide spend — destroying farmer trust and potentially the crop. Accuracy is non-negotiable before launch.*

### Secondary Metrics (First 30 Days Post-Launch)
| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Successful Scans (Offline) | >500 scans in Month 1 | Local telemetry synced on reconnect |
| PWA Install Rate | >40% of first-time visitors | Service Worker install event |
| Time-to-Diagnosis | ≤4 seconds (p95) | Client-side performance logging |
| Farmer Return Rate | >30% use app again within 7 days | Anonymous local session tracking |

---

## UI/UX Direction

**Design Feel:** Bold, earthy, farmer-friendly

### Design Principles
- **Visual over Textual:** Use crop illustrations, color-coded severity badges, and iconography. Assume mixed literacy levels.
- **Contrast for Sunlight:** All screens must pass WCAG AA contrast ratios and remain readable in direct outdoor sunlight (high brightness mode).
- **Single Thumb Operation:** All primary actions (select crop, trigger scan, read report) must be reachable with one thumb on a 5.5" screen. No small touch targets.

### Color Palette Direction
- **Primary:** Deep earthy green (`#2D5016`) — trust, nature, agriculture
- **Accent:** Warm amber/saffron (`#E8A000`) — energy, Indian cultural palette
- **Alert/Severity High:** Muted brick red (`#C0392B`)
- **Background:** Off-white warm (`#FAF7F2`) — not clinical white; warm and approachable

### Key Screens (v1)
1. **Home / Crop Selector** — Large illustrated cards for Paddy, Tomato, Groundnut. Offline status badge visible always.
2. **Camera / Scan Screen** — Full-screen camera with a leaf-framing guide overlay. "Tap to capture" or "Upload from gallery."
3. **Scanning Loader** — On-device processing animation (2–4 seconds). Shows "Analysing offline..." to reinforce the key differentiator.
4. **Disease Report Card** — Top section: disease name + severity badge. Middle: treatment recommendations. Bottom: "Save Scan" and "Scan Again" CTAs.
5. **About / Offline Status** — Shows model version, last sync time, and a simple explainer of how offline AI works.

---

## Technical Considerations

**Platform:** Progressive Web App (PWA) — works on any Android/iOS browser; no app store
**Responsive:** Mobile-first, optimized for 5"–6.5" screens
**Performance Goals:**
- Initial PWA load (cached): <1 second
- First load (fresh install): <3 seconds on 4G
- AI inference time: <4 seconds on 2GB RAM device
- App bundle + model size: <8MB total

**Offline Strategy:**
- AI model pre-cached at install via Service Worker (Workbox)
- Disease content (treatments, descriptions) bundled as static JSON
- IndexedDB stores scan metadata locally; syncs via Durable Outbox Pattern on reconnect

**Security/Privacy:**
- No farmer photos are uploaded to any server without explicit consent
- All inference happens on-device — zero cloud dependency for diagnosis
- Anonymous usage telemetry only (no PII collected in v1)

**Scalability:**
- v1 is designed for ~1,000 concurrent offline users; backend sync load is minimal since it is metadata-only
- The Python/FastAPI model retraining service (IndiaAI Compute) is separate from user-facing infrastructure

**Browser/Device Support:**
- Chrome on Android (primary target — covers >80% of target demographic)
- Safari on iOS (secondary)
- Must function on Android 10+ devices with 2GB RAM

---

## Constraints & Requirements

### Budget
- Development tools: **$0** (open-source stack)
- GPU Training (Teacher Model): **~₹67/hour** on IndiaAI Compute Portal (estimated 50–100 GPU hours total = ~₹3,500–₹7,000 one-time)
- Hosting/Backend: **$0–$10/month** (Railway/Render free tier for metadata sync)
- **Total Monthly Operating:** <$10/month

### Open Questions
- What is the minimum acceptable offline model accuracy before we release to farmers? (Proposed: 85%)
- Should v1 include a manual "What crop is this?" identification mode, or assume the farmer always knows their own crop?
- Will the app be distributed via a partner NGO or Krishi officer network, or directly to farmers?

### Assumptions
- Target farmers own an Android device running Chrome browser
- They have *some* ability to take a reasonably framed photo of a leaf
- An agricultural officer or NGO partner will assist in onboarding the first cohort of farmers

---

## MVP Definition of Done

The MVP is ready to test when:
- [ ] All 3 P0 features are functional end-to-end on a physical $60 Android device
- [ ] AI model achieves ≥85% accuracy on Indian field-condition test images
- [ ] Full diagnostic cycle (select crop → scan → report) completes with zero internet connection
- [ ] App passes offline install test: install once on Wi-Fi, then airplane mode, then scan successfully
- [ ] Disease Report Card content is complete for all diseases in v1 scope (Paddy 13 classes, Groundnut 6 classes, Tomato top 8 diseases)
- [ ] UI passes outdoor sunlight readability test (WCAG AA contrast)
- [ ] Tested with 5 real farmers or agricultural extension workers for usability feedback

---

## Next Steps

1. ✅ **Part 1** — Deep Research (Complete)
2. ✅ **Part 2** — Product Requirements Document (This document)
3. ⏭️ **Part 3** — Technical Design Document (Architecture, DB schema, model pipeline, API contracts)
4. **Part 4** — Generate AGENTS.md and AI agent configuration files
5. **Build** — Implement MVP with AI assistance (10–12 weeks)

---
*PRD Version: 1.0*
*Status: Draft — Ready for Technical Design*
*Research Reference: `research-KisanTrace.md`*
