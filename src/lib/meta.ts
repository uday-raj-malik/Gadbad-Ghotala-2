import type { DetectionStatus, Hazard, WasteCategory, WasteType } from '@/types';

export const TYPE_META: Record<WasteType, { label: string; color: string; prefix: string; category: WasteCategory }> = {
  'ghost-net': { label: 'Ghost net', color: '#2DD4DA', prefix: 'GN', category: 'fishing-net' },
  plastic: { label: 'Plastic cluster', color: '#8FB8FF', prefix: 'PL', category: 'plastic' },
  tyre: { label: 'Tyre', color: '#F2C14E', prefix: 'TY', category: 'tyre' },
  drum: { label: 'Oil drum', color: '#FF8A5B', prefix: 'DR', category: 'metal' },
  other: { label: 'Other debris', color: '#B6C2CF', prefix: 'OT', category: 'other' },
};

export const TYPE_ORDER: WasteType[] = ['ghost-net', 'plastic', 'tyre', 'drum', 'other'];

export const HAZARD_META: Record<Hazard, { label: string; color: string; rank: number }> = {
  high: { label: 'High', color: '#FF5A5F', rank: 3 },
  medium: { label: 'Medium', color: '#F6A623', rank: 2 },
  low: { label: 'Low', color: '#3FD98F', rank: 1 },
};

export const STATUS_META: Record<DetectionStatus, { label: string; color: string }> = {
  confirmed: { label: 'Confirmed', color: '#2FD3E6' },
  review: { label: 'Needs review', color: '#F6A623' },
  rejected: { label: 'Rejected', color: '#7B8FA1' },
  recovered: { label: 'Recovered', color: '#3FD98F' },
};

export const CATEGORY_META: Record<WasteCategory, { label: string; color: string; recycler: string }> = {
  plastic: { label: 'Plastic', color: '#8FB8FF', recycler: 'BlueLoop Polymers' },
  tyre: { label: 'Tyres', color: '#F2C14E', recycler: 'EcoTyre Processing' },
  metal: { label: 'Metal', color: '#FF8A5B', recycler: 'Coastal Metals Recycling' },
  'fishing-net': { label: 'Fishing nets', color: '#2DD4DA', recycler: 'NetCycle Marine' },
  other: { label: 'Other', color: '#B6C2CF', recycler: 'Municipal Sorting Facility' },
};

export const CATEGORY_ORDER: WasteCategory[] = ['plastic', 'tyre', 'metal', 'fishing-net', 'other'];

export const WASTE_STAGES = ['Recovered', 'Sorted', 'Weighed', 'Manifest generated', 'Recycler handover'];

export const WORKFLOW = [
  'Sonar',
  'AI detection',
  'Confidence & review',
  'Location',
  'Prioritisation',
  'Recovery',
  'Segregation',
  'Recycling',
];

export const LANE_COUNT = 5;
