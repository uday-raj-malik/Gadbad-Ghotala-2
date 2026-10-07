import { useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, Route, XCircle, X } from 'lucide-react';
import type { Detection } from '@/types';
import { useApp } from '@/store/AppStore';
import Button from '../ui/Button';
import { Spinner } from '../ui/States';
import SonarPatch from '../sonar/SonarPatch';
import ReviewTrack from './ReviewTrack';
import { cn } from '@/lib/utils';

interface Props {
  detection: Detection;
  onDecided?: (action: 'confirm' | 'reject' | 'recover') => void;
  compact?: boolean;
  /** Show sonar crop, segmentation mask and shadow/anomaly information next to the decision. */
  evidence?: boolean;
  /** Show the AI → confidence → human → outcome track. */
  track?: boolean;
}

/** The human-in-the-loop decision block. Shared by the Detections drawer and the Sonar workspace. */
export default function ReviewPanel({ detection: d, onDecided, compact, evidence, track }: Props) {
  const { settings, setStatus, addToMission, missionIds, toast } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const needsReview = d.status === 'review';
  const queued = missionIds.includes(d.id);
  const locked = d.status === 'recovered';

  const run = async (kind: 'confirm' | 'reject' | 'recover') => {
    setBusy(kind);
    try {
      if (kind === 'confirm') {
        await setStatus(d.id, 'confirmed');
        toast(`${d.id} confirmed. Added to the verified detection list.`);
      } else if (kind === 'reject') {
        await setStatus(d.id, 'rejected');
        toast(`${d.id} rejected as a false positive.`, 'info');
      } else {
        if (d.status === 'review') await setStatus(d.id, 'confirmed');
        addToMission([d.id]);
        toast(`${d.id} added to the recovery mission.`);
      }
      onDecided?.(kind);
    } catch {
      toast(`Could not save the decision for ${d.id}. Try again.`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const reason = needsReview
    ? d.confidence >= settings.autoConfirm
      ? `Detection confidence is above ${settings.autoConfirm}%, but high-hazard objects always need operator sign-off.`
      : d.confidence < settings.reviewLow
        ? `Detection confidence is below ${settings.reviewLow}%, so this was flagged for manual review automatically.`
        : `Detection confidence is between ${settings.reviewLow}% and ${settings.autoConfirm}%. A person must confirm before recovery.`
    : d.reviewedBy
      ? `${d.status === 'rejected' ? 'Rejected' : 'Reviewed'} by ${d.reviewedBy}.`
      : d.status === 'confirmed'
        ? `Auto-confirmed: detection confidence is above ${settings.autoConfirm}%.`
        : d.status === 'recovered'
          ? 'Recovered and handed to waste processing.'
          : 'Marked as a false positive.';

  return (
    <div className={cn('overflow-hidden rounded-md border', needsReview ? 'border-hz-med/55 bg-hz-med/[0.06]' : 'border-line bg-deep/70')}>
      {needsReview ? (
        <div className="flex items-center gap-2 border-b border-hz-med/35 bg-hz-med/[0.12] px-3.5 py-2">
          <AlertTriangle size={15} className="shrink-0 text-hz-med" aria-hidden />
          <p className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-hz-med">Needs human review</p>
          <span className="num ml-auto text-xs text-hz-med">{d.confidence.toFixed(1)}%</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-b border-line px-3.5 py-2">
          {d.status === 'rejected' ? <XCircle size={15} className="text-hz-high" aria-hidden /> : <CheckCircle2 size={15} className="text-hz-low" aria-hidden />}
          <p className="text-[13px] font-medium">Review status</p>
        </div>
      )}

      <div className={cn('space-y-3', compact ? 'p-3' : 'p-3.5')}>
        <p className="text-xs leading-relaxed text-mute">{reason}</p>

        {track && <div className="pt-1"><ReviewTrack detection={d} /></div>}

        {evidence && (
          <div>
            <div className="grid grid-cols-3 gap-2">
              <SonarPatch detection={d} mode="raw" label="Sonar crop" />
              <SonarPatch detection={d} mode="mask" label="Detection mask" />
              <SonarPatch detection={d} mode="shadow" label="Shadow" />
            </div>
            <p className="num mt-2 flex flex-wrap gap-x-4 text-xs text-mute">
              <span>Shadow score <span className="text-ink">{d.shadowScore.toFixed(2)}</span></span>
              <span>Anomaly score <span className="text-ink">{d.anomalyScore.toFixed(2)}</span></span>
              <span>Size ≈ <span className="text-ink">{d.sizeM} m</span></span>
            </p>
          </div>
        )}

        {needsReview ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="success" size="lg" className="w-full justify-center uppercase tracking-wide" disabled={!!busy} onClick={() => run('confirm')}>
                {busy === 'confirm' ? <Spinner /> : <Check size={15} />} Confirm detection
              </Button>
              <Button variant="danger" size="lg" className="w-full justify-center uppercase tracking-wide" disabled={!!busy} onClick={() => run('reject')}>
                {busy === 'reject' ? <Spinner /> : <X size={15} />} Reject detection
              </Button>
            </div>
            <button disabled={!!busy || queued} onClick={() => run('recover')} className="flex w-full items-center justify-center gap-1.5 text-xs text-mute transition-colors hover:text-sonar disabled:opacity-50">
              <Route size={12} aria-hidden /> {queued ? 'Already in recovery plan' : 'Confirm and add to recovery plan'}
            </button>
          </>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button disabled={!!busy || queued || d.status === 'rejected' || locked} onClick={() => run('recover')}>
              {busy === 'recover' ? <Spinner /> : <Route size={14} />} {queued ? 'In recovery plan' : 'Mark for recovery'}
            </Button>
            <Button variant="ghost" disabled={!!busy || d.status === 'rejected' || locked} onClick={() => run('reject')}>
              {busy === 'reject' ? <Spinner /> : <X size={14} />} Reject
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
