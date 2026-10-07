import { ShieldAlert } from 'lucide-react';
import type { Hazard } from '@/types';
import { HAZARD_META } from '@/lib/meta';

export default function HazardBadge({ hazard, compact }: { hazard: Hazard; compact?: boolean }) {
  const m = HAZARD_META[hazard];
  return (
    <span
      className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-2xs font-medium"
      style={{ color: m.color, borderColor: m.color + '55', background: m.color + '14' }}
    >
      {hazard === 'high' && <ShieldAlert size={11} aria-hidden />}
      {compact ? m.label : `${m.label} hazard`}
    </span>
  );
}
