import { useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import StatusBar from './StatusBar';
import Toasts from '../ui/Toasts';
import { ErrorState, PageSkeleton } from '../ui/States';
import { useApp } from '@/store/AppStore';
import { appPath } from '@/lib/routes';
import { contourPath } from '@/lib/bathymetry';
import { MAP_H, MAP_W } from '@/lib/geo';

/** Faint real-bathymetry contours behind the operations UI. Same data as the maps. */
function ContourBackdrop() {
  const paths = useMemo(() => [6, 10, 14, 18, 22, 26, 30].map((l) => contourPath(l)), []);
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMidYMid slice" aria-hidden>
      {paths.map((d, i) => <path key={i} d={d} fill="none" stroke="#7fd0ea" strokeOpacity={i % 2 ? 0.05 : 0.08} strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
    </svg>
  );
}

export default function AppShell() {
  const { loading, error, retry } = useApp();
  const { pathname } = useLocation();
  const bleed = pathname === appPath('/map');
  return (
    <div className="ops-bg relative flex h-full min-w-[768px] animate-fadein">
      <ContourBackdrop />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[200] focus:rounded focus:bg-sonar focus:px-3 focus:py-1.5 focus:text-abyss">
        Skip to content
      </a>
      <Sidebar />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="main" className={cn('min-h-0 flex-1', bleed ? 'relative overflow-hidden' : 'overflow-y-auto p-4 xl:p-5')}>
          {loading ? <div className={bleed ? 'p-4' : ''}><PageSkeleton /></div> : error ? <ErrorState message={error} onRetry={retry} /> : <Outlet />}
        </main>
        <StatusBar />
      </div>
      <Toasts />
    </div>
  );
}
