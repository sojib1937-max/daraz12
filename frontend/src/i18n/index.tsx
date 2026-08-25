// Lightweight i18n — English + Arabic with RTL. All strings are dictionary-driven.
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { en } from './en';
import { ar } from './ar';

export type Lang = 'en' | 'ar';

const dicts: Record<Lang, Record<string, string>> = { en, ar };

interface I18nCtx {
  lang: Lang;
  dir: 'ltr' | 'rtl';
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18nCtx>({
  lang: 'en',
  dir: 'ltr',
  setLang: () => undefined,
  t: (k) => k,
});

const STORAGE_KEY = 'dc_lang';

export function I18nProvider({ children, defaultLang }: { children: React.ReactNode; defaultLang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved === 'en' || saved === 'ar') return saved;
    return defaultLang || 'en';
  });

  const setLang = (l: Lang) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLangState(l);
  };

  const dir: 'ltr' | 'rtl' = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const t = (key: string, vars?: Record<string, string | number>) => {
    let s = dicts[lang][key] ?? en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    }
    return s;
  };

  const value = useMemo(() => ({ lang, dir, setLang, t }), [lang, dir]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}

export function useT() {
  return useContext(Ctx).t;
}

export function useLang() {
  return useContext(Ctx).lang;
}
