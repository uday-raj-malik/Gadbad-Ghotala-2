export const BOUNDS = { north: 18.94, south: 18.9112, west: 72.85, east: 72.888 };
export const AREA = { widthKm: 4.0, heightKm: 3.2 };
export const MAP_W = 1000;
export const MAP_H = 800;

export function uvToLatLon(u: number, v: number) {
  return {
    latitude: +(BOUNDS.north - v * (BOUNDS.north - BOUNDS.south)).toFixed(6),
    longitude: +(BOUNDS.west + u * (BOUNDS.east - BOUNDS.west)).toFixed(6),
  };
}

export function distKm(a: { u: number; v: number }, b: { u: number; v: number }) {
  const dx = (a.u - b.u) * AREA.widthKm;
  const dy = (a.v - b.v) * AREA.heightKm;
  return Math.sqrt(dx * dx + dy * dy);
}

export function zoneAt(u: number, v: number): string {
  if (v < 0.5) return u < 0.5 ? 'Breakwater North' : 'Outer Anchorage';
  return u < 0.5 ? 'Berth Approach' : 'Channel East';
}

export const ZONES = ['Breakwater North', 'Outer Anchorage', 'Berth Approach', 'Channel East'];

export function fmtLat(lat: number) {
  return `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'N' : 'S'}`;
}
export function fmtLon(lon: number) {
  return `${Math.abs(lon).toFixed(5)}° ${lon >= 0 ? 'E' : 'W'}`;
}

/** Fixed points used by the recovery planner. */
export const BASE_POINT = { label: 'Mumbai Port jetty', u: 0.045, v: 0.9 };
export const QUAY_POINT = { label: 'Waste handling quay', u: 0.05, v: 0.8 };
