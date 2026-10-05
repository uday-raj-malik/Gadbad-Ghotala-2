"""
Fetches the trained YOLOv8-ESI v6 ONNX weights (~5.9 MB) from Hugging Face.

This is the real model trained during the team's KADAL (SIH26057) R&D phase on
multi-source side-scan sonar data. Run this once before starting the API, from
the repository root:

    python -m backend.download_model
"""
import os
import shutil

from backend.config import BASE_DIR, HF_REPO_ID, HF_MODEL_FILE


def main():
    models_dir = BASE_DIR / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    dest = models_dir / HF_MODEL_FILE

    if dest.exists():
        print(f"[download_model] Already present: {dest}")
        return

    from huggingface_hub import hf_hub_download

    print(f"[download_model] Downloading {HF_MODEL_FILE} from {HF_REPO_ID} ...")
    downloaded = hf_hub_download(HF_REPO_ID, HF_MODEL_FILE, local_dir=str(models_dir))
    if os.path.abspath(downloaded) != os.path.abspath(dest):
        shutil.copy(downloaded, dest)
    print(f"[download_model] Ready: {dest}")


if __name__ == "__main__":
    main()
