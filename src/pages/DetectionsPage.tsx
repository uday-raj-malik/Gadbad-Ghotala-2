import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ClipboardCheck, Download, Route, X } from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { exportCsv } from '@/services/reportService';
import { HAZARD_META, STATUS_META, TYPE_META, TYPE_ORDER } from '@/lib/meta';
import { cn } from '@/lib/utils';
import type { DetectionStatus, Hazard, WasteType } from '@/types';
import PageHeader from '@/components/ui/PageHeader';
import Panel from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import DetectionTable, { type Sort, type SortKey } from '@/components/detections/DetectionTable';
import DetectionDetailPanel from '@/components/detections/DetectionDetailPanel';
import { useFocusOn } from '@/hooks/useFocusOn';

const PAGE = 15;
const TABS: { key: 'all' | DetectionStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'review', label: 'Needs review' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'recovered', label: 'Recovered' },
  { key: 'rejected', label: 'Rejected' },
];
const HAZ_RANK = { low: 1, medium: 2, high: 3 } as const;

export default function DetectionsPage() {
  const { detections, search, setSearch, setStatusBulk, addToMission, toast, settings } = useApp();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'all' | DetectionStatus>((params.get('status') as DetectionStatus | null) ?? 'all');
  const [type, setType] = useState<'all' | WasteType>('all');
  const [hazard, setHazard] = useState<'all' | Hazard>('all');
  const [minConf, setMinConf] = useState(0);
  const [maxDepth, setMaxDepth] = useState(30);
  const [days, setDays] = useState<'all' | '1' | '7'>('all');
  const [sort, setSort] = useState<Sort>({ key: 'detectedAt', dir: 'desc' });
  const [page, setPage] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [queue, setQueue] = useState<string[] | null>(null);
  const openId = params.get('id');

  useEffect(() => setPage(0), [tab, type, hazard, minConf, maxDepth, days, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: detections.length };
    for (const d of detections) c[d.status] = (c[d.status] ?? 0) + 1;
    return c;
  }, [detections]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff = days === 'all' ? 0 : Date.now() - Number(days) * 86400000;
    const list = detections.filter((d) =>
      (tab === 'all' || d.status === tab) &&
      (type === 'all' || d.type === type) &&
      (hazard === 'all' || d.hazard === hazard) &&
      d.confidence >= minConf &&
      d.depth <= maxDepth &&
      +new Date(d.detectedAt) >= cutoff &&
      (!q || `${d.id} ${TYPE_META[d.type].label} ${d.zone} ${d.status} ${d.hazard}`.toLowerCase().includes(q)),
    );
    const dir = sort.dir === 'asc' ? 1 : -1;
    const val = (d: (typeof list)[number]): number | string =>
      sort.key === 'hazard' ? HAZ_RANK[d.hazard] : sort.key === 'detectedAt' ? +new Date(d.detectedAt) : sort.key === 'type' ? TYPE_META[d.type].label : d[sort.key];
    return list.sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === 'string' ? x.localeCompare(String(y)) : x - (y as number)) * dir;
    });
  }, [detections, tab, type, hazard, minConf, maxDepth, days, search, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const view = rows.slice(page * PAGE, page * PAGE + PAGE);
  const open = detections.find((d) => d.id === openId) ?? null;
  useFocusOn(open);
  const filtersOn = tab !== 'all' || type !== 'all' || hazard !== 'all' || minConf > 0 || maxDepth < 30 || days !== 'all' || !!search;

  const setOpen = (id: string | null) => {
    const p = new URLSearchParams(params);
    if (id) p.set('id', id); else p.delete('id');
    setParams(p, { replace: true });
  };
  const onSort = (k: SortKey) => setSort((s) => (s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: k === 'id' || k === 'type' ? 'asc' : 'desc' }));
  const toggle = (id: string) => setChecked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = (on: boolean) => setChecked(on ? new Set(view.map((d) => d.id)) : new Set());
  const clear = () => { setTab('all'); setType('all'); setHazard('all'); setMinConf(0); setMaxDepth(30); setDays('all'); setSearch(''); };

  const startQueue = () => {
    const ids = detections.filter((d) => d.status === 'review').sort((a, b) => b.hazardScore - a.hazardScore).map((d) => d.id);
    if (!ids.length) { toast('No detections are waiting for review.', 'info'); return; }
    setQueue(ids);
    setOpen(ids[0]);
  };
  const next = () => {
    if (!queue) return;
    const left = queue.filter((id) => id !== openId && detections.find((d) => d.id === id)?.status === 'review');
    if (left.length) { setQueue(left); setOpen(left[0]); }
    else { setQueue(null); setOpen(null); toast('Review queue complete.'); }
  };
  const queueLeft = queue ? queue.filter((id) => id !== openId && detections.find((d) => d.id === id)?.status === 'review').length : undefined;

  const bulk = async (status: DetectionStatus) => {
    const ids = [...checked];
    await setStatusBulk(ids, status);
    toast(`${ids.length} detection${ids.length > 1 ? 's' : ''} marked ${STATUS_META[status].label.toLowerCase()}.`);
    setChecked(new Set());
  };

  return (
    <>
      <PageHeader
        title="Detections"
        description={`Model output is auto-confirmed at ${settings.autoConfirm}% or higher. Anything between ${settings.reviewLow}% and ${settings.autoConfirm}%, and all detections below ${settings.reviewLow}%, wait for a human decision.`}
        actions={
          <>
            <Button onClick={async () => { const n = await exportCsv(rows); toast(`Exported ${rows.length} rows to ${n}.`); }}><Download size={14} aria-hidden />Export CSV</Button>
            <Button variant="primary" onClick={startQueue}><ClipboardCheck size={14} aria-hidden />Start review queue ({counts.review ?? 0})</Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap gap-1 border-b border-line" role="tablist" aria-label="Filter by status">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn('-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] transition-colors', tab === t.key ? 'border-sonar text-ink' : 'border-transparent text-mute hover:text-ink')}
          >
            {t.label}
            <span className={cn('num rounded px-1.5 text-2xs', t.key === 'review' && (counts.review ?? 0) > 0 ? 'bg-hz-med/15 text-hz-med' : 'bg-raised text-dim')}>{counts[t.key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Field label="Waste type">
          <select className="field" value={type} onChange={(e) => setType(e.target.value as 'all' | WasteType)}>
            <option value="all">All types</option>
            {TYPE_ORDER.map((t) => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
          </select>
        </Field>
        <Field label="Hazard">
          <select className="field" value={hazard} onChange={(e) => setHazard(e.target.value as 'all' | Hazard)}>
            <option value="all">All hazards</option>
            {(['high', 'medium', 'low'] as Hazard[]).map((h) => <option key={h} value={h}>{HAZARD_META[h].label}</option>)}
          </select>
        </Field>
        <Field label={`Min confidence: ${minConf}%`}>
          <input type="range" min={0} max={95} step={5} value={minConf} onChange={(e) => setMinConf(+e.target.value)} className="h-8 w-36" aria-label="Minimum confidence" />
        </Field>
        <Field label={`Max depth: ${maxDepth >= 30 ? 'any' : maxDepth + ' m'}`}>
          <input type="range" min={5} max={30} step={1} value={maxDepth} onChange={(e) => setMaxDepth(+e.target.value)} className="h-8 w-36" aria-label="Maximum depth" />
        </Field>
        <Field label="Detected">
          <select className="field" value={days} onChange={(e) => setDays(e.target.value as 'all' | '1' | '7')}>
            <option value="all">Any time</option>
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
          </select>
        </Field>
        {filtersOn && <Button variant="ghost" onClick={clear}><X size={13} aria-hidden />Reset filters</Button>}
        <p className="num ml-auto pb-2 text-xs text-dim">{rows.length} of {detections.length} detections</p>
      </div>

      {checked.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-sonar/40 bg-sonar/10 px-3 py-2" role="region" aria-label="Bulk actions">
          <span className="text-[13px]">{checked.size} selected</span>
          <Button size="sm" variant="success" onClick={() => bulk('confirmed')}>Confirm</Button>
          <Button size="sm" variant="danger" onClick={() => bulk('rejected')}>Reject</Button>
          <Button size="sm" onClick={() => { addToMission([...checked]); toast(`${checked.size} added to the recovery mission.`); setChecked(new Set()); }}><Route size={13} aria-hidden />Add to mission</Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setChecked(new Set())}>Clear</Button>
        </div>
      )}

      <Panel bodyClassName="p-0">
        {rows.length === 0 ? (
          <EmptyState title="No detections match" body="Loosen the filters or clear the search to see more results." action={<Button onClick={clear}>Reset filters</Button>} />
        ) : (
          <DetectionTable rows={view} sort={sort} onSort={onSort} selected={checked} onToggle={toggle} onToggleAll={toggleAll} onOpen={setOpen} activeId={openId} />
        )}
        {rows.length > 0 && (
          <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-mute">
            <span className="num">{page * PAGE + 1}–{Math.min(rows.length, page * PAGE + PAGE)} of {rows.length}</span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft size={14} /></Button>
              <span className="num px-1">{page + 1} / {pages}</span>
              <Button size="sm" variant="ghost" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight size={14} /></Button>
            </div>
          </div>
        )}
      </Panel>

      {open && (
        <DetectionDetailPanel
          detection={open}
          onClose={() => { setOpen(null); setQueue(null); }}
          queueLeft={queueLeft}
          onNext={queue ? next : undefined}
          onDecided={queue ? () => setTimeout(next, 250) : undefined}
        />
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
