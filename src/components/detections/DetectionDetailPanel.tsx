import { useEffect } from 'react';
import { ChevronRight, CircleAlert, CircleCheck, CircleMinus, X } from 'lucide-react';
import type { Detection } from '@/types';
import { useApp } from '@/store/AppStore';
import { HAZARD_META, TYPE_META } from '@/lib/meta';
import { fmtDate } from '@/lib/utils';
import { fmtLat, fmtLon } from '@/lib/geo';
import SonarPatch from '../sonar/SonarPatch';
import ReviewPanel from './ReviewPanel';
import ReviewTrack from './ReviewTrack';
import ConfidenceBadge from '../ui/ConfidenceBadge';
import StatusBadge from '../ui/StatusBadge';
import TypeChip from '../ui/TypeChip';
import HazardBadge from '../ui/HazardBadge';
import Button from '../ui/Button';

interface Props {
  detection: Detection;
  onClose: () => void;
  queueLeft?: number;
  onNext?: () => void;
  onDecided?: () => void;
}

function Gauge({ value }: { value: number }) {
  const { settings } = useApp();
  return (
    <div>
      <div className="relative h-2 overflow-hidden rounded-full bg-line" role="img" aria-label={`Detection confidence ${value}% against review thresholds ${settings.reviewLow}% and ${settings.autoConfirm}%`}>
        <div className="absolute inset-y-0 left-0 bg-hz-high/30" style={{ width: `${settings.reviewLow}%` }} />
        <div className="absolute inset-y-0 bg-hz-med/30" style={{ left: `${settings.reviewLow}%`, width: `${settings.autoConfirm - settings.reviewLow}%` }} />
        <div className="absolute inset-y-0 bg-hz-low/30" style={{ left: `${settings.autoConfirm}%`, right: 0 }} />
        <div className="absolute -top-0.5 h-3 w-0.5 bg-white" style={{ left: `calc(${value}% - 1px)` }} />
      </div>
      <div className="num relative mt-1 h-3 text-2xs text-dim">
        <span className="absolute" style={{ left: `${settings.reviewLow}%`, transform: 'translateX(-50%)' }}>{settings.reviewLow}</span>
        <span className="absolute" style={{ left: `${settings.autoConfirm}%`, transform: 'translateX(-50%)' }}>{settings.autoConfirm}</span>
      </div>
    </div>
  );
}

const EFFECT = {
  supports: { icon: CircleCheck, color: '#3FD98F', label: 'Supports detection' },
  against: { icon: CircleAlert, color: '#F6A623', label: 'Lowers confidence' },
  neutral: { icon: CircleMinus, color: '#93ABBE', label: 'Context' },
} as const;

export default function DetectionDetailPanel({ detection: d, onClose, queueLeft, onNext, onDecided }: Props) {
  const { missionIds, settings } = useApp();
  const needsReview = d.status === 'review';
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/45" onClick={onClose} aria-hidden />
      <aside role="dialog" aria-label={`Detection ${d.id}`} className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-[500px] animate-slidein flex-col border-l border-line2 bg-panel shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            <p className="label">Detection record</p>
            <h2 className="mt-0.5 flex items-center gap-2 font-display text-[21px] font-semibold uppercase leading-tight tracking-wide">
              {TYPE_META[d.type].label} <span className="font-mono text-[15px] font-normal normal-case text-mute">#{d.id}</span>
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close detail panel" className="rounded p-1 text-mute hover:bg-raised hover:text-ink"><X size={18} /></button>
        </header>

        {queueLeft !== undefined && (
          <div className="flex items-center justify-between border-b border-hz-med/30 bg-hz-med/[0.07] px-5 py-2 text-xs">
            <span className="text-hz-med">Review queue: {queueLeft} left</span>
            <Button size="sm" variant="ghost" onClick={onNext}>Skip <ChevronRight size={13} /></Button>
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* human review comes first when the model is unsure */}
          {needsReview && <ReviewPanel detection={d} evidence track onDecided={onDecided} />}

          <section aria-label="Detection details">
            <dl className="grid grid-cols-2 gap-x-5 gap-y-3.5">
              <div><dt className="label">Detection ID</dt><dd className="font-mono text-[14px]">{d.id}</dd></div>
              <div><dt className="label">Waste type</dt><dd className="mt-0.5"><TypeChip type={d.type} /></dd></div>
              <div className="col-span-2">
                <dt className="label">Detection confidence</dt>
                <dd className="mt-0.5 flex items-baseline gap-2">
                  <span className="num font-display text-[28px] font-semibold leading-none"><ConfidenceBadge value={d.confidence} bar={false} /></span>
                  <span className="text-xs text-dim">auto-confirm at {settings.autoConfirm}% · review {settings.reviewLow}–{settings.autoConfirm}%</span>
                </dd>
                <div className="mt-2"><Gauge value={d.confidence} /></div>
              </div>
              <div><dt className="label">Depth</dt><dd className="num text-[16px]">{d.depth.toFixed(1)} m</dd></div>
              <div><dt className="label">Error radius</dt><dd className="num text-[16px]">±{d.errorRadius.toFixed(1)} m</dd></div>
              <div><dt className="label">Latitude</dt><dd className="font-mono text-[13.5px]">{fmtLat(d.latitude)}</dd></div>
              <div><dt className="label">Longitude</dt><dd className="font-mono text-[13.5px]">{fmtLon(d.longitude)}</dd></div>
              <div><dt className="label">Hazard</dt><dd className="mt-0.5"><HazardBadge hazard={d.hazard} /></dd></div>
              <div><dt className="label">Status</dt><dd className="mt-0.5"><StatusBadge status={d.status} /></dd></div>
              <div className="col-span-2">
                <div className="flex items-center justify-between"><dt className="label">Hazard score</dt><dd className="num text-[13px]" style={{ color: HAZARD_META[d.hazard].color }}>{d.hazardScore} / 100</dd></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${d.hazardScore}%`, background: HAZARD_META[d.hazard].color }} /></div>
              </div>
            </dl>
            <p className="mt-3 text-2xs text-dim">{d.scanId} · detected {fmtDate(d.detectedAt)}</p>
          </section>

          {!needsReview && (
            <section aria-label="Sonar evidence">
              <h3 className="mb-2 text-[13px] font-medium">Sonar evidence</h3>
              <div className="grid grid-cols-3 gap-2">
                <SonarPatch detection={d} mode="raw" label="Sonar crop" />
                <SonarPatch detection={d} mode="mask" label="Segmentation mask" />
                <SonarPatch detection={d} mode="shadow" label="Shadow analysis" />
              </div>
              <div className="num mt-2 flex gap-4 text-xs text-mute">
                <span>Shadow score {d.shadowScore.toFixed(2)}</span>
                <span>Anomaly score {d.anomalyScore.toFixed(2)}</span>
                <span>Size ≈ {d.sizeM} m</span>
              </div>
            </section>
          )}

          {!needsReview && (
            <section aria-label="Verification workflow">
              <h3 className="mb-3 text-[13px] font-medium">Verification</h3>
              <ReviewTrack detection={d} />
            </section>
          )}

          <section aria-label="AI explanation">
            <h3 className="mb-2 text-[13px] font-medium">Why the model flagged this</h3>
            <ul className="space-y-2">
              {d.signals.map((s) => {
                const E = EFFECT[s.effect];
                return (
                  <li key={s.label} className="flex gap-2.5">
                    <E.icon size={15} className="mt-0.5 shrink-0" style={{ color: E.color }} aria-label={E.label} />
                    <div>
                      <p className="text-[13px]">{s.label}</p>
                      <p className="text-xs text-mute">{s.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-label="Recovery estimate" className="grid grid-cols-3 gap-3 border-y border-line py-3">
            <div><p className="label">Difficulty</p><p className="text-[13px] capitalize">{d.recoveryDifficulty}</p></div>
            <div><p className="label">Est. time</p><p className="num text-[13px]">{d.recoveryMinutes} min</p></div>
            <div><p className="label">Est. weight</p><p className="num text-[13px]">{d.weightKg} kg</p></div>
            {missionIds.includes(d.id) && <p className="col-span-3 text-xs text-hz-med">Included in the current recovery mission.</p>}
          </section>

          <p className="text-xs leading-relaxed text-dim">
            Sonar indicates a <span className="text-mute">likely category</span> from shape, size and acoustic shadow. It cannot identify material. Whether this is nylon, HDPE or steel is confirmed physically after recovery, during sorting and weighing.
          </p>
        </div>

        {!needsReview && (
          <footer className="border-t border-line p-3">
            <ReviewPanel detection={d} compact onDecided={onDecided} />
          </footer>
        )}
      </aside>
    </>
  );
}
