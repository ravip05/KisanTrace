# Technical Report: Kisan-Trace Project Analysis

**Target Audience:** Senior Software Engineers / Architects
**Subject:** Kisan-Trace — Edge-AI Diagnostic PWA for Offline Agricultural Use

---

## 1. Executive Summary
Kisan-Trace is a mobile-first, offline-first Progressive Web Application (PWA) designed to provide agronomist-level crop disease diagnosis in remote rural environments with zero connectivity. The system leverages a multi-tier architecture involving on-device WASM inference, a reactive NoSQL synchronization layer, and a robust Python-based ML training pipeline.

## 2. System Architecture & Tech Stack

The project follows a modern **Edge-Compute / Cloud-Sync** hybrid architecture:

*   **PWA (React + Vite)**: The primary interface. Optimized for low-end Android devices with high-contrast UI for outdoor readability. Uses **LiteRT.js** for WASM-based hardware-accelerated inference.
*   **Sync Gateway (Node.js/Express)**: A lean middleware layer facilitating bidirectional replication between the local database and the cloud. It implements a custom sync protocol compatible with RxDB's replication interface.
*   **ML Pipeline (Python/FastAPI)**: A dedicated service for model lifecycle management. It orchestrates training on **IndiaAI Compute** GPU clusters, performs knowledge distillation, and handles the TFLite quantization pipeline.
*   **Persistence Layer**: 
    *   **Local**: **RxDB** (NoSQL) backed by **IndexedDB** (Dexie adapter).
    *   **Cloud**: **PostgreSQL** (managed via the Sync Gateway).

## 3. Offline-First Implementation Details

Kisan-Trace treats "Offline" as a primary state, not an edge case:

*   **Workbox & Service Worker**:
    *   **Asset Pre-caching**: Critical UI assets, the 3.5MB INT8 TFLite model, and the disease knowledge base (JSON) are cached during the `install` event.
    *   **Runtime Caching**: Uses a `CacheFirst` strategy for static content and `NetworkFirst` for API metadata.
*   **RxDB Replication Protocol**:
    *   Data is written locally to IndexedDB first.
    *   A bidirectional replication handler pushes local changes to the `/api/sync/push` endpoint and pulls updates from `/api/sync/pull`.
    *   **Checkpointing**: Uses an `updatedAt` based checkpointing system to ensure minimal data transfer and no data loss during "flapping" network signals.

## 4. AI/ML Pipeline: From ViT to INT8

The ML strategy focuses on the "Inference Budget" (Model Size < 5MB, Latency < 2s):

*   **Knowledge Distillation**:
    *   **Teacher**: A heavy Vision Transformer (ViT) or ResNet-50 trained on high-resolution field datasets.
    *   **Student**: **MobileNetV3-Small**, chosen for its optimal latency-to-accuracy ratio on ARM CPUs.
*   **Quantization Pipeline**: 
    *   **PyTorch → ONNX → TF SavedModel → TFLite**.
    *   **INT8 Full Integer Quantization**: Employs a representative dataset of ~200 field images for calibration. This reduces the footprint from ~15MB (FP32) to ~3.8MB (INT8) with <2% accuracy degradation.
*   **Inference Engine**:
    *   Runs in a dedicated **Web Worker** using **LiteRT.js**.
    *   Uses **OffscreenCanvas** for zero-copy image preprocessing (resizing to 224x224 and normalization).

## 5. Software Engineering Patterns & Resilience

*   **Singleton Pattern**: The `getDatabase()` utility ensures a single RxDB instance is shared across the PWA, preventing IndexedDB lock contention.
*   **Abstraction Layer**: The `inference.ts` interface abstracts the complexities of Worker communication, providing a clean Promise-based API (`runInference`) to the UI components.
*   **Resilience Engineering**:
    *   **Laplacian Variance Blur Detection**: A pre-inference check filters out blurry captures, preventing "garbage-in/garbage-out" scenarios.
    *   **AbortController Integration**: Long-running inference tasks are cancelable via the UI, preventing thread starvation.
    *   **Thermal Awareness**: The UI monitors inference latency; if execution exceeds 8s, it triggers a thermal warning advising the user to cool the device.

## 6. The 'Why': Solving Real-World Problems

The codebase is fundamentally optimized for the **Indian Field Condition**:
*   **Sunlight Readability**: UI uses HSL-based palettes with high contrast ratios (Outdoor Contrast > 7:1).
*   **Zero Connectivity**: The diagnosis is 100% offline. Farmers in "dark zones" get instant results without waiting for high-latency cloud uploads.
*   **Low-End Hardware**: By utilizing WASM and INT8 quantization, the app runs smoothly on ₹8,000–₹10,000 Android devices typical of the user base.
