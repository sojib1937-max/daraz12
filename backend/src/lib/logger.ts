// Tiny structured logger. Never logs secrets. In production it prints JSON lines.
type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const current = LEVELS[(process.env.LOG_LEVEL as Level) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')];

function write(level: Level, msg: string, meta?: Record<string, unknown>) {
  if (LEVELS[level] < current) return;
  const line: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg,
  };
  if (meta && Object.keys(meta).length) {
    // Redact anything that looks sensitive before logging.
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(meta)) {
      if (/pass|secret|token|key|authorization|cookie/i.test(k)) safe[k] = '[REDACTED]';
      else safe[k] = v;
    }
    line.meta = safe;
  }
  if (process.env.NODE_ENV === 'production') {
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](JSON.stringify(line));
  } else {
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](`[${level.toUpperCase()}] ${msg}`, meta ? JSON.stringify(line.meta) : '');
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => write('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => write('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => write('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => write('error', msg, meta),
};
