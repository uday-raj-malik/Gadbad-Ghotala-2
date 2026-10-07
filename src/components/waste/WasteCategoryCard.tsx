import { ArrowRight, FileCheck2, Truck } from 'lucide-react';
import type { WasteRecord } from '@/types';
import { CATEGORY_META, WASTE_STAGES } from '@/lib/meta';
import Button from '../ui/Button';
import { Spinner } from '../ui/States';
import { cn } from '@/lib/utils';

interface Props {
  record: WasteRecord;
  busy?: boolean;
  onAdvance: () => void;
}

export default function WasteCategoryCard({ record: r, busy, onAdvance }: Props) {
  const m = CATEGORY_META[r.category];
  const done = r.stage >= 4;
  const manifest = r.stage >= 3 ? 'Generated' : r.stage === 2 ? 'Pending weighing sign-off' : 'Not started';
  return (
    <article className="panel flex flex-col" aria-label={`${m.label} recovery record`}>
      <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: m.color }} aria-hidden />
          {m.label}
        </h3>
        <span className={cn('rounded px-1.5 py-0.5 text-2xs', done ? 'bg-hz-low/10 text-hz-low' : 'bg-raised text-mute')}>{WASTE_STAGES[r.stage]}</span>
      </header>
      <ol className="flex items-center px-4 pt-3" aria-label={`Stage ${r.stage + 1} of ${WASTE_STAGES.length}: ${WASTE_STAGES[r.stage]}`}>
        {WASTE_STAGES.map((s, i) => (
          <li key={s} className="flex flex-1 items-center last:flex-none" title={s}>
            <span className={cn('h-2.5 w-2.5 rounded-full border', i < r.stage ? 'border-teal bg-teal' : i === r.stage ? 'border-sonar bg-sonar shadow-[0_0_0_3px_rgba(47,211,230,0.18)]' : 'border-line2 bg-panel')} />
            {i < WASTE_STAGES.length - 1 && <span className={cn('h-px flex-1', i < r.stage ? 'bg-teal/70' : 'bg-line2')} />}
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-2 gap-3 p-4">
        <div>
          <p className="label">Items</p>
          <p className="num text-2xl font-semibold leading-tight">{r.items}</p>
        </div>
        <div>
          <p className="label">Weight</p>
          <p className="num text-2xl font-semibold leading-tight">{Math.round(r.weightKg)}<span className="ml-1 text-xs font-normal text-mute">kg</span></p>
        </div>
        <div className="col-span-2 space-y-1.5 border-t border-line pt-3 text-xs">
          <p className="flex items-center gap-2 text-mute"><Truck size={13} className="text-dim" aria-hidden />Recycler: <span className="text-ink">{r.recycler}</span></p>
          <p className="flex items-center gap-2 text-mute">
            <FileCheck2 size={13} className="text-dim" aria-hidden />Manifest:
            <span className={r.stage >= 3 ? 'text-hz-low' : 'text-ink'}>{manifest}</span>
            {r.manifestId && r.stage >= 3 && <span className="font-mono text-2xs text-dim">{r.manifestId}</span>}
          </p>
        </div>
      </div>
      <div className="mt-auto border-t border-line p-3">
        <Button className="w-full" variant={done ? 'ghost' : 'secondary'} disabled={done || busy || r.items === 0} onClick={onAdvance}>
          {busy ? <Spinner /> : null}
          {done ? 'Handed over to recycler' : r.items === 0 ? 'Nothing recovered yet' : `Advance to ${WASTE_STAGES[r.stage + 1].toLowerCase()}`}
          {!done && !busy && r.items > 0 && <ArrowRight size={13} aria-hidden />}
        </Button>
      </div>
    </article>
  );
}
