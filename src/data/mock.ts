import type { Notification, Settings, SonarScan, Survey, WasteRecord } from '@/types';
import { CATEGORY_META, CATEGORY_ORDER, LANE_COUNT } from '@/lib/meta';

export const MOCK_SURVEY: Survey = {
  id: 'SR-024',
  name: 'Mumbai Port Survey 24',
  harbour: 'Mumbai Port',
  startedAt: new Date(Date.now() - 14 * 86400000).toISOString(),
  areaKm2: 12.8,
  vessel: 'RV Sagar Anveshak',
  sensor: 'Klein 3900 side-scan',
  frequencyKhz: 455,
  scansProcessed: 38,
  falsePositivesFiltered: 412,
  lastScanAt: new Date(Date.now() - 52 * 60000).toISOString(),
};

export const MOCK_SCANS: SonarScan[] = Array.from({ length: LANE_COUNT }, (_, i) => ({
  id: `SC-${String(408 + i).padStart(4, '0')}`,
  surveyId: MOCK_SURVEY.id,
  fileName: `MBP24_Lane${i + 1}_${['0612', '0745', '0910', '1032', '1145'][i]}.xtf`,
  format: 'XTF' as const,
  sizeMb: [412, 388, 455, 401, 436][i],
  pings: [18240, 17610, 19002, 18115, 18690][i],
  swathM: 150,
  uploadedAt: new Date(Date.now() - (5 - i) * 3.2 * 3600000).toISOString(),
  lane: i,
  status: 'ready' as const,
}));

export const MOCK_NOTIFICATIONS: Notification[] = [
  { id: 'n1', title: 'High-hazard ghost net found', body: 'GN-024 at 18.4 m needs operator sign-off.', at: new Date(Date.now() - 3 * 3600000).toISOString(), level: 'warning', read: false },
  { id: 'n2', title: 'Lane 5 processing finished', body: 'SC-0412 produced 30 detections; 11 need review.', at: new Date(Date.now() - 52 * 60000).toISOString(), level: 'info', read: false },
  { id: 'n3', title: 'Manifest MF-2026-0187 generated', body: 'Tyre batch is ready for EcoTyre Processing.', at: new Date(Date.now() - 20 * 3600000).toISOString(), level: 'success', read: true },
];

export const DEFAULT_SETTINGS: Settings = {
  autoConfirm: 85,
  reviewLow: 60,
  requireHighHazardSignoff: true,
  surveyName: MOCK_SURVEY.name,
  vessel: MOCK_SURVEY.vessel,
  swathM: 150,
  basemap: 'bathymetry',
  errorExaggeration: 8,
  layerCoverage: true,
  layerCurrents: false,
  layerContours: true,
  notifyHigh: true,
  notifyReview: true,
  notifyScan: true,
  vesselSpeedKn: 6,
};

/** Initial pipeline stage per waste category (0 = recovered ... 4 = handed over). */
export const MOCK_WASTE_STAGES: Record<string, { stage: number; manifestId?: string }> = {
  plastic: { stage: 4, manifestId: 'MF-2026-0184' },
  tyre: { stage: 3, manifestId: 'MF-2026-0187' },
  metal: { stage: 3, manifestId: 'MF-2026-0188' },
  'fishing-net': { stage: 2 },
  other: { stage: 1 },
};

export const RECYCLERS = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, CATEGORY_META[c].recycler])) as Record<string, string>;
export type { WasteRecord };
