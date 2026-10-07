import { useMemo, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { advanceStage, buildWasteRecords } from '@/services/wasteService';
import { CATEGORY_META, TYPE_META, WASTE_STAGES } from '@/lib/meta';
import { cn } from '@/lib/utils';
import PageHeader from '@/components/ui/PageHeader';
import Panel from '@/components/ui/Panel';
import TypeChip from '@/components/ui/TypeChip';
import { EmptyState } from '@/components/ui/States';
import WasteCategoryCard from '@/components/waste/WasteCategoryCard';

export default function WastePage() {
  const { detections, wasteStages, setWasteStages, toast, pushNotification } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const records = useMemo(() => buildWasteRecords(detections, wasteStages), [detections, wasteStages]);
  const recovered = useMemo(() => detections.filter((d) => d.status === 'recovered').sort((a, b) => +new Date(b.reviewedAt ?? b.detectedAt) - +new Date(a.reviewedAt ?? a.detectedAt)), [detections]);
  const totalItems = records.reduce((a, r) => a + r.items, 0);
  const totalKg = records.reduce((a, r) => a + r.weightKg, 0);
  const minStage = Math.min(...records.filter((r) => r.items > 0).map((r) => r.stage), 4);

  const advance = async (cat: string, cur: number) => {
    setBusy(cat);
    try {
      const next = await advanceStage(cat, cur);
      setWasteStages({ ...wasteStages, [cat]: next });
      const label = CATEGORY_META[cat as keyof typeof CATEGORY_META].label;
      toast(`${label}: ${WASTE_STAGES[next.stage].toLowerCase()}${next.manifestId ? ` (${next.manifestId})` : ''}.`);
      if (next.stage === 4) pushNotification({ title: `${label} handed over`, body: `Batch received by ${CATEGORY_META[cat as keyof typeof CATEGORY_META].recycler}.`, level: 'success' });
    } catch {
      toast('Could not update the batch. Try again.', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Waste & recycling" description={`${totalItems} recovered items, ${Math.round(totalKg).toLocaleString()} kg, tracked from the seabed to the recycler.`} />

      <section className="panel mb-4 overflow-x-auto" aria-label="Post-recovery workflow">
        <ol className="flex min-w-[760px] items-stretch">
          {WASTE_STAGES.map((s, i) => {
            const here = records.filter((r) => r.items > 0 && r.stage === i);
            const items = here.reduce((a, r) => a + r.items, 0);
            const kg = here.reduce((a, r) => a + r.weightKg, 0);
            const done = records.filter((r) => r.items > 0).every((r) => r.stage > i);
            const active = items > 0;
            return (
              <li key={s} className="relative flex flex-1 items-stretch">
                <div className={cn('flex-1 px-4 py-3.5', active && 'bg-sonar/[0.06]')}>
                  <p className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-[0.14em]">
                    <span className={cn('flex h-[18px] w-[18px] items-center justify-center rounded-full border text-[10px]', done ? 'border-teal bg-teal text-abyss' : active ? 'border-sonar text-sonar' : 'border-line2 text-dim')}>
                      {done ? <Check size={10} strokeWidth={3} /> : i + 1}
                    </span>
                    <span className={active || done ? 'text-ink' : 'text-dim'}>{s}</span>
                  </p>
                  <p className="num mt-2 font-display text-[26px] font-semibold leading-none">{items}<span className="ml-1 text-xs font-normal text-mute">items</span></p>
                  <p className="num mt-1 text-2xs text-dim">{items > 0 ? `${Math.round(kg)} kg · ${here.length} categor${here.length > 1 ? 'ies' : 'y'}` : done ? 'cleared' : 'none waiting'}</p>
                </div>
                {i < WASTE_STAGES.length - 1 && <ChevronRight size={16} className="my-auto -mx-2 z-10 shrink-0 text-line2" aria-hidden />}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label="Categories" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {records.map((r) => (
          <WasteCategoryCard key={r.category} record={r} busy={busy === r.category} onAdvance={() => advance(r.category, r.stage)} />
        ))}
      </section>

      <Panel title="Recovered items" subtitle="Most recent first" className="mt-4" bodyClassName="p-0">
        {recovered.length === 0 ? (
          <EmptyState title="Nothing recovered yet" body="Items appear here once a recovery mission marks them recovered." />
        ) : (
          <div className="max-h-[340px] overflow-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-panel text-left text-xs text-dim">
                <tr>{['ID', 'Type', 'Category', 'Weight', 'Depth', 'Recycler'].map((h) => <th key={h} className="border-b border-line px-4 py-2 font-normal">{h}</th>)}</tr>
              </thead>
              <tbody>
                {recovered.slice(0, 40).map((d) => (
                  <tr key={d.id} className="border-b border-line/60 last:border-0 hover:bg-raised">
                    <td className="px-4 py-2 font-mono text-xs text-mute">{d.id}</td>
                    <td className="px-4 py-2"><TypeChip type={d.type} /></td>
                    <td className="px-4 py-2 text-mute">{CATEGORY_META[TYPE_META[d.type].category].label}</td>
                    <td className="num px-4 py-2">{d.weightKg} kg</td>
                    <td className="num px-4 py-2">{d.depth} m</td>
                    <td className="px-4 py-2 text-mute">{CATEGORY_META[TYPE_META[d.type].category].recycler}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
