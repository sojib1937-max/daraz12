// Small domain helpers: order numbers, money formatting, emirates, slugs.
import { prisma } from './prisma';

export const EMIRATES = [
  { key: 'DUBAI', en: 'Dubai', ar: 'دبي' },
  { key: 'ABU_DHABI', en: 'Abu Dhabi', ar: 'أبوظبي' },
  { key: 'SHARJAH', en: 'Sharjah', ar: 'الشارقة' },
  { key: 'AJMAN', en: 'Ajman', ar: 'عجمان' },
  { key: 'UMM_AL_QUWAIN', en: 'Umm Al Quwain', ar: 'أم القيوين' },
  { key: 'RAS_AL_KHAIMAH', en: 'Ras Al Khaimah', ar: 'رأس الخيمة' },
  { key: 'FUJAIRAH', en: 'Fujairah', ar: 'الفجيرة' },
] as const;

export function emirateName(key: string, lang: 'en' | 'ar' = 'en'): string {
  const found = EMIRATES.find((e) => e.key === key);
  if (!found) return key;
  return lang === 'ar' ? found.ar : found.en;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
}

export function formatAED(amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatAEDInt(amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `AED ${n.toLocaleString('en-AE', { maximumFractionDigits: n % 1 === 0 ? 0 : 2 })}`;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Generate a unique order number: PREFIX-YYYYMMDD-SEQ (e.g. DXB-20260824-000123). */
export async function generateOrderNumber(prefix: string): Promise<string> {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const base = `${prefix || 'DXB'}-${y}${m}${d}-`;
  // Count today's orders for the sequence, with a couple of retries on collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await prisma.order.count({
      where: { orderNumber: { startsWith: base } },
    });
    const seq = String(count + 1 + attempt).padStart(6, '0');
    const candidate = `${base}${seq}`;
    const exists = await prisma.order.findUnique({ where: { orderNumber: candidate } });
    if (!exists) return candidate;
  }
  // Fallback with timestamp suffix — collision-safe.
  return `${base}${Date.now().toString().slice(-6)}`;
}

export function maskName(name: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 1) + '****';
  }
  return parts[0].slice(0, 1) + '****' + (parts[1] ? ` ${parts[1].slice(0, 1)}****` : '');
}

export function maskPhone(phone: string): string {
  const p = phone.replace(/\D/g, '');
  if (p.length < 7) return '****';
  return p.slice(0, 4) + '****' + p.slice(-2);
}

/** "8 minutes ago" style relative time. */
export function timeAgo(date: Date | string): { labelEn: string; labelAr: string; minutes: number } {
  const d = typeof date === 'string' ? new Date(date) : date;
  const mins = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  let labelEn: string;
  let labelAr: string;
  if (mins < 1) {
    labelEn = 'just now';
    labelAr = 'الآن';
  } else if (mins < 60) {
    labelEn = `${mins} minute${mins > 1 ? 's' : ''} ago`;
    labelAr = `منذ ${mins} دقيقة`;
  } else if (mins < 60 * 24) {
    const h = Math.floor(mins / 60);
    labelEn = `${h} hour${h > 1 ? 's' : ''} ago`;
    labelAr = `منذ ${h} ساعة`;
  } else {
    const days = Math.floor(mins / (60 * 24));
    labelEn = `${days} day${days > 1 ? 's' : ''} ago`;
    labelAr = `منذ ${days} يوم`;
  }
  return { labelEn, labelAr, minutes: mins };
}

export function todayRange(): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function dateRangeFromParam(param: string | undefined): { from: Date; to: Date } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  let from = daysAgo(30);
  if (param) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(param)) {
      // explicit date or date range "from,to"
      from = new Date(`${param}T00:00:00`);
    } else {
      switch (param) {
        case 'today': from = todayRange().start; break;
        case 'yesterday':
          from = daysAgo(1);
          to.setDate(to.getDate() - 1);
          break;
        case '7d': from = daysAgo(7); break;
        case '30d': from = daysAgo(30); break;
        case 'month': from = new Date(to.getFullYear(), to.getMonth(), 1); break;
        default: from = daysAgo(30);
      }
    }
  }
  return { from, to };
}

/** Validate a UAE mobile number: 05XXXXXXXX or +9715XXXXXXXX. Returns normalized (971...) or null. */
export function normalizeUaePhone(input: string): string | null {
  let p = input.replace(/[^\d+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('00971')) p = '971' + p.slice(5);
  if (p.startsWith('971')) {
    if (p.length !== 12 || !p.startsWith('9715')) return null;
    return p;
  }
  if (p.startsWith('0') && p.length === 10 && p.startsWith('05')) {
    return '971' + p.slice(1);
  }
  if (p.length === 9 && p.startsWith('5')) {
    return '971' + p;
  }
  return null;
}
