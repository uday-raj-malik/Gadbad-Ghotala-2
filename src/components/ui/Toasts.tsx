import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useApp } from '@/store/AppStore';

const ICON = { success: CheckCircle2, info: Info, warning: AlertTriangle, error: XCircle };
const COLOR = { success: '#3FD98F', info: '#2FD3E6', warning: '#F6A623', error: '#FF5A5F' };

export default function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[340px] flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((t) => {
        const I = ICON[t.kind];
        return (
          <div key={t.id} className="glass pointer-events-auto flex animate-slidein items-start gap-2.5 px-3 py-2.5" style={{ borderColor: COLOR[t.kind] + '66' }}>
            <I size={16} style={{ color: COLOR[t.kind] }} className="mt-0.5 shrink-0" aria-hidden />
            <p className="flex-1 text-[13px]">{t.message}</p>
            <button onClick={() => dismissToast(t.id)} aria-label="Dismiss notification" className="text-dim hover:text-ink">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
