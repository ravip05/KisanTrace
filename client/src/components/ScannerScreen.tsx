/**
 * ScannerScreen.tsx
 *
 * Integrates the CameraViewfinder with the LiteRT inference engine.
 *
 * User flow:
 *   1. Camera auto-starts when the screen mounts.
 *   2. Farmer taps "Capture" — frame is grabbed, blur-checked, then sent
 *      to the Web Worker for inference.
 *   3. While analyzing: spinner + thermal warning at >8s.
 *   4. On success: calls onDiagnosisComplete() with the result.
 *   5. Cancel button aborts the in-flight inference via AbortController.
 *   6. Gallery fallback: opens a file picker for image upload.
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import { Camera, ImagePlus, X, AlertTriangle } from 'lucide-react'
import CameraViewfinder from './CameraViewfinder'
import type { CameraViewfinderHandle } from './CameraViewfinder'
import {
  runInference,
  loadModel,
  BlurDetectedError,
  InferenceAbortedError,
} from '../ai/inference'
import type { InferenceResult } from '../ai/inference'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ScannerScreenProps {
  selectedCrop: string | null
  onBack: () => void
  onDiagnosisComplete: (result: InferenceResult, crop: string) => void
}

type ScanState =
  | { status: 'idle' }
  | { status: 'loading-model'; progress: string }
  | { status: 'analyzing'; thermalWarning: boolean }
  | { status: 'error'; message: string }

const CROP_LABELS: Record<string, { name: string; icon: string }> = {
  paddy: { name: 'Paddy (धान)', icon: '/crops/paddy.png' },
  tomato: { name: 'Tomato (टमाटर)', icon: '/crops/tomato.png' },
  groundnut: { name: 'Groundnut (मूँगफली)', icon: '/crops/groundnut.png' },
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ScannerScreen({
  selectedCrop,
  onBack,
  onDiagnosisComplete,
}: ScannerScreenProps) {
  const viewfinderRef = useRef<CameraViewfinderHandle>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const thermalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [scanState, setScanState] = useState<ScanState>({ status: 'idle' })
  const [cameraError, setCameraError] = useState<string | null>(null)

  const crop = selectedCrop ? CROP_LABELS[selectedCrop] : null
  const isAnalyzing = scanState.status === 'analyzing'
  const isLoadingModel = scanState.status === 'loading-model'
  const isBusy = isAnalyzing || isLoadingModel

  // ── Pre-warm the model when the screen opens ─────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function warmUp() {
      try {
        setScanState({
          status: 'loading-model',
          progress: 'Preparing AI engine…',
        })

        await loadModel((_stage, message) => {
          if (!cancelled) {
            setScanState({ status: 'loading-model', progress: message })
          }
        })

        if (!cancelled) setScanState({ status: 'idle' })
      } catch {
        if (!cancelled) {
          setScanState({
            status: 'error',
            message: 'Failed to load AI model. Check storage and try again.',
          })
        }
      }
    }

    warmUp()
    return () => { cancelled = true }
  }, [])

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      if (thermalTimerRef.current) clearTimeout(thermalTimerRef.current)
    }
  }, [])

  // ── Capture & Infer ──────────────────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    if (isBusy || !selectedCrop) return

    const frame = viewfinderRef.current?.captureFrame()
    if (!frame) {
      setScanState({ status: 'error', message: 'Could not capture frame. Is the camera active?' })
      return
    }

    // Start a new AbortController for this inference request
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    // Start analyzing state
    setScanState({ status: 'analyzing', thermalWarning: false })

    // Edge Case 6.6: Show thermal warning if inference takes >8s
    thermalTimerRef.current = setTimeout(() => {
      setScanState({ status: 'analyzing', thermalWarning: true })
    }, 8_000)

    try {
      const result = await runInference(
        frame.imageData,
        [frame.width, frame.height],
        { signal: controller.signal }
      )

      if (thermalTimerRef.current) clearTimeout(thermalTimerRef.current)
      setScanState({ status: 'idle' })
      onDiagnosisComplete(result, selectedCrop)
    } catch (err) {
      if (thermalTimerRef.current) clearTimeout(thermalTimerRef.current)

      if (err instanceof InferenceAbortedError) {
        setScanState({ status: 'idle' }) // User cancelled — silent reset
      } else if (err instanceof BlurDetectedError) {
        setScanState({
          status: 'error',
          message: '📷 Image too blurry. Hold the camera steady and try again.',
        })
      } else {
        const msg = err instanceof Error ? err.message : 'Unknown error during analysis.'
        setScanState({ status: 'error', message: msg })
      }
    }
  }, [isBusy, selectedCrop, onDiagnosisComplete])

  // ── Cancel in-flight inference ───────────────────────────────────────────
  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort()
    if (thermalTimerRef.current) clearTimeout(thermalTimerRef.current)
    setScanState({ status: 'idle' })
  }, [])

  // ── Gallery upload ───────────────────────────────────────────────────────
  const handleGallery = useCallback(() => {
    if (isBusy || !selectedCrop) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      // Decode the uploaded image via a canvas
      const bitmap = await createImageBitmap(file)
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bitmap, 0, 0)
      const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
      bitmap.close()

      // Reuse the same capture-and-infer path
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller
      setScanState({ status: 'analyzing', thermalWarning: false })

      thermalTimerRef.current = setTimeout(() => {
        setScanState({ status: 'analyzing', thermalWarning: true })
      }, 8_000)

      try {
        const result = await runInference(
          imageData,
          [bitmap.width, bitmap.height],
          { signal: controller.signal, skipBlurCheck: true } // User chose this image deliberately
        )
        if (thermalTimerRef.current) clearTimeout(thermalTimerRef.current)
        setScanState({ status: 'idle' })
        onDiagnosisComplete(result, selectedCrop)
      } catch (err) {
        if (thermalTimerRef.current) clearTimeout(thermalTimerRef.current)
        if (!(err instanceof InferenceAbortedError)) {
          const msg = err instanceof Error ? err.message : 'Analysis failed.'
          setScanState({ status: 'error', message: msg })
        } else {
          setScanState({ status: 'idle' })
        }
      }
    }
    input.click()
  }, [isBusy, selectedCrop, onDiagnosisComplete])

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="scanner-screen">

      {/* Crop pill / No crop warning */}
      {crop ? (
        <div className="scanner__selected-crop">
          <img src={crop.icon} alt="" width={24} height={24} />
          {crop.name}
        </div>
      ) : (
        <button onClick={onBack} className="scanner__selected-crop scanner__selected-crop--warn">
          ← Go back and select a crop first
        </button>
      )}

      {/* Camera Viewfinder */}
      <div className="scanner__viewfinder" id="scanner-viewfinder">
        <CameraViewfinder ref={viewfinderRef} onError={setCameraError} />

        {/* Model loading overlay */}
        {isLoadingModel && (
          <div className="scanner__overlay">
            <div className="scanner__overlay-spinner" />
            <p className="scanner__overlay-text">
              {(scanState as { status: 'loading-model'; progress: string }).progress}
            </p>
          </div>
        )}

        {/* Analyzing overlay */}
        {isAnalyzing && (
          <div className="scanner__overlay scanner__overlay--analyzing">
            <div className="scanner__overlay-spinner" />
            <p className="scanner__overlay-text">Analysing leaf…</p>
            {(scanState as { status: 'analyzing'; thermalWarning: boolean }).thermalWarning && (
              <p className="scanner__overlay-thermal">
                <AlertTriangle size={14} />
                Phone is running warm — almost done
              </p>
            )}
            <button className="scanner__overlay-cancel" onClick={handleCancel} id="cancel-inference-btn">
              <X size={16} /> Cancel
            </button>
          </div>
        )}
      </div>

      {/* Error message (dismissible) */}
      {scanState.status === 'error' && (
        <div className="scanner__error-banner" id="scanner-error-banner">
          <AlertTriangle size={16} />
          <span>{scanState.message}</span>
          <button
            onClick={() => setScanState({ status: 'idle' })}
            aria-label="Dismiss error"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {cameraError && (
        <div className="scanner__error-banner" id="camera-error-banner">
          <AlertTriangle size={16} />
          <span>{cameraError}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="scanner__actions">
        <button
          className="scanner__btn scanner__btn--primary"
          onClick={handleCapture}
          id="capture-btn"
          disabled={!selectedCrop || isBusy}
          aria-busy={isAnalyzing}
          aria-label="Capture and analyse leaf"
        >
          <Camera size={20} />
          {isAnalyzing ? 'Analysing…' : 'Capture'}
        </button>

        <button
          className="scanner__btn scanner__btn--secondary"
          onClick={handleGallery}
          id="gallery-btn"
          disabled={!selectedCrop || isBusy}
          aria-label="Upload from gallery"
        >
          <ImagePlus size={20} />
          Gallery
        </button>
      </div>
    </div>
  )
}
