import type { PipelineEvent, SonarScan, Survey, Detection } from '@/types';
import { MOCK_SCANS, MOCK_SURVEY } from '@/data/mock';
import { generateScanDetections } from '@/data/mockDetections';
import { mock } from './http';
import { sleep } from '@/lib/utils';

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

/** GET /survey */
export async function getSurvey(): Promise<Survey> {
  return mock(MOCK_SURVEY);
}

/** GET /scans */
export async function listScans(): Promise<SonarScan[]> {
  return mock(MOCK_SCANS);
}

export interface AnalyzeResult {
  scan: SonarScan;
  detections: Detection[];
}

/**
 * POST /scans (multipart) then poll/stream job status.
 * With a real backend, replace the sleeps with SSE / websocket progress events.
 */
export async function analyzeScan(
  file: { name: string; sizeMb: number },
  existing: Detection[],
  onEvent: (e: PipelineEvent) => void,
): Promise<AnalyzeResult> {
  for (let i = 0; i < SEQUENCE.length; i++) {
    const s = SEQUENCE[i];
    onEvent({ step: s.step, message: s.message, progress: Math.round((i / (SEQUENCE.length - 1)) * 100) });
    await sleep(s.ms);
  }
  const ext = file.name.split('.').pop()?.toUpperCase();
  const format = ext === 'JSF' || ext === 'CSV' ? ext : 'XTF';
  const lane = 2 + Math.floor(Math.random() * 3);
  const id = `SC-${String(413 + Math.floor(Math.random() * 40)).padStart(4, '0')}`;
  const scan: SonarScan = {
    id,
    surveyId: MOCK_SURVEY.id,
    fileName: file.name,
    format: format as SonarScan['format'],
    sizeMb: file.sizeMb,
    pings: 17000 + Math.floor(Math.random() * 2500),
    swathM: 150,
    uploadedAt: new Date().toISOString(),
    lane,
    status: 'ready',
  };
  const detections = generateScanDetections(id, lane, existing, Math.floor(Math.random() * 1e6));
  return { scan, detections };
}
