import { ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { useApp } from '@/store/AppStore';
import { WORKFLOW } from '@/lib/meta';
import { buildWasteRecords } from '@/services/wasteService';
import { useNavigate } from 'react-router-dom';
import { appPath } from '@/lib/routes';

const ROUTES = ['/sonar', '/sonar', '/detections', '/map', '/detections', '/recovery', '/waste', '/waste'].map((p) => appPath(p));

/** The product story as a live pipeline: every step shows a real count from the store. */
export default function WorkflowStrip() {
  const { detections, survey, wasteStages } = useApp();
  const nav = useNavigate();
  const steps = useMemo(() => {
    const active = detections.filter((d) => d.status !== 'rejected');
    const recs = buildWasteRecords(detections, wasteStages);
    const sorted = recs.filter((r) => r.stage >= 1).reduce((a, r) => a + r.items, 0);
    const handed = recs.filter((r) => r.stage >= 4).reduce((a, r) => a + r.items, 0);
    return [
      { value: survey?.scansProcessed ?? 0, unit: 'scans' },
      { value: active.length, unit: 'objects' },
      { value: detections.filter((d) => d.status === 'review').length, unit: 'in review' },
      { value: active.length, unit: 'geolocated' },
      { value: active.filter((d) => d.hazard === 'high' && d.status !== 'recovered').length, unit: 'high priority' },
      { value: detections.filter((d) => d.status === 'recovered').length, unit: 'recovered' },
      { value: sorted, unit: 'sorted' },
      { value: handed, unit: 'handed over' },
    ];
  }, [detections, survey, wasteStages]);

  return (
    <nav aria-label="JalNiriksh workflow" className="panel overflow-x-auto">
      <ol className="flex min-w-[880px] items-stretch">
        {WORKFLOW.map((label, i) => (
          <li key={label} className="flex flex-1 items-stretch">
            <button onClick={() => nav(ROUTES[i])} className="group flex-1 px-3 py-2.5 text-left transition-colors hover:bg-raised">
              <div className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-dim">
                <span className="num text-sonar">{String(i + 1).padStart(2, '0')}</span>
                <span className="truncate">{label}</span>
              </div>
              <p className="mt-1 flex items-baseline gap-1">
                <span className="num text-lg font-semibold leading-none">{steps[i].value}</span>
                <span className="text-xs text-mute">{steps[i].unit}</span>
              </p>
            </button>
            {i < WORKFLOW.length - 1 && <ChevronRight size={14} className="my-auto shrink-0 text-line2" aria-hidden />}
          </li>
        ))}
      </ol>
    </nav>
  );
}
