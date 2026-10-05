import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
SAMPLES_DIR = BASE_DIR / "static" / "samples"


def find_model_path() -> str:
    """Auto-discovers the YOLO-ESI ONNX model path from env, candidates, or recursive scan."""
    env_path = os.getenv("MODEL_PATH")
    if env_path:
        return env_path

    candidates = [
        BASE_DIR / "models" / "yolo_esi_v6_fp16.onnx",
        BASE_DIR / "models" / "best.onnx",
    ]
    for c in candidates:
        if c.exists():
            return str(c)

    models_dir = BASE_DIR / "models"
    if models_dir.exists():
        onnx_files = list(models_dir.glob("**/*.onnx"))
        if onnx_files:
            return str(onnx_files[0])

    return str(BASE_DIR / "models" / "yolo_esi_v6_fp16.onnx")


MODEL_PATH = find_model_path()
HF_REPO_ID = os.getenv("HF_REPO_ID", "Dinoman1221/sonarvision-yolov8-esi-v6")
HF_MODEL_FILE = os.getenv("HF_MODEL_FILE", "yolo_esi_v6_fp16.onnx")

DEFAULT_CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.25"))
DEFAULT_IOU_THRESHOLD = float(os.getenv("IOU_THRESHOLD", "0.45"))
MODEL_INPUT_SIZE = (256, 256)

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "25"))
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff"}

# Acoustic Physics Constants
P95_METALLIC_THRESHOLD = 185.0

# Reused from the team's KADAL (SIH26057) side-scan sonar debris model.
# These are acoustic-signature classes, not fine-grained waste-material classes —
# see README "Live Analysis" section for how they map onto JalNiriksh's debris categories.
MODEL_CLASSES = {
    0: "unknown_debris",
    1: "airplane",
    2: "mine",
    3: "wreck"
}
