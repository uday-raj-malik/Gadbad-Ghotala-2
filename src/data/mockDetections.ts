import type { Detection, DetectionStatus, Difficulty, Hazard, Signal, SonarBox, WasteType } from '@/types';
import { clamp, gauss, rng, shuffle } from '@/lib/random';
import { depthAt } from '@/lib/bathymetry';
import { uvToLatLon, zoneAt } from '@/lib/geo';
import { LANE_COUNT, TYPE_META } from '@/lib/meta';

const R = rng(20261001);
const DAY = 86400000;

const COUNTS: Record<WasteType, number> = { 'ghost-net': 31, plastic: 47, tyre: 34, drum: 19, other: 16 };
const REJECTED: Partial<Record<WasteType, number>> = { plastic: 3, other: 4, 'ghost-net': 1, drum: 1 };

interface Pin {
  confidence: number;
  depth: number;
  errorRadius: number;
  hazard: Hazard;
  status: DetectionStatus;
  u: number;
  v: number;
  hazardScore: number;
  hoursAgo: number;
}

/** Hand-placed objects that appear in the demo script. */
const PINNED: Record<string, Pin> = {
  'GN-024': { confidence: 94.2, depth: 18.4, errorRadius: 3.2, hazard: 'high', status: 'review', u: 0.58, v: 0.62, hazardScore: 91, hoursAgo: 3 },
  'DR-017': { confidence: 89.1, depth: 21.2, errorRadius: 2.8, hazard: 'medium', status: 'confirmed', u: 0.34, v: 0.42, hazardScore: 62, hoursAgo: 9 },
  'TY-031': { confidence: 91.6, depth: 15.3, errorRadius: 2.4, hazard: 'medium', status: 'confirmed', u: 0.7, v: 0.3, hazardScore: 55, hoursAgo: 6 },
  'PL-009': { confidence: 96.3, depth: 8.7, errorRadius: 1.6, hazard: 'low', status: 'confirmed', u: 0.22, v: 0.7, hazardScore: 24, hoursAgo: 30 },
};

const HOTSPOTS = [
  { u: 0.3, v: 0.38, s: 0.07 },
  { u: 0.62, v: 0.6, s: 0.08 },
  { u: 0.78, v: 0.27, s: 0.07 },
  { u: 0.2, v: 0.72, s: 0.06 },
];

const SIGNALS: Record<WasteType, Signal[]> = {
  'ghost-net': [
    { label: 'Irregular mesh texture', detail: 'Segmentation mask shows tangled, high-frequency linear returns.', effect: 'supports' },
    { label: 'Draped acoustic shadow', detail: 'Low-relief shadow with ragged trailing edge, typical of netting over rock.', effect: 'supports' },
    { label: 'Elongated anomaly', detail: 'Backscatter anomaly spans several metres along-track.', effect: 'supports' },
    { label: 'Possible natural rock', detail: 'Part of the return overlaps a rocky outcrop; texture is ambiguous.', effect: 'against' },
  ],
  plastic: [
    { label: 'Scattered bright returns', detail: 'Multiple small high-intensity echoes in a 3–6 m cluster.', effect: 'supports' },
    { label: 'Weak shadow', detail: 'Individual shadows below detection floor; cluster-level shadow only.', effect: 'neutral' },
    { label: 'Seabed texture change', detail: 'Local backscatter contrast against surrounding sediment.', effect: 'supports' },
    { label: 'Shell debris look-alike', detail: 'Similar to shell beds seen on previous surveys in this zone.', effect: 'against' },
  ],
  tyre: [
    { label: 'Ring-shaped echo', detail: 'Closed annular return with darker centre, ~0.6 m diameter.', effect: 'supports' },
    { label: 'Consistent shadow height', detail: 'Shadow length gives 0.2–0.3 m relief, matching a tyre stack.', effect: 'supports' },
    { label: 'Compact, high contrast', detail: 'Sharp edges, strong return relative to seabed.', effect: 'supports' },
    { label: 'Partial burial', detail: 'Lower contour hidden; diameter estimate less certain.', effect: 'against' },
  ],
  drum: [
    { label: 'Cylindrical highlight', detail: 'Bright linear return with clean rectangular shadow.', effect: 'supports' },
    { label: 'Shadow geometry', detail: 'Shadow length gives ~0.9 m height, consistent with a 200 L drum.', effect: 'supports' },
    { label: 'Orientation along current', detail: 'Object lies parallel to local current, typical for rolling debris.', effect: 'neutral' },
    { label: 'Boulder ambiguity', detail: 'Rounded return could also be a small boulder.', effect: 'against' },
  ],
  other: [
    { label: 'Hard, angular target', detail: 'Sharp-edged return inconsistent with natural sediment.', effect: 'supports' },
    { label: 'Anomaly vs local seabed', detail: 'Intensity well above the local background estimate.', effect: 'supports' },
    { label: 'No class match', detail: 'Shape does not match any trained class with high confidence.', effect: 'against' },
    { label: 'Short shadow', detail: 'Low relief limits shadow-based height estimate.', effect: 'neutral' },
  ],
};

const HAZARD_WEIGHT: Record<WasteType, number> = { 'ghost-net': 1, drum: 0.85, tyre: 0.5, other: 0.35, plastic: 0.15 };
const SIZE: Record<WasteType, [number, number]> = { 'ghost-net': [3, 12], plastic: [1.5, 6], tyre: [0.6, 3], drum: [0.6, 1.2], other: [0.5, 4] };
const WEIGHT: Record<WasteType, [number, number]> = { 'ghost-net': [15, 90], plastic: [3, 20], tyre: [7, 10], drum: [18, 26], other: [5, 40] };
const BOXSIZE: Record<WasteType, [number, number]> = {
  'ghost-net': [0.05, 0.12],
  plastic: [0.035, 0.05],
  tyre: [0.032, 0.04],
  drum: [0.028, 0.055],
  other: [0.035, 0.045],
};

const range = (lo: number, hi: number) => lo + R() * (hi - lo);

function difficulty(type: WasteType, depth: number): Difficulty {
  if (type === 'ghost-net') return depth > 15 ? 'hard' : 'moderate';
  if (type === 'drum') return depth > 22 ? 'hard' : 'moderate';
  if (type === 'tyre') return 'easy';
  if (type === 'plastic') return 'easy';
  return 'moderate';
}

function minutes(type: WasteType, depth: number): number {
  const base = { 'ghost-net': 24, drum: 15, tyre: 9, plastic: 7, other: 11 }[type];
  return Math.round(base + depth * 0.35 + R() * 4);
}

function pickSignals(type: WasteType, status: DetectionStatus, conf: number): Signal[] {
  const pool = SIGNALS[type];
  const out = pool.filter((s) => s.effect !== 'against').slice(0, 3);
  if (status === 'review' || conf < 85) out.push(pool.find((s) => s.effect === 'against') ?? pool[3]);
  if (status === 'rejected') return [pool[pool.length - 1], { label: 'False-positive filter', detail: 'Return matches seabed ripple/sediment signature; removed by filter stage.', effect: 'against' }];
  return out;
}

function makeBox(type: WasteType, u: number, v: number): { box: SonarBox; scanId: string; lane: number } {
  const lane = clamp(Math.floor(u / (1 / LANE_COUNT)), 0, LANE_COUNT - 1);
  const center = (lane + 0.5) / LANE_COUNT;
  const half = 0.5 / LANE_COUNT;
  let x = 0.5 + ((u - center) / half) * 0.5;
  x = clamp(x, 0.08, 0.92);
  if (Math.abs(x - 0.5) < 0.09) x = 0.5 + (x >= 0.5 ? 0.09 : -0.09);
  const [bw, bh] = BOXSIZE[type];
  const w = bw * range(0.9, 1.15);
  const h = bh * range(0.9, 1.3) * 1.4;
  return {
    box: { x: clamp(x - w / 2, 0.01, 0.99 - w), y: clamp(v - h / 2, 0.01, 0.99 - h), w, h },
    scanId: `SC-${String(408 + lane).padStart(4, '0')}`,
    lane,
  };
}

interface Seed {
  type: WasteType;
  num: number;
  id: string;
  rejected: boolean;
}

function build(): Detection[] {
  const seeds: Seed[] = [];
  (Object.keys(COUNTS) as WasteType[]).forEach((type) => {
    const n = COUNTS[type];
    for (let i = 1; i <= n; i++) seeds.push({ type, num: i, id: `${TYPE_META[type].prefix}-${String(i).padStart(3, '0')}`, rejected: false });
    const rj = REJECTED[type] ?? 0;
    for (let i = 1; i <= rj; i++) {
      const num = n + i;
      seeds.push({ type, num, id: `${TYPE_META[type].prefix}-${String(num).padStart(3, '0')}`, rejected: true });
    }
  });

  const free = shuffle(seeds.filter((s) => !PINNED[s.id] && !s.rejected), R);
  const statusOf = new Map<string, DetectionStatus>();
  let k = 0;
  const quota: [DetectionStatus, number][] = [['recovered', 81], ['review', 30], ['confirmed', 32]];
  for (const [st, n] of quota) for (let i = 0; i < n; i++) statusOf.set(free[k++].id, st);

  // hazard: unrecovered free objects ranked by type weight + noise
  const unrec = free.filter((s) => statusOf.get(s.id) !== 'recovered');
  const ranked = unrec
    .map((s) => ({ s, w: HAZARD_WEIGHT[s.type] + R() * 0.8 }))
    .sort((a, b) => b.w - a.w)
    .map((x) => x.s.id);
  const hazardOf = new Map<string, Hazard>();
  ranked.forEach((id, i) => hazardOf.set(id, i < 22 ? 'high' : i < 45 ? 'medium' : 'low'));

  const out: Detection[] = seeds.map((s) => {
    const pin = PINNED[s.id];
    const status: DetectionStatus = pin ? pin.status : s.rejected ? 'rejected' : statusOf.get(s.id) ?? 'confirmed';
    let hazard: Hazard;
    if (pin) hazard = pin.hazard;
    else if (s.rejected) hazard = 'low';
    else if (status === 'recovered') {
      const x = R();
      hazard = x < 0.15 ? 'high' : x < 0.55 ? 'medium' : 'low';
    } else hazard = hazardOf.get(s.id) ?? 'low';

    // location
    let u: number;
    let v: number;
    if (pin) {
      u = pin.u;
      v = pin.v;
    } else if (R() < 0.68) {
      const h = HOTSPOTS[Math.floor(R() * HOTSPOTS.length)];
      u = clamp(h.u + gauss(R) * h.s, 0.07, 0.97);
      v = clamp(h.v + gauss(R) * h.s, 0.04, 0.96);
    } else {
      u = range(0.1, 0.96);
      v = range(0.05, 0.95);
    }

    // confidence
    let confidence: number;
    let reviewedBy: string | undefined;
    if (pin) confidence = pin.confidence;
    else if (status === 'review') confidence = range(55, 84.5);
    else if (status === 'rejected') confidence = range(31, 58);
    else if (status === 'recovered') confidence = range(85.7, 97.7);
    else if (R() < 0.75) confidence = range(86, 98.5);
    else {
      confidence = range(72, 85);
      reviewedBy = 'Operator A. Rao';
    }
    if (status === 'recovered' && confidence < 85) reviewedBy = 'Operator A. Rao';
    confidence = +confidence.toFixed(1);

    const depth = pin ? pin.depth : +clamp(depthAt(u, v) + gauss(R) * 1.2, 2, 33).toFixed(1);
    const errorRadius = pin ? pin.errorRadius : +(1.2 + depth * 0.09 + R() * 0.8).toFixed(1);
    const hazardScore = pin
      ? pin.hazardScore
      : Math.round(hazard === 'high' ? range(72, 96) : hazard === 'medium' ? range(40, 71) : range(8, 39));
    const { box, scanId } = makeBox(s.type, u, v);
    const ll = uvToLatLon(u, v);
    const hoursAgo = pin ? pin.hoursAgo : range(1, 14 * 24);
    const [sLo, sHi] = SIZE[s.type];
    const [wLo, wHi] = WEIGHT[s.type];
    const d: Detection = {
      id: s.id,
      type: s.type,
      confidence,
      depth,
      latitude: ll.latitude,
      longitude: ll.longitude,
      errorRadius,
      hazard,
      status,
      detectedAt: new Date(Date.now() - hoursAgo * 3600000).toISOString(),
      num: s.num,
      u,
      v,
      zone: zoneAt(u, v),
      scanId,
      hazardScore,
      sizeM: +range(sLo, sHi).toFixed(1),
      weightKg: Math.round(range(wLo, wHi)),
      recoveryDifficulty: difficulty(s.type, depth),
      recoveryMinutes: minutes(s.type, depth),
      shadowScore: +range(0.45, 0.95).toFixed(2),
      anomalyScore: +range(0.4, 0.96).toFixed(2),
      signals: pickSignals(s.type, status, confidence),
      box,
    };
    if (reviewedBy) {
      d.reviewedBy = reviewedBy;
      d.reviewedAt = new Date(Date.now() - (hoursAgo - 0.5) * 3600000).toISOString();
    }
    if (s.id === 'GN-024') {
      d.signals = [
        { label: 'Irregular mesh texture', detail: 'Segmentation mask shows tangled, high-frequency linear returns across ~9 m.', effect: 'supports' },
        { label: 'Draped acoustic shadow', detail: 'Ragged shadow, estimated relief 0.7 m over a rock ledge.', effect: 'supports' },
        { label: 'Anomaly score 0.91', detail: 'Strong departure from the local sediment backscatter model.', effect: 'supports' },
        { label: 'High-hazard class', detail: 'Entanglement risk to vessels and divers: operator sign-off is required even above the auto-confirm threshold.', effect: 'neutral' },
      ];
      d.sizeM = 9.4;
      d.weightKg = 74;
      d.shadowScore = 0.88;
      d.anomalyScore = 0.91;
      d.recoveryMinutes = 38;
    }
    return d;
  });
  return out.sort((a, b) => +new Date(b.detectedAt) - +new Date(a.detectedAt));
}

export const MOCK_DETECTIONS: Detection[] = build();

/** Objects pre-selected in the recovery planner so the page opens with a believable mission. */
export function defaultMissionIds(dets: Detection[]): string[] {
  const base = ['DR-017', 'TY-031'];
  const near = (id: string) => dets.find((d) => d.id === id);
  const g = near('GN-024'); // anchor the nearest-neighbour pick around the demo object
  const rest = dets
    .filter((d) => (d.status === 'confirmed' || d.status === 'review') && !base.includes(d.id) && d.id !== 'GN-024')
    .map((d) => ({ d, score: (d.hazard === 'high' ? 2 : 0) + (g ? -Math.hypot(d.u - g.u, d.v - g.v) * 3 : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x) => x.d.id);
  return [...base, ...rest]; // GN-024 is deliberately left out: the demo adds it from the 3D map
}

/** Used by the "analyze scan" simulation to create a fresh batch of detections. */
export function generateScanDetections(scanId: string, lane: number, existing: Detection[], seed: number): Detection[] {
  const r = rng(seed);
  const types: WasteType[] = ['ghost-net', 'plastic', 'plastic', 'tyre', 'drum', 'other', 'plastic', 'ghost-net'];
  const counters: Record<WasteType, number> = { 'ghost-net': 0, plastic: 0, tyre: 0, drum: 0, other: 0 };
  existing.forEach((d) => (counters[d.type] = Math.max(counters[d.type], d.num)));
  return types.map((type, i) => {
    counters[type] += 1;
    const num = counters[type];
    const u = clamp((lane + 0.12 + r() * 0.76) / LANE_COUNT, 0.05, 0.98);
    const v = 0.08 + (i / types.length) * 0.84 + r() * 0.05;
    const confidence = +(52 + r() * 44).toFixed(1);
    const status: DetectionStatus = confidence >= 85 ? 'confirmed' : 'review';
    const hazardScore = Math.round(HAZARD_WEIGHT[type] * 60 + r() * 40);
    const hazard: Hazard = hazardScore >= 72 ? 'high' : hazardScore >= 40 ? 'medium' : 'low';
    const depth = +clamp(depthAt(u, v) + gauss(r) * 1.1, 2, 33).toFixed(1);
    const ll = uvToLatLon(u, v);
    const b = makeBox(type, u, v);
    const [wLo, wHi] = WEIGHT[type];
    const [sLo, sHi] = SIZE[type];
    return {
      id: `${TYPE_META[type].prefix}-${String(num).padStart(3, '0')}`,
      type,
      confidence,
      depth,
      latitude: ll.latitude,
      longitude: ll.longitude,
      errorRadius: +(1.2 + depth * 0.09 + r() * 0.8).toFixed(1),
      hazard,
      status,
      detectedAt: new Date().toISOString(),
      num,
      u,
      v,
      zone: zoneAt(u, v),
      scanId,
      hazardScore,
      sizeM: +(sLo + r() * (sHi - sLo)).toFixed(1),
      weightKg: Math.round(wLo + r() * (wHi - wLo)),
      recoveryDifficulty: difficulty(type, depth),
      recoveryMinutes: Math.round(8 + depth * 0.4 + r() * 10),
      shadowScore: +(0.45 + r() * 0.5).toFixed(2),
      anomalyScore: +(0.4 + r() * 0.56).toFixed(2),
      signals: pickSignals(type, status, confidence),
      box: { ...b.box, x: clamp(b.box.x, 0.02, 0.95 - b.box.w) },
    } as Detection;
  });
}
