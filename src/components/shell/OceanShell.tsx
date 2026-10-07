import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import OceanBackdrop from './OceanBackdrop';

interface Props {
  waterY: number;
  leaving: boolean;
  nav: (scrolled: boolean, scrollToTop: () => void) => ReactNode;
  children: ReactNode;
  imageSrc?: string;
}

/** 0 m at the waterline, a tick every 5 m: a nautical detail that also anchors the type to the water. */
function DepthGauge({ waterY }: { waterY: number }) {
  const STEP = 58;
  return (
    <div className="pointer-events-none absolute left-5 z-[2] hidden select-none md:block" style={{ top: waterY }} aria-hidden>
      {Array.from({ length: 17 }, (_, i) => (
        <div key={i} className="absolute left-0 flex items-center gap-1.5 whitespace-nowrap font-mono text-[10px] text-white/55" style={{ top: i * STEP, transform: 'translateY(-50%)' }}>
          <span className={'block h-px bg-white/55 ' + (i % 2 === 0 ? 'w-3.5' : 'w-2')} />
          {i % 2 === 0 && <span>{i * 5} m</span>}
        </div>
      ))}
      <span className="absolute left-[1px] top-0 block w-px bg-white/25" style={{ height: 16 * STEP }} />
    </div>
  );
}

/**
 * The presentation frame: a flat blue stage with a thin rounded glass border and, inside it, a scrollable
 * underwater scene. The ocean visuals live here and nowhere in the operations environment.
 */
export default function OceanShell({ waterY, leaving, nav, children, imageSrc }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = scroller.current!;
    const h = () => setScrolled(el.scrollTop > 36);
    el.addEventListener('scroll', h, { passive: true });
    return () => el.removeEventListener('scroll', h);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-[#3d6aa6] via-[#305c9a] to-[#1f4584] p-3 sm:p-5">
      <div
        className={cn(
          'relative h-full overflow-hidden rounded-[22px] border-[3px] border-white/65 shadow-[0_30px_80px_-30px_rgba(2,12,40,0.8)] transition-all duration-700 ease-in sm:rounded-[30px]',
          leaving && 'scale-[1.04] opacity-0 blur-[5px]',
        )}
      >
        <div ref={scroller} className="absolute inset-0 overflow-y-auto overflow-x-hidden scroll-smooth">
          <div data-ocean-content className="relative min-h-full">
            <OceanBackdrop waterY={waterY} imageSrc={imageSrc} className="absolute inset-0 z-0" />
            {/* legibility veil: keeps text readable without flattening the water */}
            <div
              className="pointer-events-none absolute inset-0 z-[1]"
              style={{ background: 'linear-gradient(180deg, rgba(6,30,70,0.18) 0%, rgba(6,30,70,0) 30%, rgba(3,18,48,0.28) 100%)' }}
              aria-hidden
            />
            <DepthGauge waterY={waterY} />
            <div className="relative z-10">{children}</div>
          </div>
        </div>
        {nav(scrolled, () => scroller.current?.scrollTo({ top: 0, behavior: 'smooth' }))}
      </div>

      {/* transition into the operations environment */}
      <div
        className={cn('pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-abyss transition-opacity duration-500', leaving ? 'opacity-100 delay-200' : 'opacity-0')}
        aria-hidden
      >
        {leaving && (
          <>
            <span className="absolute h-[50vmin] w-[50vmin] animate-ringout rounded-full border border-sonar/50" />
            <span className="absolute h-[50vmin] w-[50vmin] animate-ringout rounded-full border border-sonar/30 [animation-delay:0.25s]" />
            <span className="font-display text-sm font-light uppercase tracking-[0.5em] text-sonar/80">Entering operations</span>
          </>
        )}
      </div>
    </div>
  );
}
