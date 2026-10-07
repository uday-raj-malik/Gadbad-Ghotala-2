import type { ChartDatum, Detection, Report } from '@/types';
import { CATEGORY_META, CATEGORY_ORDER, TYPE_META } from '@/lib/meta';
import { ZONES } from '@/lib/geo';
import { MOCK_SURVEY } from '@/data/mock';
import { downloadBlob, sleep } from '@/lib/utils';

/** In production GET /reports/summary. Computed client-side from detections for the demo. */
export function buildReport(dets: Detection[]): Report {
  const active = dets.filter((d) => d.status !== 'rejected');
  const count = (s: Detection['status']) => dets.filter((d) => d.status === s).length;
  const recovered = count('recovered');
  const byCategory: ChartDatum[] = CATEGORY_ORDER.map((c) => ({
    name: CATEGORY_META[c].label,
    value: active.filter((d) => TYPE_META[d.type].category === c).length,
    recovered: dets.filter((d) => d.status === 'recovered' && TYPE_META[d.type].category === c).length,
  }));
  const bands: [string, number, number][] = [['0–5 m', 0, 5], ['5–10 m', 5, 10], ['10–15 m', 10, 15], ['15–20 m', 15, 20], ['20–25 m', 20, 25], ['25 m+', 25, 99]];
  const byDepth: ChartDatum[] = bands.map(([name, lo, hi]) => ({ name, value: active.filter((d) => d.depth >= lo && d.depth < hi).length }));
  const byZone = ZONES.map((z) => ({
    name: z,
    confirmed: dets.filter((d) => d.zone === z && d.status === 'confirmed').length,
    review: dets.filter((d) => d.zone === z && d.status === 'review').length,
    recovered: dets.filter((d) => d.zone === z && d.status === 'recovered').length,
  }));
  const histogram: ChartDatum[] = [];
  for (let lo = 30; lo < 100; lo += 10) {
    histogram.push({ name: `${lo}–${lo + 10}`, value: dets.filter((d) => d.confidence >= lo && d.confidence < lo + 10 + (lo === 90 ? 1 : 0)).length });
  }
  const days = 14;
  let cd = 0;
  let cr = 0;
  const trend = Array.from({ length: days }, (_, i) => {
    const start = Date.now() - (days - i) * 86400000;
    const end = start + 86400000;
    const inDay = dets.filter((d) => +new Date(d.detectedAt) >= start && +new Date(d.detectedAt) < end);
    const detected = inDay.filter((d) => d.status !== 'rejected').length;
    const rec = inDay.filter((d) => d.status === 'recovered').length;
    cd += detected;
    cr += rec;
    return {
      day: new Date(end - 43200000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      detected,
      recovered: rec,
      cumulativeDetected: cd,
      cumulativeRecovered: cr,
    };
  });
  // Mean model confidence over verified detections (confirmed + recovered).
  const verified = dets.filter((d) => d.status === 'confirmed' || d.status === 'recovered');
  const avg = verified.reduce((a, d) => a + d.confidence, 0) / Math.max(verified.length, 1);
  return {
    generatedAt: new Date().toISOString(),
    areaKm2: MOCK_SURVEY.areaKm2,
    totalDetections: active.length,
    confirmed: count('confirmed'),
    review: count('review'),
    rejected: count('rejected'),
    recovered,
    recoveryRate: active.length ? (recovered / active.length) * 100 : 0,
    avgConfidence: avg,
    // Share of reviewed outcomes that a person rejected. (The pipeline's own pre-filtering is reported separately.)
    falsePositiveRate: (count('rejected') / Math.max(1, count('rejected') + count('confirmed') + count('recovered'))) * 100,
    byCategory,
    byDepth,
    byZone,
    confidenceHistogram: histogram,
    trend,
    weightKg: dets.filter((d) => d.status === 'recovered').reduce((a, d) => a + d.weightKg, 0),
  };
}

/** GET /reports/export?format=csv */
export async function exportCsv(dets: Detection[]): Promise<string> {
  await sleep(400);
  const head = ['id', 'type', 'confidence', 'depth_m', 'latitude', 'longitude', 'error_radius_m', 'hazard', 'status', 'zone', 'detected_at'];
  const rows = dets.map((d) => [d.id, d.type, d.confidence, d.depth, d.latitude, d.longitude, d.errorRadius, d.hazard, d.status, d.zone, d.detectedAt].join(','));
  const name = `jalniriksh_detections_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadBlob(name, [head.join(','), ...rows].join('\n'), 'text/csv');
  return name;
}

/** GET /reports/export?format=pdf (mocked as a Markdown report) */
export async function exportReport(r: Report): Promise<string> {
  await sleep(700);
  const md = `# JalNiriksh AI — Survey report\n\nSurvey: ${MOCK_SURVEY.name} (${MOCK_SURVEY.harbour})\nGenerated: ${r.generatedAt}\n\n## Summary\n- Area surveyed: ${r.areaKm2} km²\n- Waste detected: ${r.totalDetections}\n- Confirmed: ${r.confirmed}\n- Needs review: ${r.review}\n- Recovered: ${r.recovered} (${r.recoveryRate.toFixed(1)}%)\n- Mean AI confidence: ${r.avgConfidence.toFixed(1)}%\n- False-positive rate: ${r.falsePositiveRate.toFixed(1)}%\n- Recovered weight: ${r.weightKg} kg\n\n## By category\n${r.byCategory.map((c) => `- ${c.name}: ${c.value} detected, ${c.recovered} recovered`).join('\n')}\n\n## By depth\n${r.byDepth.map((c) => `- ${c.name}: ${c.value}`).join('\n')}\n`;
  const name = `jalniriksh_report_${new Date().toISOString().slice(0, 10)}.md`;
  downloadBlob(name, md, 'text/markdown');
  return name;
}

/** GET /surveys/{id}/data */
export async function downloadSurveyData(dets: Detection[]): Promise<string> {
  await sleep(600);
  const name = `${MOCK_SURVEY.id}_survey_data.json`;
  downloadBlob(name, JSON.stringify({ survey: MOCK_SURVEY, detections: dets }, null, 2), 'application/json');
  return name;
}
