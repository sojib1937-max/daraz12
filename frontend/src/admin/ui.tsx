// Shared admin UI: page header, stat cards, confirm dialog, form fields.
import React, { useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Modal, Spinner } from '../components/ui';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="text-xl md:text-2xl font-extrabold text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-ink/50 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, sub, icon, tone = 'brand' }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode; tone?: 'brand' | 'gold' | 'red' | 'green' | 'blue' | 'violet' }) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-700',
    gold: 'bg-gold-50 text-gold-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    violet: 'bg-violet-50 text-violet-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-ink/5 shadow-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink/45">{label}</p>
          <p className="text-xl md:text-2xl font-extrabold text-ink mt-1 truncate">{value}</p>
          {sub && <p className="text-[11px] text-ink/45 mt-0.5">{sub}</p>}
        </div>
        {icon && <span className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${tones[tone]}`}>{icon}</span>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, busy }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; busy?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex items-start gap-3">
        <span className="h-10 w-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
          <AlertTriangle size={19} />
        </span>
        <p className="text-sm text-ink/65 leading-relaxed">{message}</p>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-outline !py-2.5 !px-4 text-sm" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button className="btn-danger !py-2.5 !px-5 text-sm" onClick={onConfirm} disabled={busy}>
          {busy && <Spinner className="h-3.5 w-3.5" />} Confirm
        </button>
      </div>
    </Modal>
  );
}

export function AdminPagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button className="btn-outline !p-2" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous">
        <ChevronLeft size={16} />
      </button>
      <span className="text-sm font-semibold text-ink/60">
        Page {page} of {pages}
      </span>
      <button className="btn-outline !p-2" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder, className = '' }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`input !w-64 max-w-full ${className}`}
      aria-label={placeholder}
    />
  );
}

export function FilterSelect({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; label: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input !w-auto !py-2 text-sm" aria-label={label}>
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </select>
  );
}

export function Field({ label, children, hint, required }: { label: string; children: React.ReactNode; hint?: string; required?: boolean }) {
  return (
    <div>
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-ink/40 mt-1">{hint}</p>}
    </div>
  );
}

export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="!py-12 text-center text-sm text-ink/40">
        {message}
      </td>
    </tr>
  );
}
