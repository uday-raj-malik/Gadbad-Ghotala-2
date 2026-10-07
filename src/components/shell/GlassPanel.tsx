import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** "frost" is the lighter reference-style tile; "deep" is a darker panel for dense content. */
  tone?: 'frost' | 'deep';
}

/** Translucent glass surface used by the presentation shell: thin white border, soft inner highlight, restrained blur. */
export default function GlassPanel({ children, tone = 'frost', className, ...rest }: Props) {
  return (
    <div
      {...rest}
      className={cn(
        'relative rounded-2xl border border-white/25 backdrop-blur-md',
        tone === 'frost'
          ? 'bg-gradient-to-b from-white/[0.14] to-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_10px_34px_-12px_rgba(2,18,48,0.55)]'
          : 'bg-[#071a36]/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_34px_-12px_rgba(2,18,48,0.6)]',
        className,
      )}
    >
      {children}
    </div>
  );
}
