import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowUpRight } from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { buildReport } from '@/services/reportService';
import { appPath } from '@/lib/routes';
import { HAZARD_META, TYPE_META, WORKFLOW } from '@/lib/meta';
import { timeAgo } from '@/lib/utils';
import GlassPanel from './GlassPanel';
import HeatmapPreview from './HeatmapPreview';
import TypeChip from '../ui/TypeChip';
import { ErrorState } from '../ui/States';
import { ZONES } from '@/lib/geo';
import type { Detection } from '@/types';

function GlassKpi({ value, unit, label, ready, alert }: { value: string; unit?: string; label: string; ready: boolean; alert?: boolean }) {
  return (
    <GlassPanel className="px-4 py-3.5" aria-label={`${label}: ${value}${unit ?? ''}`}>
      <p className="font-display text-[clamp(24px,2.3vw,34px)] font-semibold leading-none tracking-tight text-white">
        {ready ? value : <span className="inline-block h-7 w-16 animate-pulse rounded bg-white/20 align-middle" />}
        {ready && unit && <span className="ml-0.5 text-[0.4em] font-normal text-white/80">{unit}</span>}
      </p>
      <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-[#cfeaff]">
        {alert && <span className="h-1.5 w-1.5 rounded-full bg-hz-high" aria-hidden />}
        {label}
      </p>
    </GlassPanel>
  );
}

export default function AnalyticsPanel({ onEnter }: { onEnter: (path: string) => void }) {
  const { detections, survey, loading, error, retry } = useApp();
  const ready = !loading && !error;
  const report = useMemo(() => buildReport(detections), [detections]);
  const active = detections.filter((d) => d.status !== 'rejected');
  const highOpen = active.filter((d) => d.hazard === 'high' && d.status !== 'recovered').length;
  const recent = useMemo(() => active.slice().sort((a, b) => +new Date(b.detectedAt) - +new Date(a.detectedAt)).slice(0, 4), [active]);

  if (error) {
    return (
      <div className="mx-auto max-w-[1180px] px-5 pb-16">
        <GlassPanel tone="deep" className="p-2"><ErrorState message={error} onRetry={retry} /></GlassPanel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-16 sm:px-6">
      <GlassPanel className="rounded-[28px] p-4 sm:p-6" tone="frost">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col">
            <h2 className="font-display text-[26px] font-semibold leading-tight text-white">Survey Intelligence</h2>
            <p className="mt-0.5 text-[13.5px] text-[#cfeaff]">
              {survey ? `${survey.harbour} · Survey #${survey.id}` : 'Loading survey…'} · every detection verified before recovery.
            </p>

            <section aria-label="Key figures" className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
              <GlassKpi ready={ready} value={String(survey?.areaKm2 ?? '')} unit="km²" label="Area Surveyed" />
              <GlassKpi ready={ready} value={String(active.length)} label="Waste Detected" />
              <GlassKpi ready={ready} value={String(highOpen)} label="High Priority" alert />
              <GlassKpi ready={ready} value={String(report.recovered)} label="Recovered" />
              <GlassKpi ready={ready} value={report.avgConfidence.toFixed(1)} unit="%" label="AI Confidence" />
            </section>

            <div className="mt-5 grid flex-1 gap-5 border-t border-white/15 pt-4 md:grid-cols-[1.35fr_1fr]">
              <div className="flex flex-col md:border-r md:border-white/15 md:pr-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-[14px] font-medium text-white">Survey Activity</h3>
                    <p className="text-xs text-[#cfeaff]/90">Objects per day, last 14 days</p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-white/90" aria-hidden>
                    <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-[#e6f6ff]" />Detected</span>
                    <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-[#6fe8b4]" />Recovered</span>
                  </div>
                </div>
                <div className="mt-2 min-h-[150px] flex-1" role="img" aria-label="Line chart of objects detected and recovered per day">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={report.trend} margin={{ top: 8, right: 6, left: -26, bottom: 0 }}>
                      <CartesianGrid stroke="#ffffff" strokeOpacity={0.12} strokeDasharray="2 5" vertical={false} />
                      <XAxis dataKey="day" stroke="#d6eeff" strokeOpacity={0.7} fontSize={10} tickLine={false} axisLine={false} interval={2} />
                      <YAxis stroke="#d6eeff" strokeOpacity={0.7} fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: 'rgba(6,28,62,0.92)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, fontSize: 12, color: '#fff' }} labelStyle={{ color: '#cfeaff' }} />
                      <Line type="monotone" dataKey="detected" name="Detected" stroke="#e6f6ff" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="recovered" name="Recovered" stroke="#6fe8b4" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-medium text-white">Recent Detections</h3>
                  <button onClick={() => onEnter(appPath('/detections'))} className="text-xs text-[#cfeaff] hover:text-white">View all</button>
                </div>
                <ul className="mt-2 divide-y divide-white/15">
                  {recent.length === 0 && <li className="py-6 text-center text-xs text-[#cfeaff]">No detections yet.</li>}
                  {recent.map((d) => (
                    <li key={d.id}>
                      <button onClick={() => onEnter(appPath(`/detections?id=${d.id}`))} className="flex w-full items-center gap-3 py-2 text-left text-white transition-colors hover:bg-white/10">
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2"><TypeChip type={d.type} label={TYPE_META[d.type].label} /><span className="font-mono text-[10.5px] text-[#cfeaff]/80">{d.id}</span></span>
                          <span className="num text-[11.5px] text-[#cfeaff]/90">{d.depth} m · {d.confidence.toFixed(0)}% · {timeAgo(d.detectedAt)}</span>
                        </span>
                        <span className="rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide" style={{ color: HAZARD_META[d.hazard].color, borderColor: HAZARD_META[d.hazard].color + '88', background: HAZARD_META[d.hazard].color + '1a' }}>
                          {HAZARD_META[d.hazard].label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col">
            <h2 className="font-display text-[26px] font-semibold leading-tight text-white">Underwater Waste Heatmap</h2>
            <p className="mt-0.5 text-[13.5px] text-[#cfeaff]">Where debris concentrates in the survey area</p>
            <GlassPanel className="relative mt-4 overflow-hidden p-1.5">
              <div className="relative aspect-[5/4] w-full overflow-hidden rounded-xl">
                {ready ? <HeatmapPreview detections={detections} /> : <div className="h-full w-full animate-pulse bg-white/10" />}
                <button
                  onClick={() => onEnter(appPath('/map'))}
                  className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/50 bg-[#0b2f5e]/55 px-3 py-1 text-[11.5px] text-white backdrop-blur-sm transition-colors hover:bg-[#0b2f5e]/80"
                >
                  View full map <ArrowUpRight size={12} aria-hidden />
                </button>
                <div className="absolute bottom-3 left-3 flex items-center gap-3 rounded-full border border-white/25 bg-[#0b2f5e]/60 px-3 py-1.5 text-[11px] text-white backdrop-blur-sm" aria-label="Legend">
                  {(['high', 'medium', 'low'] as const).map((h) => (
                    <span key={h} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: HAZARD_META[h].color }} aria-hidden />{HAZARD_META[h].label}</span>
                  ))}
                </div>
              </div>
            </GlassPanel>
            <Hotspots detections={detections} onEnter={onEnter} />
          </div>
        </div>

        <ol className="mt-5 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 border-t border-white/15 pt-4 text-[11.5px] uppercase tracking-[0.14em] text-[#cfeaff]" aria-label="Workflow">
          {[...WORKFLOW, 'Reporting'].map((s, i, a) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className={i === 0 ? 'text-white' : ''}>{s}</span>
              {i < a.length - 1 && <span className="text-white/40" aria-hidden>→</span>}
            </li>
          ))}
        </ol>
      </GlassPanel>
    </div>
  );
}

/** Zones ranked by open (unrecovered) objects, like the "Hotspots" list in the visual reference. */
function Hotspots({ detections, onEnter }: { detections: Detection[]; onEnter: (p: string) => void }) {
  const rows = ZONES.map((z) => {
    const open = detections.filter((d) => d.zone === z && (d.status === 'confirmed' || d.status === 'review'));
    return { zone: z, open: open.length, high: open.filter((d) => d.hazard === 'high').length };
  }).sort((a, b) => b.high - a.high || b.open - a.open);
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-medium text-white">Hotspots</h3>
        <button onClick={() => onEnter(appPath('/recovery'))} className="text-xs text-[#cfeaff] hover:text-white">Plan recovery</button>
      </div>
      <ul className="mt-2 divide-y divide-white/15">
        {rows.map((r, i) => (
          <li key={r.zone} className="flex items-center gap-3 py-2 text-white">
            <span className="num w-7 text-[11px] text-[#cfeaff]/80">H-{i + 1}</span>
            <span className="flex-1 text-[13px]">{r.zone}</span>
            <span className="num text-[12px] text-[#cfeaff]">{r.open} open</span>
            <span className="num w-14 text-right text-[12px]" style={{ color: r.high ? '#ff8a8e' : '#cfeaff' }}>{r.high} high</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
