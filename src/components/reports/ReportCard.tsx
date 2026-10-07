import type { ReactNode } from 'react';
import Panel from '../ui/Panel';

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="px-4 py-3.5">
      <p className="label">{label}</p>
      <p className="num mt-1.5 font-display text-[24px] font-semibold leading-none">{value}</p>
      {hint && <p className="mt-1.5 text-2xs text-dim">{hint}</p>}
    </div>
  );
}

/** Titled chart container used throughout Reports. */
export default function ReportCard({ title, subtitle, children, className }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <Panel title={title} subtitle={subtitle} className={className}>
      {children}
    </Panel>
  );
}
