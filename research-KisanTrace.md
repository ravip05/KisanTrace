# Research Report: Kisan-Trace (Offline-First Edge AI)

## 1. Edge AI & Browser Inference (2026 State of the Art)
*   **Engine:** **LiteRT** (the evolution of TFLite) is the primary framework for browser-based inference.
*   **Acceleration:** WebAssembly (WASM) with **XNNPACK** provides high-performance CPU inference. For devices with modern browsers, **WebGPU** and **WebNN** (Web Neural Network API) are now production-ready, allowing PWAs to access the phone's NPU/GPU directly.
*   **Optimization:** **INT8 Quantization** is mandatory for $60 Android devices to keep the model under 5MB and prevent memory crashes on low-RAM (2GB) hardware.

## 2. Indian Crop Datasets (Beyond PlantVillage)
*   **Paddy (Rice):** The **Paddy Doctor Dataset** (16,225 images, 13 classes) is the most robust source for regional Indian paddy diseases.
*   **Groundnut:** Mendeley Data hosts specific Indian datasets (e.g., **Koppal, Karnataka** - 10k images; **West Bengal** - 1.7k images) covering leaf spot, rust, and rosette.
*   **Multi-Crop:** The **March 2026 "15 Crop and 45 Disease" Dataset** on Mendeley provides high-resolution, field-captured images for Tomato and others.
*   **Government Source:** **AIKosha** (via IndiaAI) offers curated regional datasets specifically for Indian startups.

## 3. Infrastructure: IndiaAI Compute Portal
*   **Accessibility:** Startups and researchers can access NVIDIA H100/A100 clusters at subsidized rates (approx. **₹67/hour**).
*   **Workflow:** Requires registration via Digilocker/e-Pramaan. Projects under 5,000 GPU hours often get automated approval.
*   **Strategic Advantage:** This allows for training the "Teacher" model (ViT/ResNet-101) on massive high-res datasets before distilling it for the PWA.

## 4. Offline-First Sync & Storage
*   **Client Storage:** **SQLite (via WASM)** is becoming preferred over raw IndexedDB for complex queries, often managed by **RxDB** or **PowerSync**.
*   **Sync Logic:** Use the **Durable Outbox Pattern**—mutations are queued in a local buffer and drained by a Service Worker when connectivity is restored.
*   **Conflict Resolution:** **UUIDv7** is recommended for deterministic ordering. For simple metadata, "Last Writer Wins" is sufficient; for collaborative notes, field-level merging is needed.

## 5. Competitor Gap Analysis
*   **Plantix:** Has a great offline library (text/images) but **AI diagnostics require an internet connection** for cloud processing.
*   **Agrio:** Focused on precision agriculture (satellite/weather) and is almost entirely cloud-dependent.
*   **Kisan-Trace USP:** Our ability to run the **actual AI inference** on the device without a single byte of data leaving the field is our primary competitive advantage.

## 6. Technical Recommendations
*   **Frontend:** React with **Vite** (for fast PWA builds) and **Workbox** for aggressive caching.
*   **Model Format:** Export distilled models to **ONNX** or **TFLite (LiteRT)** with Metadata for easy browser loading.
*   **Backend:** Node.js for metadata sync; Python/FastAPI microservice for the "Teacher" model training loop on IndiaAI compute.
