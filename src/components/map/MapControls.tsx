import type { LucideIcon } from 'lucide-react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LayerToggle {
  key: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  layers?: LayerToggle[];
  onToggle?: (key: string) => void;
  className?: string;
  orientation?: 'vertical' | 'horizontal';
}

function IconBtn({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded transition-colors',
        active === undefined ? 'text-mute hover:bg-raised hover:text-ink' : active ? 'bg-sonar/15 text-sonar' : 'text-dim hover:bg-raised hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

export default function MapControls({ onZoomIn, onZoomOut, onReset, layers, onToggle, className, orientation = 'vertical' }: Props) {
  const col = orientation === 'vertical';
  return (
    <div className={cn('flex gap-2', col ? 'flex-col' : 'flex-row', className)}>
      <div className={cn('glass flex p-0.5', col ? 'flex-col' : 'flex-row')} role="group" aria-label="Map zoom">
        <IconBtn label="Zoom in" onClick={onZoomIn}><Plus size={15} /></IconBtn>
        <IconBtn label="Zoom out" onClick={onZoomOut}><Minus size={15} /></IconBtn>
        <IconBtn label="Reset view" onClick={onReset}><RotateCcw size={14} /></IconBtn>
      </div>
      {layers && onToggle && (
        <div className={cn('glass flex p-0.5', col ? 'flex-col' : 'flex-row')} role="group" aria-label="Map layers">
          {layers.map((l) => (
            <IconBtn key={l.key} label={`${l.active ? 'Hide' : 'Show'} ${l.label.toLowerCase()}`} active={l.active} onClick={() => onToggle(l.key)}>
              <l.icon size={15} />
            </IconBtn>
          ))}
        </div>
      )}
    </div>
  );
}
