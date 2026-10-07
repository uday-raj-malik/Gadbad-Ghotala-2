import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, FileText, Database } from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { buildReport, downloadSurveyData, exportCsv, exportReport } from '@/services/reportService';
import { CATEGORY_META, CATEGORY_ORDER } from '@/lib/meta';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import { Spinner } from '@/components/ui/States';
import ReportCard, { Stat } from '@/components/reports/ReportCard';
import { AXIS, CHART_TOOLTIP, CumulativeChart } from '@/components/overview/ActivityChart';

export default function ReportsPage() {
  const { detections, toast } = useApp();
  const r = useMemo(() => buildReport(detections), [detections]);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<string>) => {
    setBusy(key);
    try {
      const name = await fn();
      toast(`Downloaded ${name}.`);
    } catch {
      toast('Export failed. Try again.', 'error');
    } finally {
      setBusy(null);
    }
  };
  const catColor = (name: string) => CATEGORY_ORDER.map((c) => CATEGORY_META[c]).find((m) => m.label === name)?.color ?? '#B6C2CF';
  const efficiency = r.confirmed + r.recovered ? (r.recovered / (r.confirmed + r.recovered)) * 100 : 0;

  return (
    <>
      <PageHeader
        title="Reports"
        description="Survey-level analytics for the current harbour survey."
        actions={
          <>
            <Button onClick={() => run('csv', () => exportCsv(detections))} disabled={!!busy}>{busy === 'csv' ? <Spinner /> : <Download size={14} aria-hidden />}Export CSV</Button>
            <Button onClick={() => run('rep', () => exportReport(r))} disabled={!!busy}>{busy === 'rep' ? <Spinner /> : <FileText size={14} aria-hidden />}Export Report</Button>
            <Button variant="primary" onClick={() => run('data', () => downloadSurveyData(detections))} disabled={!!busy}>{busy === 'data' ? <Spinner /> : <Database size={14} aria-hidden />}Download Survey Data</Button>
          </>
        }
      />

      <section aria-label="Summary" className="panel grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 xl:divide-x xl:divide-line">
        <Stat label="Area surveyed" value={`${r.areaKm2} km²`} />
        <Stat label="Total detections" value={String(r.totalDetections)} />
        <Stat label="Confirmed" value={String(r.confirmed)} hint={`${r.review} awaiting review`} />
        <Stat label="Recovered" value={String(r.recovered)} hint={`${Math.round(r.weightKg)} kg`} />
        <Stat label="Recovery rate" value={`${r.recoveryRate.toFixed(1)}%`} />
        <Stat label="Recovery efficiency" value={`${efficiency.toFixed(0)}%`} hint="Recovered / verified" />
        <Stat label="AI confidence" value={`${r.avgConfidence.toFixed(1)}%`} hint="Mean, verified detections" />
        <Stat label="False-positive rate" value={`${r.falsePositiveRate.toFixed(1)}%`} hint="Rejected after human review" />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ReportCard title="Waste by category" subtitle="Detected vs recovered">
          <div className="grid h-[240px] grid-cols-[1fr_1.2fr] items-center" role="img" aria-label="Waste by category">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={r.byCategory} dataKey="value" nameKey="name" innerRadius={42} outerRadius={78} paddingAngle={2} stroke="#0B1827">
                  {r.byCategory.map((c) => <Cell key={c.name} fill={catColor(c.name)} />)}
                </Pie>
                <Tooltip {...CHART_TOOLTIP} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="space-y-1.5 text-xs">
              {r.byCategory.map((c) => (
                <li key={c.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: catColor(c.name) }} aria-hidden />
                  <span className="flex-1 text-mute">{c.name}</span>
                  <span className="num">{c.value}</span>
                  <span className="num w-14 text-right text-dim">{c.recovered} rec.</span>
                </li>
              ))}
            </ul>
          </div>
        </ReportCard>

        <ReportCard title="Waste by depth" subtitle="Objects per depth band">
          <div className="h-[240px]" role="img" aria-label="Waste by depth band">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={r.byDepth} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="#173049" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="name" {...AXIS} />
                <YAxis {...AXIS} allowDecimals={false} />
                <Tooltip {...CHART_TOOLTIP} />
                <Bar dataKey="value" name="Objects" fill="#2FD3E6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ReportCard>

        <ReportCard title="Waste by harbour zone" subtitle="By status">
          <div className="h-[240px]" role="img" aria-label="Waste by harbour zone">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={r.byZone} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="#173049" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="name" {...AXIS} interval={0} tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.split(' ')[0]} />
                <YAxis {...AXIS} allowDecimals={false} />
                <Tooltip {...CHART_TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="confirmed" name="Confirmed" stackId="a" fill="#2FD3E6" />
                <Bar dataKey="review" name="Needs review" stackId="a" fill="#F6A623" />
                <Bar dataKey="recovered" name="Recovered" stackId="a" fill="#3FD98F" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ReportCard>

        <ReportCard title="Detection and recovery trend" subtitle="Cumulative, last 14 days" className="lg:col-span-2">
          <CumulativeChart data={r.trend} height={240} />
        </ReportCard>

        <ReportCard title="AI confidence distribution" subtitle="Detections per confidence band (%)">
          <div className="h-[240px]" role="img" aria-label="Confidence distribution">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={r.confidenceHistogram} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="#173049" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="name" {...AXIS} />
                <YAxis {...AXIS} allowDecimals={false} />
                <Tooltip {...CHART_TOOLTIP} />
                <Bar dataKey="value" name="Detections" radius={[2, 2, 0, 0]}>
                  {r.confidenceHistogram.map((b) => {
                    const lo = parseInt(String(b.name), 10);
                    return <Cell key={b.name} fill={lo >= 80 ? '#3FD98F' : lo >= 60 ? '#F6A623' : '#FF5A5F'} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ReportCard>
      </div>
    </>
  );
}
