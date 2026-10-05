"""
JalNiriksh AI — Live Analysis API.

A thin FastAPI service around the team's real YOLOv8-ESI side-scan sonar
detector (trained during the KADAL / SIH26057 R&D phase). It accepts a sonar
or sonar-like image, runs real ONNX inference plus acoustic-physics material
and hazard analysis, and returns structured detections the operator console
can render — no mock data involved when this service is running.

Run from the repository root:
    python -m backend.download_model
    python -m uvicorn backend.app:app --reload --port 8000
"""
import io
import base64
import os
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config import ALLOWED_EXTENSIONS, MAX_UPLOAD_SIZE_MB, SAMPLES_DIR
from backend.inference.engine import YOLOESIInferenceEngine
from backend.utils.annotator import draw_annotations

app = FastAPI(
    title="JalNiriksh AI — Live Analysis API",
    description="Real side-scan sonar debris detection, reused from the team's KADAL R&D model.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = YOLOESIInferenceEngine()

# Acoustic-signature classes -> JalNiriksh debris categories, for display only.
# The model was trained on mine/wreck/airplane/generic-debris signatures, not
# fine-grained waste material — see README "Live Analysis" for the honest mapping.
CLASS_DISPLAY = {
    "unknown_debris": "Debris (Unclassified)",
    "wreck": "Wreck / Large Object",
    "mine": "High-Hazard Object",
    "airplane": "Aircraft Wreckage",
}


def _encode_jpeg(img_bgr: np.ndarray) -> str:
    ok, buf = cv2.imencode(".jpg", img_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    if not ok:
        raise RuntimeError("Failed to encode annotated image")
    return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("ascii")


def _run_analysis(img_bytes: bytes):
    arr = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode image. Upload a JPG/PNG/TIFF.")

    detections, timing = engine.predict(img)

    for d in detections:
        d["display_label"] = CLASS_DISPLAY.get(d["class_name"], d["class_name"])

    annotated = draw_annotations(img, detections) if detections else img
    return {
        "is_demo_mode": getattr(engine, "is_demo", False),
        "model": engine.get_metadata(),
        "timing_ms": timing,
        "detections": detections,
        "annotated_image": _encode_jpeg(annotated),
        "image_size": {"width": int(img.shape[1]), "height": int(img.shape[0])},
    }


@app.get("/api/health")
def health():
    return {"status": "ok", "demo_mode": getattr(engine, "is_demo", False)}


@app.get("/api/model/info")
def model_info():
    return engine.get_metadata()


@app.get("/api/samples")
def list_samples():
    if not SAMPLES_DIR.exists():
        return {"samples": []}
    return {"samples": sorted(p.name for p in SAMPLES_DIR.glob("*.png"))}


@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{ext}'. Allowed: {sorted(ALLOWED_EXTENSIONS)}")

    body = await file.read()
    if len(body) > MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_UPLOAD_SIZE_MB} MB limit")

    try:
        result = _run_analysis(body)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {e}")

    return JSONResponse(result)


@app.post("/api/analyze-sample/{sample_name}")
def analyze_sample(sample_name: str):
    path = SAMPLES_DIR / sample_name
    if not path.exists() or path.parent != SAMPLES_DIR:
        raise HTTPException(status_code=404, detail="Unknown sample")
    with open(path, "rb") as f:
        body = f.read()
    try:
        result = _run_analysis(body)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {e}")
    return JSONResponse(result)
