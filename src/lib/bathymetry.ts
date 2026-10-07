import { clamp } from './random';
import { MAP_H, MAP_W } from './geo';

/** Synthetic bathymetry (metres). Replace with a real DEM / multibeam grid later. */
export function depthAt(u: number, v: number): number {
  const slope = 4 + 20 * Math.pow(clamp(u, 0, 1), 1.05);
  const chan = 7 * Math.exp(-Math.pow(v - (0.52 + 0.25 * (u - 0.4)), 2) / 0.012);
  const ridge = 2.2 * Math.sin(u * 9 + v * 4) * Math.cos(v * 7 - u * 2);
  const pit = 4 * Math.exp(-(Math.pow(u - 0.62, 2) + Math.pow(v - 0.62, 2)) / 0.02);
  return clamp(slope + chan + ridge + pit, 3, 36);
}

/** Surface current vector (east = +u, south = +v). */
export function currentAt(u: number, v: number): { cu: number; cv: number; speed: number } {
  const cu = 0.75 + 0.25 * Math.sin(v * 5 + u * 2);
  const cv = 0.35 * Math.sin(u * 6 - v * 3) + 0.15;
  const speed = 0.3 + 0.5 * Math.hypot(cu, cv) * (0.6 + 0.4 * u);
  return { cu, cv, speed };
}

type RGB = [number, number, number];
const STOPS: { t: number; c: RGB }[] = [
  { t: 0, c: [26, 120, 132] },
  { t: 0.3, c: [14, 84, 118] },
  { t: 0.6, c: [9, 48, 88] },
  { t: 1, c: [5, 18, 40] },
];

export function depthColor(d: number): RGB {
  const t = clamp((d - 3) / 33, 0, 1);
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i].t) {
      const a = STOPS[i - 1];
      const b = STOPS[i];
      const k = (t - a.t) / (b.t - a.t);
      return [0, 1, 2].map((j) => a.c[j] + (b.c[j] - a.c[j]) * k) as RGB;
    }
  }
  return STOPS[STOPS.length - 1].c;
}

let cachedUrl: string | null = null;
export function bathymetryDataUrl(): string {
  if (cachedUrl) return cachedUrl;
  const w = 400;
  const h = 320;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      const v = y / (h - 1);
      const d = depthAt(u, v);
      const dx = depthAt(u + 0.004, v) - depthAt(u - 0.004, v);
      const dy = depthAt(u, v + 0.004) - depthAt(u, v - 0.004);
      const shade = clamp(1 + (-dx * 0.9 - dy * 0.6) * 0.5, 0.65, 1.4);
      const [r, g, b] = depthColor(d);
      const i = (y * w + x) * 4;
      img.data[i] = clamp(r * shade, 0, 255);
      img.data[i + 1] = clamp(g * shade, 0, 255);
      img.data[i + 2] = clamp(b * shade, 0, 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  cachedUrl = c.toDataURL('image/png');
  return cachedUrl;
}

const contourCache = new Map<number, string>();
/** Marching squares contour as an SVG path in map coordinates. */
export function contourPath(level: number, nx = 90, ny = 72): string {
  const hit = contourCache.get(level);
  if (hit) return hit;
  const g: number[][] = [];
  for (let j = 0; j <= ny; j++) {
    const row: number[] = [];
    for (let i = 0; i <= nx; i++) row.push(depthAt(i / nx, j / ny));
    g.push(row);
  }
  const sx = MAP_W / nx;
  const sy = MAP_H / ny;
  const lerp = (a: number, b: number) => (level - a) / (b - a);
  const segs: string[] = [];
  const CASES: number[][][] = [
    [], [[3, 2]], [[2, 1]], [[3, 1]], [[0, 1]], [[3, 0], [2, 1]], [[0, 2]], [[3, 0]],
    [[3, 0]], [[0, 2]], [[0, 1], [3, 2]], [[0, 1]], [[3, 1]], [[2, 1]], [[3, 2]], [],
  ];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const tl = g[j][i];
      const tr = g[j][i + 1];
      const br = g[j + 1][i + 1];
      const bl = g[j + 1][i];
      const idx = (tl >= level ? 8 : 0) | (tr >= level ? 4 : 0) | (br >= level ? 2 : 0) | (bl >= level ? 1 : 0);
      const edge = (e: number): [number, number] => {
        if (e === 0) return [(i + lerp(tl, tr)) * sx, j * sy];
        if (e === 1) return [(i + 1) * sx, (j + lerp(tr, br)) * sy];
        if (e === 2) return [(i + lerp(bl, br)) * sx, (j + 1) * sy];
        return [i * sx, (j + lerp(tl, bl)) * sy];
      };
      for (const [a, b] of CASES[idx]) {
        const p = edge(a);
        const q = edge(b);
        segs.push(`M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}`);
      }
    }
  }
  const d = segs.join('');
  contourCache.set(level, d);
  return d;
}
