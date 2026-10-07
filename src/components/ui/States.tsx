import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import Button from './Button';

export function Spinner({ size = 14 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin" aria-hidden />;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <Inbox size={22} className="text-dim" aria-hidden />
      <p className="text-[13px] font-medium">{title}</p>
      <p className="max-w-xs text-xs text-mute">{body}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <AlertTriangle size={24} className="text-hz-med" aria-hidden />
      <div>
        <p className="text-sm font-medium">Could not load survey data</p>
        <p className="mt-1 text-xs text-mute">{message} Check that the analysis service is running, then try again.</p>
      </div>
      <Button onClick={onRetry}>Retry</Button>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading survey data">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-[92px] animate-shimmer rounded-md border border-line" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="skeleton h-[520px] animate-shimmer rounded-md border border-line" />
        <div className="skeleton h-[520px] animate-shimmer rounded-md border border-line" />
      </div>
    </div>
  );
}
