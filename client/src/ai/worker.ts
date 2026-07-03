// @ts-ignore
if (typeof self.importScripts === 'undefined') {
  // @ts-ignore
  self.importScripts = (...args) => {
    console.warn('[Worker] importScripts stub called (ignoring):', args);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Protocol
// ─────────────────────────────────────────────────────────────────────────────

/** Messages the main thread sends TO this worker. */
export interface WorkerRequest {
  type: 'LOAD_MODEL' | 'RUN_INFERENCE';
  /** Unique request ID for correlating responses. */
  requestId: string;
  /** For LOAD_MODEL: path to the .tflite file (relative to public/). */
  modelPath?: string;
  /** For RUN_INFERENCE: raw RGBA pixel data from a <canvas>. */
  imageData?: ArrayBuffer;
  /** For RUN_INFERENCE: image dimensions [width, height]. */
  imageDims?: [number, number];
}

/** Messages this worker sends BACK to the main thread. */
export interface WorkerResponse {
  type: 'MODEL_LOADED' | 'INFERENCE_RESULT' | 'ERROR' | 'PROGRESS';
  requestId: string;
  /** For MODEL_LOADED: metadata about the loaded model. */
  modelInfo?: {
    loadedAt: string;         // ISO 8601 timestamp
    inputShape: number[];     // e.g., [1, 224, 224, 3]
    outputShape: number[];    // e.g., [1, 15] (15 disease classes)
    sizeBytes: number;
    usedFallback: boolean;    // true if low-memory fallback model was loaded
  };
  /** For INFERENCE_RESULT: the classification output. */
  result?: {
    classIndex: number;
    confidence: number;
    allScores: number[];      // Raw softmax probabilities for all classes
    inferenceMs: number;      // Wall-clock time for inference only
  };
  /** For ERROR: what went wrong. */
  error?: string;
  /** For PROGRESS: loading stage feedback. */
  progress?: {
    stage: 'downloading' | 'compiling' | 'warming-up' | 'ready';
    message: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const MODEL_INPUT_SIZE = 224;
const STANDARD_MODEL = '/models/model_v1_int8.tflite';
const FALLBACK_MODEL = '/models/model_v1_lite.tflite'; // <2MB for low-RAM devices
const WASM_PATH = '/wasm/';  // Served from public/wasm/ — copied from node_modules

// ─────────────────────────────────────────────────────────────────────────────
// Worker State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * We hold the compiled model in worker-scoped state.
 * This survives between inference calls — no need to reload per-scan.
 *
 * `any` is used here because the LiteRT.js types are resolved at runtime
 * via dynamic import inside the worker context. The worker runs in its own
 * scope and doesn't share the main thread's TypeScript module graph.
 */
let compiledModel: any = null;
let modelLoadedAt: string | null = null;
let usedFallback = false;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function reply(msg: WorkerResponse): void {
  self.postMessage(msg);
}

/**
 * Edge Case 6.1: Check available device memory.
 * `navigator.deviceMemory` is only available in Chromium (which is fine —
 * our target is Chrome on Android). Returns GB, e.g. 2, 4, 8.
 * Falls back to 4 if the API is unavailable (desktop browsers).
 */
function getDeviceMemoryGB(): number {
  return (navigator as any).deviceMemory ?? 4;
}

/**
 * Preprocess RGBA ImageData → Float32Array in NHWC format [1, 224, 224, 3].
 *
 * Steps:
 *   1. Extract R, G, B channels (skip A).
 *   2. Resize to 224×224 if needed (bilinear via OffscreenCanvas).
 *   3. Normalize to [-1.0, 1.0] (MobileNetV3 expects this range).
 *
 * For INT8 models, LiteRT.js handles the float→int8 quantization internally
 * using the model's embedded quantization parameters. We always pass float32.
 */
function preprocessImage(
  rgba: ArrayBuffer,
  srcWidth: number,
  srcHeight: number
): Float32Array {
  // Use OffscreenCanvas for resize (available in Web Workers since Chrome 69)
  const srcCanvas = new OffscreenCanvas(srcWidth, srcHeight);
  const srcCtx = srcCanvas.getContext('2d')!;
  const imgData = new ImageData(
    new Uint8ClampedArray(rgba),
    srcWidth,
    srcHeight
  );
  srcCtx.putImageData(imgData, 0, 0);

  // Resize to model input dimensions
  const dstCanvas = new OffscreenCanvas(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  const dstCtx = dstCanvas.getContext('2d')!;
  dstCtx.drawImage(srcCanvas, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

  const resized = dstCtx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  const pixels = resized.data; // Uint8ClampedArray [R,G,B,A, R,G,B,A, ...]

  // Convert to Float32 NHWC [1, 224, 224, 3], normalized to [-1, 1]
  const numPixels = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
  const float32 = new Float32Array(numPixels * 3);

  for (let i = 0; i < numPixels; i++) {
    const srcIdx = i * 4;  // RGBA stride
    const dstIdx = i * 3;  // RGB stride

    // Normalize: pixel / 127.5 - 1.0 maps [0, 255] → [-1.0, 1.0]
    float32[dstIdx]     = pixels[srcIdx]     / 127.5 - 1.0; // R
    float32[dstIdx + 1] = pixels[srcIdx + 1] / 127.5 - 1.0; // G
    float32[dstIdx + 2] = pixels[srcIdx + 2] / 127.5 - 1.0; // B
  }

  return float32;
}

/**
 * Apply softmax to raw logits to get probabilities.
 * LiteRT INT8 models may return raw logits rather than softmax output.
 */
function softmax(logits: number[]): number[] {
  const maxLogit = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - maxLogit)); // subtract max for numerical stability
  const sumExps = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sumExps);
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleLoadModel(req: WorkerRequest): Promise<void> {
  const { requestId } = req;

  try {
    // Step 1: Check memory budget (Edge Case 6.1)
    const memGB = getDeviceMemoryGB();
    usedFallback = memGB < 2;
    const chosenModel = req.modelPath
      ?? (usedFallback ? FALLBACK_MODEL : STANDARD_MODEL);

    if (usedFallback) {
      reply({
        type: 'PROGRESS', requestId,
        progress: { stage: 'downloading', message: 'Low memory detected. Loading lightweight model...' },
      });
    } else {
      reply({
        type: 'PROGRESS', requestId,
        progress: { stage: 'downloading', message: 'Downloading AI model...' },
      });
    }

    // Step 2: Initialize the LiteRT WASM runtime
    // @ts-ignore
    const { loadLiteRt, loadAndCompile } = await import('@litertjs/core');
    await loadLiteRt(WASM_PATH);

    reply({
      type: 'PROGRESS', requestId,
      progress: { stage: 'compiling', message: 'Compiling model for your device...' },
    });

    // Step 3: Load and compile the TFLite model with WASM (XNNPack CPU backend)
    compiledModel = await loadAndCompile(chosenModel, {
      accelerator: 'wasm',  // CPU-only — guaranteed to work on all Android devices
    });

    modelLoadedAt = new Date().toISOString();

    // Step 4: Warm-up run (first inference is always slower due to JIT)
    reply({
      type: 'PROGRESS', requestId,
      progress: { stage: 'warming-up', message: 'Warming up the AI engine...' },
    });

    const warmupInput = new Float32Array(MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * 3);
    try {
      await compiledModel.run(warmupInput);
    } catch {
      // Warm-up failure is non-fatal; some models don't accept zero-filled input gracefully
      console.warn('[Worker] Warm-up inference failed (non-fatal)');
    }

    reply({
      type: 'PROGRESS', requestId,
      progress: { stage: 'ready', message: 'AI engine ready!' },
    });

    // Step 5: Report success with model metadata
    // Attempt to read shape info from the compiled model (API may vary)
    const inputShape = compiledModel.inputShape ?? [1, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, 3];
    const outputShape = compiledModel.outputShape ?? [1, -1]; // -1 = unknown class count

    reply({
      type: 'MODEL_LOADED',
      requestId,
      modelInfo: {
        loadedAt: modelLoadedAt,
        inputShape,
        outputShape,
        sizeBytes: 0, // Not easily available from the runtime; tracked via SW cache
        usedFallback,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    reply({ type: 'ERROR', requestId, error: `Model load failed: ${message}` });
  }
}

async function handleRunInference(req: WorkerRequest): Promise<void> {
  const { requestId, imageData, imageDims } = req;

  if (!compiledModel) {
    reply({ type: 'ERROR', requestId, error: 'Model not loaded. Call LOAD_MODEL first.' });
    return;
  }

  if (!imageData || !imageDims) {
    reply({ type: 'ERROR', requestId, error: 'Missing imageData or imageDims.' });
    return;
  }

  try {
    // Step 1: Preprocess the image → [1, 224, 224, 3] float32
    const inputTensor = preprocessImage(imageData, imageDims[0], imageDims[1]);

    // Step 2: Run inference and measure time (Edge Case 6.6: thermal tracking)
    const startMs = performance.now();
    const rawOutput = await compiledModel.run(inputTensor);
    const inferenceMs = Math.round(performance.now() - startMs);

    // Step 3: Post-process — extract scores and find the top class
    // rawOutput could be a Float32Array, a nested array, or a typed array view.
    let scores: number[];
    if (rawOutput instanceof Float32Array || rawOutput instanceof Int8Array) {
      scores = Array.from(rawOutput);
    } else if (Array.isArray(rawOutput)) {
      // If nested (e.g., [[0.1, 0.2, ...]]), flatten the first batch
      scores = Array.isArray(rawOutput[0]) ? rawOutput[0] : rawOutput;
    } else {
      scores = Object.values(rawOutput);
    }

    // Apply softmax if the model outputs raw logits
    const probabilities = softmax(scores);

    // Find the top prediction
    let maxIdx = 0;
    let maxVal = probabilities[0];
    for (let i = 1; i < probabilities.length; i++) {
      if (probabilities[i] > maxVal) {
        maxVal = probabilities[i];
        maxIdx = i;
      }
    }

    reply({
      type: 'INFERENCE_RESULT',
      requestId,
      result: {
        classIndex: maxIdx,
        confidence: Math.round(maxVal * 10000) / 10000, // 4 decimal places
        allScores: probabilities,
        inferenceMs,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    reply({ type: 'ERROR', requestId, error: `Inference failed: ${message}` });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Listener
// ─────────────────────────────────────────────────────────────────────────────

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;

  switch (req.type) {
    case 'LOAD_MODEL':
      await handleLoadModel(req);
      break;
    case 'RUN_INFERENCE':
      await handleRunInference(req);
      break;
    default:
      reply({
        type: 'ERROR',
        requestId: req.requestId ?? 'unknown',
        error: `Unknown request type: ${req.type}`,
      });
  }
};
