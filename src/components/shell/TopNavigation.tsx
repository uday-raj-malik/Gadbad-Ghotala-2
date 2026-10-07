import { cn } from '@/lib/utils';
import { appPath } from '@/lib/routes';

interface Props {
  scrolled: boolean;
  onEnter: (path: string) => void;
  onTop: () => void;
}

const ITEMS: { label: string; path: string | null }[] = [
  { label: 'Overview', path: null },
  { label: 'Operations', path: appPath('') },
  { label: 'Sonar', path: appPath('/sonar') },
  { label: 'Map', path: appPath('/map') },
  { label: 'Recovery', path: appPath('/recovery') },
  { label: 'Reports', path: appPath('/reports') },
];

/** Lightweight presentation-shell navigation. Items open the matching operations view via the shared transition. */
export default function TopNavigation({ scrolled, onEnter, onTop }: Props) {
  return (
    <header
      className={cn(
        'absolute inset-x-0 top-0 z-30 flex h-[72px] items-center justify-between px-6 transition-[background,backdrop-filter,border-color] duration-300 lg:px-9',
        scrolled ? 'border-b border-white/15 bg-[#0b3566]/45 backdrop-blur-md' : 'border-b border-transparent',
      )}
    >
      <button onClick={onTop} className="font-display text-[23px] font-semibold tracking-tight text-white" aria-label="JalNiriksh AI, back to top">
        JalNiriksh<span className="ml-1 font-light text-[#bfe6ff]">AI</span>
      </button>

      <nav aria-label="Primary" className="hidden md:block">
        <ul className="flex items-center gap-7 text-[14px] font-medium text-white/90 lg:gap-9">
          {ITEMS.map((it, i) => (
            <li key={it.label}>
              <button
                onClick={() => (it.path ? onEnter(it.path) : onTop())}
                className={cn('relative py-1 transition-colors hover:text-white', i === 0 && 'text-white')}
              >
                {it.label}
                {i === 0 && <span className="absolute inset-x-0 -bottom-0.5 h-px bg-white/80" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-2 rounded-full border border-white/35 bg-white/10 px-3 py-1.5 text-[12.5px] text-white/95 backdrop-blur-sm sm:inline-flex">
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ring rounded-full bg-[#5ef0b0]/70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#5ef0b0]" />
          </span>
          System operational
        </span>
        <button
          onClick={() => onEnter(appPath(''))}
          className="flex items-center gap-2 rounded-full border border-white/70 py-1 pl-1 pr-3.5 text-[13.5px] text-white transition-colors hover:bg-white/15"
          aria-label="Operator profile: A. Rao. Opens the operations dashboard"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-[11px] font-medium">AR</span>
          A. Rao
        </button>
      </div>
    </header>
  );
}
