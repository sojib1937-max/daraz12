// Server-Sent Events hub for real-time features:
//   1. Admin stream   (/api/admin/notifications/events) — new COD orders, low stock, reviews
//   2. Public stream  (/api/events/sales) — masked "recent purchase" social-proof popups
// Only real orders (or clearly-labelled demo orders in DEMO_MODE) are broadcast.
import { Response } from 'express';
import { config } from '../config';
import { logger } from './logger';

interface Subscriber {
  id: string;
  res: Response;
  kind: 'admin' | 'public';
  filter?: { adminId?: number };
  pingAt: number;
}

let nextId = 1;
const subscribers = new Map<string, Subscriber>();

const PING_INTERVAL = 25_000;

function sseWrite(sub: Subscriber, event: string, data: unknown) {
  try {
    sub.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    // Socket likely closed; cleaned up by heartbeat / close handler.
  }
}

export function broadcast(kind: 'admin' | 'public', event: string, data: unknown, filter?: { adminId?: number }) {
  for (const sub of subscribers.values()) {
    if (sub.kind !== kind) continue;
    if (filter && sub.filter?.adminId && filter.adminId !== sub.filter.adminId) continue;
    sseWrite(sub, event, data);
  }
}

export function broadcastAdmin(event: string, data: unknown, adminId?: number) {
  broadcast('admin', event, data, adminId ? { adminId } : undefined);
}

export function broadcastPublic(event: string, data: unknown) {
  // Never leak PII on the public stream — callers must mask before broadcasting.
  broadcast('public', event, data);
}

/**
 * Register an SSE client. Returns a cleanup function.
 */
export function subscribe(kind: 'admin' | 'public', res: Response, filter?: { adminId?: number }): () => void {
  const id = `sub-${Date.now()}-${nextId++}`;
  const sub: Subscriber = { id, res, kind, filter, pingAt: Date.now() };

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders?.();
  res.write(`retry: 5000\n\n`);

  // Initial hello event so clients can detect connectivity.
  sseWrite(sub, 'hello', { time: new Date().toISOString(), demoMode: config.demoMode });

  subscribers.set(id, sub);

  const ping = setInterval(() => {
    const s = subscribers.get(id);
    if (!s) return clearInterval(ping);
    try {
      s.res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      clearInterval(ping);
      cleanup();
    }
  }, PING_INTERVAL);

  const cleanup = () => {
    clearInterval(ping);
    subscribers.delete(id);
    try {
      res.end();
    } catch {
      /* noop */
    }
  };
  res.on('close', cleanup);
  res.on('error', cleanup);

  logger.debug(`SSE subscriber connected (${kind})`, { id });
  return cleanup;
}

export function subscriberCount(): number {
  return subscribers.size;
}
