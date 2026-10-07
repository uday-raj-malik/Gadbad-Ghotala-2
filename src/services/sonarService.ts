import type { PipelineEvent, SonarScan, Survey, Detection } from '@/types';
import { MOCK_SCANS, MOCK_SURVEY } from '@/data/mock';
import { generateScanDetections } from '@/data/mockDetections';
import { mock } from './http';
import { sleep } from '@/lib/utils';
import { analyzeFile, analyzeSample, isBackendOnline, listSamples, rawDetectionToDetection, type AnalyzeResponse } from './liveApi';
import type { PickedFile } from '@/components/sonar/UploadDropzone';

export const PIPELINE_STEPS = [
  'File ingested',
  'Preprocessing',
  'AI detection',
  'False-positive filtering',
  'Geolocation',
  'Ready for review',
];

/** Each message advances the visible pipeline; `step` is the active pipeline index. */
const SEQUENCE: { message: string; step: number; ms: number }[] = [
  { message: 'Uploading…', step: 0, ms: 900 },
  { message: 'Parsing sonar data…', step: 0, ms: 900 },
  { message: 'Preprocessing…', step: 1, ms: 1100 },
  { message: 'Running AI detection…', step: 2, ms: 1700 },
  { message: 'Filtering false positives…', step: 3, ms: 1100 },
  { message: 'Generating coordinates…', step: 4, ms: 900 },
  { message: 'Analysis complete', step: 5, ms: 400 },
];

const LIVE_IMAGE_EXT = ['jpg', 'jpeg', 'png', 'tif', 'tiff'];

/** GET /survey */
export async function getSurvey(): Promise<Survey> {
  return mock(MOCK_SURVEY);
}

/** GET /scans */
export async function listScans(): Promise<SonarScan[]> {
  return mock(MOCK_SCANS);
}

/** GET /live/samples — bundled sonar images the real backend can analyze instantly. */
export async function getLiveSamples(): Promise<string[]> {
  try {
    return await listSamples();
  } catch {
    return [];
  }
}

export interface AnalyzeResult {
  scan: SonarScan;
  detections: Detection[];
  /** The real backend's own annotated JPEG, when a live analysis actually ran. */
  liveAnnotatedImage?: string;
  live: boolean;
}

function newScanShell(fileName: string, sizeMb: number, lane: number): SonarScan {
  const ext = fileName.split('.').pop()?.toUpperCase();
  const format = ext === 'JSF' || ext === 'CSV' ? ext : 'XTF';
  const id = `SC-${String(413 + Math.floor(Math.random() * 40)).padStart(4, '0')}`;
  return {
    id,
    surveyId: MOCK_SURVEY.id,
    fileName,
    format: format as SonarScan['format'],
    sizeMb,
    pings: 17000 + Math.floor(Math.random() * 2500),
    swathM: 150,
    uploadedAt: new Date().toISOString(),
    lane,
    status: 'ready',
  };
}

function detectionsFromLiveResult(scanId: string, lane: number, existing: Detection[], api: AnalyzeResponse): Detection[] {
  const counters: Record<string, number> = {};
  existing.forEach((d) => {
    counters[d.type] = Math.max(counters[d.type] ?? 0, d.num);
  });
  const seed = Math.floor(Math.random() * 1e6);
  return api.detections.map((raw) => {
    // num is assigned per-type after the first pass since inferWasteType happens inside the adapter;
    // run the adapter once to learn the type, then fix up the sequential num per type.
    const det = rawDetectionToDetection(raw, { scanId, lane, num: 1, imageSize: api.image_size, seed });
    counters[det.type] = (counters[det.type] ?? 0) + 1;
    det.num = counters[det.type];
    det.id = det.id.replace(/-\d+$/, `-${String(det.num).padStart(3, '0')}`);
    return det;
  });
}

/**
 * POST /scans (multipart) then poll/stream job status.
 * If `file.raw` is an image the real backend can decode and the backend
 * is reachable, this runs an actual YOLO-ESI inference pass and returns
 * real detections (see liveApi.ts). Otherwise — XTF/JSF/CSV (not parsed
 * yet, see repo README) or the backend being offline — it falls back to
 * the original simulated pipeline so the demo still works standalone.
 */
export async function analyzeScan(
  file: PickedFile,
  existing: Detection[],
  onEvent: (e: PipelineEvent) => void,
): Promise<AnalyzeResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const lane = 2 + Math.floor(Math.random() * 3);
  const canTryLive = LIVE_IMAGE_EXT.includes(ext);

  if (canTryLive && (await isBackendOnline())) {
    onEvent({ step: 0, message: 'Uploading to Live Analysis API…', progress: 10 });
    try {
      const api = await analyzeFile(file.raw);
      onEvent({ step: 2, message: 'Running AI detection (real YOLO-ESI model)…', progress: 55 });
      await sleep(250);
      onEvent({ step: 3, message: 'Acoustic-physics post-processing…', progress: 75 });
      await sleep(200);
      const scan = newScanShell(file.name, file.sizeMb, lane);
      const detections = detectionsFromLiveResult(scan.id, lane, existing, api);
      onEvent({ step: 5, message: 'Live analysis complete', progress: 100 });
      return { scan, detections, liveAnnotatedImage: api.annotated_image, live: !api.is_demo_mode };
    } catch {
      // fall through to the simulated pipeline below
    }
  }

  for (let i = 0; i < SEQUENCE.length; i++) {
    const s = SEQUENCE[i];
    onEvent({ step: s.step, message: s.message, progress: Math.round((i / (SEQUENCE.length - 1)) * 100) });
    await sleep(s.ms);
  }
  const scan = newScanShell(file.name, file.sizeMb, lane);
  const detections = generateScanDetections(scan.id, lane, existing, Math.floor(Math.random() * 1e6));
  return { scan, detections, live: false };
}

/** Analyze one of the backend's bundled sample sonar images directly (no file picker). */
export async function analyzeSampleScan(
  sampleName: string,
  existing: Detection[],
  onEvent: (e: PipelineEvent) => void,
): Promise<AnalyzeResult> {
  const lane = 2 + Math.floor(Math.random() * 3);
  onEvent({ step: 0, message: `Loading sample "${sampleName}"…`, progress: 15 });
  const api = await analyzeSample(sampleName);
  onEvent({ step: 2, message: 'Running AI detection (real YOLO-ESI model)…', progress: 55 });
  await sleep(250);
  onEvent({ step: 3, message: 'Acoustic-physics post-processing…', progress: 75 });
  await sleep(200);
  const scan = newScanShell(sampleName, 4, lane);
  const detections = detectionsFromLiveResult(scan.id, lane, existing, api);
  onEvent({ step: 5, message: 'Live analysis complete', progress: 100 });
  return { scan, detections, liveAnnotatedImage: api.annotated_image, live: !api.is_demo_mode };
}
