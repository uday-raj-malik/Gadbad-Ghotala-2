import type { Detection, MapObject } from '@/types';
import { TYPE_META } from './meta';

export function toMapObject(d: Detection): MapObject {
  return {
    id: d.id,
    label: `${TYPE_META[d.type].label} #${d.num}`,
    type: d.type,
    u: d.u,
    v: d.v,
    depth: d.depth,
    hazard: d.hazard,
    status: d.status,
    errorRadius: d.errorRadius,
  };
}

/**
 * Objects for operational maps. Rejected detections are false positives and never appear. Recovered objects
 * are no longer on the seabed, so they are hidden unless `includeRecovered` is set.
 */
export function toMapObjects(ds: Detection[], opts: { includeRecovered?: boolean } = {}): MapObject[] {
  return ds.filter((d) => d.status !== 'rejected' && (opts.includeRecovered || d.status !== 'recovered')).map(toMapObject);
}
