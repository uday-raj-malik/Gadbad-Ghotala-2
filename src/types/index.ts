export type WasteType = 'ghost-net' | 'plastic' | 'tyre' | 'drum' | 'other';
export type Hazard = 'low' | 'medium' | 'high';
export type DetectionStatus = 'confirmed' | 'review' | 'rejected' | 'recovered';
export type WasteCategory = 'plastic' | 'tyre' | 'metal' | 'fishing-net' | 'other';
export type Difficulty = 'easy' | 'moderate' | 'hard';

/** Normalised (0..1) bounding box inside a sonar scan image. x = across-track, y = along-track. */
export interface SonarBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Signal {
  label: string;
  detail: string;
  effect: 'supports' | 'against' | 'neutral';
}

export interface Detection {
  id: string;
  type: WasteType;
  confidence: number; // 0..100
  depth: number; // metres
  latitude: number;
  longitude: number;
  errorRadius: number; // metres (1-sigma horizontal)
  hazard: Hazard;
  status: DetectionStatus;
  detectedAt: string; // ISO
  // --- extended fields used by the UI ---
  num: number;
  u: number; // 0..1 west -> east inside survey bounds
  v: number; // 0..1 north -> south inside survey bounds
  zone: string;
  scanId: string;
  hazardScore: number; // 0..100
  sizeM: number;
  weightKg: number;
  recoveryDifficulty: Difficulty;
  recoveryMinutes: number;
  shadowScore: number; // 0..1
  anomalyScore: number; // 0..1
  signals: Signal[];
  box: SonarBox;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface Survey {
  id: string;
  name: string;
  harbour: string;
  startedAt: string;
  areaKm2: number;
  vessel: string;
  sensor: string;
  frequencyKhz: number;
  scansProcessed: number;
  falsePositivesFiltered: number;
  lastScanAt: string;
}

export interface SonarScan {
  id: string;
  surveyId: string;
  fileName: string;
  format: 'XTF' | 'JSF' | 'CSV';
  sizeMb: number;
  pings: number;
  swathM: number;
  uploadedAt: string;
  lane: number;
  status: 'ready' | 'processing' | 'failed';
}

export interface RouteStop {
  kind: 'start' | 'object' | 'end';
  label: string;
  detectionId?: string;
  u: number;
  v: number;
  legKm: number;
  legMin: number;
}

export interface RecoveryMission {
  id: string;
  name: string;
  createdAt: string;
  stops: RouteStop[];
  objectIds: string[];
  distanceKm: number;
  naiveDistanceKm: number;
  durationMin: number;
  highRiskCount: number;
  solver: string;
}

export interface WasteRecord {
  category: WasteCategory;
  items: number;
  weightKg: number;
  recycler: string;
  stage: number; // 0 recovered .. 4 handed over
  manifestId?: string;
}

/** Minimal shape any map renderer (SVG, canvas, Cesium) needs. */
export interface MapObject {
  id: string;
  label: string;
  type: WasteType;
  u: number;
  v: number;
  depth: number;
  hazard: Hazard;
  status: DetectionStatus;
  errorRadius: number;
}

export interface ChartDatum {
  name: string;
  value: number;
  [k: string]: string | number;
}

export interface Report {
  generatedAt: string;
  areaKm2: number;
  totalDetections: number;
  confirmed: number;
  review: number;
  rejected: number;
  recovered: number;
  recoveryRate: number;
  avgConfidence: number;
  falsePositiveRate: number;
  byCategory: ChartDatum[];
  byDepth: ChartDatum[];
  byZone: { name: string; confirmed: number; review: number; recovered: number }[];
  confidenceHistogram: ChartDatum[];
  trend: { day: string; detected: number; recovered: number; cumulativeDetected: number; cumulativeRecovered: number }[];
  weightKg: number;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  at: string;
  level: 'info' | 'warning' | 'success';
  read: boolean;
}

export interface Settings {
  autoConfirm: number;
  reviewLow: number;
  requireHighHazardSignoff: boolean;
  surveyName: string;
  vessel: string;
  swathM: number;
  basemap: 'bathymetry' | 'chart';
  errorExaggeration: number;
  layerCoverage: boolean;
  layerCurrents: boolean;
  layerContours: boolean;
  notifyHigh: boolean;
  notifyReview: boolean;
  notifyScan: boolean;
  vesselSpeedKn: number;
}

export type PipelineEvent = { step: number; message: string; progress: number };
