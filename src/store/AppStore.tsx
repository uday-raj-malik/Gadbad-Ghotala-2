import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Detection, DetectionStatus, Notification, RecoveryMission, Settings, SonarScan, Survey } from '@/types';
import { listDetections, updateDetectionStatus } from '@/services/detectionService';
import { getSurvey, listScans } from '@/services/sonarService';
import { getWasteStages, type StageMap } from '@/services/wasteService';
import { DEFAULT_SETTINGS, MOCK_NOTIFICATIONS } from '@/data/mock';
import { defaultMissionIds } from '@/data/mockDetections';

export interface Toast {
  id: number;
  kind: 'success' | 'info' | 'warning' | 'error';
  message: string;
}

export interface Focus { latitude: number; longitude: number; depth: number; label?: string }

interface AppState {
  focus: Focus | null;
  setFocus: (f: Focus | null) => void;
  loading: boolean;
  error: string | null;
  retry: () => void;
  survey: Survey | null;
  scans: SonarScan[];
  detections: Detection[];
  setStatus: (id: string, status: DetectionStatus) => Promise<void>;
  setStatusBulk: (ids: string[], status: DetectionStatus) => Promise<void>;
  addScan: (scan: SonarScan, dets: Detection[]) => void;
  missionIds: string[];
  toggleMission: (id: string) => void;
  addToMission: (ids: string[]) => void;
  setMissionIds: (ids: string[]) => void;
  mission: RecoveryMission | null;
  setMission: (m: RecoveryMission | null) => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  wasteStages: StageMap;
  setWasteStages: (s: StageMap) => void;
  toasts: Toast[];
  toast: (message: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
  search: string;
  setSearch: (s: string) => void;
  notifications: Notification[];
  markAllRead: () => void;
  pushNotification: (n: Omit<Notification, 'id' | 'at' | 'read'>) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [scans, setScans] = useState<SonarScan[]>([]);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [missionIds, setMissionIds] = useState<string[]>([]);
  const [mission, setMission] = useState<RecoveryMission | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [wasteStages, setWasteStages] = useState<StageMap>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [search, setSearch] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const [attempt, setAttempt] = useState(0);
  const [focus, setFocus] = useState<Focus | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([getSurvey(), listScans(), listDetections(), getWasteStages()])
      .then(([sv, sc, dt, ws]) => {
        if (!alive) return;
        setSurvey(sv);
        setScans(sc);
        setDetections(dt);
        setWasteStages(ws);
        setMissionIds((cur) => (cur.length ? cur : defaultMissionIds(dt)));
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Could not reach the analysis service.');
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const toast = useCallback((message: string, kind: Toast['kind'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const setStatus = useCallback(async (id: string, status: DetectionStatus) => {
    const rec = await updateDetectionStatus(id, status);
    setDetections((ds) => ds.map((d) => (d.id === id ? { ...d, status, reviewedBy: rec.reviewedBy, reviewedAt: rec.reviewedAt } : d)));
  }, []);

  const setStatusBulk = useCallback(async (ids: string[], status: DetectionStatus) => {
    await Promise.all(ids.map((id) => updateDetectionStatus(id, status)));
    const at = new Date().toISOString();
    setDetections((ds) => ds.map((d) => (ids.includes(d.id) ? { ...d, status, reviewedBy: 'Operator A. Rao', reviewedAt: at } : d)));
  }, []);

  const pushNotification = useCallback((n: Omit<Notification, 'id' | 'at' | 'read'>) => {
    setNotifications((ns) => [{ ...n, id: `n${Date.now()}`, at: new Date().toISOString(), read: false }, ...ns]);
  }, []);

  const addScan = useCallback(
    (scan: SonarScan, dets: Detection[]) => {
      setScans((s) => [scan, ...s]);
      setDetections((ds) => [...dets, ...ds.filter((d) => !dets.some((x) => x.id === d.id))]);
      setSurvey((sv) => (sv ? { ...sv, scansProcessed: sv.scansProcessed + 1, lastScanAt: scan.uploadedAt, falsePositivesFiltered: sv.falsePositivesFiltered + 9 } : sv));
      pushNotification({ title: `${scan.id} processed`, body: `${dets.length} objects detected; ${dets.filter((d) => d.status === 'review').length} need review.`, level: 'info' });
    },
    [pushNotification],
  );

  const toggleMission = useCallback((id: string) => setMissionIds((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id])), []);
  const addToMission = useCallback((ids: string[]) => setMissionIds((m) => Array.from(new Set([...m, ...ids]))), []);
  const updateSettings = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);
  const markAllRead = useCallback(() => setNotifications((ns) => ns.map((n) => ({ ...n, read: true }))), []);

  const value = useMemo<AppState>(
    () => ({
      focus, setFocus, loading, error, retry: () => setAttempt((a) => a + 1), survey, scans, detections, setStatus, setStatusBulk, addScan,
      missionIds, toggleMission, addToMission, setMissionIds, mission, setMission, settings, updateSettings, wasteStages, setWasteStages,
      toasts, toast, dismissToast, search, setSearch, notifications, markAllRead, pushNotification,
    }),
    [focus, loading, error, survey, scans, detections, setStatus, setStatusBulk, addScan, missionIds, toggleMission, addToMission, mission, settings, updateSettings, wasteStages, toasts, toast, dismissToast, search, notifications, markAllRead, pushNotification],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp must be used inside AppProvider');
  return c;
}
