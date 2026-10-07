import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Report } from '@/types';

export const CHART_TOOLTIP = {
  contentStyle: { background: '#08121F', border: '1px solid #21496C', borderRadius: 4, fontSize: 12, color: '#E6F1F7' },
  labelStyle: { color: '#93ABBE' },
  cursor: { stroke: '#21496C' },
};
export const AXIS = { stroke: '#5F7B92', fontSize: 11, tickLine: false, axisLine: { stroke: '#173049' } } as const;

/** Detections over time: daily bars plus cumulative recovery area. */
export default function ActivityChart({ data, height = 168 }: { data: Report['trend']; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="Chart of objects detected and recovered per day over the last 14 days">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
          <CartesianGrid stroke="#173049" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="day" {...AXIS} interval={1} />
          <YAxis {...AXIS} allowDecimals={false} />
          <Tooltip {...CHART_TOOLTIP} />
          <Bar dataKey="detected" name="Detected" fill="#2FD3E6" fillOpacity={0.75} radius={[2, 2, 0, 0]} />
          <Bar dataKey="recovered" name="Recovered" fill="#3FD98F" fillOpacity={0.9} radius={[2, 2, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CumulativeChart({ data, height = 220 }: { data: Report['trend']; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="Cumulative detections and recoveries over 14 days">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="gd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2FD3E6" stopOpacity={0.35} /><stop offset="1" stopColor="#2FD3E6" stopOpacity={0} /></linearGradient>
            <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3FD98F" stopOpacity={0.35} /><stop offset="1" stopColor="#3FD98F" stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid stroke="#173049" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="day" {...AXIS} interval={1} />
          <YAxis {...AXIS} allowDecimals={false} />
          <Tooltip {...CHART_TOOLTIP} />
          <Area type="monotone" dataKey="cumulativeDetected" name="Detected (cumulative)" stroke="#2FD3E6" strokeWidth={1.8} fill="url(#gd)" />
          <Area type="monotone" dataKey="cumulativeRecovered" name="Recovered (cumulative)" stroke="#3FD98F" strokeWidth={1.8} fill="url(#gr)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
