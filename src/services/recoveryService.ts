import type { Detection, RecoveryMission, RouteStop } from '@/types';
import { BASE_POINT, QUAY_POINT, distKm } from '@/lib/geo';
import { sleep } from '@/lib/utils';

type P = { u: number; v: number };

function tourLength(pts: P[]): number {
  let t = 0;
  for (let i = 1; i < pts.length; i++) t += distKm(pts[i - 1], pts[i]);
  return t;
}

/** Nearest-neighbour seed + 2-opt refinement. Stand-in for the OR-Tools VRP solver. */
function solve(start: P, nodes: Detection[], end: P): Detection[] {
  const left = nodes.slice();
  const order: Detection[] = [];
  let cur: P = start;
  while (left.length) {
    let bi = 0;
    for (let i = 1; i < left.length; i++) if (distKm(cur, left[i]) < distKm(cur, left[bi])) bi = i;
    const [n] = left.splice(bi, 1);
    order.push(n);
    cur = n;
  }
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < order.length - 1; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const cand = order.slice(0, i).concat(order.slice(i, j + 1).reverse(), order.slice(j + 1));
        if (tourLength([start, ...cand, end]) + 1e-9 < tourLength([start, ...order, end])) {
          order.splice(0, order.length, ...cand);
          improved = true;
        }
      }
    }
  }
  return order;
}

export function estimateNaiveKm(ids: string[], all: Detection[]): number {
  const pts = ids.map((id) => all.find((d) => d.id === id)).filter((d): d is Detection => !!d);
  return tourLength([BASE_POINT, ...pts, QUAY_POINT]);
}

/** POST /recovery/route */
export async function generateRoute(ids: string[], all: Detection[], speedKn: number): Promise<RecoveryMission> {
  await sleep(1300);
  const nodes = ids.map((id) => all.find((d) => d.id === id)).filter((d): d is Detection => !!d);
  const ordered = solve(BASE_POINT, nodes, QUAY_POINT);
  const kmh = speedKn * 1.852;
  const stops: RouteStop[] = [];
  let prev: P = BASE_POINT;
  stops.push({ kind: 'start', label: BASE_POINT.label, u: BASE_POINT.u, v: BASE_POINT.v, legKm: 0, legMin: 0 });
  for (const d of ordered) {
    const leg = distKm(prev, d);
    stops.push({
      kind: 'object',
      label: `${d.id}`,
      detectionId: d.id,
      u: d.u,
      v: d.v,
      legKm: +leg.toFixed(2),
      legMin: Math.round((leg / kmh) * 60 + d.recoveryMinutes),
    });
    prev = d;
  }
  const last = distKm(prev, QUAY_POINT);
  stops.push({ kind: 'end', label: QUAY_POINT.label, u: QUAY_POINT.u, v: QUAY_POINT.v, legKm: +last.toFixed(2), legMin: Math.round((last / kmh) * 60) });
  const distanceKm = +stops.reduce((a, s) => a + s.legKm, 0).toFixed(1);
  const durationMin = stops.reduce((a, s) => a + s.legMin, 0);
  return {
    id: `RM-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
    name: 'Recovery mission',
    createdAt: new Date().toISOString(),
    stops,
    objectIds: ids,
    distanceKm,
    naiveDistanceKm: +estimateNaiveKm(ids, all).toFixed(1),
    durationMin,
    highRiskCount: nodes.filter((n) => n.hazard === 'high').length,
    solver: 'Nearest-neighbour + 2-opt (mock for OR-Tools)',
  };
}

/** POST /recovery/missions */
export async function dispatchMission(m: RecoveryMission): Promise<{ id: string; status: 'dispatched' }> {
  await sleep(500);
  return { id: m.id, status: 'dispatched' };
}
