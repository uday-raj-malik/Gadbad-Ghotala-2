# JalNiriksh AI — frontend prototype

Operational platform for detecting and recovering underwater waste from side-scan sonar.
Two environments: an ocean-tech presentation shell at `/` and the operations dashboard at `/app/*`.
React + TypeScript + Vite + Tailwind + Lucide + Recharts. All data is mocked in the browser.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
```

If `npm install` crashes in the esbuild postinstall on your machine, use `npm install --ignore-scripts`.

## Demo script

0. **Landing (`/`)**: procedural underwater scene, wordmark cut by the waterline, glass analytics panel, heatmap, hotspots. *Open Operations Dashboard* plays a transition into `/app`.
1. **Overview**: KPIs, live workflow strip (Sonar → … → Recycling), map, priority list.
2. **Sonar Analysis**: pick any file (.xtf/.jsf/.csv), click *Analyze Scan*, watch the pipeline, review the new detections.
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
  services/     the ONLY place the UI talks to a backend
  store/        React context: detections, mission, settings, toasts, notifications
  components/   ui/ layout/ map/ sonar/ detections/ overview/ recovery/ waste/ reports/
  pages/        one file per route
  lib/          geo, bathymetry, procedural sonar renderer, helpers
```

### Swapping mocks for FastAPI

Every function in `src/services/*` is async and mirrors an endpoint (the endpoint is in the doc comment above it,
e.g. `GET /detections`, `PATCH /detections/{id}/status`, `POST /recovery/route`).
Set `VITE_API_BASE` and `VITE_USE_MOCK=false`, then replace each `mock(...)` body with a `fetch`.
Component and page code does not change. `analyzeScan` takes an `onEvent` callback: feed it from SSE / websocket
job-progress events instead of the timed sequence.

### Replacing the 3D view with Cesium

`components/map/Seabed3D.tsx` is a canvas renderer behind a small interface: `objects`, `selectedId`, `onSelect`,
`layers`, `mission`, `errorExaggeration`, and a handle with `zoomIn / zoomOut / reset`. Implement a Cesium component
with the same props and swap the import in `pages/Map3DPage.tsx`. Objects use normalised `u, v` coordinates plus
`latitude / longitude`, so they map directly to Cesium cartographics.

## Notes

- shadcn/ui was not installed; the primitives in `components/ui` follow its conventions (`cn()`, variants).
- The route "solver" is nearest-neighbour + 2-opt, standing in for OR-Tools.
- Sonar imagery, bathymetry and currents are procedurally generated; no external assets or network calls.

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
