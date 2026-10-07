import type { WasteType } from '@/types';
import { TYPE_META } from '@/lib/meta';
import TypeGlyph from '../map/TypeGlyph';

export default function TypeChip({ type, label }: { type: WasteType; label?: string }) {
  const m = TYPE_META[type];
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px]">
      <svg width="14" height="14" viewBox="-8 -8 16 16" aria-hidden>
        <TypeGlyph type={type} color={m.color} size={6.5} />
      </svg>
      {label ?? m.label}
    </span>
  );
}
