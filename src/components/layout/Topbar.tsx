import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, MapPin, Search, X } from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { cn, timeAgo } from '@/lib/utils';
import { appPath } from '@/lib/routes';
import { BOUNDS } from '@/lib/geo';

const LEVEL = { info: '#2FD3E6', warning: '#F6A623', success: '#3FD98F' } as const;

export default function Topbar() {
  const { survey, search, setSearch, notifications, markAllRead, focus } = useApp();
  // with nothing selected, show the survey reference position (centre of the surveyed area)
  const pos = focus ? { lat: focus.latitude, lon: focus.longitude } : { lat: (BOUNDS.north + BOUNDS.south) / 2, lon: (BOUNDS.east + BOUNDS.west) / 2 };
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const onSearch = (v: string) => {
    setSearch(v);
    if (v && loc.pathname !== appPath('/detections')) nav(appPath('/detections'));
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-[#06142a]/70 px-4 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2.5">
        <MapPin size={16} className="shrink-0 text-sonar" aria-hidden />
        <div className="min-w-0">
          <p className="truncate font-display text-[14px] font-semibold uppercase leading-tight tracking-[0.12em]">{survey?.harbour ?? 'Loading…'}</p>
          <p className="num truncate text-2xs leading-tight tracking-[0.14em] text-dim">{survey ? `SURVEY #${survey.id}` : '…'}</p>
        </div>
      </div>

      <div className="relative mx-auto hidden w-full max-w-md md:block">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search detections by ID, type, zone…"
          aria-label="Search detections"
          className="field w-full pl-8 pr-8"
        />
        {search && (
          <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-dim hover:text-ink">
            <X size={13} />
          </button>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden items-center gap-4 border-x border-white/10 px-4 xl:flex" aria-label={`Position readout${focus?.label ? ' for ' + focus.label : ''}`} aria-live="off">
          <Readout k="LAT" v={`${pos.lat.toFixed(4)}° N`} />
          <Readout k="LON" v={`${pos.lon.toFixed(4)}° E`} />
          <Readout k="DEPTH" v={focus ? `${focus.depth.toFixed(1)} m` : '— m'} accent />
          {focus?.label && <span className="num rounded bg-sonar/10 px-1.5 py-0.5 text-2xs text-sonar">{focus.label}</span>}
        </div>
        <div className="hidden text-right 2xl:block">
          <p className="text-2xs leading-tight tracking-[0.12em] text-dim">STATUS</p>
          <p className="flex items-center justify-end gap-1.5 text-[12.5px] font-medium leading-tight text-hz-low">
            <span className="h-1.5 w-1.5 rounded-full bg-hz-low" aria-hidden />Operational
          </p>
        </div>

        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={`Notifications, ${unread} unread`}
            aria-expanded={open}
            className="relative flex h-8 w-8 items-center justify-center rounded text-mute hover:bg-raised hover:text-ink"
          >
            <Bell size={16} />
            {unread > 0 && <span className="num absolute right-0.5 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-hz-high px-1 text-[9px] font-semibold text-white">{unread}</span>}
          </button>
          {open && (
            <div className="glass absolute right-0 top-10 z-50 w-[340px] animate-slidein shadow-xl" role="dialog" aria-label="Notifications">
              <div className="flex items-center justify-between border-b border-line px-3 py-2">
                <span className="text-[13px] font-medium">Notifications</span>
                <button onClick={markAllRead} className="text-xs text-sonar hover:underline">Mark all read</button>
              </div>
              <ul className="max-h-80 overflow-y-auto">
                {notifications.map((n) => (
                  <li key={n.id} className={cn('flex gap-2.5 border-b border-line/60 px-3 py-2.5 last:border-0', !n.read && 'bg-sonar/5')}>
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: LEVEL[n.level] }} aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[13px] leading-snug">{n.title}</p>
                      <p className="text-xs text-mute">{n.body}</p>
                      <p className="mt-0.5 text-2xs text-dim">{timeAgo(n.at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <button className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-raised" aria-label="User profile: A. Rao">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-line2 bg-raised text-xs font-medium">AR</span>
          <span className="hidden text-[13px] xl:inline">A. Rao</span>
          <ChevronDown size={13} className="hidden text-dim xl:block" aria-hidden />
        </button>
      </div>
    </header>
  );
}

function Readout({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="leading-tight">
      <p className="text-[9.5px] tracking-[0.18em] text-dim">{k}</p>
      <p className={'num font-mono text-[12.5px] ' + (accent ? 'text-sonar' : 'text-ink')}>{v}</p>
    </div>
  );
}
