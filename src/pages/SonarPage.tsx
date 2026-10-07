import { useMemo, useState } from 'react';
import { Play, Radar } from 'lucide-react';
import { useApp } from '@/store/AppStore';
import { analyzeScan } from '@/services/sonarService';
import PageHeader from '@/components/ui/PageHeader';
import Panel from '@/components/ui/Panel';
import Button from '@/components/ui/Button';
import { EmptyState, Spinner } from '@/components/ui/States';
import UploadDropzone, { type PickedFile } from '@/components/sonar/UploadDropzone';
import SurveyProgress from '@/components/sonar/SurveyProgress';
import SonarViewer from '@/components/sonar/SonarViewer';
import AiDetectionPanel from '@/components/sonar/AiDetectionPanel';
import { useFocusOn } from '@/hooks/useFocusOn';

export default function SonarPage() {
  const { scans, detections, addScan, toast } = useApp();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [state, setState] = useState<'idle' | 'running' | 'done'>('idle');
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [scanId, setScanId] = useState<string>(scans[scans.length - 1]?.id ?? '');
  const [selected, setSelected] = useState<string | null>(null);

  const scan = scans.find((s) => s.id === scanId) ?? scans[0];
  const scanDets = useMemo(() => detections.filter((d) => d.scanId === scan?.id), [detections, scan]);
  useFocusOn(scanDets.find((d) => d.id === selected));

  const run = async () => {
    if (!file) return;
    setState('running');
    setStep(0);
    setProgress(0);
    try {
      const res = await analyzeScan(file, detections, (e) => {
        setStep(e.step);
        setProgress(e.progress);
        setMessage(e.message);
      });
      addScan(res.scan, res.detections);
      setScanId(res.scan.id);
      const firstReview = res.detections.filter((d) => d.status === 'review').sort((a, b) => a.confidence - b.confidence)[0];
      setSelected(firstReview?.id ?? null);
      setState('done');
      const rv = res.detections.filter((d) => d.status === 'review').length;
      toast(`${res.scan.id}: ${res.detections.length} objects detected, ${rv} need human review.`);
    } catch {
      setState('idle');
      toast('Analysis failed. The sonar file could not be processed.', 'error');
    }
  };

  return (
    <>
      <PageHeader
        title="Sonar analysis"
        description="Side-scan sonar in, AI detections out. Uncertain detections wait for a person."
        actions={
          scan && (
            <label className="flex items-center gap-2 text-xs text-mute">
              Scan
              <select className="field h-8 py-0" value={scan.id} onChange={(e) => { setScanId(e.target.value); setSelected(null); }} aria-label="Select scan">
                {scans.map((s) => <option key={s.id} value={s.id}>{s.id} · lane {s.lane + 1}</option>)}
              </select>
            </label>
          )
        }
      />

      {/* slim session bar: upload + pipeline, so the sonar image gets the screen */}
      <div className="panel mb-4 grid items-center gap-x-5 gap-y-3 px-4 py-3 lg:grid-cols-[minmax(260px,360px)_auto_minmax(0,1fr)]" aria-label="New sonar session">
        <UploadDropzone compact file={file} onFile={(f) => { setFile(f); if (state === 'done') setState('idle'); }} disabled={state === 'running'} />
        <div className="flex gap-2">
          <Button variant="primary" size="lg" disabled={!file || state === 'running'} onClick={run} className="uppercase tracking-wide">
            {state === 'running' ? <Spinner /> : <Play size={14} aria-hidden />}
            {state === 'running' ? 'Analysing…' : 'Analyze scan'}
          </Button>
          {state === 'done' && <Button size="lg" onClick={() => { setFile(null); setState('idle'); }}>New file</Button>}
        </div>
        <SurveyProgress inline state={state} step={step} progress={progress} message={message} />
      </div>

      {!scan ? (
        <Panel><EmptyState title="No scans yet" body="Upload a sonar file to start the analysis." /></Panel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_410px] xl:items-start">
          <div className="min-w-0">
            <div className="mb-2 flex items-end justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold uppercase tracking-[0.16em]"><Radar size={15} className="text-sonar" aria-hidden />Sonar image</h2>
              <p className="num truncate text-xs text-dim">{scan.fileName} · {scan.format} · {scan.sizeMb} MB · {scan.pings.toLocaleString('en-IN')} pings · {scan.swathM} m swath</p>
            </div>
            <SonarViewer scan={scan} detections={scanDets} selectedId={selected} onSelect={setSelected} />
          </div>
          <div className="xl:sticky xl:top-0" style={{ height: 'clamp(560px, calc(100vh - 250px), 880px)' }}>
            <AiDetectionPanel detections={scanDets} selectedId={selected} onSelect={setSelected} />
          </div>
        </div>
      )}
    </>
  );
}
