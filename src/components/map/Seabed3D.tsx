import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import type { MapObject, RecoveryMission, WasteType } from '@/types';
import { contourPath, depthAt, depthColor, currentAt } from '@/lib/bathymetry';
import { AREA, MAP_H, MAP_W, fmtLat, fmtLon, uvToLatLon } from '@/lib/geo';
import { HAZARD_META, LANE_COUNT, TYPE_META } from '@/lib/meta';
import { clamp } from '@/lib/random';

/**
 * Self-contained canvas 3D seabed renderer.
 * Public surface (props + handle) is deliberately renderer-agnostic so a CesiumJS
 * implementation can replace this file without touching the page.
 */
export interface SceneLayers {
  terrain: boolean;
  coverage: boolean;
  detections: boolean;
  currents: boolean;
  route: boolean;
  uncertainty: boolean;
}
export interface SeabedSceneHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
}
interface Props {
  objects: MapObject[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  layers: SceneLayers;
  mission?: RecoveryMission | null;
  errorExaggeration?: number;
  /** Starting zoom; smaller canvases (dashboard tile) want a larger value than the full-screen map. */
  initialZoom?: number;
  /** Rendered in an anchored card next to the selected marker. The renderer positions it every frame. */
  renderCallout?: (id: string) => ReactNode;
  onHover?: (id: string | null) => void;
  className?: string;
}

const N = 64;
const CARD_W = 304;
const WX = 1.25;
const WZ = 1;
const YS = 0.021;
const M_TO_WORLD = (2 * WX) / (AREA.widthKm * 1000);

/** Real vertical exaggeration of the rendered terrain (depth scale vs horizontal scale). */
export const VERTICAL_EXAGGERATION = Math.round(YS / M_TO_WORLD);

const wx = (u: number) => (u - 0.5) * 2 * WX;
const wz = (v: number) => (0.5 - v) * 2 * WZ;
const ty = (u: number, v: number) => -depthAt(u, v) * YS;

const GRID = (() => {
  const g = new Float32Array((N + 1) * (N + 1));
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) g[j * (N + 1) + i] = depthAt(i / N, j / N);
  return g;
})();

const SHADE_EXAGGERATION = 7;
const LIGHT = (() => { const l = [-0.5, 0.8, 0.35]; const m = Math.hypot(l[0], l[1], l[2]); return l.map((x) => x / m); })();
const hAt = (i: number, j: number) => -GRID[j * (N + 1) + i] * YS;

/** Per-cell colour: depth ramp, Lambert shading from the real terrain normal, and a little deterministic grain. */
const CELL_COLOR: string[] = (() => {
  const out: string[] = [];
  const DX = (2 * WX) / N;
  const DZ = (2 * WZ) / N;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const avg = (GRID[j * (N + 1) + i] + GRID[j * (N + 1) + i + 1] + GRID[(j + 1) * (N + 1) + i + 1] + GRID[(j + 1) * (N + 1) + i]) / 4;
      const dhdx = ((hAt(i + 1, j) - hAt(i, j)) + (hAt(i + 1, j + 1) - hAt(i, j + 1))) / (2 * DX);
      const dhdz = -((hAt(i, j + 1) - hAt(i, j)) + (hAt(i + 1, j + 1) - hAt(i + 1, j))) / (2 * DZ);
      const nx = -dhdx * SHADE_EXAGGERATION, ny = 1, nz = -dhdz * SHADE_EXAGGERATION;
      const nl = Math.hypot(nx, ny, nz);
      const lit = Math.max(0, (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / nl);
      const grain = 1 + (((Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1) * 0.5) * 0.05;
      const shade = clamp((0.42 + 0.95 * lit) * grain, 0.5, 1.5);
      const [r, g, bl] = depthColor(avg);
      out.push(`rgb(${clamp(r * shade * 1.22, 0, 255) | 0},${clamp(g * shade * 1.22, 0, 255) | 0},${clamp(bl * shade * 1.18, 0, 255) | 0})`);
    }
  }
  return out;
})();

/** Smooth depth contours (marching squares, shared with the 2D map): [u0, v0, u1, v1, depth] per segment. */
const CONTOUR_LEVELS = [4, 8, 12, 16, 20, 24, 28, 32];
const CONTOUR_SEGS: number[] = (() => {
  const out: number[] = [];
  const re = /M([\d.]+) ([\d.]+)L([\d.]+) ([\d.]+)/g;
  for (const level of CONTOUR_LEVELS) {
    const d = contourPath(level);
    let m: RegExpExecArray | null;
    while ((m = re.exec(d))) out.push(+m[1] / MAP_W, +m[2] / MAP_H, +m[3] / MAP_W, +m[4] / MAP_H, level);
    re.lastIndex = 0;
  }
  return out;
})();

/** Vertex indices walking along each of the four survey edges. */
const WALLS = {
  N: Array.from({ length: N + 1 }, (_, i) => i),
  S: Array.from({ length: N + 1 }, (_, i) => N * (N + 1) + i),
  W: Array.from({ length: N + 1 }, (_, j) => j * (N + 1)),
  E: Array.from({ length: N + 1 }, (_, j) => j * (N + 1) + N),
};
const vu = (idx: number) => (idx % (N + 1)) / N;
const vv = (idx: number) => Math.floor(idx / (N + 1)) / N;

const DEFAULT_CAM = { yaw: 0.45, pitch: 0.82, zoom: 0.7 };

interface Particle { u: number; v: number; age: number; trail: { u: number; v: number }[] }

function glyph(ctx: CanvasRenderingContext2D, type: WasteType, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color + 'CC';
  ctx.strokeStyle = '#06101c';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (type === 'ghost-net') {
    ctx.moveTo(x, y - s * 1.25); ctx.lineTo(x + s * 1.25, y); ctx.lineTo(x, y + s * 1.25); ctx.lineTo(x - s * 1.25, y); ctx.closePath();
  } else if (type === 'drum') {
    ctx.rect(x - s * 0.85, y - s * 0.95, s * 1.7, s * 1.9);
  } else if (type === 'other') {
    ctx.moveTo(x, y - s * 1.15); ctx.lineTo(x + s * 1.05, y + s * 0.85); ctx.lineTo(x - s * 1.05, y + s * 0.85); ctx.closePath();
  } else {
    ctx.arc(x, y, s, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();
  if (type === 'tyre') {
    ctx.beginPath();
    ctx.arc(x, y, s * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#06101c';
    ctx.fill();
  }
  if (type === 'ghost-net') {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.6, y); ctx.lineTo(x + s * 0.6, y); ctx.moveTo(x, y - s * 0.6); ctx.lineTo(x, y + s * 0.6);
    ctx.strokeStyle = '#06101c'; ctx.lineWidth = 1; ctx.stroke();
  }
}

const Seabed3D = forwardRef<SeabedSceneHandle, Props>(function Seabed3D(
  { objects, selectedId, onSelect, layers, mission, errorExaggeration = 8, renderCallout, onHover, initialZoom, className },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const calloutRef = useRef<HTMLDivElement>(null);
  const startCam = { ...DEFAULT_CAM, zoom: initialZoom ?? DEFAULT_CAM.zoom };
  const cam = useRef({ ...startCam });
  const dirty = useRef(true);
  const hits = useRef<{ id: string; x: number; y: number }[]>([]);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const particles = useRef<Particle[]>([]);
  const propsRef = useRef({ objects, selectedId, layers, mission, errorExaggeration });
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const hoverRef = useRef<string | null>(null);

  propsRef.current = { objects, selectedId, layers, mission, errorExaggeration };
  useEffect(() => { dirty.current = true; }, [objects, selectedId, layers, mission, errorExaggeration]);

  useImperativeHandle(ref, () => ({
    zoomIn: () => { cam.current.zoom = clamp(cam.current.zoom * 1.25, 0.6, 3.5); dirty.current = true; },
    zoomOut: () => { cam.current.zoom = clamp(cam.current.zoom / 1.25, 0.6, 3.5); dirty.current = true; },
    reset: () => { cam.current = { ...startCam }; dirty.current = true; },
  }));

  const render = useCallback((time: number) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { objects: objs, selectedId: sel, layers: L, mission: mis, errorExaggeration: exag } = propsRef.current;

    const { yaw, pitch, zoom } = cam.current;
    const dist = 3.6;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const k0 = Math.min(w / 2.9, h / 1.75) * zoom;
    const cx0 = w / 2;
    const cy0 = h / 2 - h * 0.01;
    const project = (x: number, y: number, z: number) => {
      const x1 = x * cy - z * sy;
      const z1 = x * sy + z * cy;
      const y2 = y * cp + z1 * sp;
      const z2 = -y * sp + z1 * cp;
      const k = (k0 * dist) / (dist + z2);
      return { x: cx0 + x1 * k, y: cy0 - y2 * k, z: z2, k };
    };

    // ---- backdrop: deep water with a soft light bloom behind the survey block
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0a1d33');
    bg.addColorStop(0.55, '#06121f');
    bg.addColorStop(1, '#03080f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const bloom = ctx.createRadialGradient(cx0, cy0 - h * 0.05, 10, cx0, cy0, Math.max(w, h) * 0.62);
    bloom.addColorStop(0, 'rgba(36,128,176,0.20)');
    bloom.addColorStop(1, 'rgba(36,128,176,0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, w, h);

    // ---- projected terrain vertices
    const PX = new Float32Array((N + 1) * (N + 1));
    const PY = new Float32Array((N + 1) * (N + 1));
    const PZ = new Float32Array((N + 1) * (N + 1));
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const p = project(wx(i / N), -GRID[j * (N + 1) + i] * YS, wz(j / N));
        const idx = j * (N + 1) + i;
        PX[idx] = p.x; PY[idx] = p.y; PZ[idx] = p.z;
      }
    }

    // ---- cross-section walls (the "block diagram" look). Far walls first, near walls after the terrain.
    const centerZ = project(0, 0, 0).z;
    const wallList = (Object.keys(WALLS) as (keyof typeof WALLS)[]).map((key) => {
      const idxs = WALLS[key];
      const mid = idxs[N >> 1];
      const midTop = project(wx(vu(mid)), 0, wz(vv(mid)));
      return { key, idxs, far: midTop.z > centerZ };
    });
    const drawWall = (wall: { idxs: number[] }) => {
      const tops = wall.idxs.map((idx) => project(wx(vu(idx)), 0, wz(vv(idx))));
      let yMin = Infinity, yMax = -Infinity;
      tops.forEach((t) => { yMin = Math.min(yMin, t.y); });
      wall.idxs.forEach((idx) => { yMax = Math.max(yMax, PY[idx]); });
      const g = ctx.createLinearGradient(0, yMin, 0, yMax);
      g.addColorStop(0, 'rgba(64,170,214,0.30)');
      g.addColorStop(0.55, 'rgba(14,78,130,0.55)');
      g.addColorStop(1, 'rgba(4,24,50,0.88)');
      ctx.beginPath();
      tops.forEach((t, k) => (k ? ctx.lineTo(t.x, t.y) : ctx.moveTo(t.x, t.y)));
      for (let k = wall.idxs.length - 1; k >= 0; k--) ctx.lineTo(PX[wall.idxs[k]], PY[wall.idxs[k]]);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
      ctx.beginPath();
      wall.idxs.forEach((idx, k) => (k ? ctx.lineTo(PX[idx], PY[idx]) : ctx.moveTo(PX[idx], PY[idx])));
      ctx.strokeStyle = 'rgba(170,228,245,0.55)';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    };
    wallList.filter((x) => x.far).forEach(drawWall);

    // ---- terrain
    const order = Array.from({ length: N * N }, (_, i) => i);
    const key = new Float32Array(N * N);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a = j * (N + 1) + i;
        key[j * N + i] = (PZ[a] + PZ[a + 1] + PZ[a + N + 1] + PZ[a + N + 2]) / 4;
      }
    }
    order.sort((a, b) => key[b] - key[a]);
    ctx.lineJoin = 'round';
    for (const c of order) {
      const i = c % N;
      const j = (c / N) | 0;
      const a = j * (N + 1) + i;
      const b = a + 1;
      const d = a + N + 1;
      const e = d + 1;
      ctx.beginPath();
      ctx.moveTo(PX[a], PY[a]); ctx.lineTo(PX[b], PY[b]); ctx.lineTo(PX[e], PY[e]); ctx.lineTo(PX[d], PY[d]); ctx.closePath();
      if (L.terrain) {
        ctx.fillStyle = CELL_COLOR[c];
        ctx.strokeStyle = CELL_COLOR[c];
        ctx.lineWidth = 0.7;
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(4,10,18,0.92)';
        ctx.strokeStyle = 'rgba(47,211,230,0.26)';
        ctx.lineWidth = 0.6;
        ctx.fill();
        ctx.stroke();
      }
    }
    if (L.terrain) {
      for (const major of [false, true]) {
        ctx.beginPath();
        for (let k = 0; k < CONTOUR_SEGS.length; k += 5) {
          const isMajor = CONTOUR_SEGS[k + 4] % 12 === 0;
          if (isMajor !== major) continue;
          const u0 = CONTOUR_SEGS[k], v0 = CONTOUR_SEGS[k + 1], u1 = CONTOUR_SEGS[k + 2], v1 = CONTOUR_SEGS[k + 3];
          const q0 = project(wx(u0), ty(u0, v0) + 0.003, wz(v0));
          const q1 = project(wx(u1), ty(u1, v1) + 0.003, wz(v1));
          ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y);
        }
        ctx.strokeStyle = major ? 'rgba(225,246,255,0.5)' : 'rgba(214,242,255,0.24)';
        ctx.lineWidth = major ? 1.1 : 0.8;
        ctx.stroke();
      }
    }

    // ---- near walls, surface plane, survey boundary
    wallList.filter((x) => !x.far).forEach(drawWall);
    const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => ({ u, v, top: project(wx(u), 0, wz(v)), bot: project(wx(u), ty(u, v), wz(v)) }));
    ctx.beginPath();
    corners.forEach((c, i) => (i ? ctx.lineTo(c.top.x, c.top.y) : ctx.moveTo(c.top.x, c.top.y)));
    ctx.closePath();
    ctx.fillStyle = 'rgba(80,190,230,0.045)';
    ctx.fill();
    // 500 m surface grid
    ctx.strokeStyle = 'rgba(170,228,245,0.11)';
    ctx.lineWidth = 0.8;
    for (let g = 1; g < 8; g++) {
      const a = project(wx(g / 8), 0, wz(0)), b = project(wx(g / 8), 0, wz(1));
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (let g = 1; g <= 6; g++) {
      const v = g * 0.15625;
      const a = project(wx(0), 0, wz(v)), b = project(wx(1), 0, wz(v));
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    // boundary
    ctx.beginPath();
    corners.forEach((c, i) => (i ? ctx.lineTo(c.top.x, c.top.y) : ctx.moveTo(c.top.x, c.top.y)));
    ctx.closePath();
    ctx.strokeStyle = 'rgba(190,236,250,0.78)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    corners.forEach((c) => {
      ctx.beginPath(); ctx.moveTo(c.top.x, c.top.y); ctx.lineTo(c.bot.x, c.bot.y); ctx.strokeStyle = 'rgba(170,228,245,0.34)'; ctx.lineWidth = 1; ctx.stroke();
    });

    // corner coordinates + boundary label
    ctx.font = '500 10px "IBM Plex Mono", monospace';
    ctx.textBaseline = 'bottom';
    const leftmost = corners.reduce((m, c) => (c.top.x < m.top.x ? c : m), corners[0]);
    corners.forEach((c) => {
      const ll = uvToLatLon(c.u, c.v);
      const left = c.top.x < cx0;
      ctx.textAlign = left ? 'right' : 'left';
      ctx.fillStyle = 'rgba(205,238,250,0.78)';
      const ox = left ? -8 : 8;
      const up = c === leftmost ? -26 : 0;
      ctx.fillText(fmtLat(ll.latitude), c.top.x + ox, c.top.y - 3 + up);
      ctx.fillText(fmtLon(ll.longitude), c.top.x + ox, c.top.y + 9 + up);
    });
    {
      const front = corners.reduce((m, c) => (c.top.z < m.top.z ? c : m), corners[0]);
      const other = corners.filter((c) => c !== front).sort((a, b) => Math.hypot(a.top.x - front.top.x, a.top.y - front.top.y) - Math.hypot(b.top.x - front.top.x, b.top.y - front.top.y))[0];
      const mx = (front.top.x + other.top.x) / 2, my = (front.top.y + other.top.y) / 2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = '600 10px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = 'rgba(205,238,250,0.85)';
      ctx.fillText('SURVEY BOUNDARY · 4.0 × 3.2 km', mx, my + 6);
    }

    // depth ticks on the left-most vertical edge
    let li = 0;
    corners.forEach((c, i) => { if (c.top.x < corners[li].top.x) li = i; });
    const lc = corners[li];
    ctx.font = '500 10.5px "IBM Plex Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const dd of [0, 10, 20, 30]) {
      const p = project(wx(lc.u), -dd * YS, wz(lc.v));
      ctx.beginPath(); ctx.moveTo(p.x - 5, p.y); ctx.lineTo(p.x, p.y); ctx.strokeStyle = 'rgba(214,242,255,0.8)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(214,242,255,0.82)';
      ctx.fillText(`${dd} m`, p.x - 9, p.y);
    }

    // ---- sonar coverage lanes
    if (L.coverage) {
      for (let l = 0; l < LANE_COUNT; l++) {
        const u0 = l / LANE_COUNT + 0.008;
        const u1 = (l + 1) / LANE_COUNT - 0.008;
        const S = 26;
        ctx.beginPath();
        for (let t = 0; t <= S; t++) { const v = t / S; const p = project(wx(u0), ty(u0, v) + 0.006, wz(v)); t ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
        for (let t = S; t >= 0; t--) { const v = t / S; const p = project(wx(u1), ty(u1, v) + 0.006, wz(v)); ctx.lineTo(p.x, p.y); }
        ctx.closePath();
        ctx.fillStyle = l % 2 ? 'rgba(47,211,230,0.075)' : 'rgba(47,211,230,0.125)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(47,211,230,0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        const lab = project(wx((u0 + u1) / 2), ty((u0 + u1) / 2, 0.02) + 0.01, wz(0.02));
        ctx.font = '600 9.5px "IBM Plex Sans", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(160,236,246,0.85)';
        ctx.fillText(`LANE ${l + 1}`, lab.x, lab.y);
      }
    }

    // ---- currents
    if (L.currents) {
      const ps = particles.current;
      while (ps.length < 150) ps.push({ u: Math.random(), v: Math.random(), age: Math.random() * 6, trail: [] });
      for (const p of ps) {
        const c = currentAt(p.u, p.v);
        p.trail.push({ u: p.u, v: p.v });
        if (p.trail.length > 7) p.trail.shift();
        p.u += c.cu * 0.0035 * (0.5 + c.speed);
        p.v += c.cv * 0.0035 * (0.5 + c.speed);
        p.age += 0.016;
        if (p.u > 1 || p.v > 1 || p.v < 0 || p.age > 9) { p.u = Math.random() * 0.15; p.v = Math.random(); p.age = 0; p.trail = []; }
        ctx.beginPath();
        p.trail.forEach((t, i) => { const q = project(wx(t.u), -0.1, wz(t.v)); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
        ctx.strokeStyle = `rgba(143,216,255,${Math.min(0.7, p.trail.length / 10)})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // ---- recovery route: vessel track on the surface with drops to each object on the seabed
    const byId = new Map(objs.map((o) => [o.id, o]));
    let routeAnimating = false;
    if (L.route && mis && mis.stops.length > 1) {
      routeAnimating = true;
      const SURF = 0.012;
      const track = (u: number, v: number) => project(wx(u), SURF, wz(v));
      // drops
      mis.stops.forEach((st) => {
        if (st.kind !== 'object') return;
        const top = track(st.u, st.v);
        const bot = project(wx(st.u), ty(st.u, st.v) + 0.004, wz(st.v));
        ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(bot.x, bot.y);
        ctx.strokeStyle = 'rgba(246,196,83,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([2, 4]); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(bot.x, bot.y, 3, 0, Math.PI * 2); ctx.fillStyle = '#F6C453'; ctx.fill();
      });
      const path = new Path2D();
      mis.stops.forEach((st, i) => {
        const prev = mis.stops[i - 1];
        const q0 = track(st.u, st.v);
        if (!prev) { path.moveTo(q0.x, q0.y); return; }
        for (let t = 1; t <= 12; t++) {
          const q = track(prev.u + ((st.u - prev.u) * t) / 12, prev.v + ((st.v - prev.v) * t) / 12);
          path.lineTo(q.x, q.y);
        }
      });
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(5,12,22,0.7)'; ctx.lineWidth = 6.5; ctx.stroke(path);
      ctx.strokeStyle = 'rgba(246,196,83,0.28)'; ctx.lineWidth = 8; ctx.stroke(path);
      ctx.strokeStyle = '#F6C453'; ctx.lineWidth = 2.6; ctx.stroke(path);
      ctx.save();
      ctx.setLineDash([1.5, 16]);
      ctx.lineDashOffset = -time / 22;
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3.2;
      ctx.stroke(path);
      ctx.restore();
      ctx.lineCap = 'butt';
      // badges
      let n = 0;
      mis.stops.forEach((st) => {
        const q = track(st.u, st.v);
        const isObj = st.kind === 'object';
        if (isObj) n += 1;
        const text = isObj ? String(n) : st.kind === 'start' ? 'START' : 'END';
        ctx.font = '700 10.5px "IBM Plex Sans", sans-serif';
        const tw = isObj ? 0 : ctx.measureText(text).width;
        ctx.beginPath();
        if (isObj) ctx.arc(q.x, q.y, 10.5, 0, Math.PI * 2);
        else ctx.roundRect(q.x - tw / 2 - 8, q.y - 11, tw + 16, 22, 5);
        ctx.fillStyle = isObj ? '#F6C453' : '#07263a';
        ctx.fill();
        ctx.strokeStyle = isObj ? '#050C16' : '#2FD3E6'; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.fillStyle = isObj ? '#050C16' : '#2FD3E6';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, q.x, q.y + 0.5);
        const o = st.detectionId ? byId.get(st.detectionId) : undefined;
        if (o) {
          ctx.font = '500 10.5px "IBM Plex Sans", sans-serif';
          const lw = ctx.measureText(o.label).width;
          ctx.fillStyle = 'rgba(5,12,22,0.82)';
          ctx.fillRect(q.x + 14, q.y - 9, lw + 10, 18);
          ctx.fillStyle = '#F3E3B3'; ctx.textAlign = 'left';
          ctx.fillText(o.label, q.x + 19, q.y + 0.5);
        }
      });
    }

    // ---- detections
    hits.current = [];
    let selHead: { x: number; y: number } | null = null;
    if (L.detections) {
      const items = objs
        .map((o) => {
          const y0 = ty(o.u, o.v);
          return { o, base: project(wx(o.u), y0, wz(o.v)), head: project(wx(o.u), y0 + 0.16, wz(o.v)) };
        })
        .sort((a, b) => b.base.z - a.base.z);
      for (const it of items) {
        const { o, base, head } = it;
        const hz = HAZARD_META[o.hazard].color;
        const done = o.status === 'recovered';
        const active = o.id === sel;
        const sc = clamp(head.k / k0, 0.8, 1.3) * (active ? 1.25 : 1);
        ctx.globalAlpha = done ? 0.4 : 1;
        // hazard halo on the seabed
        if (!done && o.hazard !== 'low') {
          const rr = (o.hazard === 'high' ? 0.075 : 0.05) * base.k;
          const hg = ctx.createRadialGradient(base.x, base.y, 0, base.x, base.y, rr);
          hg.addColorStop(0, hz + (o.hazard === 'high' ? '55' : '33'));
          hg.addColorStop(1, hz + '00');
          ctx.fillStyle = hg;
          ctx.beginPath(); ctx.ellipse(base.x, base.y, rr, rr * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        }
        // uncertainty circle
        if (L.uncertainty || active) {
          const r = o.errorRadius * exag * M_TO_WORLD;
          ctx.beginPath();
          for (let a = 0; a <= 28; a++) {
            const th = (a / 28) * Math.PI * 2;
            const u = o.u + (Math.cos(th) * r) / (2 * WX);
            const v = o.v - (Math.sin(th) * r) / (2 * WZ);
            const q = project(wx(u), ty(u, v) + 0.004, wz(v));
            a ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
          }
          ctx.fillStyle = hz + '24';
          ctx.fill();
          ctx.strokeStyle = hz;
          ctx.lineWidth = active ? 1.5 : 1;
          ctx.setLineDash([3, 2]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // stem + anchor
        ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(head.x, head.y);
        ctx.strokeStyle = hz + 'BB'; ctx.lineWidth = 1.1; ctx.stroke();
        ctx.beginPath(); ctx.arc(base.x, base.y, 2.2, 0, Math.PI * 2); ctx.fillStyle = hz; ctx.fill();
        // marker: hazard ring + category glyph
        const R = 10.5 * sc;
        ctx.beginPath(); ctx.arc(head.x, head.y, R, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(5,12,22,0.82)'; ctx.fill();
        ctx.strokeStyle = hz; ctx.lineWidth = o.hazard === 'high' ? 2.8 : o.hazard === 'medium' ? 2 : 1.4; ctx.stroke();
        glyph(ctx, o.type, head.x, head.y, 5.4 * sc, TYPE_META[o.type].color);
        if (o.status === 'review') {
          ctx.beginPath(); ctx.arc(head.x + R * 0.82, head.y - R * 0.82, 3.6, 0, Math.PI * 2);
          ctx.fillStyle = '#F6A623'; ctx.fill(); ctx.strokeStyle = '#050C16'; ctx.lineWidth = 1; ctx.stroke();
        }
        if (active) {
          const pulse = R + 6 + Math.sin(time / 240) * 1.6;
          ctx.beginPath(); ctx.arc(head.x, head.y, pulse, 0, Math.PI * 2);
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
          selHead = { x: head.x, y: head.y };
        }
        ctx.globalAlpha = 1;
        hits.current.push({ id: o.id, x: head.x, y: head.y });
      }
    }

    // ---- anchored callout + leader line
    const card = calloutRef.current;
    if (card) {
      if (selHead) {
        const ch = card.offsetHeight || 250;
        let left = selHead.x + 30;
        if (left + CARD_W > w - 12) left = selHead.x - 30 - CARD_W;
        left = clamp(left, 12, Math.max(12, w - CARD_W - 12));
        const top = clamp(selHead.y - 64, 12, Math.max(12, h - ch - 12));
        const ax = left > selHead.x ? left : left + CARD_W;
        const ay = clamp(selHead.y, top + 18, top + ch - 18);
        ctx.beginPath(); ctx.moveTo(selHead.x, selHead.y); ctx.lineTo(ax, ay);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.stroke();
        card.style.transform = `translate(${left}px, ${top}px)`;
        card.style.opacity = '1';
        card.style.pointerEvents = 'auto';
      } else {
        card.style.opacity = '0';
        card.style.pointerEvents = 'none';
      }
    }
    animRef.current = routeAnimating;

    // ---- compass
    const cxp = 46, cyp = h - 70;
    ctx.save();
    ctx.translate(cxp, cyp);
    ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fillStyle = 'rgba(8,18,31,0.72)'; ctx.fill(); ctx.strokeStyle = 'rgba(120,180,214,0.45)'; ctx.lineWidth = 1; ctx.stroke();
    const nx = -sy, ny = -cy * sp;
    const nl = Math.hypot(nx, ny) || 1;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo((nx / nl) * 17, (ny / nl) * 17); ctx.strokeStyle = '#2FD3E6'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#2FD3E6'; ctx.font = '600 10px "IBM Plex Sans", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', (nx / nl) * 31, (ny / nl) * 31);
    ctx.restore();
  }, []);

  const animRef = useRef(false);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      const animating = propsRef.current.layers.currents || !!propsRef.current.selectedId || animRef.current;
      if (dirty.current || (animating && t - last > 33)) {
        dirty.current = false;
        last = t;
        render(t);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(() => { dirty.current = true; });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [render]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cam.current.zoom = clamp(cam.current.zoom * Math.exp(-e.deltaY * 0.0012), 0.6, 3.5);
      dirty.current = true;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const nearest = (x: number, y: number) => {
    let best: { id: string; x: number; y: number } | null = null;
    let bd = 18;
    for (const hh of hits.current) {
      const d = Math.hypot(hh.x - x, hh.y - y);
      if (d < bd) { bd = d; best = hh; }
    }
    return best;
  };

  const rel = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div ref={wrapRef} className={'relative overflow-hidden ' + (className ?? '')}>
      <canvas
        ref={canvasRef}
        className="h-full w-full touch-none"
        role="img"
        aria-label="3D seabed terrain with detected waste objects. Drag to rotate, scroll to zoom, click a marker for details."
        style={{ cursor: hover ? 'pointer' : drag.current?.moved ? 'grabbing' : 'grab' }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d && e.buttons === 1) {
            const dx = e.clientX - d.x;
            const dy = e.clientY - d.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
            if (d.moved) {
              cam.current.yaw += dx * 0.006;
              cam.current.pitch = clamp(cam.current.pitch + dy * 0.005, 0.2, 1.45);
              d.x = e.clientX; d.y = e.clientY;
              dirty.current = true;
            }
          } else {
            const { x, y } = rel(e);
            const n = nearest(x, y);
            if ((n?.id ?? null) !== hoverRef.current) { hoverRef.current = n?.id ?? null; setHover(n); onHover?.(n?.id ?? null); }
            else if (n) setHover(n);
          }
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (d && !d.moved) {
            const { x, y } = rel(e);
            onSelect?.(nearest(x, y)?.id ?? null);
          }
        }}
        onPointerLeave={() => { hoverRef.current = null; setHover(null); onHover?.(null); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') cam.current.yaw -= 0.1;
          if (e.key === 'ArrowRight') cam.current.yaw += 0.1;
          if (e.key === 'Escape') onSelect?.(null);
          dirty.current = true;
        }}
        tabIndex={0}
      />

      <div ref={calloutRef} className="absolute left-0 top-0 z-20 transition-opacity duration-150" style={{ width: CARD_W, opacity: 0, pointerEvents: 'none' }}>
        {selectedId && renderCallout?.(selectedId)}
      </div>

      {hover && hover.id !== selectedId && !drag.current && (() => {
        const o = objects.find((x) => x.id === hover.id);
        if (!o) return null;
        const ll = uvToLatLon(o.u, o.v);
        return (
          <div className="glass pointer-events-none absolute z-10 px-2.5 py-1.5 text-xs" style={{ left: hover.x + 14, top: hover.y - 10 }}>
            <p className="font-medium">{o.label} <span className="text-dim">· {o.id}</span></p>
            <p className="num text-dim">{o.depth} m · {fmtLat(ll.latitude)} {fmtLon(ll.longitude)}</p>
          </div>
        );
      })()}
    </div>
  );
});

export default Seabed3D;
