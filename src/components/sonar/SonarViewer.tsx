import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minus, Plus, ScanSearch, Sun } from 'lucide-react';
import type { Detection, SonarScan } from '@/types';
import { SONAR_H, SONAR_W, renderSonarScene } from '@/lib/sonarRender';
import { clamp, hashString, rng } from '@/lib/random';
import { STATUS_META, TYPE_META } from '@/lib/meta';
import { cn } from '@/lib/utils';

interface Props {
  scan: SonarScan;
  detections: Detection[];
  selectedId?: string | null;
  onSelect: (id: string | null) => void;
}

interface Toggles { boxes: boolean; masks: boolean; shadows: boolean; anomaly: boolean }

function maskPoints(d: Detection): string {
  const r = rng(hashString(d.id));
  const cx = (d.box.x + d.box.w / 2) * SONAR_W;
  const cy = (d.box.y + d.box.h / 2) * SONAR_H;
  const rx = (d.box.w * SONAR_W) / 2;
  const ry = (d.box.h * SONAR_H) / 2;
  return Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    const k = 0.7 + r() * 0.3;
    return `${(cx + Math.cos(a) * rx * k).toFixed(1)},${(cy + Math.sin(a) * ry * k).toFixed(1)}`;
  }).join(' ');
}

export default function SonarViewer({ scan, detections, selectedId, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLSpanElement>(null);
  const [t, setT] = useState<Toggles>({ boxes: true, masks: true, shadows: true, anomaly: true });
  const [mode, setMode] = useState<'ai' | 'raw'>('ai');
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [gain, setGain] = useState(1);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);

  const sceneKey = detections.map((d) => d.id).join('|');
  useEffect(() => {
    if (canvasRef.current) renderSonarScene(canvasRef.current, hashString(scan.id), detections.map((d) => ({ id: d.id, type: d.type, box: d.box })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scan.id, sceneKey]);

  const clampView = (k: number, x: number, y: number) => {
    const el = frameRef.current;
    if (!el) return { k, x, y };
    const w = el.clientWidth;
    const h = el.clientHeight;
    return { k, x: clamp(x, w * (1 - k), 0), y: clamp(y, h * (1 - k), 0) };
  };

  const zoom = (f: number, px?: number, py?: number) => {
    const el = frameRef.current;
    if (!el) return;
    setView((v) => {
      const k = clamp(v.k * f, 1, 8);
      const cx = px ?? el.clientWidth / 2;
      const cy = py ?? el.clientHeight / 2;
      const r = k / v.k;
      return clampView(k, cx - r * (cx - v.x), cy - r * (cy - v.y));
    });
  };

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  });

  const objs = useMemo(() => (mode === 'raw' ? [] : detections.filter((d) => d.status !== 'rejected' || t.boxes)), [detections, t.boxes, mode]);

  const toggle = (key: keyof Toggles, label: string) => (
    <button
      key={key}
      onClick={() => setT((s) => ({ ...s, [key]: !s[key] }))}
      aria-pressed={t[key]}
      className={cn('h-7 rounded border px-2.5 text-xs transition-colors', t[key] ? 'border-sonar/60 bg-sonar/10 text-sonar' : 'border-line2 text-mute hover:text-ink')}
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-md border border-line bg-black">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-panel px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="mr-1 flex rounded border border-line2 p-0.5" role="group" aria-label="Sonar display">
            {([['raw', 'Raw sonar'], ['ai', 'AI overlay']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setMode(k)} aria-pressed={mode === k} className={cn('rounded-sm px-2.5 py-0.5 text-xs transition-colors', mode === k ? 'bg-sonar/15 text-sonar' : 'text-mute hover:text-ink')}>{l}</button>
            ))}
          </div>
          {toggle('boxes', 'Detections')}
          {toggle('masks', 'Masks')}
          {toggle('shadows', 'Shadows')}
          {toggle('anomaly', 'Anomaly regions')}
        </div>
        <div className="flex items-center gap-1.5">
          <label className="flex items-center gap-1.5 text-xs text-mute">
            <Sun size={13} aria-hidden />
            <span className="sr-only">Gain</span>
            <input type="range" min={0.6} max={1.8} step={0.05} value={gain} onChange={(e) => setGain(+e.target.value)} className="w-20" aria-label="Display gain" />
          </label>
          <span className="mx-1 h-4 w-px bg-line" />
          <button aria-label="Zoom in" onClick={() => zoom(1.4)} className="rounded p-1.5 text-mute hover:bg-raised hover:text-ink"><Plus size={14} /></button>
          <button aria-label="Zoom out" onClick={() => zoom(1 / 1.4)} className="rounded p-1.5 text-mute hover:bg-raised hover:text-ink"><Minus size={14} /></button>
          <button aria-label="Reset view" onClick={() => setView({ k: 1, x: 0, y: 0 })} className="rounded p-1.5 text-mute hover:bg-raised hover:text-ink"><Maximize2 size={14} /></button>
          <span className="num w-10 text-right text-xs text-dim">{Math.round(view.k * 100)}%</span>
        </div>
      </div>

      <div
        ref={frameRef}
        className="relative w-full cursor-crosshair touch-none select-none overflow-hidden"
        style={{ height: 'clamp(460px, calc(100vh - 330px), 760px)' }}
        onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }; }}
        onPointerMove={(e) => {
          const el = frameRef.current!;
          const r = el.getBoundingClientRect();
          const ix = ((e.clientX - r.left - view.x) / view.k / r.width) * SONAR_W;
          const iy = ((e.clientY - r.top - view.y) / view.k / r.height) * SONAR_H;
          if (hudRef.current) {
            const range = (ix / SONAR_W - 0.5) * 2 * (scan.swathM / 2);
            hudRef.current.textContent = `${range >= 0 ? 'Stbd' : 'Port'} ${Math.abs(range).toFixed(1)} m · ping ${Math.round((iy / SONAR_H) * scan.pings).toLocaleString('en-IN')}`;
          }
          const d = drag.current;
          if (d && e.buttons === 1) {
            const dx = e.clientX - d.x;
            const dy = e.clientY - d.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
            if (d.moved) setView((v) => clampView(v.k, d.vx + dx, d.vy + dy));
          }
        }}
        onPointerUp={() => { if (drag.current && !drag.current.moved) onSelect(null); drag.current = null; }}
        onPointerLeave={() => { drag.current = null; }}
      >
        <div className="absolute inset-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
          <canvas ref={canvasRef} className="h-full w-full" style={{ filter: `brightness(${gain}) contrast(${1 + (gain - 1) * 0.4})` }} role="img" aria-label={`Side-scan sonar image for ${scan.id}`} />
          <svg viewBox={`0 0 ${SONAR_W} ${SONAR_H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
            {objs.map((d) => {
              const x = d.box.x * SONAR_W;
              const y = d.box.y * SONAR_H;
              const w = d.box.w * SONAR_W;
              const h = d.box.h * SONAR_H;
              const sel = d.id === selectedId;
              const sc = STATUS_META[d.status].color;
              const side = x + w / 2 > SONAR_W / 2 ? 1 : -1;
              const s = Math.max(w, h * 0.55) / 2;
              return (
                <g key={d.id}>
                  {t.shadows && (
                    <polygon
                      points={`${x + w / 2 + side * s * 0.55},${y + h / 2 - s * 0.5} ${x + w / 2 + side * s * 2.25},${y + h / 2 - s * 0.85} ${x + w / 2 + side * s * 2.25},${y + h / 2 + s * 0.85} ${x + w / 2 + side * s * 0.55},${y + h / 2 + s * 0.5}`}
                      fill="#8F7CFF" fillOpacity={0.3} stroke="#8F7CFF" strokeDasharray="4 3" strokeWidth={1.2} vectorEffect="non-scaling-stroke"
                    />
                  )}
                  {t.anomaly && (
                    <ellipse cx={x + w / 2} cy={y + h / 2} rx={w * 1.1 + 10} ry={h * 0.9 + 10} fill="#F6C453" fillOpacity={0.07} stroke="#F6C453" strokeDasharray="2 4" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
                  )}
                  {t.masks && <polygon points={maskPoints(d)} fill={TYPE_META[d.type].color} fillOpacity={0.22} stroke={TYPE_META[d.type].color} strokeOpacity={0.9} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />}
                  {t.boxes && (
                    <g
                      onClick={(e) => { e.stopPropagation(); onSelect(d.id); }}
                      style={{ cursor: 'pointer' }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${d.id} ${TYPE_META[d.type].label}, ${d.confidence} percent`}
                      onKeyDown={(e) => { if (e.key === 'Enter') onSelect(d.id); }}
                    >
                      <rect x={x - 4} y={y - 4} width={w + 8} height={h + 8} fill="transparent" stroke={sel ? '#fff' : sc} strokeWidth={sel ? 2.2 : 1.4} strokeDasharray={d.status === 'review' ? '6 3' : undefined} vectorEffect="non-scaling-stroke" />
                      {(sel || d.status === 'review' || view.k >= 1.6 || w > 60) && (
                        <g transform={`translate(${x - 4} ${y - 4}) scale(${1 / view.k})`}>
                          <rect x={0} y={-16} width={d.id.length * 6.6 + (d.status === 'review' ? 54 : 40)} height={15} fill="#050C16" fillOpacity={0.88} stroke={sel ? '#fff' : sc} strokeWidth={0.8} />
                          <text x={4} y={-5} fontSize={10} fill={d.status === 'review' ? '#F6C453' : '#E6F1F7'} fontFamily="IBM Plex Mono, monospace">{d.status === 'review' ? '⚠ ' : ''}{d.id} {d.confidence.toFixed(0)}%</text>
                        </g>
                      )}
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* fixed range ruler */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-3 pb-3 pt-1.5 text-2xs text-mute">
          <span>Port {scan.swathM / 2} m</span>
          <span className="flex items-center gap-1.5"><ScanSearch size={11} aria-hidden /> Nadir</span>
          <span>Starboard {scan.swathM / 2} m</span>
        </div>
        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 font-mono text-2xs text-mute">
          <span ref={hudRef}>Hover for range and ping</span>
        </div>
        <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-2xs text-mute">
          {scan.id} · {scan.fileName} · 455 kHz · {scan.pings.toLocaleString('en-IN')} pings
        </div>
      </div>
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line bg-panel px-3 py-1.5 text-[11.5px] text-mute" aria-label="Overlay legend">
        <li className="flex items-center gap-1.5"><span className="h-3 w-4 border border-hz-low" aria-hidden />Detection box <span className="text-dim">(dashed = needs review)</span></li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-3.5 rounded-[4px] bg-sonar/30 ring-1 ring-sonar" aria-hidden />Segmentation mask</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-4 -skew-x-12 bg-[#8F7CFF]/40 ring-1 ring-[#8F7CFF]" aria-hidden />Acoustic shadow</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-4 rounded-full bg-[#F6C453]/15 ring-1 ring-dashed ring-[#F6C453]" aria-hidden />Anomaly region</li>
      </ul>
    </div>
  );
}
