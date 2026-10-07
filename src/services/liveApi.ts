/**
 * Thin client for the real FastAPI backend in `backend/` (YOLO-ESI ONNX
 * detector + acoustic-physics post-processing + OR-Tools routing — see
 * backend/README notes in the repo root README). Every function here
 * either resolves real data or throws; callers fall back to mock data
 * on failure so the UI still works with the backend stopped.
 */
import { API_BASE } from './http';
import { clamp, rng } from '@/lib/random';
import { depthAt } from '@/lib/bathymetry';
import { uvToLatLon, zoneAt } from '@/lib/geo';
import { TYPE_META, LANE_COUNT } from '@/lib/meta';
import type { Detection, DetectionStatus, Hazard, Signal, SonarBox, WasteType } from '@/types';

const HEALTH_TIMEOUT_MS = 1500;

export interface RawDetection {
  id: number;
  class_id: number;
  class_name: 'unknown_debris' | 'wreck' | 'mine' | 'airplane';
  display_label: string;
  confidence: number; // 0..1
  bbox: { x1: number; y1: number; x2: number; y2: number };
  center_pixel: { x: number; y: number };
  material_density: string; // e.g. "Hard (Metallic)" | "Soft (Synthetic/Plastic)" | "Unclassified Benthic Target"
  peak_backscatter_p95: number;
  estimated_height_meters: number | null;
  shadow_length_meters: number | null;
  threat_score: number; // 0..100
  acoustic_telemetry: {
    mean_backscatter: number;
    reflectivity_ratio: number;
    impedance_estimate_mrayl: number;
    classification_confidence: number;
    shadow_detected: boolean;
    grazing_angle_deg: number;
    mensuration_method: string;
    density_description: string;
  };
}

export interface AnalyzeResponse {
  is_demo_mode: boolean;
  model: { model_name: string; architecture: string; [k: string]: unknown };
  timing_ms: { inference_time_ms: number; total_time_ms: number };
  detections: RawDetection[];
  annotated_image: string; // data:image/jpeg;base64,...
  image_size: { width: number; height: number };
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await p;
  } finally {
    clearTimeout(t);
  }
}

export async function isBackendOnline(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
    const res = await fetch(`${API_BASE}/health`, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

export async function analyzeFile(file: File): Promise<AnalyzeResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/analyze`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Live analysis API returned ${res.status}`);
  return res.json();
}

export async function analyzeSample(name: string): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/analyze-sample/${encodeURIComponent(name)}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Live analysis API returned ${res.status}`);
  return res.json();
}

export async function listSamples(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/samples`);
  if (!res.ok) throw new Error(`Live analysis API returned ${res.status}`);
  const data = await res.json();
  return data.samples ?? [];
}

export interface RoutePoint { id: string; x: number; y: number }
export interface RouteSolution {
  order: string[];
  total_distance_km: number;
  legs: { from: string; to: string; distance_km: number }[];
  solver: string;
}

export async function planRouteLive(
  start: { x: number; y: number },
  end: { x: number; y: number },
  items: RoutePoint[],
): Promise<RouteSolution> {
  const res = await withTimeout(
    fetch(`${API_BASE}/plan-route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boat_start: start, boat_end: end, items }),
    }),
    8000,
  );
  if (!res.ok) throw new Error(`Routing API returned ${res.status}`);
  return res.json();
}

/* ------------------------------------------------------------------ */
/* Map a real backend detection onto the frontend's rich Detection type */
/* ------------------------------------------------------------------ */

/**
 * The real model's trained classes are acoustic-signature categories
 * (unknown_debris / wreck / mine / airplane), not fine-grained waste
 * materials. This heuristic bridges them onto the UI's waste taxonomy
 * using the (real) acoustic material classifier as the primary signal —
 * it is not yet a model fine-tuned on labelled plastic/net/tyre classes.
 */
function inferWasteType(d: RawDetection): WasteType {
  const metallic = /hard|metal/i.test(d.material_density);
  const synthetic = /soft|synthetic|plastic/i.test(d.material_density);
  if (d.class_name === 'mine') return metallic ? 'drum' : 'other';
  if (d.class_name === 'wreck') return synthetic ? 'ghost-net' : 'other';
  if (d.class_name === 'airplane') return 'other';
  if (metallic) return 'drum';
  if (synthetic) return Math.random() < 0.5 ? 'plastic' : 'ghost-net';
  return 'other';
}

function hazardFromThreat(score: number): Hazard {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function difficulty(type: WasteType, depth: number) {
  if (type === 'ghost-net') return depth > 15 ? 'hard' : 'moderate';
  if (type === 'drum') return depth > 22 ? 'hard' : 'moderate';
  return 'easy';
}

const WEIGHT: Record<WasteType, [number, number]> = {
  'ghost-net': [15, 90],
  plastic: [3, 20],
  tyre: [7, 10],
  drum: [18, 26],
  other: [5, 40],
};

/**
 * Builds real signal rows from the backend's actual acoustic telemetry —
 * replacing the templated mock signal library with the model's real
 * output for this detection.
 */
function realSignals(d: RawDetection): Signal[] {
  const t = d.acoustic_telemetry;
  const out: Signal[] = [
    {
      label: `Material: ${d.material_density}`,
      detail: `Peak backscatter P95 = ${d.peak_backscatter_p95.toFixed(1)}, reflectivity ratio ${t.reflectivity_ratio.toFixed(2)}, est. impedance ${t.impedance_estimate_mrayl.toFixed(1)} MRayl.`,
      effect: 'supports',
    },
    {
      label: t.shadow_detected ? 'Acoustic shadow detected' : 'No acoustic shadow',
      detail: `Grazing angle ${t.grazing_angle_deg.toFixed(1)}°, mensuration method: ${t.mensuration_method}.`,
      effect: t.shadow_detected ? 'supports' : 'neutral',
    },
    {
      label: `Threat score ${d.threat_score}/100`,
      detail: 'Computed from material density, estimated height and model confidence (backend/inference/acoustic_physics.py).',
      effect: 'neutral',
    },
    {
      label: `YOLO-ESI confidence ${(d.confidence * 100).toFixed(1)}%`,
      detail: `Real-time inference, class "${d.class_name}".`,
      effect: d.confidence >= 0.8 ? 'supports' : 'against',
    },
  ];
  return out;
}

/**
 * Converts one real backend detection into the UI's Detection type.
 * Real: confidence, hazard/hazardScore (from threat_score), sizeM (from
 * estimated height), shadowScore/anomalyScore (from real telemetry),
 * signals, and the bounding box (normalised from the real pixel bbox).
 * Synthetic (no real nav/GPS from a plain image upload yet): position
 * (u, v placed within the given scan lane), depth (site bathymetry
 * model), weight and recovery-time estimates.
 */
export function rawDetectionToDetection(
  raw: RawDetection,
  opts: { scanId: string; lane: number; num: number; imageSize: { width: number; height: number }; seed: number },
): Detection {
  const r = rng(opts.seed + raw.id);
  const type = inferWasteType(raw);
  const confidence = +(raw.confidence * 100).toFixed(1);
  const status: DetectionStatus = confidence >= 85 ? 'confirmed' : 'review';
  const hazard = hazardFromThreat(raw.threat_score);

  const u = clamp((opts.lane + 0.12 + r() * 0.76) / LANE_COUNT, 0.05, 0.98);
  const v = clamp(0.1 + r() * 0.8, 0.05, 0.95);
  const depth = +clamp(depthAt(u, v), 2, 33).toFixed(1);
  const ll = uvToLatLon(u, v);

  const w = opts.imageSize.width || 1;
  const h = opts.imageSize.height || 1;
  const box: SonarBox = {
    x: clamp(raw.bbox.x1 / w, 0, 0.98),
    y: clamp(raw.bbox.y1 / h, 0, 0.98),
    w: clamp((raw.bbox.x2 - raw.bbox.x1) / w, 0.01, 1),
    h: clamp((raw.bbox.y2 - raw.bbox.y1) / h, 0.01, 1),
  };

  const sizeM = raw.estimated_height_meters && raw.estimated_height_meters > 0 ? +raw.estimated_height_meters.toFixed(1) : +(0.5 + r() * 2).toFixed(1);
  const [wLo, wHi] = WEIGHT[type];

  return {
    id: `${TYPE_META[type].prefix}-${String(opts.num).padStart(3, '0')}`,
    type,
    confidence,
    depth,
    latitude: ll.latitude,
    longitude: ll.longitude,
    errorRadius: +(1.2 + (100 - confidence) * 0.06).toFixed(1),
    hazard,
    status,
    detectedAt: new Date().toISOString(),
    num: opts.num,
    u,
    v,
    zone: zoneAt(u, v),
    scanId: opts.scanId,
    hazardScore: raw.threat_score,
    sizeM,
    weightKg: Math.round(wLo + r() * (wHi - wLo)),
    recoveryDifficulty: difficulty(type, depth) as Detection['recoveryDifficulty'],
    recoveryMinutes: Math.round(8 + depth * 0.4 + r() * 10),
    shadowScore: raw.acoustic_telemetry.shadow_detected ? +(0.65 + r() * 0.3).toFixed(2) : +(0.15 + r() * 0.25).toFixed(2),
    anomalyScore: +raw.confidence.toFixed(2),
    signals: realSignals(raw),
    box,
  };
}

