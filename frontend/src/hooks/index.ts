// Lightweight SWR-style data hooks + misc hooks.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';

interface UseApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

export function useApi<T>(path: string | null, deps: unknown[] = []): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [tick, setTick] = useState(0);
  const pathRef = useRef(path);
  pathRef.current = path;

  useEffect(() => {
    if (!pathRef.current) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<T>(pathRef.current)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}

export function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useCountdown(targetIso: string | null): { d: number; h: number; m: number; s: number; done: boolean } {
  const calc = useCallback(() => {
    if (!targetIso) return { d: 0, h: 0, m: 0, s: 0, done: true };
    const diff = Math.max(0, new Date(targetIso).getTime() - Date.now());
    return {
      d: Math.floor(diff / 86400000),
      h: Math.floor((diff % 86400000) / 3600000),
      m: Math.floor((diff % 3600000) / 60000),
      s: Math.floor((diff % 60000) / 1000),
      done: diff <= 0,
    };
  }, [targetIso]);
  const [v, setV] = useState(calc);
  useEffect(() => {
    setV(calc());
    const t = setInterval(() => setV(calc()), 1000);
    return () => clearInterval(t);
  }, [calc]);
  return v;
}

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = () => setMatches(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

/** Persist an action result in localStorage with expiry (popup frequency control). */
export function useLocalFlag(key: string, frequencyDays: number) {
  const [flag, setFlag] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return true; // not shown yet → allowed
      const ts = Number(raw);
      if (!Number.isFinite(ts)) return true;
      return Date.now() - ts > frequencyDays * 86400000;
    } catch {
      return true;
    }
  });
  const markShown = () => {
    try {
      localStorage.setItem(key, String(Date.now()));
      setFlag(false);
    } catch {
      /* ignore */
    }
  };
  return { allowed: flag, markShown };
}

/** Scroll to top on route change. */
export function useScrollTop() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);
}
