// Shared UI primitives for both storefront and admin.
import React, { useEffect } from 'react';
import { X, Star, Loader2, AlertTriangle, Minus, Plus } from 'lucide-react';
import { useToast } from '../store';

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-ink/40">
      <Spinner className="h-8 w-8 text-brand-600" />
      <p className="text-sm">{label || 'Loading…'}</p>
    </div>
  );
}

export function EmptyState({ icon, title, subtitle, action }: { icon?: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && <div className="mb-4 text-ink/25 [&>svg]:h-14 [&>svg]:w-14">{icon}</div>}
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      {subtitle && <p className="mt-1 text-sm text-ink/50 max-w-sm">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const badgeColors: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  amber: 'bg-amber-100 text-amber-800',
  violet: 'bg-violet-100 text-violet-700',
  green: 'bg-emerald-100 text-emerald-700',
  red: 'bg-red-100 text-red-700',
  orange: 'bg-orange-100 text-orange-700',
  gray: 'bg-ink/8 text-ink/60',
  gold: 'bg-gold-100 text-gold-700',
};

export function Badge({ color = 'gray', children, className = '' }: { color?: string; children: React.ReactNode; className?: string }) {
  return <span className={`chip ${badgeColors[color] || badgeColors.gray} ${className}`}>{children}</span>;
}

export function Stars({ value, size = 14, className = '' }: { value: number; size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= Math.round(value) ? 'fill-gold-500 text-gold-500' : 'fill-ink/10 text-ink/10'}
        />
      ))}
    </span>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div className={`relative bg-white w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col animate-slide-up`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink/8">
          <h3 className="font-bold text-ink">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink/5 text-ink/50" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function QtyPicker({ value, onChange, min = 1, max = 50 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-ink/10 bg-white">
      <button
        type="button"
        className="p-2.5 text-ink/60 hover:text-brand-700 disabled:opacity-30"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Decrease quantity"
      >
        <Minus size={16} />
      </button>
      <span className="w-10 text-center font-semibold text-sm tabular-nums">{value}</span>
      <button
        type="button"
        className="p-2.5 text-ink/60 hover:text-brand-700 disabled:opacity-30"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Increase quantity"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-ink/15'}`}
    >
      <span className={`inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px] rtl:-translate-x-[22px]' : 'translate-x-[3px] rtl:-translate-x-[3px]'}`} />
    </button>
  );
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  const nums: number[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== -1) nums.push(-1);
  }
  return (
    <nav className="flex items-center justify-center gap-1.5 mt-8" aria-label="Pagination">
      <button className="btn-outline !px-3 !py-1.5 text-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ←
      </button>
      {nums.map((n, i) =>
        n === -1 ? (
          <span key={`e${i}`} className="px-1 text-ink/30">
            …
          </span>
        ) : (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`btn !px-3 !py-1.5 text-sm ${n === page ? '!bg-brand-700 !text-white' : '!bg-white !text-ink hover:!bg-brand-50 border border-ink/10'}`}
            aria-current={n === page ? 'page' : undefined}
          >
            {n}
          </button>
        )
      )}
      <button className="btn-outline !px-3 !py-1.5 text-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        →
      </button>
    </nav>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <AlertTriangle className="h-10 w-10 text-amber-500" />
      <p className="text-sm text-ink/60 max-w-sm">{message}</p>
      {onRetry && (
        <button className="btn-outline !py-2 !px-4 text-sm" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
}

// Global toast renderer
export function Toasts() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="fixed bottom-20 md:bottom-6 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-[100] flex flex-col items-center gap-2 w-full max-w-sm px-4 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto w-full rounded-xl px-4 py-3 text-sm font-medium shadow-lift text-white animate-slide-up ${
            t.kind === 'success' ? 'bg-brand-700' : t.kind === 'error' ? 'bg-red-600' : 'bg-ink/85'
          }`}
          role="status"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
