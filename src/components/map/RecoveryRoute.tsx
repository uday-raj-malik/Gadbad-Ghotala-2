import { Anchor, ArrowDown, Flag, MapPin } from 'lucide-react';
import type { Detection, RecoveryMission } from '@/types';
import { MAP_H, MAP_W } from '@/lib/geo';
import { TYPE_META } from '@/lib/meta';
import { fmtDuration } from '@/lib/utils';
import HazardBadge from '../ui/HazardBadge';

/** The unoptimised path (jetty → selection order → quay), shown before a route has been generated. */
export function RoutePreviewOverlay({ points, k = 1 }: { points: { u: number; v: number }[]; k?: number }) {
  if (points.length < 2) return null;
  const pts = points.map((p) => `${p.u * MAP_W},${p.v * MAP_H}`).join(' ');
  return (
    <g pointerEvents="none">
      <polyline points={pts} fill="none" stroke="#050C16" strokeWidth={4.5} strokeLinejoin="round" opacity={0.6} />
      <polyline points={pts} fill="none" stroke="#93ABBE" strokeWidth={1.8} strokeDasharray="3 7" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
      {points.slice(1, -1).map((p, i) => (
        <g key={i} transform={`translate(${p.u * MAP_W} ${p.v * MAP_H}) scale(${1.45 / k})`}>
          <circle r={9} fill="#0B1827" stroke="#93ABBE" strokeWidth={1.3} />
          <text textAnchor="middle" dy="3.5" fontSize="10" fontWeight={600} fill="#B6C9D8">{i + 1}</text>
        </g>
      ))}
    </g>
  );
}

/** SVG overlay that draws a mission route on top of SeabedMap (same viewBox). The route draws itself, then dots flow along it. */
export function RouteOverlay({ mission, stale, k = 1, labels }: { mission: RecoveryMission; stale?: boolean; k?: number; labels?: Record<string, string> }) {
  const pts = mission.stops.map((s) => `${s.u * MAP_W},${s.v * MAP_H}`).join(' ');
  let n = 0;
  return (
    <g opacity={stale ? 0.35 : 1} pointerEvents="none" key={mission.id}>
      <polyline points={pts} fill="none" stroke="#050C16" strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" opacity={0.65} />
      <polyline points={pts} fill="none" stroke="#F6C453" strokeWidth={9} strokeLinejoin="round" strokeLinecap="round" opacity={0.16} />
      <polyline points={pts} pathLength={1} className="route-draw" fill="none" stroke="#F6C453" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={pts} fill="none" stroke="#fff" strokeWidth={3.4} strokeDasharray="0.1 15" strokeLinecap="round" strokeLinejoin="round" className="route-flow" opacity={0.95} style={{ animationDelay: '1.7s' }} />
      {mission.stops.slice(1).map((s, i) => {
        const p = mission.stops[i];
        const mx = ((p.u + s.u) / 2) * MAP_W;
        const my = ((p.v + s.v) / 2) * MAP_H;
        const ang = (Math.atan2((s.v - p.v) * MAP_H, (s.u - p.u) * MAP_W) * 180) / Math.PI;
        return <path key={i} d="M-6 -5 L6 0 L-6 5 Z" fill="#F6C453" stroke="#050C16" strokeWidth={1} transform={`translate(${mx} ${my}) rotate(${ang}) scale(${1.45 / k})`} />;
      })}
      {mission.stops.map((s, i) => {
        const isObj = s.kind === 'object';
        if (isObj) n += 1;
        const name = s.detectionId ? labels?.[s.detectionId] : undefined;
        return (
          <g key={i} transform={`translate(${s.u * MAP_W} ${s.v * MAP_H}) scale(${1.45 / k})`}>
            {isObj ? (
              <>
                <circle r={12} fill="#F6C453" stroke="#050C16" strokeWidth={1.8} />
                <text textAnchor="middle" dy="4" fontSize="12" fontWeight={700} fill="#050C16">{n}</text>
                {name && (
                  <g transform="translate(17 0)">
                    <rect x={-2} y={-9.5} width={name.length * 6 + 12} height={19} rx={3} fill="#050C16" fillOpacity={0.88} stroke="#F6C453" strokeOpacity={0.5} />
                    <text x={4} dy="3.8" fontSize="10.5" fill="#F8E7B8">{name}</text>
                  </g>
                )}
              </>
            ) : (
              <>
                <rect x={-27} y={-12} width={54} height={24} rx={5} fill="#07263a" stroke="#2FD3E6" strokeWidth={1.8} />
                <text textAnchor="middle" dy="4" fontSize="11" fontWeight={700} fill="#2FD3E6" letterSpacing="0.08em">{s.kind === 'start' ? 'START' : 'END'}</text>
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Vertical START → objects → END sequence with leg distance and running time. */
export default function RecoveryRoute({ mission, detections }: { mission: RecoveryMission; detections: Detection[] }) {
  let clock = 0;
  let n = 0;
  return (
    <ol className="relative" aria-label="Route stops">
      {mission.stops.map((s, i) => {
        const d = s.detectionId ? detections.find((x) => x.id === s.detectionId) : undefined;
        const last = i === mission.stops.length - 1;
        const isObj = s.kind === 'object';
        if (isObj) n += 1;
        clock += s.legMin;
        return (
          <li key={i} className="relative pl-12">
            {i > 0 && (
              <div className="relative -mb-px flex min-h-[34px] items-center pb-0.5">
                <span className="absolute -left-[31px] top-0 h-full w-0.5 bg-gradient-to-b from-[#F6C453]/70 to-[#F6C453]/70" aria-hidden />
                <span className="num rounded bg-raised px-1.5 py-0.5 text-2xs text-mute">{s.legKm.toFixed(1)} km · {fmtDuration(s.legMin)}</span>
              </div>
            )}
            <div className="relative pb-0.5">
              <span
                className={'absolute -left-12 top-0 flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 text-[12px] font-bold ' + (isObj ? 'border-[#050C16] bg-[#F6C453] text-[#050C16]' : 'border-sonar bg-[#07263a] text-sonar')}
              >
                {s.kind === 'start' ? <Anchor size={14} /> : s.kind === 'end' ? <Flag size={14} /> : n}
              </span>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-display text-[14px] font-semibold uppercase tracking-wide">
                  {d ? `${TYPE_META[d.type].label} #${d.num}` : s.kind === 'start' ? 'Start' : 'End'}
                </p>
                {d && <HazardBadge hazard={d.hazard} compact />}
              </div>
              <p className="num text-xs text-dim">
                {d ? <>{d.id} · {d.depth} m · +{fmtDuration(d.recoveryMinutes)} on site</> : <span className="inline-flex items-center gap-1"><MapPin size={11} />{s.label}</span>}
              </p>
              {i > 0 && <p className="num text-2xs text-sonar/80">T+{fmtDuration(clock)}</p>}
            </div>
            {!last && <ArrowDown size={12} className="absolute -left-[37px] -bottom-1 text-[#F6C453]" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
