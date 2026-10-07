import { useMemo } from 'react';
import type { Detection } from '@/types';
import { bathymetryDataUrl } from '@/lib/bathymetry';
import { MAP_H, MAP_W } from '@/lib/geo';
import { HAZARD_META } from '@/lib/meta';

const HEAT = { high: '#FF5A5F', medium: '#F6A623', low: '#46D6C8' } as const;

/** Abstract harbour map: dimmed bathymetry, density glow per detection, and hazard-coloured points. */
export default function HeatmapPreview({ detections }: { detections: Detection[] }) {
  const img = useMemo(() => bathymetryDataUrl(), []);
  const open = useMemo(() => detections.filter((d) => d.status !== 'rejected' && d.status !== 'recovered'), [detections]);
  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full" role="img" aria-label={`Heatmap of ${open.length} open waste detections in the survey area`}>
      <defs>
        {(['high', 'medium', 'low'] as const).map((h) => (
          <radialGradient key={h} id={`heat-${h}`}>
            <stop offset="0" stopColor={HEAT[h]} stopOpacity="0.62" />
            <stop offset="0.55" stopColor={HEAT[h]} stopOpacity="0.18" />
            <stop offset="1" stopColor={HEAT[h]} stopOpacity="0" />
          </radialGradient>
        ))}
        <clipPath id="hm-clip"><rect width={MAP_W} height={MAP_H} /></clipPath>
      </defs>
      <g clipPath="url(#hm-clip)">
        <image href={img} width={MAP_W} height={MAP_H} preserveAspectRatio="none" opacity={0.7} />
        <rect width={MAP_W} height={MAP_H} fill="#041a3a" opacity={0.28} />
        <g stroke="#cfeaff" strokeOpacity={0.09} vectorEffect="non-scaling-stroke">
          {Array.from({ length: 9 }, (_, i) => <line key={`x${i}`} x1={(i + 1) * 100} x2={(i + 1) * 100} y1={0} y2={MAP_H} />)}
          {Array.from({ length: 7 }, (_, i) => <line key={`y${i}`} y1={(i + 1) * 100} y2={(i + 1) * 100} x1={0} x2={MAP_W} />)}
        </g>
        <path d="M0 0 H46 C60 120 34 220 52 330 C66 440 40 560 58 680 C66 740 50 780 44 800 H0 Z" fill="#0b1a2c" fillOpacity={0.9} stroke="#8fb6d0" strokeOpacity={0.5} />
        <path d="M52 330 L196 376" stroke="#cfe6f5" strokeWidth={4} strokeLinecap="round" opacity={0.7} />
        <g style={{ mixBlendMode: 'screen' }}>
          {open.map((d) => (
            <circle key={`h${d.id}`} cx={d.u * MAP_W} cy={d.v * MAP_H} r={34 + d.hazardScore * 0.7} fill={`url(#heat-${d.hazard})`} />
          ))}
        </g>
        {open.map((d) => (
          <circle key={d.id} cx={d.u * MAP_W} cy={d.v * MAP_H} r={d.hazard === 'high' ? 5.5 : 3.6} fill={HAZARD_META[d.hazard].color} stroke="#fff" strokeOpacity={0.85} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    </svg>
  );
}
