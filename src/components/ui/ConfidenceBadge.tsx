import { useApp } from '@/store/AppStore';

export function confidenceTone(c: number, auto: number, low: number) {
  if (c >= auto) return '#3FD98F';
  if (c >= low) return '#F6A623';
  return '#FF5A5F';
}

export default function ConfidenceBadge({ value, bar = true }: { value: number; bar?: boolean }) {
  const { settings } = useApp();
  const color = confidenceTone(value, settings.autoConfirm, settings.reviewLow);
  return (
    <span className="inline-flex items-center gap-2" title={`AI confidence ${value.toFixed(1)}%`}>
      {bar && (
        <span className="relative h-1 w-10 overflow-hidden rounded-full bg-line" aria-hidden>
          <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${value}%`, background: color }} />
        </span>
      )}
      <span className="num text-[13px]" style={{ color }}>
        {value.toFixed(1)}%
      </span>
    </span>
  );
}
