import { Link, NavLink } from 'react-router-dom';
import { BarChart3, Box, Crosshair, LayoutDashboard, Radar, Recycle, Route, Settings, Waves, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/store/AppStore';
import { APP, appPath } from '@/lib/routes';

interface Item {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export default function Sidebar() {
  const { detections } = useApp();
  const pending = detections.filter((d) => d.status === 'review').length;
  const items: Item[] = [
    { to: appPath(''), label: 'Overview', icon: LayoutDashboard },
    { to: appPath('/sonar'), label: 'Sonar Analysis', icon: Radar },
    { to: appPath('/detections'), label: 'Detections', icon: Crosshair, badge: pending },
    { to: appPath('/map'), label: '3D Seabed Map', icon: Box },
    { to: appPath('/recovery'), label: 'Recovery Planning', icon: Route },
    { to: appPath('/waste'), label: 'Waste & Recycling', icon: Recycle },
    { to: appPath('/reports'), label: 'Reports', icon: BarChart3 },
    { to: appPath('/settings'), label: 'Settings', icon: Settings },
  ];
  return (
    <aside className="flex w-14 shrink-0 flex-col border-r border-white/10 bg-[#06142a]/85 backdrop-blur lg:w-[236px]" aria-label="Primary">
      <Link to="/" className="flex h-14 items-center gap-2.5 border-b border-white/10 px-3.5 transition-colors hover:bg-white/5" title="Back to the overview shell" aria-label="JalNiriksh AI, back to the overview shell">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/10 text-[#bfe6ff]">
          <Waves size={16} aria-hidden />
        </span>
        <div className="hidden min-w-0 lg:block">
          <p className="font-display text-[17px] font-semibold leading-tight tracking-tight">JalNiriksh<span className="ml-1 font-light text-[#9fdcf2]">AI</span></p>
          <p className="text-2xs leading-tight text-dim">Underwater Waste Intelligence</p>
        </div>
      </Link>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Main navigation">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === APP}
            title={it.label}
            className={({ isActive }) =>
              cn(
                'relative flex h-9 items-center gap-2.5 rounded px-2.5 text-[13px] transition-colors',
                isActive ? 'bg-sonar/10 text-sonar' : 'text-mute hover:bg-raised hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute inset-y-1.5 -left-2 w-[3px] rounded-r bg-sonar" aria-hidden />}
                <it.icon size={16} className="shrink-0" aria-hidden />
                <span className="hidden flex-1 truncate lg:block">{it.label}</span>
                {!!it.badge && (
                  <span className="num hidden rounded bg-hz-med/15 px-1.5 text-2xs text-hz-med lg:block" aria-label={`${it.badge} pending`}>
                    {it.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-2 border-t border-line p-3">
        <div className="hidden space-y-1.5 text-xs lg:block" aria-label="System status">
          <StatusRow label="AI Engine Online" />
          <StatusRow label="Sonar Feed Connected" />
        </div>
        <div className="flex justify-center gap-1 lg:hidden" aria-hidden>
          <span className="h-2 w-2 rounded-full bg-hz-low" />
          <span className="h-2 w-2 rounded-full bg-hz-low" />
        </div>
        <div className="flex items-center gap-2.5 border-t border-line pt-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line2 bg-raised text-xs font-medium">AR</span>
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-[13px] leading-tight">A. Rao</p>
            <p className="truncate text-2xs leading-tight text-dim">Survey operator</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function StatusRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-mute">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ring rounded-full bg-hz-low/60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-hz-low" />
      </span>
      {label}
    </div>
  );
}
