# JalNiriksh AI

Operational platform for detecting and recovering underwater waste from side-scan sonar.
Two environments: an ocean-tech presentation shell at `/` and the operations dashboard at `/app/*`.
React + TypeScript + Vite + Tailwind + Lucide + Recharts, backed by a real FastAPI service.

Most of the demo survey (156 seeded detections, waste/recycling tracking, reports) is mocked
in the browser so the full workflow is explorable standalone. **Sonar Analysis** and **Recovery
Planning** are different: they call a real backend when it's running; see [Backend](#backend).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
```

If `npm install` crashes in the esbuild postinstall on your machine, use `npm install --ignore-scripts`.

For the real model and real route optimisation instead of their simulated fallbacks, also
start the backend (see [Backend](#backend)) before using those two pages.

## Backend

`backend/` is a FastAPI service: real ONNX model inference and a real OR-Tools solver, not
mocks. Setup:

```bash
python -m venv .venv && source .venv/Scripts/activate   # .venv\Scripts\activate on Windows
pip install -r backend/requirements.txt
python -m backend.download_model      # fetches real ONNX weights (~5.9 MB) from Hugging Face
python -m uvicorn backend.app:app --reload --port 8000
```

**Model**: YOLOv8-Nano + Squeeze-and-Excitation attention ("YOLO-ESI"), ONNX FP16, test
mAP50 ≈ 0.60, trained on multi-source side-scan sonar data. Weights are hosted on
[Hugging Face](https://huggingface.co/Dinoman1221/sonarvision-yolov8-esi-v6), not committed
here. Post-processing (`backend/inference/acoustic_physics.py`) adds peak-backscatter material
classification (metallic vs. synthetic), shadow-based height estimation, and a 0–100 threat
score.

**Routing**: `backend/routing.py` solves a real OR-Tools TSP (jetty → selected items → waste
quay) over the actual survey coordinates, not a hardcoded order.

**How the frontend uses it** (`src/services/liveApi.ts`):
- **Sonar Analysis**: uploading a JPG/PNG/TIFF (or clicking a bundled sample) posts the real
  bytes to `/api/analyze`; the response's detections are mapped onto this app's rich `Detection`
  type: confidence, hazard/threat score, estimated size, acoustic signals and the bounding box
  are real values from the model; survey position (u/v, depth, zone) is still placed
  synthetically within the current scan lane, since a plain image has no embedded GPS nav (see
  [Known gaps](#known-gaps)). If the backend is unreachable, or the file is XTF/JSF/CSV (not
  parsed yet), it falls back to the original simulated detection generator.
- **Recovery Planning**: `generateRoute` calls `/api/plan-route` with the selected detections'
  real coordinates; if that fails, it falls back to the local nearest-neighbour + 2-opt
  heuristic that was already here.

## Known gaps

- Raw XTF/JSF sonar files aren't parsed yet (no real sample file was available to test a parser
  against); only JPG/PNG/TIFF reach the real model today.
- A plain image upload has no embedded GPS/nav, so its map position is placed within the
  current scan lane rather than measured.
- The model's trained classes are acoustic-signature categories (debris/wreck/mine/aircraft),
  heuristically mapped onto this app's plastic/net/tyre/drum taxonomy via the acoustic material
  classifier, not yet a model fine-tuned on labelled waste categories.
- No persistence: confirm/reject decisions, waste-stage advances, and newly analyzed detections
  live only in the browser session.

## Demo script

0. **Landing (`/`)**: procedural underwater scene, wordmark cut by the waterline, glass analytics panel, heatmap, hotspots. *Open Operations Dashboard* plays a transition into `/app`.
1. **Overview**: KPIs, live workflow strip (Sonar → … → Recycling), map, priority list.
2. **Sonar Analysis**: with the backend running, click a bundled sample (real model) or drop a JPG/PNG/TIFF; otherwise pick any file (.xtf/.jsf/.csv) for the simulated pipeline. Either way, watch the pipeline and review the new detections.
3. **Detections**: filter, open GN-024, confirm / reject / mark for recovery. *Start review queue* walks the pending list.
4. **3D Seabed Map**: orbit the seabed, toggle layers, select GN-024, *Add to Recovery Plan*.
5. **Recovery Planning**: adjust the selection, *Generate Optimal Route*, dispatch.
6. **Waste & Recycling**: advance each category through sorting, weighing, manifest and handover.
7. **Reports**: charts plus real CSV / Markdown / JSON downloads.
8. **Settings**: change the 85% / 60% thresholds and watch the review queue impact.

## Architecture

```
src/
  components/shell/  presentation shell: OceanShell, OceanBackdrop (canvas water), GlassPanel, TopNavigation, HeroSection, AnalyticsPanel, HeatmapPreview
  types/        domain models (Detection, Survey, SonarScan, RecoveryMission, WasteRecord, MapObject, Report)
  data/         mock data (156 seeded detections, survey, scans, settings)
  services/     the ONLY place the UI talks to a backend; liveApi.ts is the real FastAPI client + Detection adapter
  store/        React context: detections, mission, settings, toasts, notifications
  components/   ui/ layout/ map/ sonar/ detections/ overview/ recovery/ waste/ reports/
  pages/        one file per route
  lib/          geo, bathymetry, procedural sonar renderer, helpers

backend/        real FastAPI service: ONNX inference, acoustic physics, OR-Tools routing (see Backend, above)
```

### Services: real vs. mock

Every function in `src/services/*` is async and mirrors an endpoint (the endpoint is in the doc
comment above it, e.g. `GET /detections`, `PATCH /detections/{id}/status`, `POST /recovery/route`).
`sonarService.analyzeScan` / `analyzeSampleScan` and `recoveryService.generateRoute` call the
real backend (`src/services/liveApi.ts`, `VITE_API_BASE`, default `http://localhost:8000/api`)
and fall back to mock data if it's unreachable; see [Backend](#backend). The rest
(`detectionService`, `wasteService`, `reportService`) still resolve mock data, since there's no
real persistence or recycler-manifest backend yet. Component and page code doesn't change
either way. `analyzeScan` takes an `onEvent` callback: feed it from SSE / websocket job-progress
events for a real streaming backend instead of the timed sequence used by the fallback.

### Replacing the 3D view with Cesium

`components/map/Seabed3D.tsx` is a canvas renderer behind a small interface: `objects`, `selectedId`, `onSelect`,
`layers`, `mission`, `errorExaggeration`, and a handle with `zoomIn / zoomOut / reset`. Implement a Cesium component
with the same props and swap the import in `pages/Map3DPage.tsx`. Objects use normalised `u, v` coordinates plus
`latitude / longitude`, so they map directly to Cesium cartographics.

## Notes

- shadcn/ui was not installed; the primitives in `components/ui` follow its conventions (`cn()`, variants).
- The route solver is real OR-Tools (`backend/routing.py`) when the backend is running; nearest-neighbour + 2-opt is the in-browser fallback.
- Sonar imagery, bathymetry and currents are procedurally generated; no external assets or network calls. (The one exception: a live analysis's own annotated JPEG, returned by the real backend, is shown separately above the procedural viewer.)

## Using a real photograph

The shell's water is drawn on a canvas so the repo has no image assets. To use a photo, pass `imageSrc` to `OceanBackdrop` (via `OceanShell`);
rays, snow and the waterline are still drawn on top, and the veil keeps the type readable.

## Polish pass: what to show, and where it lives

| Moment | Where | Notes |
| --- | --- | --- |
| 3D seabed | `pages/Map3DPage.tsx`, `components/map/Seabed3D.tsx`, `ObjectCallout.tsx` | Click a marker: anchored card with depth, detection confidence, error radius, hazard, recommended action, **Add to recovery plan**. Legend filters categories. Recovered objects are hidden (toggle in the layer rail). |
| Sonar AI detection | `pages/SonarPage.tsx`, `components/sonar/*` | Large viewer (raw / AI overlay, masks, boxes, shadows, anomaly regions, legend). Right panel lists uncertain detections first with inline Confirm / Reject. |
| Human review | `components/detections/ReviewPanel.tsx`, `ReviewTrack.tsx`, `DetectionDetailPanel.tsx` | AI detection → detection confidence → human review → outcome. Evidence (crop, mask, shadow) sits next to the decision. |
| Recovery route | `components/recovery/RecoveryPlanner.tsx`, `components/map/RecoveryRoute.tsx` | Dotted selection-order path before generating; animated optimised route after, with START/END, numbered stops and a time-stamped sequence. |
| GIS layer | `components/layout/Topbar.tsx`, `StatusBar.tsx`, `hooks/useFocusOn.ts` | Header LAT / LON / DEPTH follow the selected object. Status bar shows datum, sensor and survey coverage. |

Hooks: `useRoutePreview` (route for maps without writing to the store) and `useFocusOn` (publishes a selection to the header readout).

Definitions worth knowing before a Q&A:
- **AI confidence** (KPI) is the mean detection confidence over verified (confirmed + recovered) detections.
- **False-positive rate** is the share of reviewed outcomes that a person rejected. Candidates the pipeline discarded before review are reported separately as "False positives filtered".
- **Vertical exaggeration** in the 3D view is computed from the scene scale (about x34), not a label.
