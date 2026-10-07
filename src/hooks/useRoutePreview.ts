import { useEffect, useRef, useState } from 'react';
import type { RecoveryMission } from '@/types';
import { useApp } from '@/store/AppStore';
import { generateRoute } from '@/services/recoveryService';

/**
 * Returns the mission the planner generated, or, until one exists, a route computed by the same
 * recoveryService from the current mission selection. Maps use it so the route is always visible.
 * It never writes to the store, so the planner's "Generate Optimal Route" step stays meaningful.
 */
export function useRoutePreview(): { route: RecoveryMission | null; isPreview: boolean } {
  const { mission, missionIds, detections, settings } = useApp();
  const [preview, setPreview] = useState<RecoveryMission | null>(null);
  const seq = useRef(0);
  const key = missionIds.join('|');

  useEffect(() => {
    if (mission || missionIds.length === 0 || detections.length === 0) { setPreview(null); return; }
    const mine = ++seq.current;
    generateRoute(missionIds, detections, settings.vesselSpeedKn)
      .then((m) => { if (mine === seq.current) setPreview(m); })
      .catch(() => { if (mine === seq.current) setPreview(null); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission, key, detections.length, settings.vesselSpeedKn]);

  return mission ? { route: mission, isPreview: false } : { route: preview, isPreview: true };
}
