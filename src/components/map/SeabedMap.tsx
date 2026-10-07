import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { CircleDashed, Layers, MapPin, Radar, Target, Waves } from 'lucide-react';
import type { MapObject, RecoveryMission } from '@/types';
import { AREA, MAP_H, MAP_W, fmtLat, fmtLon, uvToLatLon } from '@/lib/geo';
import { bathymetryDataUrl, contourPath, currentAt, depthAt } from '@/lib/bathymetry';
import { HAZARD_META, LANE_COUNT, TYPE_META, TYPE_ORDER } from '@/lib/meta';
import { cn } from '@/lib/utils';
import MapControls, { type LayerToggle } from './MapControls';
import TypeGlyph from './TypeGlyph';
import { RouteOverlay, RoutePreviewOverlay } from './RecoveryRoute';

export interface MapLayers {
  contours: boolean;
  coverage: boolean;
  currents: boolean;
  detections: boolean;
  uncertainty: boolean;
  zones: boolean;
}

interface Props {
  objects: MapObject[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  highlightIds?: string[];
  mission?: RecoveryMission | null;
  routeStale?: boolean;
  /** Unoptimised path shown while no route exists. */
  preview?: { u: number; v: number }[];
  initialLayers?: Partial<MapLayers>;
  errorExaggeration?: number;
  showLegend?: boolean;
  className?: string;
}

const ZONES = [
  { u: 0.3, v: 0.38, r: 105, name: 'Recovery zone A' },
  { u: 0.62, v: 0.6, r: 115, name: 'Recovery zone B' },
  { u: 0.78, v: 0.27, r: 90, name: 'Recovery zone C' },
];
const CONTOURS = [6, 10, 14, 18, 22, 26, 30];

const Markers = memo(function Markers({
  objects, selectedId, highlight, k, onSelect, onHover, uncertainty, exag,
}: {
  objects: MapObject[]; selectedId?: string | null; highlight?: Set<string>; k: number;
  onSelect?: (id: string | null) => void; onHover: (id: string | null) => void; uncertainty: boolean; exag: number;
}) {
  const ordered = useMemo(() => [...objects].sort((a, b) => (a.id === selectedId ? 1 : 0) - (b.id === selectedId ? 1 : 0)), [objects, selectedId]);
  return (
    <g>
      {ordered.map((o) => {
        const x = o.u * MAP_W;
        const y = o.v * MAP_H;
        const hz = HAZARD_META[o.hazard].color;
        const dim = highlight && highlight.size > 0 && !highlight.has(o.id);
        const done = o.status === 'recovered';
        const sel = o.id === selectedId;
        const rr = o.errorRadius * exag * (MAP_W / (AREA.widthKm * 1000));
        return (
          <g key={o.id}>
            {(uncertainty || sel) && <circle cx={x} cy={y} r={rr} fill={hz} fillOpacity={0.1} stroke={hz} strokeOpacity={0.7} strokeWidth={1} strokeDasharray="3 2" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
            <g
              transform={`translate(${x} ${y}) scale(${1 / k})`}
              onClick={(e) => { e.stopPropagation(); onSelect?.(o.id); }}
              onPointerEnter={() => onHover(o.id)}
              onPointerLeave={() => onHover(null)}
              style={{ cursor: 'pointer' }}
              opacity={dim ? 0.3 : done ? 0.45 : 1}
              role="button"
              tabIndex={0}
              aria-label={`${o.label}, ${HAZARD_META[o.hazard].label} hazard, ${o.depth} metres`}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(o.id); } }}
            >
              <circle r={13} fill="transparent" />
              {o.hazard === 'high' && !done && (
                <circle r={9} fill="none" stroke={hz} strokeWidth={1.2} className="animate-ring" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
              )}
              {o.hazard !== 'low' && <circle r={10} fill="#050C16" fillOpacity={0.55} stroke={hz} strokeWidth={1.4} />}
              <TypeGlyph type={o.type} color={TYPE_META[o.type].color} size={6} />
              {highlight?.has(o.id) && <circle r={14} fill="none" stroke="#F6C453" strokeWidth={1.4} />}
              {sel && <circle r={17} fill="none" stroke="#fff" strokeWidth={1.2} strokeDasharray="3 3" />}
            </g>
          </g>
        );
      })}
    </g>
  );
});

export default function SeabedMap({
  objects, selectedId, onSelect, highlightIds, mission, routeStale, preview, initialLayers, errorExaggeration = 8, showLegend = true, className,
}: Props) {
  const [layers, setLayers] = useState<MapLayers>({ contours: true, coverage: true, currents: false, detections: true, uncertainty: false, zones: true, ...initialLayers });
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const [showRoute, setShowRoute] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);

  const highlight = useMemo(() => (highlightIds ? new Set(highlightIds) : undefined), [highlightIds]);
  const img = useMemo(() => bathymetryDataUrl(), []);

  const metrics = useCallback(() => {
    const r = svgRef.current!.getBoundingClientRect();
    const s = Math.min(r.width / MAP_W, r.height / MAP_H);
    return { r, s, ox: (r.width - MAP_W * s) / 2, oy: (r.height - MAP_H * s) / 2 };
  }, []);

  const zoomAt = useCallback((factor: number, vx = MAP_W / 2, vy = MAP_H / 2) => {
    setView((v) => {
      const k = Math.min(8, Math.max(1, v.k * factor));
      const f = k / v.k;
      return { k, tx: vx - f * (vx - v.tx), ty: vy - f * (vy - v.ty) };
    });
  }, []);

  const onWheel = (e: React.WheelEvent) => {
    const { r, s, ox, oy } = metrics();
    zoomAt(e.deltaY < 0 ? 1.18 : 1 / 1.18, (e.clientX - r.left - ox) / s, (e.clientY - r.top - oy) / s);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const { r, s, ox, oy } = metrics();
    const vx = (e.clientX - r.left - ox) / s;
    const vy = (e.clientY - r.top - oy) / s;
    const u = (vx - view.tx) / view.k / MAP_W;
    const v = (vy - view.ty) / view.k / MAP_H;
    if (hudRef.current) {
      if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
        const ll = uvToLatLon(u, v);
        hudRef.current.textContent = `${fmtLat(ll.latitude)}   ${fmtLon(ll.longitude)}   depth ${depthAt(u, v).toFixed(1)} m`;
      } else hudRef.current.textContent = 'Outside survey area';
    }
    const d = drag.current;
    if (d && e.buttons === 1) {
      const dx = (e.clientX - d.x) / s;
      const dy = (e.clientY - d.y) / s;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      if (d.moved) setView((vw) => ({ ...vw, tx: d.tx + dx, ty: d.ty + dy }));
    }
  };
  const onPointerUp = () => {
    if (drag.current && !drag.current.moved) onSelect?.(null);
    drag.current = null;
  };

  const toggles: LayerToggle[] = [
    { key: 'contours', label: 'Depth contours', icon: Layers, active: layers.contours },
    { key: 'coverage', label: 'Sonar coverage', icon: Radar, active: layers.coverage },
    { key: 'detections', label: 'Detections', icon: MapPin, active: layers.detections },
    { key: 'currents', label: 'Currents', icon: Waves, active: layers.currents },
    { key: 'uncertainty', label: 'Uncertainty circles', icon: CircleDashed, active: layers.uncertainty },
    { key: 'zones', label: 'Recovery zones', icon: Target, active: layers.zones },
  ];

  const hovered = hover ? objects.find((o) => o.id === hover) : undefined;
  const routeLabels = useMemo(() => Object.fromEntries(objects.map((o) => [o.id, o.label])), [objects]);
  const scaleBarPx = (() => {
    if (!svgRef.current) return 80;
    const { s } = metrics();
    return (500 / (AREA.widthKm * 1000)) * MAP_W * view.k * s;
  })();

  return (
    <div className={cn('relative overflow-hidden rounded-md border border-line bg-[#06111d]', className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full touch-none select-none"
        role="img"
        aria-label="Seabed map of the survey area showing detected waste objects"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => { drag.current = null; }}
        style={{ cursor: drag.current?.moved ? 'grabbing' : 'crosshair' }}
      >
        <defs>
          <clipPath id="survey-clip"><rect width={MAP_W} height={MAP_H} /></clipPath>
        </defs>
        <g clipPath="url(#survey-clip)">
          <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
            <image href={img} width={MAP_W} height={MAP_H} preserveAspectRatio="none" />
            {/* graticule */}
            <g stroke="#9ED8E8" strokeOpacity={0.07} strokeWidth={1} vectorEffect="non-scaling-stroke">
              {Array.from({ length: 9 }, (_, i) => (
                <line key={`gx${i}`} x1={(i + 1) * 100} x2={(i + 1) * 100} y1={0} y2={MAP_H} vectorEffect="non-scaling-stroke" />
              ))}
              {Array.from({ length: 7 }, (_, i) => (
                <line key={`gy${i}`} y1={(i + 1) * 100} y2={(i + 1) * 100} x1={0} x2={MAP_W} vectorEffect="non-scaling-stroke" />
              ))}
            </g>
            {layers.contours && (
              <g fill="none" stroke="#BFE7F3" vectorEffect="non-scaling-stroke">
                {CONTOURS.map((c) => (
                  <path key={c} d={contourPath(c)} strokeOpacity={c % 10 === 0 ? 0.38 : 0.17} strokeWidth={c % 10 === 0 ? 1 : 0.7} vectorEffect="non-scaling-stroke" />
                ))}
              </g>
            )}
            {layers.coverage && (
              <g>
                {Array.from({ length: LANE_COUNT }, (_, i) => {
                  const x = (i / LANE_COUNT) * MAP_W + 4;
                  const w = MAP_W / LANE_COUNT - 8;
                  return (
                    <g key={i}>
                      <rect x={x} y={4} width={w} height={MAP_H - 8} fill="#2FD3E6" fillOpacity={0.05} stroke="#2FD3E6" strokeOpacity={0.35} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
                      <line x1={x + w / 2} x2={x + w / 2} y1={4} y2={MAP_H - 4} stroke="#2FD3E6" strokeOpacity={0.3} strokeDasharray="1 5" vectorEffect="non-scaling-stroke" />
                    </g>
                  );
                })}
              </g>
            )}
            {layers.zones && (
              <g>
                {ZONES.map((z) => (
                  <g key={z.name}>
                    <circle cx={z.u * MAP_W} cy={z.v * MAP_H} r={z.r} fill="#3FD98F" fillOpacity={0.05} stroke="#3FD98F" strokeOpacity={0.55} strokeDasharray="8 5" vectorEffect="non-scaling-stroke" />
                    <text x={z.u * MAP_W} y={z.v * MAP_H - z.r - 6} textAnchor="middle" fontSize={11 / view.k} fill="#3FD98F" fillOpacity={0.9}>{z.name}</text>
                  </g>
                ))}
              </g>
            )}
            {layers.currents && (
              <g>
                {Array.from({ length: 10 }, (_, i) =>
                  Array.from({ length: 8 }, (_, j) => {
                    const u = (i + 0.5) / 10;
                    const v = (j + 0.5) / 8;
                    const c = currentAt(u, v);
                    const ang = (Math.atan2(c.cv, c.cu) * 180) / Math.PI;
                    const len = (16 + c.speed * 26) / Math.sqrt(view.k);
                    return (
                      <g key={`${i}-${j}`} transform={`translate(${u * MAP_W} ${v * MAP_H}) rotate(${ang})`} opacity={0.65}>
                        <line x1={-len / 2} x2={len / 2} stroke="#8FD8FF" strokeWidth={1.4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                        <path d={`M${len / 2 + 3} 0 L${len / 2 - 3} -3 L${len / 2 - 3} 3 Z`} fill="#8FD8FF" />
                      </g>
                    );
                  }),
                )}
              </g>
            )}
            {/* land + breakwater */}
            <path d="M0 0 H46 C60 120 34 220 52 330 C66 440 40 560 58 680 C66 740 50 780 44 800 H0 Z" fill="#101c26" stroke="#35566d" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
            <path d="M52 330 L196 376" stroke="#8aa5b8" strokeWidth={4} strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={0.8} />
            <text x={110} y={348} fontSize={10 / view.k} fill="#9FB6C7" transform="rotate(14 110 348)">Breakwater</text>
            {!mission && preview && <RoutePreviewOverlay points={preview} k={view.k} />}
            {mission && showRoute && <RouteOverlay mission={mission} stale={routeStale} k={view.k} labels={routeLabels} />}
            {layers.detections && (
              <Markers objects={objects} selectedId={selectedId} highlight={highlight} k={view.k} onSelect={onSelect} onHover={setHover} uncertainty={layers.uncertainty} exag={errorExaggeration} />
            )}
          </g>
        </g>
      </svg>

      <MapControls
        className="absolute right-3 top-3"
        onZoomIn={() => zoomAt(1.4)}
        onZoomOut={() => zoomAt(1 / 1.4)}
        onReset={() => setView({ k: 1, tx: 0, ty: 0 })}
        layers={[...toggles, ...(mission ? [{ key: 'route', label: 'Recovery route', icon: Target, active: showRoute }] : [])]}
        onToggle={(key) => (key === 'route' ? setShowRoute((s) => !s) : setLayers((l) => ({ ...l, [key]: !l[key as keyof MapLayers] })))}
      />

      {showLegend && (
        <div className="glass absolute left-3 top-3 hidden px-2.5 py-2 md:block">
          <ul className="space-y-1">
            {TYPE_ORDER.map((t) => (
              <li key={t} className="flex items-center gap-2 text-2xs text-mute">
                <svg width="14" height="14" viewBox="-8 -8 16 16" aria-hidden><TypeGlyph type={t} color={TYPE_META[t].color} size={6} /></svg>
                {TYPE_META[t].label}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center gap-2 border-t border-line pt-2 text-2xs text-mute">
            <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-hz-high" aria-hidden /> High hazard
            <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-hz-med" aria-hidden /> Medium
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
        <div ref={hudRef} className="glass num px-2.5 py-1.5 font-mono text-2xs text-mute" aria-live="off">Move over the map for coordinates and depth</div>
        <div className="glass hidden flex-col gap-1.5 px-2.5 py-2 sm:flex">
          <div className="flex items-center gap-2 text-2xs text-mute">
            <span className="h-0.5 border-x border-b border-mute" style={{ width: Math.max(24, Math.min(160, scaleBarPx)) }} aria-hidden />
            500 m
          </div>
          <div className="flex items-center gap-2 text-2xs text-dim">
            3 m
            <span className="h-1.5 w-20 rounded-sm" style={{ background: 'linear-gradient(90deg,#1a7884,#0e5476,#093058,#051228)' }} aria-hidden />
            36 m
          </div>
        </div>
      </div>

      {hovered && (
        <div className="glass pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 px-2.5 py-1 text-xs">
          <span className="font-medium">{hovered.label}</span>
          <span className="text-dim"> · {hovered.id} · {hovered.depth} m · {HAZARD_META[hovered.hazard].label} hazard</span>
        </div>
      )}
    </div>
  );
}
