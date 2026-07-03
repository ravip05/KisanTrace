/**
 * inference.ts — Main-Thread AI Inference Interface
 *
 * This is the ONLY module that the rest of the React app should import
 * for AI functionality. It hides all Web Worker communication complexity
 * behind a clean async/await API.
 *
 * Features:
 *   - Singleton Worker lifecycle (create once, reuse for every scan)
 *   - AbortController support for cancelling long-running inference
 *   - Edge Case 6.6: Thermal throttling detection (warns if >8s)
 *   - Edge Case 6.5: Model staleness check (warns if model >90 days old)
 *   - Edge Case 6.2: Client-side blur detection before sending to the Worker
 *
 * Usage:
 *   import { loadModel, runInference, isModelStale } from './ai/inference';
 *
 *   await loadModel();
 *   const result = await runInference(imageData, [640, 480]);
 */

import type { WorkerRequest, WorkerResponse } from './worker';

// ─────────────────────────────────────────────────────────────────────────────
// Public Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ModelInfo {
  loadedAt: string;
  inputShape: number[];
  outputShape: number[];
  sizeBytes: number;
  usedFallback: boolean;
}

export interface InferenceResult {
  classIndex: number;
  confidence: number;
  allScores: number[];
  inferenceMs: number;
  thermalWarning: boolean; // true if inference took >8s (Edge Case 6.6)
}

export type ProgressCallback = (stage: string, message: string) => void;

export class InferenceAbortedError extends Error {
  constructor() {
    super('Inference was cancelled.');
    this.name = 'InferenceAbortedError';
  }
}

export class BlurDetectedError extends Error {
  public readonly variance: number;
  constructor(variance: number) {
    super(`Image too blurry (variance: ${variance.toFixed(1)}). Please retake.`);
    this.name = 'BlurDetectedError';
    this.variance = variance;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const THERMAL_WARN_THRESHOLD_MS = 8_000;
const STALENESS_THRESHOLD_DAYS = 90;
const BLUR_VARIANCE_THRESHOLD = 50; // Below this = likely blurry

// ─────────────────────────────────────────────────────────────────────────────
// Worker Singleton
// ─────────────────────────────────────────────────────────────────────────────

let worker: Worker | null = null;
let modelInfo: ModelInfo | null = null;
let requestIdCounter = 0;

/**
 * Pending requests map: requestId → { resolve, reject }
 * Each request to the worker gets a unique ID so we can match
 * responses back to the correct Promise.
 */
const pendingRequests = new Map<
  string,
  {
    resolve: (value: WorkerResponse) => void;
    reject: (reason: Error) => void;
  }
>();

/** Optional progress listener set during loadModel(). */
let globalProgressCallback: ProgressCallback | null = null;

function getOrCreateWorker(): Worker {
  if (!worker) {
    // Vite handles `new Worker(new URL(...), { type: 'module' })` natively
    // and bundles the worker as a separate ES module chunk.
    worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
      name: 'kisan-trace-ai',
    });

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;

      // Route progress events to the callback (no pending promise for these)
      if (msg.type === 'PROGRESS') {
        if (globalProgressCallback && msg.progress) {
          globalProgressCallback(msg.progress.stage, msg.progress.message);
        }
        return;
      }

      // Route responses to the correct pending Promise
      const pending = pendingRequests.get(msg.requestId);
      if (!pending) {
        console.warn('[Inference] Received response for unknown request:', msg.requestId);
        return;
      }

      pendingRequests.delete(msg.requestId);

      if (msg.type === 'ERROR') {
        pending.reject(new Error(msg.error ?? 'Unknown worker error'));
      } else {
        pending.resolve(msg);
      }
    };

    worker.onerror = (event) => {
      console.error('[Inference] Worker crashed:', event.message);
      // Reject ALL pending requests — the worker is dead
      for (const [id, pending] of pendingRequests) {
        pending.reject(new Error(`Worker crashed: ${event.message}`));
        pendingRequests.delete(id);
      }
      // Allow re-creation on next call
      worker = null;
    };
  }

  return worker;
}

function sendRequest(request: WorkerRequest): Promise<WorkerResponse> {
  return new Promise((resolve, reject) => {
    pendingRequests.set(request.requestId, { resolve, reject });
    getOrCreateWorker().postMessage(request);
  });
}

function nextRequestId(): string {
  return `req_${++requestIdCounter}_${Date.now()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Blur Detection (Edge Case 6.2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fast Laplacian variance blur check.
 *
 * Runs entirely on the main thread using a <canvas>. It applies a 3×3
 * Laplacian kernel to the grayscale image and computes the variance of
 * the result. A low variance means the image is uniformly smooth = blurry.
 *
 * This is intentionally kept on the main thread because:
 *   1. It's very fast (< 20ms for a 224×224 image).
 *   2. We want to reject blurry images BEFORE sending data to the worker,
 *      avoiding the overhead of transferring a large ArrayBuffer.
 */
export function checkBlur(
  imageData: ImageData,
  threshold: number = BLUR_VARIANCE_THRESHOLD
): { isBlurry: boolean; variance: number } {
  const { width, height, data } = imageData;

  // Convert to grayscale
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    // Luminance formula (BT.601)
    gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  // Apply 3×3 Laplacian kernel: [0, 1, 0], [1, -4, 1], [0, 1, 0]
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const laplacian =
        gray[idx - width] +     // top
        gray[idx - 1] +         // left
        -4 * gray[idx] +        // center
        gray[idx + 1] +         // right
        gray[idx + width];      // bottom

      sum += laplacian;
      sumSq += laplacian * laplacian;
      count++;
    }
  }

  const mean = sum / count;
  const variance = sumSq / count - mean * mean;

  return {
    isBlurry: variance < threshold,
    variance,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load the AI model into the Web Worker.
 *
 * Call this once during app initialization (e.g., after the Service Worker
 * confirms the model is cached). Subsequent calls are no-ops if the model
 * is already loaded.
 *
 * @param onProgress Optional callback for UI loading indicators.
 * @param modelPath  Override the default model path (for testing).
 */
export async function loadModel(
  onProgress?: ProgressCallback,
  modelPath?: string
): Promise<ModelInfo> {
  // Already loaded — return cached info
  if (modelInfo) return modelInfo;

  globalProgressCallback = onProgress ?? null;

  const response = await sendRequest({
    type: 'LOAD_MODEL',
    requestId: nextRequestId(),
    modelPath,
  });

  globalProgressCallback = null;

  if (response.modelInfo) {
    modelInfo = response.modelInfo;
    return modelInfo;
  }

  throw new Error('Model loaded but no modelInfo returned.');
}

/**
 * Run inference on an image.
 *
 * @param imageData  Raw RGBA pixel data from a <canvas> `getImageData()`.
 * @param dims       [width, height] of the source image.
 * @param options    Optional configuration.
 * @param options.signal  AbortSignal to cancel a long-running inference.
 * @param options.skipBlurCheck  Skip the blur detection pre-check.
 *
 * @throws InferenceAbortedError if the AbortSignal fires before completion.
 * @throws BlurDetectedError if the image is too blurry (and skipBlurCheck is false).
 * @throws Error for model loading issues or worker failures.
 */
export async function runInference(
  imageData: ImageData,
  dims: [number, number],
  options?: {
    signal?: AbortSignal;
    skipBlurCheck?: boolean;
  }
): Promise<InferenceResult> {
  const { signal, skipBlurCheck = false } = options ?? {};

  // Pre-check: abort early if already cancelled
  if (signal?.aborted) {
    throw new InferenceAbortedError();
  }

  // Pre-check: blur detection (Edge Case 6.2)
  if (!skipBlurCheck) {
    const blur = checkBlur(imageData);
    if (blur.isBlurry) {
      throw new BlurDetectedError(blur.variance);
    }
  }

  // Ensure model is loaded
  if (!modelInfo) {
    throw new Error('Model not loaded. Call loadModel() first.');
  }

  const requestId = nextRequestId();

  // Transfer the ArrayBuffer to the worker (zero-copy for performance)
  const rgbaBuffer = imageData.data.buffer.slice(0);

  // Create the inference promise
  const inferencePromise = sendRequest({
    type: 'RUN_INFERENCE',
    requestId,
    imageData: rgbaBuffer,
    imageDims: dims,
  });

  // Race: inference vs. abort signal
  const result = await raceWithAbort(inferencePromise, requestId, signal);

  if (!result.result) {
    throw new Error('Inference completed but no result returned.');
  }

  // Edge Case 6.6: Thermal throttling detection
  const thermalWarning = result.result.inferenceMs > THERMAL_WARN_THRESHOLD_MS;

  return {
    classIndex: result.result.classIndex,
    confidence: result.result.confidence,
    allScores: result.result.allScores,
    inferenceMs: result.result.inferenceMs,
    thermalWarning,
  };
}

/**
 * Check if the loaded model is older than 90 days (Edge Case 6.5).
 * Returns null if the model isn't loaded yet.
 */
export function isModelStale(): boolean | null {
  if (!modelInfo) return null;

  const loadedDate = new Date(modelInfo.loadedAt).getTime();
  const daysSinceLoad = (Date.now() - loadedDate) / (1000 * 60 * 60 * 24);
  return daysSinceLoad > STALENESS_THRESHOLD_DAYS;
}

/**
 * Returns the loaded model metadata, or null if not yet loaded.
 */
export function getModelInfo(): ModelInfo | null {
  return modelInfo;
}

/**
 * Terminate the worker and release all resources.
 * Call this during app cleanup or before a Service Worker update reload.
 */
export function destroyInferenceEngine(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  modelInfo = null;
  pendingRequests.clear();
  globalProgressCallback = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Races an inference promise against an AbortSignal.
 *
 * If the signal fires first, we reject with InferenceAbortedError.
 * The worker will still complete its work (we can't cancel WASM mid-execution),
 * but the main thread will ignore the result.
 */
function raceWithAbort(
  promise: Promise<WorkerResponse>,
  requestId: string,
  signal?: AbortSignal
): Promise<WorkerResponse> {
  if (!signal) return promise;

  return new Promise((resolve, reject) => {
    // If already aborted, reject immediately
    if (signal.aborted) {
      pendingRequests.delete(requestId);
      reject(new InferenceAbortedError());
      return;
    }

    const onAbort = () => {
      pendingRequests.delete(requestId);
      reject(new InferenceAbortedError());
    };

    signal.addEventListener('abort', onAbort, { once: true });

    promise
      .then((result) => {
        signal.removeEventListener('abort', onAbort);
        resolve(result);
      })
      .catch((err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      });
  });
}
