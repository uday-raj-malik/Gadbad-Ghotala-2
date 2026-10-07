import type { DetectionStatus } from '@/types';
import { STATUS_META } from '@/lib/meta';

export default function StatusBadge({ status }: { status: DetectionStatus }) {
  const m = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: m.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} aria-hidden />
      {m.label}
    </span>
  );
}
