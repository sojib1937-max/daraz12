// Shipping zone + coupon validation unit-level tests via the API.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Api, seedFixtures, cleanupFixtures } from './helpers';
import { prisma } from '../src/lib/prisma';

let fixtures: Awaited<ReturnType<typeof seedFixtures>>;
let api: Api;

beforeAll(async () => {
  fixtures = await seedFixtures();
  api = new Api();
  await api.init();
  await prisma.coupon.deleteMany({ where: { code: { startsWith: 'TEST' } } });
});

afterAll(async () => {
  await cleanupFixtures(fixtures);
  await prisma.coupon.deleteMany({ where: { code: { startsWith: 'TEST' } } });
});

describe('Coupon validation endpoint', () => {
  it('validates a percentage coupon and computes discount', async () => {
    await prisma.coupon.create({
      data: { code: 'TESTPCT', type: 'PERCENTAGE', value: 15, minOrderAmount: 100, maxDiscount: 20, perCustomerLimit: 1, isActive: true },
    });
    const res = await api.post('/api/coupons/validate', { code: 'TESTPCT', subtotal: 200 });
    expect(res.status).toBe(200);
    expect(res.body.data.discount).toBe(20); // capped at maxDiscount
  });

  it('rejects expired coupons', async () => {
    await prisma.coupon.create({
      data: { code: 'TESTEXP', type: 'PERCENTAGE', value: 10, expiresAt: new Date(Date.now() - 1000), perCustomerLimit: 1, isActive: true },
    });
    const res = await api.post('/api/coupons/validate', { code: 'TESTEXP', subtotal: 100 });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('expired');
  });

  it('rejects below-minimum orders', async () => {
    const res = await api.post('/api/coupons/validate', { code: 'TESTPCT', subtotal: 50 });
    expect(res.status).toBe(400);
  });

  it('rejects unknown codes with 404', async () => {
    const res = await api.post('/api/coupons/validate', { code: 'ZZZZZZ', subtotal: 100 });
    expect(res.status).toBe(404);
  });
});

describe('Shipping estimate endpoint', () => {
  it('computes Dubai fee and free shipping threshold', async () => {
    await prisma.shippingZone.createMany({
      data: [{ name: 'Dubai', emirates: ['DUBAI'], fee: 15, sortOrder: 1 }],
      skipDuplicates: true,
    });
    const res = await api.post('/api/checkout/shipping-estimate', {
      items: [{ productId: fixtures.p1.id, quantity: 1 }],
      emirate: 'DUBAI',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.shippingFee).toBe(15);
    expect(res.body.data.total).toBe(115);
  });

  it('requires emirate selection', async () => {
    const res = await api.post('/api/checkout/shipping-estimate', {
      items: [{ productId: fixtures.p1.id, quantity: 1 }],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.requiresSelection).toBe(true);
  });

  it('validates emirate enum values', async () => {
    const res = await api.post('/api/checkout/shipping-estimate', {
      items: [{ productId: fixtures.p1.id, quantity: 1 }],
      emirate: 'BOGUS',
    });
    expect(res.status).toBe(422);
  });
});
