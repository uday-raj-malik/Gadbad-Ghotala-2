import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const V: Record<Variant, string> = {
  primary: 'bg-sonar text-abyss hover:bg-[#5be0ef] font-medium',
  secondary: 'bg-raised text-ink border border-line2 hover:border-sonar-soft hover:bg-[#143050]',
  ghost: 'text-mute hover:text-ink hover:bg-raised',
  danger: 'bg-hz-high/10 text-hz-high border border-hz-high/50 hover:bg-hz-high/20',
  success: 'bg-hz-low/15 text-hz-low border border-hz-low/55 hover:bg-hz-low/25',
};

const Button = forwardRef<HTMLButtonElement, Props>(({ variant = 'secondary', size = 'md', className, ...p }, ref) => (
  <button
    ref={ref}
    {...p}
    className={cn(
      'inline-flex items-center justify-center gap-1.5 rounded text-[13px] transition-colors disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap',
      size === 'sm' ? 'h-7 px-2.5' : size === 'lg' ? 'h-10 px-4 text-[12.5px] font-semibold' : 'h-8 px-3.5',
      V[variant],
      className,
    )}
  />
));
Button.displayName = 'Button';
export default Button;
