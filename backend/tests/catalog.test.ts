// Catalog tests: public product listing/search + admin product CRUD + security shapes.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app, Api, seedFixtures, cleanupFixtures } from './helpers';
import request from 'supertest';

let fixtures: Awaited<ReturnType<typeof seedFixtures>>;
let api: Api;
let adminApi: Api;

beforeAll(async () => {
  fixtures = await seedFixtures();
  api = new Api();
  await api.init();
  adminApi = new Api();
  await adminApi.init();
  const login = await adminApi.post('/api/admin/auth/login', { email: fixtures.admin.email, password: 'TestPass123!' });
  adminApi.capture(login);
});

afterAll(async () => {
  await cleanupFixtures(fixtures);
});

describe('Public catalog', () => {
  it('lists published products with pagination', async () => {
    const res = await api.get('/api/products?page=1&limit=5');
    expect(res.status).toBe(200);
    expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(2);
    expect(res.body.data.items[0].price).toBeTypeOf('number');
  });

  it('searches by title', async () => {
    const res = await api.get('/api/products?q=Product%20One');
    expect(res.status).toBe(200);
    expect(res.body.data.items.some((p: { title: string }) => p.title.includes('Product One'))).toBe(true);
  });

  it('filters by category slug', async () => {
    const res = await api.get(`/api/products?category=test-electronics`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
  });

  it('sorts by price ascending', async () => {
    const res = await api.get('/api/products?sort=price_asc&limit=10');
    const prices = res.body.data.items.map((p: { price: number }) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('returns product detail by slug with images and discount', async () => {
    const res = await api.get(`/api/products/${fixtures.p1.slug}`);
    expect(res.status).toBe(200);
    const p = res.body.data.product;
    expect(p.discountPercent).toBe(33); // 100 vs 150
    expect(p.images.length).toBe(1);
    expect(p.costPrice).toBeUndefined(); // never expose cost price publicly
  });

  it('404 for unknown product', async () => {
    const res = await api.get('/api/products/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('unknown API route returns consistent 404 shape (no stack traces)', async () => {
    const res = await request(app).get('/api/definitely-not-a-route');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('API route not found');
    expect(JSON.stringify(res.body)).not.toContain('at ');
    expect(JSON.stringify(res.body)).not.toContain('node_modules');
  });
});

describe('Admin product management', () => {
  let createdId = 0;

  it('creates a product (admin only)', async () => {
    const res = await adminApi.post('/api/admin/products', {
      title: 'Admin Created Product',
      titleAr: 'منتج إداري',
      sku: `TEST-ADM-${Date.now()}`,
      price: 199.5,
      compareAtPrice: 299,
      stock: 25,
      status: 'PUBLISHED',
      isFeatured: true,
      tags: ['test', 'admin'],
      specifications: [{ label: 'Color', value: 'Black' }],
      images: [{ url: '/images/products/speaker.jpg', isThumbnail: true }],
    });
    expect(res.status).toBe(201);
    createdId = res.body.data.id;
  });

  it('XSS payload in product title is stored as data (React escapes on render)', async () => {
    const res = await adminApi.post('/api/admin/products', {
      title: '<script>alert(1)</script>',
      sku: `TEST-XSS-${Date.now()}`,
      price: 10,
      stock: 1,
      status: 'DRAFT',
    });
    expect(res.status).toBe(201);
    const fetched = await api.get('/api/products?limit=1');
    expect(fetched.status).toBe(200);
    // API returns raw string (frontend escapes); no execution vector server-side
    const created = await adminApi.get(`/api/admin/products/${res.body.data.id}`);
    expect(created.body.data.product.titleEn).toContain('<script>');
  });

  it('validates required fields (422)', async () => {
    const res = await adminApi.post('/api/admin/products', { title: 'No price' });
    expect(res.status).toBe(422);
    expect(res.body.error.details).toBeDefined();
  });

  it('rejects duplicate SKU (409)', async () => {
    const res = await adminApi.post('/api/admin/products', {
      title: 'Dup SKU', sku: fixtures.p1.sku, price: 10, stock: 1,
    });
    expect(res.status).toBe(409);
  });

  it('updates a product', async () => {
    const res = await adminApi.patch(`/api/admin/products/${createdId}`, { price: 250, isBestSeller: true });
    expect(res.status).toBe(200);
    const fetched = await adminApi.get(`/api/admin/products/${createdId}`);
    expect(fetched.body.data.product.price).toBe(250);
    expect(fetched.body.data.product.isBestSeller).toBe(true);
  });

  it('duplicates a product', async () => {
    const res = await adminApi.post(`/api/admin/products/${createdId}/duplicate`);
    expect(res.status).toBe(201);
    const dup = await adminApi.get(`/api/admin/products/${res.body.data.id}`);
    expect(dup.body.data.product.titleEn).toContain('(Copy)');
    await adminApi.del(`/api/admin/products/${res.body.data.id}`);
  });

  it('deletes a product (soft delete)', async () => {
    const res = await adminApi.del(`/api/admin/products/${createdId}`);
    expect(res.status).toBe(200);
    const list = await adminApi.get('/api/admin/products?q=Admin%20Created');
    expect(list.body.data.items.length).toBe(0);
  });
});
