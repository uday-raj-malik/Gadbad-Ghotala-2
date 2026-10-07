import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appPath } from '@/lib/routes';
import OceanShell from '@/components/shell/OceanShell';
import TopNavigation from '@/components/shell/TopNavigation';
import HeroSection from '@/components/shell/HeroSection';
import AnalyticsPanel from '@/components/shell/AnalyticsPanel';

/** Presentation environment. Everything operational is reached through `enter()`, which plays the transition first. */
export default function LandingPage() {
  const nav = useNavigate();
  const [waterY, setWaterY] = useState(300);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number>();

  const enter = useCallback(
    (path: string) => {
      if (leaving) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) { nav(path); return; }
      setLeaving(true);
      timer.current = window.setTimeout(() => nav(path), 720);
    },
    [leaving, nav],
  );
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <OceanShell
      waterY={waterY}
      leaving={leaving}
      nav={(scrolled, top) => <TopNavigation scrolled={scrolled} onEnter={enter} onTop={top} />}
    >
      <HeroSection onWaterline={setWaterY} onOpen={() => enter(appPath(''))} />
      <AnalyticsPanel onEnter={enter} />
    </OceanShell>
  );
}
