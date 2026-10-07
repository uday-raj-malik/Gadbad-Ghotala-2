import { useEffect, useRef } from 'react';
import type { Detection } from '@/types';
import { hashString } from '@/lib/random';
import { renderPatch, type PatchMode } from '@/lib/sonarRender';

export default function SonarPatch({ detection, mode, label }: { detection: Detection; mode: PatchMode; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) renderPatch(ref.current, detection.type, hashString(detection.id), mode, detection.sizeM * 0.7 * detection.shadowScore + 0.6);
  }, [detection.id, detection.type, detection.sizeM, detection.shadowScore, mode]);
  return (
    <figure className="min-w-0">
      <canvas ref={ref} className="aspect-[11/8] w-full rounded border border-line" role="img" aria-label={`${label} for ${detection.id}`} />
      <figcaption className="mt-1 text-2xs text-dim">{label}</figcaption>
    </figure>
  );
}
