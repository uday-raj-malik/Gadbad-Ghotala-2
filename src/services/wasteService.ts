import type { Detection, WasteRecord } from '@/types';
import { CATEGORY_META, CATEGORY_ORDER, TYPE_META } from '@/lib/meta';
import { MOCK_WASTE_STAGES } from '@/data/mock';
import { mock } from './http';
import { sleep } from '@/lib/utils';

export type StageMap = Record<string, { stage: number; manifestId?: string }>;

/** GET /waste/stages */
export async function getWasteStages(): Promise<StageMap> {
  return mock(MOCK_WASTE_STAGES);
}

/** Aggregates recovered detections into waste records (GET /waste/records on a real backend). */
export function buildWasteRecords(dets: Detection[], stages: StageMap): WasteRecord[] {
  return CATEGORY_ORDER.map((c) => {
    const rec = dets.filter((d) => d.status === 'recovered' && TYPE_META[d.type].category === c);
    return {
      category: c,
      items: rec.length,
      weightKg: rec.reduce((a, d) => a + d.weightKg, 0),
      recycler: CATEGORY_META[c].recycler,
      stage: stages[c]?.stage ?? 0,
      manifestId: stages[c]?.manifestId,
    };
  });
}

/** POST /waste/{category}/advance */
export async function advanceStage(category: string, current: number): Promise<{ stage: number; manifestId?: string }> {
  await sleep(450);
  const stage = Math.min(4, current + 1);
  return { stage, manifestId: stage >= 3 ? `MF-2026-${String(180 + Math.floor(Math.random() * 90)).padStart(4, '0')}` : undefined };
}
