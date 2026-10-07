import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { Detection } from '@/types';
import { fmtDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import ConfidenceBadge from '../ui/ConfidenceBadge';
import HazardBadge from '../ui/HazardBadge';
import StatusBadge from '../ui/StatusBadge';
import TypeChip from '../ui/TypeChip';
import Button from '../ui/Button';

export type SortKey = 'id' | 'type' | 'confidence' | 'depth' | 'hazard' | 'status' | 'detectedAt';
export interface Sort { key: SortKey; dir: 'asc' | 'desc' }

interface Props {
  rows: Detection[];
  sort: Sort;
  onSort: (k: SortKey) => void;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onOpen: (id: string) => void;
  activeId?: string | null;
}

function Th({ label, k, sort, onSort, className }: { label: string; k?: SortKey; sort: Sort; onSort: (k: SortKey) => void; className?: string }) {
  const active = k && sort.key === k;
  return (
    <th scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined} className={cn('whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-mute', className)}>
      {k ? (
        <button onClick={() => onSort(k)} className="inline-flex items-center gap-1 hover:text-ink">
          {label}
          {active ? (sort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ChevronsUpDown size={11} className="text-dim" />}
        </button>
      ) : label}
    </th>
  );
}

export default function DetectionTable({ rows, sort, onSort, selected, onToggle, onToggleAll, onOpen, activeId }: Props) {
  const all = rows.length > 0 && rows.every((r) => selected.has(r.id));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-[13px]">
        <thead className="border-b border-line bg-deep/60">
          <tr>
            <th className="w-9 px-3 py-2"><input type="checkbox" aria-label="Select all rows on this page" checked={all} onChange={(e) => onToggleAll(e.target.checked)} className="accent-[#2FD3E6]" /></th>
            <Th label="ID" k="id" sort={sort} onSort={onSort} />
            <Th label="Type" k="type" sort={sort} onSort={onSort} />
            <Th label="Detection conf." k="confidence" sort={sort} onSort={onSort} />
            <Th label="Depth" k="depth" sort={sort} onSort={onSort} />
            <Th label="Latitude" sort={sort} onSort={onSort} />
            <Th label="Longitude" sort={sort} onSort={onSort} />
            <Th label="Hazard" k="hazard" sort={sort} onSort={onSort} />
            <Th label="Status" k="status" sort={sort} onSort={onSort} />
            <Th label="Detected at" k="detectedAt" sort={sort} onSort={onSort} />
            <Th label="Action" sort={sort} onSort={onSort} className="text-right" />
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr
              key={d.id}
              onClick={() => onOpen(d.id)}
              className={cn('cursor-pointer border-b border-line/70 transition-colors hover:bg-raised/60', activeId === d.id && 'bg-raised')}
            >
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" aria-label={`Select ${d.id}`} checked={selected.has(d.id)} onChange={() => onToggle(d.id)} className="accent-[#2FD3E6]" />
              </td>
              <td className="px-3 py-2 font-mono text-xs">{d.id}</td>
              <td className="px-3 py-2"><TypeChip type={d.type} /></td>
              <td className="px-3 py-2"><ConfidenceBadge value={d.confidence} /></td>
              <td className="num px-3 py-2">{d.depth.toFixed(1)} m</td>
              <td className="px-3 py-2 font-mono text-xs text-mute">{d.latitude.toFixed(5)}</td>
              <td className="px-3 py-2 font-mono text-xs text-mute">{d.longitude.toFixed(5)}</td>
              <td className="px-3 py-2"><HazardBadge hazard={d.hazard} compact /></td>
              <td className="px-3 py-2"><StatusBadge status={d.status} /></td>
              <td className="num whitespace-nowrap px-3 py-2 text-xs text-mute">{fmtDate(d.detectedAt)}</td>
              <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant={d.status === 'review' ? 'primary' : 'secondary'} onClick={() => onOpen(d.id)} aria-label={`${d.status === 'review' ? 'Review' : 'View'} ${d.id}`}>
                  {d.status === 'review' ? 'Review' : 'View'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
