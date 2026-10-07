import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleDashed, Eye, MapPin, Mountain, Radar, Route, Waves, ArrowUpRight } from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { toMapObjects } from '@/lib/mapObjects';
import { HAZARD_META, TYPE_META, TYPE_ORDER } from '@/lib/meta';
import { appPath } from '@/lib/routes';
import { fmtDuration, cn } from '@/lib/utils';
import { useRoutePreview } from '@/hooks/useRoutePreview';
import { useFocusOn } from '@/hooks/useFocusOn';
import Seabed3D, { VERTICAL_EXAGGERATION, type SeabedSceneHandle } from '@/components/map/Seabed3D';
import MapControls, { type LayerToggle } from '@/components/map/MapControls';
import ObjectCallout from '@/components/map/ObjectCallout';
import TypeGlyph from '@/components/map/TypeGlyph';
import type { WasteType } from '@/types';

type Layers = { terrain: boolean; coverage: boolean; detections: boolean; currents: boolean; route: boolean; uncertainty: boolean };

export default function Map3DPage() {
  const { detections, settings, survey } = useApp();
  const nav = useNavigate();
  const ref = useRef<SeabedSceneHandle>(null);
  const [selectedId, setSelectedId] = useState<string | null>('GN-024');
  const [layers, setLayers] = useState<Layers>({ terrain: true, coverage: settings.layerCoverage, detections: true, currents: settings.layerCurrents, route: true, uncertainty: true });
  const [showRecovered, setShowRecovered] = useState(false);
  const [hidden, setHidden] = useState<Set<WasteType>>(new Set());
  const { route, isPreview } = useRoutePreview();

  const open = useMemo(() => toMapObjects(detections), [detections]);
  const objects = useMemo(() => toMapObjects(detections, { includeRecovered: showRecovered }).filter((o) => !hidden.has(o.type)), [detections, showRecovered, hidden]);
  const recoveredCount = detections.filter((d) => d.status === 'recovered').length;
  const counts = useMemo(() => {
    const c = {} as Record<WasteType, { n: number; high: number }>;
    for (const t of TYPE_ORDER) c[t] = { n: 0, high: 0 };
    for (const o of open) { c[o.type].n += 1; if (o.hazard === 'high') c[o.type].high += 1; }
    return c;
  }, [open]);
  const sel = detections.find((d) => d.id === selectedId) ?? null;

  useFocusOn(sel);

  const toggles: LayerToggle[] = [
    { key: 'terrain', label: 'Terrain', icon: Mountain, active: layers.terrain },
    { key: 'coverage', label: 'Sonar coverage', icon: Radar, active: layers.coverage },
    { key: 'detections', label: 'Detections', icon: MapPin, active: layers.detections },
    { key: 'currents', label: 'Currents', icon: Waves, active: layers.currents },
    { key: 'route', label: 'Recovery route', icon: Route, active: layers.route },
    { key: 'uncertainty', label: 'Uncertainty circles', icon: CircleDashed, active: layers.uncertainty },
    { key: 'recovered', label: 'Show recovered objects', icon: Eye, active: showRecovered },
  ];

  return (
    <div className="absolute inset-0">
      <Seabed3D
        ref={ref}
        className="h-full w-full"
        objects={objects}
        selectedId={selectedId}
        onSelect={setSelectedId}
        layers={layers}
        mission={route}
        errorExaggeration={settings.errorExaggeration}
        renderCallout={(id) => {
          const d = detections.find((x) => x.id === id);
          return d ? <ObjectCallout detection={d} onClose={() => setSelectedId(null)} /> : null;
        }}
      />

      <div className="pointer-events-none absolute inset-0 p-4">
        <div className="pointer-events-auto absolute left-4 top-4">
          <MapControls
            onZoomIn={() => ref.current?.zoomIn()}
            onZoomOut={() => ref.current?.zoomOut()}
            onReset={() => ref.current?.reset()}
            layers={toggles}
            onToggle={(k) => (k === 'recovered' ? setShowRecovered((v) => !v) : setLayers((l) => ({ ...l, [k]: !l[k as keyof Layers] })))}
          />
        </div>

        <div className="absolute left-[72px] top-4">
          <p className="font-display text-[11px] font-medium uppercase tracking-[0.28em] text-sonar/90">3D seabed</p>
          <h1 className="font-display text-[22px] font-semibold leading-tight">{survey?.harbour ?? 'Mumbai Port'}</h1>
          <p className="num mt-0.5 text-xs text-mute">
            <span className="text-ink">{open.length}</span> objects on the seabed · {recoveredCount} recovered{showRecovered ? ' (shown)' : ' (hidden)'}
          </p>
        </div>

        {/* legend doubles as a category filter */}
        <div className="glass pointer-events-auto absolute bottom-4 left-4 w-[236px] px-3 py-2.5" aria-label="Waste categories">
          <p className="label mb-1.5 flex items-center justify-between">Waste categories <span className="normal-case tracking-normal text-dim">click to filter</span></p>
          <ul className="space-y-0.5">
            {TYPE_ORDER.map((t) => {
              const off = hidden.has(t);
              return (
                <li key={t}>
                  <button
                    aria-pressed={!off}
                    onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(t)) n.delete(t); else n.add(t); return n; })}
                    className={cn('flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs transition-colors hover:bg-white/5', off && 'opacity-40')}
                  >
                    <svg width="16" height="16" viewBox="-9 -9 18 18" aria-hidden className="shrink-0"><TypeGlyph type={t} color={TYPE_META[t].color} size={6.5} /></svg>
                    <span className="flex-1">{TYPE_META[t].label}</span>
                    <span className="num text-mute">{counts[t].n}</span>
                    {counts[t].high > 0 && <span className="num w-7 text-right text-2xs text-hz-high">{counts[t].high}!</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex items-center gap-3 border-t border-white/10 pt-2 text-2xs text-mute">
            {(['high', 'medium', 'low'] as const).map((h) => (
              <span key={h} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: HAZARD_META[h].color }} aria-hidden />{HAZARD_META[h].label}</span>
            ))}
          </div>
        </div>

        {/* mission strip */}
        {route && layers.route && (
          <button
            onClick={() => nav(appPath('/recovery'))}
            className="glass pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-4 px-4 py-2 text-left transition-colors hover:border-sonar/60"
            aria-label="Open the recovery planner"
          >
            <span className="flex items-center gap-2 text-xs"><Route size={14} className="text-[#F6C453]" aria-hidden /><span className="font-medium">Recovery route</span>{isPreview && <span className="rounded bg-white/10 px-1.5 text-2xs text-mute">preview</span>}</span>
            <span className="num text-xs text-mute">{route.objectIds.length} objects · <span className="text-ink">{route.distanceKm} km</span> · <span className="text-ink">{fmtDuration(route.durationMin)}</span></span>
            <span className="inline-flex items-center gap-0.5 text-xs text-sonar">Plan <ArrowUpRight size={12} aria-hidden /></span>
          </button>
        )}

        <div className="glass pointer-events-none absolute right-4 top-4 hidden w-[220px] px-3 py-2.5 sm:block">
          <p className="label mb-1.5">Depth</p>
          <div className="h-2 rounded-sm" style={{ background: 'linear-gradient(90deg,#2a9cac,#1a7884,#0e5476,#093058,#051228)' }} aria-hidden />
          <div className="num mt-1 flex justify-between text-2xs text-mute"><span>3 m</span><span>18 m</span><span>36 m</span></div>
          <p className="mt-1.5 border-t border-white/10 pt-1.5 text-2xs text-dim">Vertical exaggeration ×{VERTICAL_EXAGGERATION} · contours every 4 m</p>
        </div>
      </div>
    </div>
  );
}
