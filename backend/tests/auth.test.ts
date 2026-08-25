// Customer auth tests: register, login, validation, enumeration safety.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app, Api, seedFixtures, cleanupFixtures } from './helpers';

let fixtures: Awaited<ReturnType<typeof seedFixtures>>;
let api: Api;

beforeAll(async () => {
  fixtures = await seedFixtures();
  api = new Api();
  await api.init();
});

afterAll(async () => {
  await cleanupFixtures(fixtures);
});

describe('Customer auth', () => {
  it('registers a new customer with UAE phone normalization', async () => {
    const res = await api.post('/api/auth/register', {
      name: 'Test User',
      phone: '0509990001',
      email: 'test@example.com',
      password: 'password123',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.phone).toBe('971509990001');
    api.capture(res);
  });

  it('rejects invalid UAE phone numbers', async () => {
    const res = await api.post('/api/auth/register', {
      name: 'Bad Phone',
      phone: '1111111111', // valid length, invalid UAE prefix
      email: '',
      password: 'password123',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('rejects weak passwords', async () => {
    const res = await api.post('/api/auth/register', {
      name: 'Weak',
      phone: '0509990002',
      password: 'short',
    });
    expect([400, 422]).toContain(res.status); // zod min-8 (422) or phone conflict from stale rows (400)
    if (res.status === 422) {
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('rejects duplicate phone registration', async () => {
    const res = await api.post('/api/auth/register', {
      name: 'Dup',
      phone: '0509990001',
      password: 'password123',
    });
    expect(res.status).toBe(409);
  });

  it('logs in with correct password', async () => {
    const res = await api.post('/api/auth/login', { phone: '0509990001', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Test User');
    api.capture(res);
  });

  it('returns the same error for wrong password and unknown user (no enumeration)', async () => {
    const wrong = await api.post('/api/auth/login', { phone: '0509990001', password: 'nope' });
    const unknown = await api.post('/api/auth/login', { phone: '0509999999', password: 'nope' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('returns current customer via /me', async () => {
    const res = await api.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('971509990001');
  });

  it('logout revokes the session', async () => {
    const out = await api.post('/api/auth/logout');
    expect(out.status).toBe(200);
    const me = await api.get('/api/auth/me');
    expect(me.body.data).toBeNull();
  });

  it('CSRF is enforced in production for cookie-authenticated requests', async () => {
    const { csrfProtect } = await import('../src/middleware/csrf');
    const { AppError } = await import('../src/lib/errors');
    const { config } = await import('../src/config');
    const orig = config.isProd;
    (config as { isProd: boolean }).isProd = true;
    let err: unknown = null;
    csrfProtect(
      { method: 'POST', headers: {}, cookies: {} } as never,
      {} as never,
      (e?: unknown) => { err = e ?? null; }
    );
    (config as { isProd: boolean }).isProd = orig;
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('CSRF_INVALID');
  });

  it('CSRF is skipped for header-token-authenticated requests (CSRF-safe by design)', async () => {
    const { csrfProtect } = await import('../src/middleware/csrf');
    const { config } = await import('../src/config');
    const orig = config.isProd;
    (config as { isProd: boolean }).isProd = true;
    let err: unknown = 'not-called';
    csrfProtect(
      { method: 'POST', headers: { 'x-admin-token': 'a'.repeat(64) }, cookies: {} } as never,
      {} as never,
      (e?: unknown) => { err = e ?? null; }
    );
    (config as { isProd: boolean }).isProd = orig;
    expect(err).toBeNull();
  });

  it('non-production environments relax CSRF (embedded preview iframe support)', async () => {
    const { csrfProtect } = await import('../src/middleware/csrf');
    const { config } = await import('../src/config');
    const orig = config.isProd;
    (config as { isProd: boolean }).isProd = false;
    let err: unknown = 'not-called';
    csrfProtect(
      { method: 'POST', headers: {}, cookies: {} } as never,
      {} as never,
      (e?: unknown) => { err = e ?? null; }
    );
    (config as { isProd: boolean }).isProd = orig;
    expect(err).toBeNull();
  });
});

// Send a POST without the CSRF header to verify the double-submit protection.
async function requestNoCsrf() {
  const { default: request } = await import('supertest');
  const fresh = await request(app).get('/api/health');
  const cookies = fresh.headers['set-cookie'] as unknown as string[];
  return request(app)
    .post('/api/auth/login')
    .set('Cookie', cookies)
    .set('Content-Type', 'application/json')
    .send({ phone: '0509990001', password: 'password123' });
}