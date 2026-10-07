import { AlertTriangle, ArrowUpRight, Check, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Detection } from '@/types';
import { useApp } from '@/store/AppStore';
import { fmtLat, fmtLon } from '@/lib/geo';
import { HAZARD_META, TYPE_META } from '@/lib/meta';
import { appPath } from '@/lib/routes';
import HazardBadge from '../ui/HazardBadge';
import TypeGlyph from './TypeGlyph';

function recommended(d: Detection): { action: string; note?: string } {
  if (d.status === 'recovered') return { action: 'None', note: 'Already recovered' };
  if (d.status === 'rejected') return { action: 'None', note: 'Rejected as a false positive' };
  if (d.hazard === 'high') return { action: 'Recover', note: d.status === 'review' ? 'Pending human sign-off' : 'Priority recovery' };
  if (d.hazard === 'medium') return { action: 'Recover', note: 'Schedule within the next mission' };
  return { action: 'Batch with nearby recoveries', note: 'Low hazard' };
}

/** The card anchored to a selected seabed marker. Positioned by Seabed3D; content and actions live here. */
export default function ObjectCallout({ detection: d, onClose }: { detection: Detection; onClose: () => void }) {
  const { missionIds, addToMission, toast } = useApp();
  const nav = useNavigate();
  const inPlan = missionIds.includes(d.id);
  const rec = recommended(d);
  const hz = HAZARD_META[d.hazard].color;
  const closed = d.status === 'recovered' || d.status === 'rejected';

  return (
    <div className="animate-slidein overflow-hidden rounded-lg border border-white/20 bg-[#06142a]/92 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.75)] backdrop-blur-md" role="dialog" aria-label={`${TYPE_META[d.type].label} ${d.id}`}>
      <div className="h-[3px]" style={{ background: hz }} aria-hidden />
      <div className="px-4 pb-3 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-display text-[17px] font-semibold uppercase leading-tight tracking-wide">
              <svg width="18" height="18" viewBox="-9 -9 18 18" aria-hidden className="shrink-0"><TypeGlyph type={d.type} color={TYPE_META[d.type].color} size={7} /></svg>
              <span className="truncate">{TYPE_META[d.type].label} #{d.id}</span>
            </p>
            <p className="num mt-0.5 text-2xs text-dim">{fmtLat(d.latitude)} · {fmtLon(d.longitude)}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 rounded p-1 text-dim hover:bg-white/10 hover:text-ink"><X size={15} /></button>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
          <div><dt className="label">Depth</dt><dd className="num text-[19px] font-semibold leading-tight">{d.depth.toFixed(1)}<span className="ml-0.5 text-xs font-normal text-mute">m</span></dd></div>
          <div><dt className="label">Detection confidence</dt><dd className="num text-[19px] font-semibold leading-tight">{Math.round(d.confidence)}<span className="ml-0.5 text-xs font-normal text-mute">%</span></dd></div>
          <div><dt className="label">Error radius</dt><dd className="num text-[19px] font-semibold leading-tight">±{d.errorRadius.toFixed(1)}<span className="ml-0.5 text-xs font-normal text-mute">m</span></dd></div>
          <div><dt className="label">Hazard</dt><dd className="mt-0.5"><HazardBadge hazard={d.hazard} /></dd></div>
        </dl>

        {d.status === 'review' && (
          <button
            onClick={() => nav(appPath(`/detections?id=${d.id}`))}
            className="mt-3 flex w-full items-center gap-2 rounded border border-hz-med/45 bg-hz-med/10 px-2.5 py-1.5 text-left text-xs text-hz-med transition-colors hover:bg-hz-med/20"
          >
            <AlertTriangle size={13} className="shrink-0" aria-hidden />
            <span className="flex-1 font-medium">Needs human review</span>
            <span className="inline-flex items-center gap-0.5 text-2xs">Review <ArrowUpRight size={11} aria-hidden /></span>
          </button>
        )}

        <div className="mt-3 border-t border-white/10 pt-2.5">
          <p className="label">Recommended action</p>
          <p className="mt-0.5 font-display text-[19px] font-semibold leading-tight" style={{ color: closed ? '#93ABBE' : d.hazard === 'high' ? '#FF7A7F' : '#E6F1F7' }}>{rec.action}</p>
          {rec.note && <p className="text-2xs text-dim">{rec.note}</p>}
        </div>

        <button
          disabled={inPlan || closed}
          onClick={() => { addToMission([d.id]); toast(`${d.id} added to the recovery plan.`); }}
          className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded bg-sonar text-[12.5px] font-semibold uppercase tracking-wider text-abyss transition-colors hover:bg-sonar-soft disabled:cursor-not-allowed disabled:bg-sonar/20 disabled:text-sonar"
        >
          {inPlan ? <Check size={14} aria-hidden /> : <Plus size={14} aria-hidden />}
          {inPlan ? 'In recovery plan' : 'Add to recovery plan'}
        </button>
      </div>
    </div>
  );
}
