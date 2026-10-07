import { Check } from 'lucide-react';
import { PIPELINE_STEPS } from '@/services/sonarService';
import { cn } from '@/lib/utils';
import { Spinner } from '../ui/States';

interface Props {
  state: 'idle' | 'running' | 'done';
  step: number;
  progress: number;
  message: string;
  /** Horizontal stepper for the Sonar session bar. */
  inline?: boolean;
}

export default function SurveyProgress({ state, step, progress, message, inline }: Props) {
  if (inline) {
    return (
      <div aria-live="polite" className="min-w-0">
        <ol className="flex items-center">
          {PIPELINE_STEPS.map((label, i) => {
            const done = state === 'done' || (state === 'running' && i < step);
            const active = state === 'running' && i === step;
            return (
              <li key={label} className="flex min-w-0 flex-1 items-center">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={cn('flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[9px]', done ? 'border-teal bg-teal text-abyss' : active ? 'border-sonar text-sonar' : 'border-line2 text-dim')}>
                    {done ? <Check size={10} strokeWidth={3} /> : active ? <Spinner size={10} /> : i + 1}
                  </span>
                  <span className={cn('hidden truncate text-[11.5px] 2xl:block', done || active ? 'text-ink' : 'text-dim')}>{label}</span>
                </span>
                {i < PIPELINE_STEPS.length - 1 && <span className={cn('mx-1.5 h-px min-w-3 flex-1', done ? 'bg-teal/60' : 'bg-line2')} aria-hidden />}
              </li>
            );
          })}
        </ol>
        <div className="relative mt-2 h-[3px] overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={state === 'done' ? 100 : progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-sonar transition-all duration-500" style={{ width: `${state === 'done' ? 100 : progress}%` }} />
          {state === 'running' && <div className="absolute inset-y-0 w-1/3 animate-sweep bg-gradient-to-r from-transparent via-white/40 to-transparent" />}
        </div>
        <p className="mt-1 truncate text-xs text-mute">{state === 'idle' ? 'Waiting for a sonar file.' : state === 'done' ? 'Analysis complete.' : message}</p>
      </div>
    );
  }
  return (
    <div aria-live="polite">
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PIPELINE_STEPS.map((label, i) => {
          const done = state === 'done' || (state === 'running' && i < step);
          const active = state === 'running' && i === step;
          return (
            <li key={label} className={cn('relative rounded border px-2.5 py-2 transition-colors', done ? 'border-teal/40 bg-teal/5' : active ? 'border-sonar bg-sonar/5' : 'border-line bg-deep')}>
              <div className="flex items-center gap-2">
                <span className={cn('flex h-4 w-4 items-center justify-center rounded-full border text-[9px]', done ? 'border-teal bg-teal text-abyss' : active ? 'border-sonar text-sonar' : 'border-line2 text-dim')}>
                  {done ? <Check size={10} strokeWidth={3} /> : active ? <Spinner size={10} /> : i + 1}
                </span>
                <span className={cn('truncate text-xs', done || active ? 'text-ink' : 'text-dim')}>{label}</span>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-3">
        <div className="relative h-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={state === 'done' ? 100 : progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-sonar transition-all duration-500" style={{ width: `${state === 'done' ? 100 : progress}%` }} />
          {state === 'running' && <div className="absolute inset-y-0 w-1/3 animate-sweep bg-gradient-to-r from-transparent via-white/40 to-transparent" />}
        </div>
        <p className="mt-1.5 text-xs text-mute">{state === 'idle' ? 'Waiting for a sonar file.' : message}</p>
      </div>
    </div>
  );
}
