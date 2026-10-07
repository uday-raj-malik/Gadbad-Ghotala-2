import type { WasteType } from '@/types';

/** Marker shape per waste type, drawn around (0,0). Shape + colour keep categories legible without labels. */
export default function TypeGlyph({ type, color, size = 7, opacity = 1 }: { type: WasteType; color: string; size?: number; opacity?: number }) {
  const s = size;
  const common = { fill: color, fillOpacity: 0.28 * opacity, stroke: color, strokeOpacity: opacity, strokeWidth: 1.4 };
  switch (type) {
    case 'ghost-net':
      return <path d={`M0 ${-s * 1.15} L${s * 1.15} 0 L0 ${s * 1.15} L${-s * 1.15} 0 Z M${-s * 0.5} 0 H${s * 0.5} M0 ${-s * 0.5} V${s * 0.5}`} {...common} />;
    case 'plastic':
      return <circle r={s} {...common} />;
    case 'tyre':
      return (
        <g>
          <circle r={s} {...common} />
          <circle r={s * 0.38} fill="none" stroke={color} strokeOpacity={opacity} strokeWidth={1.2} />
        </g>
      );
    case 'drum':
      return <rect x={-s * 0.85} y={-s * 0.85} width={s * 1.7} height={s * 1.7} rx={1.5} {...common} />;
    default:
      return <path d={`M0 ${-s * 1.1} L${s} ${s * 0.8} L${-s} ${s * 0.8} Z`} {...common} />;
  }
}
