// Admin notification center: bell + dropdown + SSE real-time feed + sound.
import React, { useEffect, useRef, useState } from 'react';
import { Bell, ShoppingCart, Package, Star, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { timeAgoEn, aedShort } from '../lib/format';

interface Notif {
  id: number;
  type: string;
  title: string;
  body: string;
  data: { orderNumber?: string; orderId?: number; total?: number };
  isRead: boolean;
  createdAt: string;
}

export function NotificationCenter() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const soundRef = useRef<AudioContext | null>(null);
  const lastSound = useRef(0);

  const load = () => {
    api
      .get<{ items: Notif[]; unread: number }>('/api/admin/notifications?limit=20')
      .then((d) => {
        setItems(d.items);
        setUnread(d.unread);
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
    let es: EventSource | null = null;
    let pollTimer: number | null = null;
    let sseFailed = false;
    let switchedToPolling = false;

    const onNewOrder = (data: { orderNumber: string; total: number; emirateLabel?: string; message?: string }) => {
      const notif: Notif = {
        id: Date.now(),
        type: 'NEW_ORDER',
        title: 'New COD Order',
        body: `Order ${data.orderNumber} • ${aedShort(data.total)} • ${data.emirateLabel || ''}`,
        data: { orderNumber: data.orderNumber },
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      setItems((prev) => [notif, ...prev].slice(0, 50));
      setUnread((u) => u + 1);
      playChime();
    };

    const onOrderUpdate = (data: { message?: string }) => {
      setItems((prev) =>
        [
          { id: Date.now(), type: 'ORDER_STATUS', title: 'Order updated', body: data.message || '', data: {}, isRead: false, createdAt: new Date().toISOString() },
          ...prev,
        ].slice(0, 50)
      );
      setUnread((u) => u + 1);
    };

    // SSE path — instant real-time (same-origin / non-buffering proxy)
    const startSse = () => {
      es = new EventSource('/api/admin/notifications/events');
      es.addEventListener('new-order', (e) => {
        try {
          onNewOrder(JSON.parse((e as MessageEvent).data as string));
        } catch {
          /* ignore */
        }
      });
      es.addEventListener('order-update', (e) => {
        try {
          onOrderUpdate(JSON.parse((e as MessageEvent).data as string));
        } catch {
          /* ignore */
        }
      });
      es.onerror = () => {
        if (!sseFailed) {
          sseFailed = true;
          es?.close();
          startPolling();
        }
      };
      setTimeout(() => {
        if (!sseFailed && !switchedToPolling) {
          switchedToPolling = true;
          es?.close();
          startPolling();
        }
      }, 5000);
    };

    // Polling fallback — works on split hosting (Netlify frontend → Render API)
    const startPolling = () => {
      if (pollTimer) return;
      const poll = async () => {
        try {
          const d = await api.get<{ items: Notif[]; unread: number }>('/api/admin/notifications?limit=20');
          setItems((prev) => {
            const known = new Set(prev.map((n) => n.id));
            const fresh = d.items.filter((n) => !known.has(n.id));
            if (fresh.length > 0) playChime();
            return [...fresh, ...prev].slice(0, 50);
          });
          setUnread(d.unread);
        } catch {
          /* not ready */
        }
      };
      poll();
      pollTimer = window.setInterval(poll, 30000); // every 30s
    };

    startSse();
    return () => {
      es?.close();
      if (pollTimer) window.clearInterval(pollTimer);
    };
  }, []);

  // Web-Audio chime (no asset needed)
  const playChime = () => {
    const now = Date.now();
    if (now - lastSound.current < 3000) return;
    lastSound.current = now;
    try {
      const ctx = soundRef.current || new AudioContext();
      soundRef.current = ctx;
      const play = () => {
        const t = ctx.currentTime;
        [880, 1174.66].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.0001, t + i * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.14, t + i * 0.12 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.35);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t + i * 0.12);
          osc.stop(t + i * 0.12 + 0.4);
        });
      };
      if (ctx.state === 'suspended') ctx.resume().then(play);
      else play();
    } catch {
      /* audio unavailable */
    }
  };

  const markRead = async () => {
    if (unread === 0) return;
    setUnread(0);
    setItems((prev) => prev.map((i) => ({ ...i, isRead: true })));
    try {
      await api.post('/api/admin/notifications/read', {});
    } catch {
      /* ignore */
    }
  };

  const openNotif = (n: Notif) => {
    setOpen(false);
    if (n.type === 'NEW_ORDER' && n.data.orderNumber) {
      navigate(`/admin/orders?q=${encodeURIComponent(n.data.orderNumber)}`);
    } else {
      navigate('/admin/orders');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) markRead();
        }}
        className="relative p-2.5 rounded-xl hover:bg-ink/5 text-ink/60"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -end-0.5 bg-red-500 text-white text-[10px] font-extrabold rounded-full h-[18px] min-w-[18px] flex items-center justify-center px-1 animate-pulse-soft">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute end-0 top-full mt-2 w-[340px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-lift border border-ink/8 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-ink/8">
            <p className="font-bold text-sm">Notifications</p>
            <button onClick={() => setOpen(false)} className="p-1 text-ink/40 hover:text-ink/70" aria-label="Close">
              <X size={15} />
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && <p className="p-6 text-center text-sm text-ink/40">No notifications yet</p>}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => openNotif(n)}
                className={`w-full text-start px-4 py-3 flex gap-3 border-b border-ink/5 hover:bg-brand-50/40 ${n.isRead ? '' : 'bg-brand-50/30'}`}
              >
                <span className="h-9 w-9 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                  {n.type === 'NEW_ORDER' ? <ShoppingCart size={16} /> : n.type === 'REVIEW' ? <Star size={16} /> : <Package size={16} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold">{n.title}</span>
                  <span className="block text-xs text-ink/55 truncate">{n.body}</span>
                  <span className="block text-[10px] text-ink/35 mt-0.5">{timeAgoEn(n.createdAt)}</span>
                </span>
                {!n.isRead && <span className="ms-auto mt-1.5 h-2 w-2 rounded-full bg-gold-500 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
