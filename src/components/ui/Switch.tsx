import { cn } from '@/lib/utils';

export default function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative h-5 w-9 shrink-0 rounded-full border transition-colors', checked ? 'border-sonar bg-sonar/30' : 'border-line2 bg-deep')}
    >
      <span className={cn('absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all', checked ? 'left-[18px] bg-sonar' : 'left-0.5 bg-dim')} />
    </button>
  );
}
