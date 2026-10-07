import { Check, AlertTriangle, Minus } from 'lucide-react';
import type { Detection } from '@/types';
import { cn } from '@/lib/utils';

type NodeState = 'done' | 'active' | 'pending' | 'skipped' | 'bad';

/** AI detection → detection confidence → human review → outcome. Shows where this detection sits in the verification workflow. */
export default function ReviewTrack({ detection: d }: { detection: Detection }) {
  const reviewed = !!d.reviewedBy;
  const needs = d.status === 'review';
  const nodes: { label: string; sub: string; state: NodeState }[] = [
    { label: 'AI detection', sub: 'YOLO + anomaly + shadow', state: 'done' },
    { label: 'Detection confidence', sub: `${d.confidence.toFixed(1)}%`, state: 'done' },
    {
      label: 'Human review',
      sub: needs ? 'Waiting for operator' : reviewed ? d.reviewedBy! : 'Not required',
      state: needs ? 'active' : reviewed ? 'done' : 'skipped',
    },
    {
      label: d.status === 'rejected' ? 'Rejected' : d.status === 'recovered' ? 'Recovered' : 'Confirmed',
      sub: needs ? 'Pending' : d.status === 'rejected' ? 'False positive' : d.status === 'recovered' ? 'Removed from seabed' : 'Cleared for recovery',
      state: needs ? 'pending' : d.status === 'rejected' ? 'bad' : 'done',
    },
  ];

  return (
    <ol className="flex items-start" aria-label="Verification workflow">
      {nodes.map((n, i) => (
        <li key={n.label} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
          {i > 0 && (
            <span
              className={cn('absolute right-1/2 top-[11px] h-px w-full', nodes[i - 1].state === 'done' && (n.state === 'done' || n.state === 'active' || n.state === 'bad') ? 'bg-teal/60' : 'bg-line2')}
              aria-hidden
            />
          )}
          <span
            className={cn(
              'relative z-10 flex h-[23px] w-[23px] items-center justify-center rounded-full border text-[10px]',
              n.state === 'done' && 'border-teal bg-teal text-abyss',
              n.state === 'active' && 'border-hz-med bg-hz-med/20 text-hz-med shadow-[0_0_0_3px_rgba(246,166,35,0.15)]',
              n.state === 'pending' && 'border-line2 bg-panel text-dim',
              n.state === 'skipped' && 'border-line2 bg-panel text-dim',
              n.state === 'bad' && 'border-hz-high bg-hz-high/20 text-hz-high',
            )}
          >
            {n.state === 'done' ? <Check size={12} strokeWidth={3} /> : n.state === 'active' ? <AlertTriangle size={11} /> : n.state === 'skipped' ? <Minus size={11} /> : n.state === 'bad' ? '×' : i + 1}
          </span>
          <span className={cn('mt-1.5 px-0.5 text-[11px] font-medium leading-tight', n.state === 'active' ? 'text-hz-med' : n.state === 'pending' ? 'text-dim' : 'text-ink')}>{n.label}</span>
          <span className="num mt-0.5 line-clamp-1 px-0.5 text-2xs text-dim">{n.sub}</span>
        </li>
      ))}
    </ol>
  );
}
