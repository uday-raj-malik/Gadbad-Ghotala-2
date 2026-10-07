import { useLayoutEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { BOUNDS } from '@/lib/geo';

interface Props {
  onWaterline: (y: number) => void;
  onOpen: () => void;
}

const WORD = 'JALNIRIKSH';
/** Share of the wordmark's box that sits above the water surface. */
const SPLIT = 0.5;

/**
 * Oversized wordmark cut by the waterline: navy above the surface, ice-blue and slightly refracted below it.
 * The measured waterline position is lifted to the shell so the canvas surface lines up with the type.
 */
export default function HeroSection({ onWaterline, onOpen }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { survey } = useApp();
  const lat = ((BOUNDS.north + BOUNDS.south) / 2).toFixed(4);
  const lon = ((BOUNDS.east + BOUNDS.west) / 2).toFixed(4);

  useLayoutEffect(() => {
    const el = ref.current!;
    const host = el.closest('[data-ocean-content]') as HTMLElement | null;
    const measure = () => {
      if (!host) return;
      const a = el.getBoundingClientRect();
      const b = host.getBoundingClientRect();
      onWaterline(a.top - b.top + a.height * SPLIT);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    if (document.fonts?.ready) document.fonts.ready.then(measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [onWaterline]);

  const word = 'font-display font-extrabold tracking-[-0.035em] leading-[0.86] text-[clamp(54px,14vw,240px)] whitespace-nowrap';

  return (
    <section className="relative px-6 pb-16 pt-[118px] text-center" aria-labelledby="hero-title">
      <svg width="0" height="0" className="absolute" aria-hidden>
        <filter id="refract" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.004 0.012" numOctaves="2" seed="4" result="n">
            <animate attributeName="baseFrequency" dur="14s" values="0.004 0.012;0.006 0.016;0.004 0.012" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      <div ref={ref} className="relative mx-auto w-fit select-none">
        <h1 id="hero-title" className={`${word} relative text-[#09295c]`} style={{ clipPath: `inset(0 0 ${(1 - SPLIT) * 100}% 0)` }}>
          {WORD}
        </h1>
        <span
          aria-hidden
          className={`${word} absolute inset-0 text-[#dff3ff]/90`}
          style={{ clipPath: `inset(${SPLIT * 100}% 0 0 0)`, filter: 'url(#refract)' }}
        >
          {WORD}
        </span>
        <span className="absolute -top-1 right-0 translate-x-[30%] rounded-full border border-white/70 bg-white/10 px-2.5 py-0.5 font-display text-[clamp(11px,1.2vw,17px)] font-medium tracking-[0.22em] text-white backdrop-blur-sm" aria-hidden>AI</span>
      </div>

      <p className="relative mt-5 font-display text-[clamp(14px,1.9vw,26px)] font-light uppercase tracking-[0.42em] text-white/95">
        Underwater Waste Intelligence
      </p>
      <p className="mt-2.5 text-[clamp(15px,1.35vw,19px)] font-light tracking-wide text-white">Detect. Verify. Recover.</p>

      <button
        onClick={onOpen}
        className="group mt-9 inline-flex items-center gap-2.5 rounded-full border border-white/75 bg-white/10 px-8 py-3 text-[15px] font-medium text-white shadow-[0_8px_30px_-10px_rgba(2,18,48,0.6)] backdrop-blur-md transition-all hover:bg-white/20"
      >
        Open Operations Dashboard
        <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
      </button>

      <p className="mx-auto mt-8 flex max-w-[860px] flex-wrap justify-center gap-x-7 gap-y-1 font-mono text-[11px] uppercase tracking-[0.18em] text-white/75">
        <span>{survey?.harbour ?? 'Mumbai Port'}</span>
        <span>Survey #{survey?.id ?? 'SR-024'}</span>
        <span>{lat}° N · {lon}° E</span>
        <span>Side-scan {survey?.frequencyKhz ?? 455} kHz</span>
      </p>
    </section>
  );
}
