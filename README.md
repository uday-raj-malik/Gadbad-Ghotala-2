# JalNiriksh AI

AI-assisted underwater debris detection and recovery planning for side-scan sonar surveys.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-backend-009688?logo=fastapi&logoColor=white)
![No build step](https://img.shields.io/badge/Frontend-vanilla%20JS-F7DF1E?logo=javascript&logoColor=black)

JalNiriksh AI is an operator console for finding and recovering underwater waste (ghost
nets, plastic, drums, metal debris) from side-scan sonar surveys. It combines a real
ONNX-based detector with acoustic-physics post-processing, a 3D map, and OR-Tools route
planning, wrapped in a single-page operator UI.

Originally built for Smart India Hackathon 2026 (Team Gadbad Ghotala), this repo is now
maintained as a working prototype rather than a static pitch.

## What's real vs. demo

This matters more than usual here, so it's up front instead of buried:

| Capability | Status |
|---|---|
| Sonar debris detection (ONNX model + acoustic physics) | **Real**; see [Backend](#backend) |
| 3D map (CesiumJS) | **Real** |
| Recovery route optimisation (OR-Tools) | **Real** |
| Operator console UI (upload, review queue, map, planner, reports) | **Real**, running against a bundled demo survey by default |
| Raw XTF/JSF sonar file ingestion with embedded GPS | Not built: needs a real sample file to implement against |
| Fine-grained waste-material classes (plastic/net/tyre, vs. generic debris) | Not built: see model notes below |
| Persistence (Postgres), retraining loop | Not built: state is in-memory / stateless per request |

## Features

- **Overview**: KPI tiles, detections-by-type chart, cleanliness-index trend
- **Sonar Scans**: drag-and-drop upload or one-click sample scans, run through the real model
- **Review Queue**: confirm/reject detections the model scored as uncertain
- **Ocean Map**: CesiumJS 3D globe with per-item markers, accuracy-circle rings, filters
- **Recovery Planner**: hazard ranking plus a real OR-Tools-optimised collection route
- **Reports**: cleanliness trend history, CSV/GeoJSON export

## Backend

`backend/` is a FastAPI service that actually runs inference, not a mock.

**Model**: YOLOv8-Nano + Squeeze-and-Excitation attention ("YOLO-ESI"), 3.03M params, ONNX
FP16, test mAP50 ≈ 0.60. Trained on multi-source side-scan sonar data (NOAA debris surveys +
synthetic/augmented targets) during an earlier phase of this project. Weights are hosted on
[Hugging Face](https://huggingface.co/Dinoman1221/sonarvision-yolov8-esi-v6) and downloaded
on setup, not committed to the repo.

**Pipeline**: letterboxed tiling → ONNX inference → Soft-NMS → acoustic-physics
post-processing (`backend/inference/acoustic_physics.py`): peak-backscatter material
classification (metallic vs. synthetic), shadow-based height estimation, and a 0–100 threat
score, then an annotated image + structured JSON.

**Note on classes**: the model's trained classes are acoustic-signature categories
(`unknown_debris`, `wreck`, `mine`, `airplane`), relabeled in `backend/app.py` for display.
The acoustic material classifier ("metallic" vs. "synthetic") is what currently stands in
for fine-grained waste typing; it isn't yet fine-tuned on a labeled marine-litter dataset.

**Routing**: `backend/routing.py` solves a real single-vehicle closed-tour TSP with
[OR-Tools](https://developers.google.com/optimization/routing) over confirmed items'
coordinates: an actual solve, not a sort.

### API

| Endpoint | Description |
|---|---|
| `GET /api/health` | Whether the real model loaded or it's running in simulation mode |
| `GET /api/model/info` | Model architecture, input size, execution provider, weights checksum |
| `GET /api/samples` | List bundled sample sonar images |
| `POST /api/analyze` | Multipart image upload → detections + annotated image |
| `POST /api/analyze-sample/{name}` | Run the pipeline on a bundled sample |
| `POST /api/plan-route` | OR-Tools TSP solve → visiting order + distance |

### Setup

```bash
python -m venv .venv && source .venv/Scripts/activate   # .venv\Scripts\activate on Windows
pip install -r backend/requirements.txt
python -m backend.download_model      # fetches ONNX weights (~5.9 MB)
python -m uvicorn backend.app:app --reload --port 8000
```

With the API running, the console's status pill turns green and sample-scan buttons appear
under **Sonar Scans**. Without it, the console falls back to simulated ingestion so the UI
still demos standalone.

## Frontend

Static site, no build step.

```bash
git clone https://github.com/uday-raj-malik/Gadbad-Ghotala-2.git
cd Gadbad-Ghotala-2
npx serve .   # or just open index.html
```

## Tech stack

Python · FastAPI · ONNX Runtime · OpenCV · OR-Tools · HTML/CSS/JS · CesiumJS

## Project structure

```
.
├── index.html                 # App shell: sidebar nav, topbar, six routed views
├── assets/
│   ├── css/style.css          # Dashboard design system
│   └── js/main.js             # Router, demo dataset, charts, map + planner logic, API calls
├── backend/
│   ├── app.py                 # FastAPI endpoints
│   ├── config.py               # Model path discovery, class map, thresholds
│   ├── download_model.py       # Fetches ONNX weights from Hugging Face
│   ├── routing.py               # OR-Tools TSP solver
│   ├── inference/               # ONNX engine, pre/post-processing, acoustic physics
│   ├── utils/annotator.py       # Draws detection overlays
│   ├── static/samples/          # Bundled sample sonar images
│   └── requirements.txt
├── LICENSE
└── README.md
```

## Roadmap

- Parse raw XTF/JSF sonar files (with embedded GPS nav) instead of plain images
- Fine-tune on a labeled marine-litter dataset for plastic/net/tyre-level classes
- Persist detections and review outcomes (Postgres) instead of in-memory state
- Closed-loop retraining from analyst confirmations

## License

MIT. See [LICENSE](LICENSE).

---

Team Gadbad Ghotala · Smart India Hackathon 2026 (PS SIH26195)
