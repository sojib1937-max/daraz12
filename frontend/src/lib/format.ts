// Formatting helpers: AED currency, dates, phone.
export function aed(amount: number | string | null | undefined, opts?: { compact?: boolean }): string {
  const n = Number(amount ?? 0);
  if (opts?.compact && n % 1 === 0) {
    return `AED ${n.toLocaleString('en-AE')}`;
  }
  return `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function aedShort(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  return `AED ${n.toLocaleString('en-AE', { maximumFractionDigits: n % 1 === 0 ? 0 : 2 })}`;
}

export function formatDate(iso: string | null | undefined, opts?: { withTime?: boolean }): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...(opts?.withTime ? { hour: '2-digit', minute: '2-digit' } : {}) });
}

export function timeAgoEn(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

export const EMIRATES = [
  { key: 'DUBAI', en: 'Dubai', ar: 'دبي' },
  { key: 'ABU_DHABI', en: 'Abu Dhabi', ar: 'أبوظبي' },
  { key: 'SHARJAH', en: 'Sharjah', ar: 'الشارقة' },
  { key: 'AJMAN', en: 'Ajman', ar: 'عجمان' },
  { key: 'UMM_AL_QUWAIN', en: 'Umm Al Quwain', ar: 'أم القيوين' },
  { key: 'RAS_AL_KHAIMAH', en: 'Ras Al Khaimah', ar: 'رأس الخيمة' },
  { key: 'FUJAIRAH', en: 'Fujairah', ar: 'الفجيرة' },
];

export function emirateName(key: string, lang: 'en' | 'ar' = 'en'): string {
  return EMIRATES.find((e) => e.key === key)?.[lang === 'ar' ? 'ar' : 'en'] ?? key;
}

export const ORDER_STATUS_LABELS: Record<string, { en: string; ar: string; color: string }> = {
  NEW: { en: 'New', ar: 'جديد', color: 'blue' },
  CONFIRMED: { en: 'Confirmed', ar: 'مؤكد', color: 'indigo' },
  PROCESSING: { en: 'Processing', ar: 'قيد المعالجة', color: 'amber' },
  PACKED: { en: 'Packed', ar: 'تم التغليف', color: 'amber' },
  SHIPPED: { en: 'Shipped', ar: 'تم الشحن', color: 'violet' },
  OUT_FOR_DELIVERY: { en: 'Out for delivery', ar: 'في الطريق للتوصيل', color: 'violet' },
  DELIVERED: { en: 'Delivered', ar: 'تم التوصيل', color: 'green' },
  CANCELLED: { en: 'Cancelled', ar: 'ملغي', color: 'red' },
  RETURN_REQUESTED: { en: 'Return requested', ar: 'طلب إرجاع', color: 'orange' },
  RETURNED: { en: 'Returned', ar: 'تم الإرجاع', color: 'red' },
  FAILED_DELIVERY: { en: 'Failed delivery', ar: 'توصيل فاشل', color: 'red' },
  COD_COLLECTED: { en: 'COD collected', ar: 'تم تحصيل الدفع', color: 'green' },
};

export function discountPercent(price: number, compareAt: number | null): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

export function waLink(phone: string, text?: string): string {
  const p = phone.replace(/\D/g, '');
  return `https://wa.me/${p}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
