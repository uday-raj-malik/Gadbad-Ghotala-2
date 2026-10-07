import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Route, Send, Sparkles, TrendingDown } from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { generateRoute, dispatchMission, estimateNaiveKm } from '@/services/recoveryService';
import { toMapObjects } from '@/lib/mapObjects';
import { BASE_POINT, QUAY_POINT } from '@/lib/geo';
import { fmtDuration, cn } from '@/lib/utils';
import Button from '../ui/Button';
import HazardBadge from '../ui/HazardBadge';
import TypeChip from '../ui/TypeChip';
import { EmptyState, Spinner } from '../ui/States';
import SeabedMap from '../map/SeabedMap';
import RecoveryRoute from '../map/RecoveryRoute';
import { useFocusOn } from '@/hooks/useFocusOn';

const DIFF = { easy: '#3FD98F', moderate: '#F6A623', hard: '#FF5A5F' } as const;

export default function RecoveryPlanner() {
  const { detections, missionIds, toggleMission, setMissionIds, mission, setMission, settings, toast, pushNotification } = useApp();
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [dispatched, setDispatched] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<'objects' | 'route'>('objects');

  const candidates = useMemo(
    () => detections.filter((d) => d.status === 'confirmed' || d.status === 'review').sort((a, b) => b.hazardScore - a.hazardScore),
    [detections],
  );
  const chosen = useMemo(() => detections.filter((d) => missionIds.includes(d.id)), [detections, missionIds]);
  const unreviewed = chosen.filter((d) => d.status === 'review');
  const stale = !!mission && (mission.objectIds.length !== missionIds.length || mission.objectIds.some((id) => !missionIds.includes(id)));
  const fresh = !!mission && !stale;
  useFocusOn(detections.find((d) => d.id === sel));
  const naive = useMemo(() => estimateNaiveKm(missionIds, detections), [missionIds, detections]);
  const highChosen = chosen.filter((d) => d.hazard === 'high').length;
  const saved = fresh ? mission!.naiveDistanceKm - mission!.distanceKm : 0;

  // before a route exists, show the unoptimised path so the solver's effect is visible
  const preview = useMemo(() => {
    if (mission || missionIds.length === 0) return undefined;
    const pts = missionIds.map((id) => detections.find((d) => d.id === id)).filter(Boolean).map((d) => ({ u: d!.u, v: d!.v }));
    return [{ u: BASE_POINT.u, v: BASE_POINT.v }, ...pts, { u: QUAY_POINT.u, v: QUAY_POINT.v }];
  }, [mission, missionIds, detections]);

  const generate = async () => {
    setBusy(true);
    setDispatched(false);
    try {
      const m = await generateRoute(missionIds, detections, settings.vesselSpeedKn);
      setMission(m);
      setTab('route');
      toast(`Route generated: ${m.distanceKm} km, ${fmtDuration(m.durationMin)}.`);
    } catch {
      toast('Route generation failed. Try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const dispatch = async () => {
    if (!mission) return;
    setSending(true);
    try {
      const r = await dispatchMission(mission);
      setDispatched(true);
      toast(`Mission ${r.id} dispatched to the recovery vessel.`);
      pushNotification({ title: `Mission ${r.id} dispatched`, body: `${mission.objectIds.length} objects, ${mission.distanceKm} km.`, level: 'success' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[330px_minmax(0,1fr)]">
      {/* left rail: objects ⇄ route sequence */}
      <div className="relative min-h-[420px] xl:min-h-0">
        <section className="panel flex max-h-[560px] flex-col xl:absolute xl:inset-0 xl:max-h-none" aria-label="Mission workspace">
          <div className="flex border-b border-line" role="tablist">
            {([['objects', `Objects · ${missionIds.length}/${candidates.length}`], ['route', 'Route sequence']] as const).map(([k, l]) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cn('-mb-px flex-1 border-b-2 px-3 py-2.5 text-[12.5px] font-medium transition-colors', tab === k ? 'border-sonar text-ink' : 'border-transparent text-mute hover:text-ink')}
              >
                {l}
              </button>
            ))}
          </div>

          {tab === 'objects' ? (
            <>
              <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
                <p className="text-2xs text-dim">Highest hazard first</p>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setMissionIds(candidates.filter((d) => d.hazard === 'high').map((d) => d.id))}>High only</Button>
                  <Button size="sm" variant="ghost" onClick={() => setMissionIds([])}>Clear</Button>
                </div>
              </div>
              {candidates.length === 0 ? (
                <EmptyState title="Nothing to recover" body="Confirmed or pending detections appear here once a scan is analysed." />
              ) : (
                <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto" aria-label="Recoverable objects">
                  {candidates.map((d) => {
                    const on = missionIds.includes(d.id);
                    return (
                      <li key={d.id} className={cn('flex items-center gap-3 px-3 py-2 transition-colors hover:bg-raised', sel === d.id && 'bg-raised')}>
                        <input type="checkbox" checked={on} onChange={() => toggleMission(d.id)} aria-label={`Include ${d.id} in mission`} className="h-3.5 w-3.5 shrink-0 accent-[#2FD3E6]" />
                        <button className="min-w-0 flex-1 text-left" onClick={() => setSel(d.id)}>
                          <div className="flex items-center gap-2">
                            <TypeChip type={d.type} />
                            <span className="font-mono text-2xs text-dim">{d.id}</span>
                            {d.status === 'review' && <span className="rounded bg-hz-med/10 px-1 text-2xs text-hz-med">⚠ review</span>}
                          </div>
                          <p className="num mt-0.5 text-xs text-dim">
                            {d.depth} m · ~{d.weightKg} kg · <span style={{ color: DIFF[d.recoveryDifficulty] }}>{d.recoveryDifficulty}</span> · {d.recoveryMinutes} min
                          </p>
                        </button>
                        <HazardBadge hazard={d.hazard} compact />
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {mission ? (
                <>
                  {stale && <p className="mb-3 rounded border border-sonar/30 bg-sonar/10 px-2.5 py-1.5 text-xs text-sonar">Selection changed. Regenerate to refresh this sequence.</p>}
                  <RecoveryRoute mission={mission} detections={detections} />
                </>
              ) : (
                <EmptyState title="No route yet" body="Select objects, then click Generate Optimal Route." />
              )}
            </div>
          )}
        </section>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        {/* mission summary + actions: one strip, not four cards */}
        <section className="panel flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-3.5" aria-label="Mission summary">
          <Stat label="Objects selected" value={String(missionIds.length)} />
          <Stat label="Estimated distance" value={fresh ? String(mission!.distanceKm) : `~${naive.toFixed(1)}`} unit="km" hint={fresh ? undefined : 'unoptimised'} />
          <Stat label="Estimated recovery time" value={fresh ? fmtDuration(mission!.durationMin) : '—'} />
          <Stat label="High-risk objects" value={String(highChosen)} danger={highChosen > 0} />
          {fresh && saved > 0.05 && (
            <span className="inline-flex items-center gap-1.5 rounded border border-hz-low/40 bg-hz-low/10 px-2 py-1 text-xs text-hz-low"><TrendingDown size={13} aria-hidden />{saved.toFixed(1)} km shorter than selection order</span>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="primary" size="lg" onClick={generate} disabled={busy || missionIds.length === 0} className="uppercase tracking-wide">
              {busy ? <Spinner /> : <Sparkles size={14} aria-hidden />}
              {busy ? 'Solving route…' : 'Generate optimal route'}
            </Button>
            <Button variant="success" size="lg" onClick={dispatch} disabled={!fresh || sending || dispatched} className="uppercase tracking-wide">
              {sending ? <Spinner /> : dispatched ? <CheckCircle2 size={14} aria-hidden /> : <Send size={14} aria-hidden />}
              {dispatched ? 'Dispatched' : 'Dispatch'}
            </Button>
          </div>
        </section>

        {unreviewed.length > 0 && (
          <div role="alert" className="flex items-start gap-2.5 rounded border border-hz-med/40 bg-hz-med/10 px-3 py-2 text-[13px]">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-hz-med" aria-hidden />
            <p>
              <span className="font-medium">{unreviewed.length} selected object{unreviewed.length > 1 ? 's' : ''} not yet verified</span>{' '}
              <span className="text-mute">({unreviewed.map((d) => d.id).join(', ')}). Confirm them in Detections before dispatch.</span>
            </p>
          </div>
        )}

        <section className="panel overflow-hidden p-2" aria-label="Route map">
          <div className="relative" style={{ height: 'clamp(520px, calc(100vh - 360px), 820px)' }}>
            <SeabedMap
              className="h-full"
              objects={toMapObjects(detections)}
              highlightIds={missionIds}
              selectedId={sel}
              onSelect={setSel}
              mission={mission}
              routeStale={stale}
              preview={preview}
              showLegend={false}
              initialLayers={{ zones: false, coverage: false }}
              errorExaggeration={settings.errorExaggeration}
            />
            {!mission && missionIds.length > 0 && (
              <p className="glass pointer-events-none absolute bottom-14 left-1/2 -translate-x-1/2 px-3 py-1.5 text-xs text-mute">
                <Route size={12} className="mr-1.5 inline text-mute" aria-hidden />Dotted line: stops in selection order. Generate a route to optimise it.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, unit, hint, danger }: { label: string; value: string; unit?: string; hint?: string; danger?: boolean }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="num mt-0.5 flex items-baseline gap-1 font-display text-[26px] font-semibold leading-none" style={danger ? { color: '#FF5A5F' } : undefined}>
        {value}{unit && <span className="text-xs font-normal text-mute">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-2xs text-dim">{hint}</p>}
    </div>
  );
}
