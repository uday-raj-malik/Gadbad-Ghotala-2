import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertOctagon, Box, CircleDashed, Gauge, Layers, MapPin, Mountain, PackageCheck, Percent, Radar, Route, ShieldAlert, Trash2, Waves } from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { buildReport } from '@/services/reportService';
import { toMapObjects } from '@/lib/mapObjects';
import { CATEGORY_META, CATEGORY_ORDER } from '@/lib/meta';
import { cn, timeAgo } from '@/lib/utils';
import { appPath } from '@/lib/routes';
import PageHeader from '@/components/ui/PageHeader';
import KpiCard from '@/components/ui/KpiCard';
import Panel from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import DetectionCard from '@/components/detections/DetectionCard';
import SeabedMap from '@/components/map/SeabedMap';
import Seabed3D, { type SeabedSceneHandle } from '@/components/map/Seabed3D';
import MapControls, { type LayerToggle } from '@/components/map/MapControls';
import WorkflowStrip from '@/components/overview/WorkflowStrip';
import ActivityChart, { AXIS, CHART_TOOLTIP } from '@/components/overview/ActivityChart';
import { EmptyState } from '@/components/ui/States';
import { useFocusOn } from '@/hooks/useFocusOn';

type Layers = { terrain: boolean; coverage: boolean; detections: boolean; currents: boolean; route: boolean; uncertainty: boolean };

export default function OverviewPage() {
  const { detections, survey, settings, mission } = useApp();
  const nav = useNavigate();
  const [sel, setSel] = useState<string | null>('GN-024');
  const [view, setView] = useState<'3d' | '2d'>('3d');
  const [layers, setLayers] = useState<Layers>({ terrain: true, coverage: true, detections: true, currents: false, route: true, uncertainty: true });
  const sceneRef = useRef<SeabedSceneHandle>(null);
  const report = useMemo(() => buildReport(detections), [detections]);
  const active = detections.filter((d) => d.status !== 'rejected');
  const highOpen = active.filter((d) => d.hazard === 'high' && d.status !== 'recovered');
  const pending = detections.filter((d) => d.status === 'review').length;
  const priority = useMemo(
    () => active.filter((d) => d.status !== 'recovered').sort((a, b) => b.hazardScore - a.hazardScore || b.confidence - a.confidence).slice(0, 6),
    [active],
  );
  const mapObjs = useMemo(() => toMapObjects(detections), [detections]);
  useFocusOn(detections.find((d) => d.id === sel));

  const toggles: LayerToggle[] = [
    { key: 'terrain', label: 'Terrain', icon: Mountain, active: layers.terrain },
    { key: 'coverage', label: 'Sonar coverage', icon: Radar, active: layers.coverage },
    { key: 'detections', label: 'Detections', icon: MapPin, active: layers.detections },
    { key: 'currents', label: 'Currents', icon: Waves, active: layers.currents },
    { key: 'route', label: 'Recovery route', icon: Route, active: layers.route },
    { key: 'uncertainty', label: 'Uncertainty circles', icon: CircleDashed, active: layers.uncertainty },
  ];

  return (
    <>
      <PageHeader
        title="Operations overview"
        description={`${survey?.harbour ?? ''} · ${survey?.sensor ?? ''} at ${survey?.frequencyKhz ?? ''} kHz`}
        actions={<Button onClick={() => nav(appPath('/sonar'))}><Radar size={14} aria-hidden />New survey</Button>}
      />

      <section aria-label="Key indicators" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Area Surveyed" value={String(survey?.areaKm2 ?? 0)} unit="km²" icon={Layers} hint={`${survey?.scansProcessed ?? 0} scans processed`} />
        <KpiCard label="Waste Detected" value={String(active.length)} unit="objects" icon={Trash2} hint={`${report.confirmed} confirmed · ${pending} in review`} onClick={() => nav(appPath('/detections'))} />
        <KpiCard label="High Priority" value={String(highOpen.length)} unit="objects" icon={ShieldAlert} tone="danger" hint="High hazard, not yet recovered" onClick={() => nav(appPath('/recovery'))} />
        <KpiCard label="Recovered" value={String(report.recovered)} unit="objects" icon={PackageCheck} tone="success" hint={`${Math.round(report.weightKg)} kg removed`} onClick={() => nav(appPath('/waste'))} />
        <KpiCard label="Recovery Rate" value={report.recoveryRate.toFixed(0)} unit="%" icon={Percent} tone="success" hint="Recovered / detected" />
        <KpiCard label="AI Confidence" value={report.avgConfidence.toFixed(1)} unit="%" icon={Gauge} hint={`Verified · auto-confirm ${settings.autoConfirm}%`} />
      </section>

      <div className="mt-4"><WorkflowStrip /></div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <Panel
          title="Seabed map"
          subtitle={`${survey?.harbour ?? ''} · bathymetry, sonar lanes and detections`}
          bodyClassName="p-3"
          actions={
            <>
              <div className="flex rounded border border-line2 p-0.5" role="group" aria-label="Map view">
                {(['3d', '2d'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    aria-pressed={view === v}
                    className={cn('flex items-center gap-1 rounded-sm px-2.5 py-0.5 text-xs transition-colors', view === v ? 'bg-sonar/15 text-sonar' : 'text-mute hover:text-ink')}
                  >
                    {v === '3d' && <Box size={12} aria-hidden />}{v.toUpperCase()}
                  </button>
                ))}
              </div>
              <Button size="sm" variant="ghost" onClick={() => nav(appPath('/map'))}>Full screen</Button>
            </>
          }
        >
          {view === '3d' ? (
            <div className="relative h-[560px] overflow-hidden rounded-md border border-line bg-[#06111d]">
              <Seabed3D ref={sceneRef} initialZoom={0.86} className="h-full w-full" objects={mapObjs} selectedId={sel} onSelect={setSel} layers={layers} mission={mission} errorExaggeration={settings.errorExaggeration} />
              <MapControls
                className="absolute right-3 top-3"
                onZoomIn={() => sceneRef.current?.zoomIn()}
                onZoomOut={() => sceneRef.current?.zoomOut()}
                onReset={() => sceneRef.current?.reset()}
                layers={toggles}
                onToggle={(k) => setLayers((l) => ({ ...l, [k]: !l[k as keyof Layers] }))}
              />
              <p className="glass pointer-events-none absolute bottom-3 left-3 px-2.5 py-1 text-2xs text-mute">Drag to orbit · scroll to zoom · click a marker</p>
            </div>
          ) : (
            <SeabedMap className="h-[560px]" objects={mapObjs} selectedId={sel} onSelect={setSel} errorExaggeration={settings.errorExaggeration} />
          )}
        </Panel>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel
            title="Priority detections"
            subtitle="Ranked by hazard score"
            bodyClassName="p-3"
            actions={<Button size="sm" variant="ghost" onClick={() => nav(appPath('/detections'))}>View all</Button>}
          >
            {priority.length === 0 ? (
              <EmptyState title="No open detections" body="Everything detected so far has been recovered." />
            ) : (
              <ul className="space-y-1.5">
                {priority.map((d) => (
                  <li key={d.id}>
                    <DetectionCard detection={d} selected={sel === d.id} onClick={() => setSel(d.id)} showStatus />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Survey status" bodyClassName="grid grid-cols-2 gap-2 p-3">
            <Mini icon={Activity} label="Last scan" value={survey ? timeAgo(survey.lastScanAt) : '—'} />
            <Mini icon={Radar} label="Scans processed" value={String(survey?.scansProcessed ?? 0)} />
            <Mini icon={AlertOctagon} label="False positives filtered" value={String(survey?.falsePositivesFiltered ?? 0)} />
            <Mini icon={ShieldAlert} label="Human reviews pending" value={String(pending)} warn={pending > 0} onClick={() => nav(appPath('/detections?status=review'))} />
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Survey activity" subtitle="Detected vs recovered, last 14 days">
          <ActivityChart data={report.trend} height={190} />
        </Panel>

        <Panel title="AI confidence" subtitle={`Detections per band · review below ${settings.autoConfirm}%`}>
          <div className="h-[190px]" role="img" aria-label="AI confidence distribution">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.confidenceHistogram} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="#173049" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="name" {...AXIS} />
                <YAxis {...AXIS} allowDecimals={false} />
                <Tooltip {...CHART_TOOLTIP} />
                <Bar dataKey="value" name="Detections" radius={[2, 2, 0, 0]}>
                  {report.confidenceHistogram.map((b) => {
                    const lo = parseInt(String(b.name), 10);
                    return <Cell key={b.name} fill={lo >= settings.autoConfirm - 5 ? '#3FD98F' : lo >= settings.reviewLow ? '#F6A623' : '#FF5A5F'} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Recovery progress" subtitle={`${report.recovered} of ${active.length} objects recovered`}>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(report.recoveryRate)} aria-valuemin={0} aria-valuemax={100} aria-label="Overall recovery progress">
            <div className="h-full rounded-full bg-hz-low" style={{ width: `${report.recoveryRate}%` }} />
          </div>
          <ul className="space-y-2.5">
            {CATEGORY_ORDER.map((c) => {
              const row = report.byCategory.find((x) => x.name === CATEGORY_META[c].label);
              const total = Number(row?.value ?? 0);
              const rec = Number(row?.recovered ?? 0);
              return (
                <li key={c}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-mute"><span className="h-2 w-2 rounded-sm" style={{ background: CATEGORY_META[c].color }} aria-hidden />{CATEGORY_META[c].label}</span>
                    <span className="num text-ink">{rec}<span className="text-dim"> / {total}</span></span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${total ? (rec / total) * 100 : 0}%`, background: CATEGORY_META[c].color }} /></div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </>
  );
}

function Mini({ icon: Icon, label, value, warn, onClick }: { icon: typeof Activity; label: string; value: string; warn?: boolean; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className="rounded border border-line bg-deep/70 px-2.5 py-2 text-left transition-colors hover:border-line2">
      <p className="flex items-center gap-1.5 text-2xs text-dim"><Icon size={12} aria-hidden />{label}</p>
      <p className="num mt-0.5 font-display text-lg font-semibold" style={warn ? { color: '#F6A623' } : undefined}>{value}</p>
    </Tag>
  );
}
