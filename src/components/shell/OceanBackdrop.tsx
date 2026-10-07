import { useEffect, useRef } from 'react';

interface Props {
  /** Y position (px, relative to the backdrop's own top) of the water surface. */
  waterY: number;
  /** Optional photograph. When present it replaces the procedural water body (rays, caustics and snow are still drawn on top). */
  imageSrc?: string;
  className?: string;
}

const CW = 260;
const CH = 130;

/**
 * Procedural "looking through clear water" backdrop: surface haze above, a bright subsurface band, caustics, light shafts,
 * marine snow and seabed silhouettes. Everything is drawn with 2D canvas, so the shell needs no photographic assets.
 */
export default function OceanBackdrop({ waterY, imageSrc, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wyRef = useRef(waterY);
  wyRef.current = waterY;

  useEffect(() => {
    const canvas = ref.current!;
    const parent = canvas.parentElement!;
    const ctx = canvas.getContext('2d')!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // caustic texture (low-res, upscaled with smoothing)
    const cc = document.createElement('canvas');
    cc.width = CW;
    cc.height = CH;
    const cctx = cc.getContext('2d')!;
    const img = cctx.createImageData(CW, CH);

    let photo: HTMLImageElement | null = null;
    if (imageSrc) {
      const im = new Image();
      im.onload = () => { photo = im; };
      im.src = imageSrc;
    }

    let W = 0;
    let H = 0;
    const resize = () => {
      W = parent.clientWidth;
      H = parent.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(() => { resize(); if (reduce) draw(0); });
    ro.observe(parent);

    // deterministic particles
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const snow = Array.from({ length: 150 }, () => ({ x: rnd(), y: rnd(), s: 0.5 + rnd() * 1.8, a: 0.1 + rnd() * 0.4, v: 4 + rnd() * 10, p: rnd() * 6 }));
    const bubbles = Array.from({ length: 14 }, () => ({ x: rnd(), y: rnd(), r: 1.5 + rnd() * 4, v: 16 + rnd() * 26, p: rnd() * 6 }));
    const bokeh = Array.from({ length: 14 }, () => ({ x: rnd(), y: rnd(), r: 18 + rnd() * 52, a: 0.035 + rnd() * 0.06, v: 2 + rnd() * 5, p: rnd() * 6 }));
    const fish = Array.from({ length: 16 }, (_, i) => ({ x: rnd(), y: 0.32 + rnd() * 0.34, s: 4.5 + rnd() * 4, v: 5 + rnd() * 4, p: rnd() * 6, row: i % 3 }));
    const rays = Array.from({ length: 8 }, (_, i) => ({ x: (i + 0.5) / 8 + (rnd() - 0.5) * 0.08, w: 40 + rnd() * 90, lean: 0.16 + rnd() * 0.18, a: 0.07 + rnd() * 0.08, p: rnd() * 6 }));

    const caustics = (t: number, depth: number) => {
      const d = img.data;
      for (let y = 0; y < CH; y++) {
        const fy = Math.pow(1 - y / CH, 3.1);
        for (let x = 0; x < CW; x++) {
          const u = (x / CW) * 15;
          const v = (y / CH) * 6.2 + depth * 0.0003;
          const a = Math.sin(u * 1.7 + Math.sin(v * 2.3 + t * 0.6) * 1.25 + t * 0.5);
          const b = Math.sin(v * 2.1 + Math.sin(u * 1.3 - t * 0.45) * 1.4 - t * 0.4);
          const c = Math.sin((u + v) * 1.1 + Math.sin((u - v) * 1.9 + t * 0.3) * 1.1);
          const k = 1 - Math.abs((a + b + c) / 3);
          const inten = Math.pow(k, 11) * fy;
          const i = (y * CW + x) * 4;
          d[i] = 200; d[i + 1] = 240; d[i + 2] = 255; d[i + 3] = Math.min(255, inten * 520);
        }
      }
      cctx.putImageData(img, 0, 0);
    };

    const ridge = (x0: number, dir: 1 | -1, reach: number, h: number, base: number) => {
      ctx.beginPath();
      ctx.moveTo(x0, H);
      const steps = 40;
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const x = x0 + dir * f * reach;
        const prof = Math.pow(1 - f, 1.6);
        const noise = Math.sin(f * 9 + base) * 0.12 + Math.sin(f * 23 + base * 2) * 0.05;
        ctx.lineTo(x, H - h * (prof + noise * prof));
      }
      ctx.lineTo(x0 + dir * reach, H);
      ctx.closePath();
    };

    let raf = 0;
    let last = 0;
    let causticT = -1;

    function draw(ts: number) {
      const t = ts / 1000;
      const wy = Math.min(wyRef.current, H - 40);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);

      // ---- base: haze above, water body below
      if (photo) {
        const s = Math.max(W / photo.width, H / photo.height);
        ctx.drawImage(photo, (W - photo.width * s) / 2, (H - photo.height * s) / 2, photo.width * s, photo.height * s);
        ctx.fillStyle = 'rgba(4,22,52,0.35)';
        ctx.fillRect(0, 0, W, H);
      } else {
        const sky = ctx.createLinearGradient(0, 0, 0, wy);
        sky.addColorStop(0, '#6f9fd2');
        sky.addColorStop(1, '#4d82c2');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, wy + 2);
        const body = ctx.createLinearGradient(0, wy, 0, H);
        body.addColorStop(0, '#3a95d2');
        body.addColorStop(0.06, '#2278bd');
        body.addColorStop(0.26, '#12589f');
        body.addColorStop(0.55, '#0a3a72');
        body.addColorStop(1, '#03142f');
        ctx.fillStyle = body;
        ctx.fillRect(0, wy, W, H - wy);
      }

      // ---- caustics near the surface
      const depth = Math.min(H - wy, 520);
      if (t - causticT > 0.066 || causticT < 0) { caustics(t, wy); causticT = t; }
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.24;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(cc, 0, wy, W, depth);

      // ---- light shafts
      ctx.globalAlpha = 1;
      const L = Math.min(H - wy, 900);
      for (const r of rays) {
        const sway = Math.sin(t * 0.18 + r.p) * 30;
        const x = r.x * W + sway;
        const pulse = 0.65 + 0.35 * Math.sin(t * 0.35 + r.p * 2);
        const g = ctx.createLinearGradient(0, wy, 0, wy + L);
        g.addColorStop(0, `rgba(205,238,255,${r.a * pulse})`);
        g.addColorStop(1, 'rgba(205,238,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - r.w / 2, wy);
        ctx.lineTo(x + r.w / 2, wy);
        ctx.lineTo(x + r.w * 2.4 + r.lean * L, wy + L);
        ctx.lineTo(x - r.w * 0.6 + r.lean * L, wy + L);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

      // ---- surface: wave line + subsurface glow
      const wave = (x: number) => wy + Math.sin(x * 0.011 + t * 1.1) * 2.4 + Math.sin(x * 0.029 - t * 0.8) * 1.3 + Math.sin(x * 0.0035 + t * 0.4) * 3;
      const glow = ctx.createLinearGradient(0, wy - 2, 0, wy + 46);
      glow.addColorStop(0, 'rgba(235,248,255,0.5)');
      glow.addColorStop(0.25, 'rgba(170,220,250,0.22)');
      glow.addColorStop(1, 'rgba(170,220,250,0)');
      ctx.beginPath();
      ctx.moveTo(0, wave(0));
      for (let x = 0; x <= W; x += 8) ctx.lineTo(x, wave(x));
      ctx.lineTo(W, wy + 46);
      ctx.lineTo(0, wy + 46);
      ctx.closePath();
      ctx.fillStyle = glow;
      ctx.fill();
      ctx.beginPath();
      for (let x = 0; x <= W; x += 6) (x === 0 ? ctx.moveTo(x, wave(x)) : ctx.lineTo(x, wave(x)));
      ctx.strokeStyle = 'rgba(245,251,255,0.8)';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // ---- out-of-focus bokeh for photographic depth
      ctx.globalCompositeOperation = 'lighter';
      for (const b of bokeh) {
        const span = Math.min(H - wy, 900);
        const y = wy + 60 + ((((b.y * span - t * b.v) % span) + span) % span);
        const x = b.x * W + Math.sin(t * 0.12 + b.p) * 24;
        const g = ctx.createRadialGradient(x, y, 0, x, y, b.r);
        g.addColorStop(0, `rgba(190,232,255,${b.a})`);
        g.addColorStop(0.7, `rgba(190,232,255,${b.a * 0.5})`);
        g.addColorStop(1, 'rgba(190,232,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, b.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

      // ---- a distant school, barely there
      for (const f of fish) {
        const span = W + 160;
        const x = W + 80 - ((((f.x * span + t * f.v * 3) % span) + span) % span);
        const y = wy + 140 + f.y * Math.min(H - wy - 300, 520) + Math.sin(t * 0.7 + f.p) * 5 + f.row * 6;
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = 'rgba(6,34,70,0.34)';
        ctx.beginPath(); ctx.ellipse(0, 0, f.s, f.s * 0.36, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(f.s * 0.8, 0); ctx.lineTo(f.s * 1.6, -f.s * 0.45 + Math.sin(t * 6 + f.p) * 1.2); ctx.lineTo(f.s * 1.6, f.s * 0.45 + Math.sin(t * 6 + f.p) * 1.2); ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      // ---- seabed silhouettes
      const rockL = ctx.createLinearGradient(0, H - 260, 0, H);
      rockL.addColorStop(0, 'rgba(8,40,80,0.0)');
      rockL.addColorStop(0.35, 'rgba(5,28,60,0.78)');
      rockL.addColorStop(1, 'rgba(2,14,34,0.96)');
      ctx.fillStyle = rockL;
      ridge(-10, 1, Math.max(300, W * 0.34), 250, 1.3); ctx.fill();
      ridge(W + 10, -1, Math.max(260, W * 0.3), 210, 4.1); ctx.fill();
      ctx.strokeStyle = 'rgba(110,190,235,0.16)';
      ctx.lineWidth = 1;
      ridge(-10, 1, Math.max(300, W * 0.34), 250, 1.3); ctx.stroke();
      ridge(W + 10, -1, Math.max(260, W * 0.3), 210, 4.1); ctx.stroke();

      // ---- marine snow + bubbles
      ctx.fillStyle = '#d8f0ff';
      for (const p of snow) {
        const span = H - wy;
        const y = wy + 20 + ((((p.y * span - t * p.v) % span) + span) % span);
        const x = p.x * W + Math.sin(t * 0.25 + p.p) * 14;
        const near = 1 - Math.min(1, (y - wy) / span) * 0.55;
        ctx.globalAlpha = p.a * near;
        ctx.beginPath();
        ctx.arc(x, y, p.s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(225,245,255,0.35)';
      ctx.lineWidth = 1;
      for (const b of bubbles) {
        const span = Math.min(H - wy, 900);
        const rise = (((b.y * span - t * b.v) % span) + span) % span;
        const y = wy + 14 + rise;
        const x = b.x * W + Math.sin(t * 0.9 + b.p) * 7;
        ctx.beginPath();
        ctx.arc(x, y, b.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x - b.r * 0.3, y - b.r * 0.3, b.r * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fill();
      }

      // ---- vignette: pulls the eye to the centre and settles the frame edges
      const vg = ctx.createRadialGradient(W / 2, Math.min(H * 0.4, 520), Math.min(W, H) * 0.25, W / 2, Math.min(H * 0.4, 520), Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(2,14,40,0)');
      vg.addColorStop(1, 'rgba(2,14,40,0.38)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }

    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden || ts - last < 33) return;
      last = ts;
      draw(ts);
    };
    if (reduce) draw(0);
    else raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [imageSrc]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
