import { useApp } from '@/store/AppStore';
import { LANE_COUNT } from '@/lib/meta';
import { timeAgo } from '@/lib/utils';

/** Thin nautical status line: datum, units, sensor and survey coverage. */
export default function StatusBar() {
  const { survey, scans } = useApp();
  const lanes = Math.min(LANE_COUNT, new Set(scans.map((s) => s.lane)).size);
  const pct = Math.round((lanes / LANE_COUNT) * 100);
  return (
    <footer className="num flex h-[26px] shrink-0 items-center gap-5 overflow-hidden whitespace-nowrap border-t border-white/10 bg-[#040b15]/90 px-4 text-2xs tracking-wide text-dim" aria-label="Survey status">
      <span>WGS 84</span>
      <span className="hidden lg:inline">DEPTH m · CHART DATUM</span>
      <span className="hidden xl:inline">SIDE-SCAN {survey?.frequencyKhz ?? 455} kHz · SWATH {scans[0]?.swathM ?? 150} m</span>
      <span className="ml-auto flex items-center gap-2">
        <span className="hidden md:inline">SURVEY COVERAGE</span>
        <span className="relative h-1 w-24 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Survey coverage">
          <span className="absolute inset-y-0 left-0 rounded-full bg-sonar" style={{ width: `${pct}%` }} />
        </span>
        <span className="text-mute">{lanes}/{LANE_COUNT} lanes · {pct}%</span>
      </span>
      <span className="hidden xl:inline">LAST SCAN {survey ? timeAgo(survey.lastScanAt).toUpperCase() : '—'}</span>
    </footer>
  );
}
