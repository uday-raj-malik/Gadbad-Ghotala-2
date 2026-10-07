import { useMemo } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import type { Detection } from '@/types';
import { useApp } from '@/store/AppStore';
import { cn } from '@/lib/utils';
import ConfidenceBadge from '../ui/ConfidenceBadge';
import HazardBadge from '../ui/HazardBadge';
import TypeChip from '../ui/TypeChip';
import StatusBadge from '../ui/StatusBadge';
import { EmptyState } from '../ui/States';
import ReviewPanel from '../detections/ReviewPanel';

interface Props {
  detections: Detection[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const HZ = { high: 3, medium: 2, low: 1 } as const;
const rank = (d: Detection) => (d.status === 'review' ? 0 : d.status === 'rejected' ? 3 : d.status === 'recovered' ? 2 : 1);

/** "AI DETECTION" list. Uncertain detections come first and can be decided right here. */
export default function AiDetectionPanel({ detections, selectedId, onSelect }: Props) {
  const { setStatus, toast } = useApp();
  const rows = useMemo(
    () => detections.slice().sort((a, b) => rank(a) - rank(b) || (a.status === 'review' ? a.confidence - b.confidence : HZ[b.hazard] - HZ[a.hazard] || b.confidence - a.confidence)),
    [detections],
  );
  const review = rows.filter((d) => d.status === 'review');
  const auto = detections.filter((d) => d.status === 'confirmed' || d.status === 'recovered').length;
  const rejected = detections.filter((d) => d.status === 'rejected').length;

  const quick = async (d: Detection, to: 'confirmed' | 'rejected') => {
    try {
      await setStatus(d.id, to);
      toast(to === 'confirmed' ? `${d.id} confirmed.` : `${d.id} rejected as a false positive.`, to === 'confirmed' ? 'success' : 'info');
    } catch {
      toast(`Could not save the decision for ${d.id}.`, 'error');
    }
  };

  return (
    <section className="panel flex h-full min-h-0 flex-col" aria-label="AI detection">
      <header className="border-b border-line px-4 pb-3 pt-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[15px] font-semibold uppercase tracking-[0.16em]">AI Detection</h2>
          <span className="num text-xs text-dim">{detections.length} objects</span>
        </div>
        <div className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-line" role="img" aria-label={`${auto} verified, ${review.length} need review, ${rejected} rejected`}>
          <div className="bg-hz-low" style={{ flex: auto }} />
          <div className="bg-hz-med" style={{ flex: review.length }} />
          <div className="bg-hz-high/70" style={{ flex: rejected }} />
        </div>
        <p className="num mt-1.5 flex gap-3 text-2xs text-mute">
          <span><span className="text-hz-low">●</span> {auto} verified</span>
          <span><span className="text-hz-med">●</span> {review.length} need review</span>
          <span><span className="text-hz-high">●</span> {rejected} rejected</span>
        </p>
        {review.length > 0 && (
          <button
            onClick={() => onSelect(review[0].id)}
            className="mt-2.5 flex w-full items-center gap-2 rounded border border-hz-med/50 bg-hz-med/10 px-2.5 py-1.5 text-left text-[12.5px] text-hz-med transition-colors hover:bg-hz-med/20"
          >
            <AlertTriangle size={14} className="shrink-0" aria-hidden />
            <span className="flex-1 font-medium">{review.length} detection{review.length > 1 ? 's' : ''} need human review</span>
            <span className="text-2xs uppercase tracking-wider">Review first</span>
          </button>
        )}
      </header>

      {rows.length === 0 ? (
        <EmptyState title="No objects in this scan" body="The model found nothing above the detection threshold." />
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto" aria-label="Detected objects">
          {rows.map((d) => {
            const sel = selectedId === d.id;
            const rv = d.status === 'review';
            return (
              <li key={d.id} className={cn('relative', sel && 'bg-raised/70')}>
                {rv && <span className="absolute inset-y-0 left-0 w-[3px] bg-hz-med" aria-hidden />}
                <button onClick={() => onSelect(sel ? null : d.id)} className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left transition-colors hover:bg-raised/60" aria-expanded={sel}>
                  <span className="flex min-w-0 items-center gap-2"><TypeChip type={d.type} /><span className="font-mono text-2xs text-dim">{d.id}</span></span>
                  <span className="num font-display text-[19px] font-semibold leading-none"><ConfidenceBadge value={d.confidence} bar={false} /></span>
                  <span className="num text-xs text-mute">Depth: {d.depth.toFixed(1)} m</span>
                  <span className="flex items-center justify-end gap-2">
                    {rv ? <span className="text-2xs font-semibold uppercase tracking-wider text-hz-med">⚠ Needs review</span> : <StatusBadge status={d.status} />}
                    <HazardBadge hazard={d.hazard} compact />
                  </span>
                </button>
                {rv && !sel && (
                  <div className="flex gap-2 px-4 pb-2.5">
                    <button onClick={() => quick(d, 'confirmed')} className="flex h-7 flex-1 items-center justify-center gap-1 rounded border border-hz-low/50 bg-hz-low/10 text-[11px] font-semibold uppercase tracking-wide text-hz-low hover:bg-hz-low/20"><Check size={12} aria-hidden />Confirm</button>
                    <button onClick={() => quick(d, 'rejected')} className="flex h-7 flex-1 items-center justify-center gap-1 rounded border border-hz-high/50 bg-hz-high/10 text-[11px] font-semibold uppercase tracking-wide text-hz-high hover:bg-hz-high/20"><X size={12} aria-hidden />Reject</button>
                  </div>
                )}
                {sel && (
                  <div className="px-3 pb-3">
                    <ReviewPanel detection={d} evidence track compact />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
