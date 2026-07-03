"""
main.py — Kisan-Trace ML Pipeline API

FastAPI service for triggering model training and export jobs on
IndiaAI Compute infrastructure.

Responsibilities:
  - /train      : Trigger Teacher model training (ViT/ResNet on GPU)
  - /distill    : Run knowledge distillation → Student (MobileNetV3)
  - /export     : Quantize and export to ONNX / TFLite (.tflite INT8)
  - /status/{job_id} : Check job progress

This service is NOT user-facing. It is only called by ML engineers
or CI/CD pipelines on IndiaAI Compute Portal.

Run with:
    uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from routes.training import router as training_router
from routes.export import router as export_router

# ──────────────────────────────────────────────────────────────────────────────
# Logging
# ──────────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("kisan-trace-ml")


# ──────────────────────────────────────────────────────────────────────────────
# App Lifecycle
# ──────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Kisan-Trace ML Pipeline starting up...")
    # Future: initialise GPU device checks, dataset availability pings, etc.
    yield
    logger.info("Kisan-Trace ML Pipeline shutting down.")


# ──────────────────────────────────────────────────────────────────────────────
# FastAPI Application
# ──────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Kisan-Trace ML Pipeline",
    description="Training, distillation, and export API for the Kisan-Trace edge AI model.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — only allow internal tooling; this service is never called by the PWA
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8080"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

# ──────────────────────────────────────────────────────────────────────────────
# Routers
# ──────────────────────────────────────────────────────────────────────────────

app.include_router(training_router, prefix="/train", tags=["Training"])
app.include_router(export_router, prefix="/export", tags=["Export"])


# ──────────────────────────────────────────────────────────────────────────────
# Root Health Check
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health():
    """Simple health check for the ML pipeline service."""
    return {
        "status": "ok",
        "service": "kisan-trace-ml-pipeline",
        "version": "1.0.0",
    }
