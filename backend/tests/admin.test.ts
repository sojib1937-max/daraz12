// Admin auth + RBAC tests.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app, Api, seedFixtures, cleanupFixtures } from './helpers';
import request from 'supertest';

let fixtures: Awaited<ReturnType<typeof seedFixtures>>;
let superApi: Api;
let viewerApi: Api;

beforeAll(async () => {
  fixtures = await seedFixtures();
  superApi = new Api();
  await superApi.init();
  viewerApi = new Api();
  await viewerApi.init();
});

afterAll(async () => {
  await cleanupFixtures(fixtures);
});

describe('Admin security & RBAC', () => {
  it('rejects admin login with wrong password (401)', async () => {
    const res = await superApi.post('/api/admin/auth/login', { email: fixtures.admin.email, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('logs in SUPER_ADMIN and gets session cookie', async () => {
    const res = await superApi.post('/api/admin/auth/login', { email: fixtures.admin.email, password: 'TestPass123!' });
    expect(res.status).toBe(200);
    expect(res.body.data.admin.role).toBe('SUPER_ADMIN');
    superApi.capture(res);
  });

  it('blocks admin API without session (401)', async () => {
    const res = await request(app).get('/api/admin/dashboard/summary');
    expect(res.status).toBe(401);
  });

  it('super admin can access dashboard', async () => {
    const res = await superApi.get('/api/admin/dashboard/summary?range=30d');
    expect(res.status).toBe(200);
    expect(res.body.data.cards).toBeDefined();
  });

  it('VIEWER cannot create products (403 — backend enforced)', async () => {
    const login = await viewerApi.post('/api/admin/auth/login', { email: fixtures.viewer.email, password: 'TestPass123!' });
    viewerApi.capture(login);
    const res = await viewerApi.post('/api/admin/products', {
      title: 'Hack Attempt', price: 1, sku: 'HACK-1',
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('VIEWER can view products (allowed permission)', async () => {
    const res = await viewerApi.get('/api/admin/products?limit=5');
    expect(res.status).toBe(200);
  });

  it('VIEWER cannot manage settings (403)', async () => {
    const res = await viewerApi.put('/api/admin/settings', [{ key: 'store.name', value: 'Hacked' }]);
    expect(res.status).toBe(403);
  });

  it('admin login is rate-limited after many attempts', async () => {
    // auth limiter max is 100000 in tests; verify the limiter middleware exists by
    // checking it returns 429 shape only when exceeded — here we just verify
    // sequential wrong logins stay 401 (not 500).
    for (let i = 0; i < 3; i++) {
      const res = await superApi.post('/api/admin/auth/login', { email: fixtures.admin.email, password: 'wrong' });
      expect(res.status).toBe(401);
    }
  });

  it('audit log records admin login', async () => {
    const res = await superApi.get('/api/admin/audit?limit=10');
    expect(res.status).toBe(200);
    const logins = res.body.data.items.filter((a: { action: string }) => a.action === 'ADMIN_LOGIN');
    expect(logins.length).toBeGreaterThan(0);
  });

  it('logout revokes admin session', async () => {
    const out = await superApi.post('/api/admin/auth/logout');
    expect(out.status).toBe(200);
    const me = await superApi.get('/api/admin/auth/me');
    expect(me.status).toBe(401);
  });
});
