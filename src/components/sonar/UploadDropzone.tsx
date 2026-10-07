import { useRef, useState } from 'react';
import { FileUp, X, AlertCircle, FileCheck2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PickedFile {
  name: string;
  sizeMb: number;
  /** The real File, kept so a live backend can actually analyze the bytes. */
  raw: File;
}

const OK = ['xtf', 'jsf', 'csv', 'jpg', 'jpeg', 'png', 'tif', 'tiff'];

interface Props {
  file: PickedFile | null;
  onFile: (f: PickedFile | null) => void;
  disabled?: boolean;
  /** One-row layout for the Sonar session bar. */
  compact?: boolean;
}

export default function UploadDropzone({ file, onFile, disabled, compact }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const take = (f: File | undefined) => {
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (!OK.includes(ext)) {
      setError(`".${ext}" files are not supported. Use XTF, JSF, CSV, or an image (JPG/PNG/TIFF) for the live model.`);
      return;
    }
    setError(null);
    onFile({ name: f.name, sizeMb: Math.max(1, Math.round(f.size / 1048576)), raw: f });
  };

  if (file) {
    return (
      <div className={cn('flex items-center gap-3 rounded-md border border-line2 bg-deep/80', compact ? 'px-3 py-2' : 'px-4 py-3')}>
        <FileCheck2 size={20} className="text-sonar" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[13px]">{file.name}</p>
          <p className="text-xs text-dim">{file.sizeMb} MB · ready to analyse</p>
        </div>
        <button disabled={disabled} onClick={() => onFile(null)} aria-label="Remove file" className="rounded p-1 text-dim hover:bg-raised hover:text-ink disabled:opacity-40">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload sonar file. Drag and drop or browse."
        onClick={() => input.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') input.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); }}
        className={cn(
          'flex cursor-pointer items-center justify-center rounded-md border border-dashed text-center transition-colors',
          compact ? 'gap-3 px-4 py-2.5' : 'flex-col gap-2 px-6 py-8',
          over ? 'border-sonar bg-sonar/5' : 'border-line2 bg-deep hover:border-sonar-soft',
        )}
      >
        <FileUp size={compact ? 20 : 24} className={over ? 'text-sonar' : 'text-mute'} aria-hidden />
        <p className="text-[13px]">Drop a sonar file here or <span className="text-sonar underline underline-offset-2">Browse files</span></p>
        {!compact && <p className="text-xs text-dim">XTF, JSF, CSV, or a JPG/PNG/TIFF for the live model</p>}
        <input ref={input} type="file" accept=".xtf,.jsf,.csv,.jpg,.jpeg,.png,.tif,.tiff" className="hidden" onChange={(e) => take(e.target.files?.[0])} />
      </div>
      {error && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs text-hz-high">
          <AlertCircle size={13} aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}
