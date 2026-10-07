import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  icon: LucideIcon;
  tone?: 'default' | 'danger' | 'success' | 'warning';
  onClick?: () => void;
}

const TONE = { default: '#2FD3E6', danger: '#FF5A5F', success: '#3FD98F', warning: '#F6A623' };

export default function KpiCard({ label, value, unit, hint, icon: Icon, tone = 'default', onClick }: Props) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={cn('panel relative flex flex-col gap-2 p-3.5 text-left', onClick && 'transition-colors hover:border-line2')}
      aria-label={`${label}: ${value}${unit ?? ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-mute">{label}</span>
        <Icon size={15} style={{ color: TONE[tone] }} aria-hidden />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="num font-display text-[28px] font-semibold leading-none tracking-tight" style={tone === 'danger' ? { color: TONE.danger } : undefined}>
          {value}
        </span>
        {unit && <span className="text-xs text-mute">{unit}</span>}
      </div>
      {hint && <span className="text-2xs text-dim">{hint}</span>}
    </Tag>
  );
}
