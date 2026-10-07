import type { ReactNode } from 'react';
import type { Detection } from '@/types';
import { HAZARD_META, TYPE_META } from '@/lib/meta';
import { cn } from '@/lib/utils';
import ConfidenceBadge from '../ui/ConfidenceBadge';
import HazardBadge from '../ui/HazardBadge';
import StatusBadge from '../ui/StatusBadge';
import TypeChip from '../ui/TypeChip';

interface Props {
  detection: Detection;
  selected?: boolean;
  onClick?: () => void;
  trailing?: ReactNode;
  showStatus?: boolean;
}

export default function DetectionCard({ detection: d, selected, onClick, trailing, showStatus }: Props) {
  const hz = HAZARD_META[d.hazard];
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}
      aria-label={`${hz.label} hazard ${TYPE_META[d.type].label} ${d.id}, depth ${d.depth} metres, confidence ${d.confidence} percent`}
      className={cn(
        'relative grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 overflow-hidden rounded border bg-deep py-2 pl-3.5 pr-3 transition-colors',
        onClick && 'cursor-pointer hover:border-line2 hover:bg-raised',
        selected ? 'border-sonar/70 bg-raised' : 'border-line',
      )}
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: hz.color }} aria-hidden />
      <div className="flex min-w-0 items-center gap-2">
        <TypeChip type={d.type} />
        <span className="font-mono text-2xs text-dim">{d.id}</span>
      </div>
      <div className="flex items-center justify-end gap-2">
        {showStatus && <StatusBadge status={d.status} />}
        <HazardBadge hazard={d.hazard} compact />
      </div>
      <div className="num flex items-center gap-3 text-xs text-mute">
        <span>Depth {d.depth} m</span>
        <ConfidenceBadge value={d.confidence} />
      </div>
      <div className="flex justify-end">{trailing}</div>
    </div>
  );
}
