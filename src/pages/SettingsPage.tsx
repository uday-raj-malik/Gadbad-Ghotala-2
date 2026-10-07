import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { DEFAULT_SETTINGS } from '@/data/mock';
import { API_BASE } from '@/services/http';
import { isBackendOnline } from '@/services/liveApi';
import PageHeader from '@/components/ui/PageHeader';
import Panel from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import Switch from '@/components/ui/Switch';

export default function SettingsPage() {
  const { settings, updateSettings, detections, survey, toast } = useApp();
  const [liveOnline, setLiveOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    isBackendOnline().then((ok) => alive && setLiveOnline(ok));
    return () => {
      alive = false;
    };
  }, []);

  // Live preview of what the thresholds do to the current detections.
  const impact = useMemo(() => {
    const live = detections.filter((d) => d.status !== 'rejected');
    return {
      auto: live.filter((d) => d.confidence >= settings.autoConfirm).length,
      mid: live.filter((d) => d.confidence >= settings.reviewLow && d.confidence < settings.autoConfirm).length,
      low: live.filter((d) => d.confidence < settings.reviewLow).length,
    };
  }, [detections, settings.autoConfirm, settings.reviewLow]);

  const setAuto = (v: number) => updateSettings({ autoConfirm: v, reviewLow: Math.min(settings.reviewLow, v - 5) });
  const setLow = (v: number) => updateSettings({ reviewLow: Math.min(v, settings.autoConfirm - 5) });

  return (
    <>
      <PageHeader
        title="Settings"
        description="Configuration applies immediately to this session."
        actions={<Button onClick={() => { updateSettings(DEFAULT_SETTINGS); toast('Settings restored to defaults.', 'info'); }}><RotateCcw size={13} aria-hidden />Reset to defaults</Button>}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="AI confidence thresholds" subtitle="Controls which detections need a human decision" className="xl:col-span-2">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-5">
              <Slider label="AI auto-confirm threshold" value={settings.autoConfirm} min={70} max={99} onChange={setAuto} />
              <Slider label="Human review lower bound" value={settings.reviewLow} min={30} max={90} onChange={setLow} />
              <div className="rounded border border-line bg-deep px-3 py-2.5 text-[13px]">
                <p>Human review threshold: <span className="num font-medium text-hz-med">{settings.reviewLow}–{settings.autoConfirm}%</span></p>
                <p className="mt-1 text-xs text-mute">Detections below {settings.reviewLow}% are automatically flagged for manual review.</p>
              </div>
              <Row label="Require sign-off for high-hazard objects" hint="High-hazard detections always need an operator decision, even above the auto-confirm threshold.">
                <Switch label="Require high-hazard sign-off" checked={settings.requireHighHazardSignoff} onChange={(v) => updateSettings({ requireHighHazardSignoff: v })} />
              </Row>
            </div>
            <div>
              <p className="label mb-2">Impact on current detections ({impact.auto + impact.mid + impact.low})</p>
              <div className="flex h-3 overflow-hidden rounded bg-line" role="img" aria-label={`${impact.auto} auto-confirmed, ${impact.mid} human review, ${impact.low} low confidence`}>
                <div className="bg-hz-low" style={{ flex: impact.auto }} />
                <div className="bg-hz-med" style={{ flex: impact.mid }} />
                <div className="bg-hz-high" style={{ flex: impact.low }} />
              </div>
              <ul className="mt-3 space-y-2 text-[13px]">
                <Legend color="#3FD98F" label={`≥ ${settings.autoConfirm}%`} text="Auto-confirmed" n={impact.auto} />
                <Legend color="#F6A623" label={`${settings.reviewLow}–${settings.autoConfirm}%`} text="Human review" n={impact.mid} />
                <Legend color="#FF5A5F" label={`< ${settings.reviewLow}%`} text="Flagged for manual review" n={impact.low} />
              </ul>
            </div>
          </div>
        </Panel>

        <Panel title="Survey settings">
          <div className="space-y-3">
            <Text label="Survey name" value={settings.surveyName} onChange={(v) => updateSettings({ surveyName: v })} />
            <Text label="Survey vessel" value={settings.vessel} onChange={(v) => updateSettings({ vessel: v })} />
            <Slider label="Swath width (m)" value={settings.swathM} min={50} max={300} step={10} unit=" m" onChange={(v) => updateSettings({ swathM: v })} />
            <Slider label="Recovery vessel speed (kn)" value={settings.vesselSpeedKn} min={2} max={12} unit=" kn" onChange={(v) => updateSettings({ vesselSpeedKn: v })} />
          </div>
        </Panel>

        <Panel title="Map settings">
          <div className="space-y-3">
            <label className="flex flex-col gap-1">
              <span className="label">Base map</span>
              <select className="field" value={settings.basemap} onChange={(e) => updateSettings({ basemap: e.target.value as 'bathymetry' | 'chart' })}>
                <option value="bathymetry">Bathymetry</option>
                <option value="chart">Nautical chart</option>
              </select>
            </label>
            <Slider label="Error-circle exaggeration" value={settings.errorExaggeration} min={1} max={20} unit="×" onChange={(v) => updateSettings({ errorExaggeration: v })} />
            <Row label="Show sonar coverage by default"><Switch label="Sonar coverage" checked={settings.layerCoverage} onChange={(v) => updateSettings({ layerCoverage: v })} /></Row>
            <Row label="Show currents by default"><Switch label="Currents" checked={settings.layerCurrents} onChange={(v) => updateSettings({ layerCurrents: v })} /></Row>
            <Row label="Show depth contours"><Switch label="Depth contours" checked={settings.layerContours} onChange={(v) => updateSettings({ layerContours: v })} /></Row>
          </div>
        </Panel>

        <Panel title="Notifications">
          <div className="space-y-3">
            <Row label="High-hazard object detected"><Switch label="High-hazard alerts" checked={settings.notifyHigh} onChange={(v) => updateSettings({ notifyHigh: v })} /></Row>
            <Row label="Detections awaiting human review"><Switch label="Review alerts" checked={settings.notifyReview} onChange={(v) => updateSettings({ notifyReview: v })} /></Row>
            <Row label="Scan processing finished"><Switch label="Scan alerts" checked={settings.notifyScan} onChange={(v) => updateSettings({ notifyScan: v })} /></Row>
          </div>
        </Panel>

        <Panel title="System information">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[13px]">
            <Info k="Version" v="JalNiriksh AI 0.9.0 (prototype)" />
            <Info k="Detection model" v="YOLOv8-ESI (ONNX) + acoustic physics (material, shadow, threat score)" />
            <Info k="Sensor" v={`${survey?.sensor ?? '—'} · ${survey?.frequencyKhz ?? '—'} kHz`} />
            <Info k="Survey ID" v={survey?.id ?? '—'} />
            <Info
              k="Live Analysis API"
              v={liveOnline === null ? 'Checking…' : liveOnline ? 'Connected — real inference + routing active' : 'Offline — Sonar/Recovery pages use simulated fallbacks'}
            />
            <Info k="API base" v={API_BASE} />
            <Info k="Detections / waste source" v="Seeded demo survey (in-browser); no persistence backend yet" />
          </dl>
        </Panel>
      </div>
    </>
  );
}

function Slider({ label, value, min, max, step = 1, unit = '%', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between"><span className="label">{label}</span><span className="num text-[13px]">{value}{unit}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="mt-1 h-5 w-full" />
    </label>
  );
}
function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1"><span className="label">{label}</span><input className="field" value={value} onChange={(e) => onChange(e.target.value)} /></label>
  );
}
function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div><p className="text-[13px]">{label}</p>{hint && <p className="text-xs text-dim">{hint}</p>}</div>
      {children}
    </div>
  );
}
function Legend({ color, label, text, n }: { color: string; label: string; text: string; n: number }) {
  return (
    <li className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} aria-hidden />
      <span className="num w-16 text-mute">{label}</span>
      <span className="flex-1">{text}</span>
      <span className="num">{n}</span>
    </li>
  );
}
function Info({ k, v }: { k: string; v: string }) {
  return (<><dt className="text-mute">{k}</dt><dd className="num min-w-0 truncate">{v}</dd></>);
}
