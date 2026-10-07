import type { SonarBox, WasteType } from '@/types';
import { clamp, rng } from './random';

export const SONAR_W = 1400;
export const SONAR_H = 700;

export interface SceneObject {
  id: string;
  type: WasteType;
  box: SonarBox;
}

function paintSeabed(ctx: CanvasRenderingContext2D, W: number, H: number, seed: number, nadir: boolean, gain = 1) {
  const r = rng(seed);
  const gx = Math.max(8, Math.round(W / 30));
  const gy = Math.max(6, Math.round(H / 30));
  const grid = new Float32Array((gx + 1) * (gy + 1));
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  const sm = (x: number, y: number) => {
    const fx = (x / W) * gx;
    const fy = (y / H) * gy;
    const x0 = Math.min(gx - 1, Math.floor(fx));
    const y0 = Math.min(gy - 1, Math.floor(fy));
    const tx = fx - x0;
    const ty = fy - y0;
    const a = grid[y0 * (gx + 1) + x0];
    const b = grid[y0 * (gx + 1) + x0 + 1];
    const c = grid[(y0 + 1) * (gx + 1) + x0];
    const d = grid[(y0 + 1) * (gx + 1) + x0 + 1];
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
  };
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.abs(x - W / 2) / (W / 2);
      let v: number;
      if (nadir && d < 0.045) v = 5 + r() * 12;
      else {
        const range = nadir ? (d - 0.045) / 0.955 : d;
        const tex = sm(x, y) * 42;
        const rip = 11 * Math.sin(y * (W > 600 ? 0.05 : 0.15) + x * 0.012 + sm(x, y) * 6);
        v = (44 + tex + rip) * (1 - 0.2 * range) + (r() - 0.5) * 36;
        if (nadir && d < 0.07) v += (30 * (0.07 - d)) / 0.025;
      }
      v = clamp(v * gain, 0, 255);
      const i = (y * W + x) * 4;
      img.data[i] = v * 0.42;
      img.data[i + 1] = v * 0.86;
      img.data[i + 2] = Math.min(255, v * 0.98 + 8);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export type DrawMode = 'raw' | 'mask';

/** Draws a stylised acoustic signature (raw echo) or segmentation silhouette (mask) for a waste type. */
export function drawObject(ctx: CanvasRenderingContext2D, type: WasteType, cx: number, cy: number, s: number, seed: number, mode: DrawMode) {
  const r = rng(seed);
  ctx.save();
  const raw = mode === 'raw';
  ctx.fillStyle = raw ? 'rgba(215,250,255,0.85)' : 'rgba(47,211,230,0.5)';
  ctx.strokeStyle = raw ? 'rgba(235,252,255,0.95)' : '#2FD3E6';
  if (raw) { ctx.shadowColor = 'rgba(180,240,255,0.8)'; ctx.shadowBlur = s * 0.35; }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (type === 'ghost-net') {
    ctx.lineWidth = Math.max(1.5, s * (raw ? 0.1 : 0.34));
    let x = cx - s * 0.9;
    let y = cy - s * 0.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i < 16; i++) {
      x += (s * 1.8) / 16 + (r() - 0.35) * s * 0.18;
      y += (r() - 0.5) * s * 0.55;
      y = clamp(y, cy - s * 0.8, cy + s * 0.8);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (raw) {
      ctx.lineWidth = Math.max(1, s * 0.05);
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(cx + (r() - 0.5) * s * 1.6, cy + (r() - 0.5) * s);
        ctx.quadraticCurveTo(cx + (r() - 0.5) * s * 1.6, cy + (r() - 0.5) * s * 1.2, cx + (r() - 0.5) * s * 1.6, cy + (r() - 0.5) * s);
        ctx.stroke();
      }
    }
  } else if (type === 'plastic') {
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.ellipse(cx + (r() - 0.5) * s * 1.6, cy + (r() - 0.5) * s * 1.2, s * (0.1 + r() * 0.16), s * (0.08 + r() * 0.12), r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'tyre') {
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.85, s * 0.62, 0.3, 0, Math.PI * 2);
    ctx.ellipse(cx, cy, s * 0.36, s * 0.25, 0.3, 0, Math.PI * 2);
    ctx.fill('evenodd');
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.stroke();
  } else if (type === 'drum') {
    ctx.translate(cx, cy);
    ctx.rotate(-0.5 + r());
    const w = s * 0.55;
    const l = s * 1.5;
    ctx.beginPath();
    ctx.roundRect(-l / 2, -w / 2, l, w, w * 0.3);
    ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.stroke();
    if (raw) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-l * 0.4, -w * 0.28, l * 0.8, w * 0.14); }
  } else {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rad = s * (0.5 + r() * 0.5);
      const px = cx + Math.cos(a) * rad;
      const py = cy + Math.sin(a) * rad * 0.8;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, side: number, strength = 0.7) {
  const x0 = cx + side * s * 0.55;
  const len = s * 1.7;
  const g = ctx.createLinearGradient(x0, 0, x0 + side * len, 0);
  g.addColorStop(0, `rgba(2,8,14,${strength})`);
  g.addColorStop(1, 'rgba(2,8,14,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x0, cy - s * 0.5);
  ctx.lineTo(x0 + side * len, cy - s * 0.85);
  ctx.lineTo(x0 + side * len, cy + s * 0.85);
  ctx.lineTo(x0, cy + s * 0.5);
  ctx.closePath();
  ctx.fill();
}

export function renderSonarScene(canvas: HTMLCanvasElement, seed: number, objects: SceneObject[]) {
  canvas.width = SONAR_W;
  canvas.height = SONAR_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  paintSeabed(ctx, SONAR_W, SONAR_H, seed, true);
  const sorted = [...objects];
  for (const o of sorted) {
    const cx = (o.box.x + o.box.w / 2) * SONAR_W;
    const cy = (o.box.y + o.box.h / 2) * SONAR_H;
    const s = Math.max(o.box.w * SONAR_W, o.box.h * SONAR_H * 0.55) * 0.5;
    drawShadow(ctx, cx, cy, s, cx > SONAR_W / 2 ? 1 : -1);
  }
  for (const o of sorted) {
    const cx = (o.box.x + o.box.w / 2) * SONAR_W;
    const cy = (o.box.y + o.box.h / 2) * SONAR_H;
    const s = Math.max(o.box.w * SONAR_W, o.box.h * SONAR_H * 0.55) * 0.5;
    drawObject(ctx, o.type, cx, cy, s, seed + o.id.length * 131 + o.box.x * 1000, 'raw');
  }
}

export type PatchMode = 'raw' | 'mask' | 'shadow';

export function renderPatch(canvas: HTMLCanvasElement, type: WasteType, seed: number, mode: PatchMode, shadowLenM: number) {
  const W = 220;
  const H = 160;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const cx = W * 0.34;
  const cy = H * 0.5;
  const s = type === 'ghost-net' ? 46 : type === 'plastic' ? 34 : 30;
  if (mode === 'mask') {
    ctx.fillStyle = '#050C16';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(47,211,230,0.08)';
    for (let x = 0; x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    drawObject(ctx, type, cx, cy, s, seed, 'mask');
    return;
  }
  paintSeabed(ctx, W, H, seed, false, mode === 'shadow' ? 0.8 : 1);
  drawShadow(ctx, cx, cy, s, 1, 0.78);
  drawObject(ctx, type, cx, cy, s, seed, 'raw');
  if (mode === 'shadow') {
    const x0 = cx + s * 0.55;
    const len = s * 1.7;
    ctx.fillStyle = 'rgba(143,124,255,0.28)';
    ctx.strokeStyle = '#8F7CFF';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x0, cy - s * 0.5); ctx.lineTo(x0 + len, cy - s * 0.85); ctx.lineTo(x0 + len, cy + s * 0.85); ctx.lineTo(x0, cy + s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x0, cy + s * 1.05); ctx.lineTo(x0 + len, cy + s * 1.05);
    ctx.strokeStyle = '#E6F1F7';
    ctx.stroke();
    ctx.fillStyle = '#E6F1F7';
    ctx.font = '600 10px "IBM Plex Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`shadow ${shadowLenM.toFixed(1)} m`, x0 + len / 2, cy + s * 1.05 + 12);
  }
}
