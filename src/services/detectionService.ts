import type { Detection, DetectionStatus } from '@/types';
import { MOCK_DETECTIONS } from '@/data/mockDetections';
import { mock } from './http';
import { sleep } from '@/lib/utils';

/** GET /detections */
export async function listDetections(): Promise<Detection[]> {
  return mock(MOCK_DETECTIONS);
}

/** GET /detections/{id} */
export async function getDetection(id: string): Promise<Detection | undefined> {
  return mock(MOCK_DETECTIONS.find((d) => d.id === id));
}

/** PATCH /detections/{id}/status. Returns the persisted review record. */
export async function updateDetectionStatus(id: string, status: DetectionStatus, reviewer = 'Operator A. Rao') {
  await sleep(180);
  return { id, status, reviewedBy: reviewer, reviewedAt: new Date().toISOString() };
}
