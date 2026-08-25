// COD checkout tests: totals, coupon, shipping zones, stock, fraud flags, tracking.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Api, seedFixtures, cleanupFixtures } from './helpers';
import { prisma } from '../src/lib/prisma';
import { resetSettingsCache } from '../src/lib/settings';

let fixtures: Awaited<ReturnType<typeof seedFixtures>>;
let api: Api;

const PHONE = '0509990100';

beforeAll(async () => {
  fixtures = await seedFixtures();
  api = new Api();
  await api.init();
  await prisma.shippingZone.deleteMany({});
  await prisma.shippingZone.createMany({
    data: [
      { name: 'Dubai', emirates: ['DUBAI'], fee: 15, codFee: 0, sortOrder: 1 },
      { name: 'Other', emirates: ['ABU_DHABI', 'SHARJAH'], fee: 25, codFee: 0, sortOrder: 2 },
    ],
  });
  // Isolate shipping rules for deterministic totals: free shipping at AED 250
  await prisma.storeSetting.upsert({
    where: { key: 'shipping.freeShippingThreshold' },
    create: { key: 'shipping.freeShippingThreshold', value: 250 },
    update: { value: 250 },
  });
  await prisma.storeSetting.upsert({
    where: { key: 'shipping.minOrderAmount' },
    create: { key: 'shipping.minOrderAmount', value: 0 },
    update: { value: 0 },
  });
  // Reset stock consumed by previous runs
  await prisma.product.update({ where: { id: fixtures.p1.id }, data: { stock: 10 } });
  await prisma.product.update({ where: { id: fixtures.p2.id }, data: { stock: 5 } });
  await prisma.order.deleteMany({ where: { customerPhone: { startsWith: '050999' } } });
  await prisma.customer.deleteMany({ where: { OR: [{ phone: { startsWith: '050999' } }, { phone: { startsWith: '97150999' } }] } });
  resetSettingsCache();
});

afterAll(async () => {
  await cleanupFixtures(fixtures);
  await prisma.shippingZone.deleteMany({});
});

const baseCustomer = {
  name: 'COD Tester',
  phone: PHONE,
  emirate: 'DUBAI',
  area: 'Test Area',
  address: 'Test Street 1',
};

describe('COD checkout', () => {
  it('creates a COD order with correct totals (price + Dubai shipping)', async () => {
    const res = await api.post('/api/checkout/cod', {
      items: [{ productId: fixtures.p1.id, quantity: 2 }],
      customer: baseCustomer,
    });
    expect(res.status).toBe(201);
    const order = res.body.data.order;
    expect(order.subtotal).toBe(200);
    expect(order.shippingFee).toBe(15);
    expect(order.total).toBe(215);
    expect(order.status).toBe('NEW');
    expect(order.orderNumber).toMatch(/^DXB-\d{8}-\d{6}$/);
    expect(order.riskFlags).toEqual([]);
  });

  it('applies free shipping above threshold', async () => {
    const res = await api.post('/api/checkout/cod', {
      items: [{ productId: fixtures.p1.id, quantity: 3 }], // 300 AED
      customer: { ...baseCustomer, phone: '0509990101' },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.order.shippingFee).toBe(0);
  });

  it('charges the correct fee for other emirates', async () => {
    const res = await api.post('/api/checkout/cod', {
      items: [{ productId: fixtures.p2.id, quantity: 1 }], // 50 AED
      customer: { ...baseCustomer, phone: '0509990102', emirate: 'ABU_DHABI' },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.order.shippingFee).toBe(25);
    expect(res.body.data.order.total).toBe(75);
  });

  it('applies percentage coupon with minimum order rule', async () => {
    await prisma.coupon.create({
      data: { code: 'TEST10', type: 'PERCENTAGE', value: 10, minOrderAmount: 150, perCustomerLimit: 1, isActive: true },
    });
    // below minimum
    const below = await api.post('/api/checkout/cod', {
      items: [{ productId: fixtures.p2.id, quantity: 1 }],
      customer: { ...baseCustomer, phone: '0509990103' },
      couponCode: 'TEST10',
    });
    expect(below.status).toBe(400);
    // above minimum
    const ok = await api.post('/api/checkout/cod', {
      items: [{ productId: fixtures.p1.id, quantity: 2 }],
      customer: { ...baseCustomer, phone: '0509990103' },
      couponCode: 'TEST10',
    });
    expect(ok.status).toBe(201);
    expect(ok.body.data.order.discount).toBe(20); // 10% of 200
    expect(ok.body.data.order.couponCode).toBe('TEST10');
  });

  it('rejects invalid coupon codes', async () => {
    const res = await api.post('/api/checkout/cod', {
      items: [{ productId: fixtures.p1.id, quantity: 1 }],
      customer: { ...baseCustomer, phone: '0509990104' },
      couponCode: 'NOPE123',
    });
    expect(res.status).toBe(400);
  });

  it('flags duplicate identical orders from the same phone (fraud detection)', async () => {
    const first = await api.post('/api/checkout/cod', {
      items: [{ productId: fixtures.p2.id, quantity: 1 }],
      customer: { ...baseCustomer, phone: '0509990105' },
    });
    expect(first.status).toBe(201);
    const second = await api.post('/api/checkout/cod', {
      items: [{ productId: fixtures.p2.id, quantity: 1 }],
      customer: { ...baseCustomer, phone: '0509990105' },
    });
    expect(second.status).toBe(201);
    const flags = second.body.data.order.riskFlags;
    expect(flags.some((f: { type: string }) => f.type === 'DUPLICATE_ORDER')).toBe(true);
  });

  it('rejects orders exceeding available stock', async () => {
    const res = await api.post('/api/checkout/cod', {
      items: [{ productId: fixtures.p2.id, quantity: 20 }], // stock is 5
      customer: { ...baseCustomer, phone: '0509990106' },
    });
    expect(res.status).toBe(400);
  });

  it('decrements stock after order', async () => {
    const before = await prisma.product.findUnique({ where: { id: fixtures.p1.id } });
    const res = await api.post('/api/checkout/cod', {
      items: [{ productId: fixtures.p1.id, quantity: 1 }],
      customer: { ...baseCustomer, phone: '0509990107' },
    });
    expect(res.status).toBe(201);
    const after = await prisma.product.findUnique({ where: { id: fixtures.p1.id } });
    expect(before!.stock - after!.stock).toBe(1);
  });

  it('rejects invalid UAE phone numbers at checkout', async () => {
    const res = await api.post('/api/checkout/cod', {
      items: [{ productId: fixtures.p1.id, quantity: 1 }],
      customer: { ...baseCustomer, phone: '1111111111' }, // valid length, invalid UAE prefix
    });
    expect(res.status).toBe(400);
  });

  it('tracks order by order number + phone (no PII leak)', async () => {
    const created = await api.post('/api/checkout/cod', {
      items: [{ productId: fixtures.p1.id, quantity: 1 }],
      customer: { ...baseCustomer, phone: '0509990108' },
    });
    const orderNumber = created.body.data.order.orderNumber;
    const tracked = await api.get(`/api/orders/track?orderId=${orderNumber}&phone=0509990108`);
    expect(tracked.status).toBe(200);
    expect(tracked.body.data.orderNumber).toBe(orderNumber);
    // must not expose the address or full PII
    expect(tracked.body.data.address).toBeUndefined();
    expect(tracked.body.data.customerPhone).toBeUndefined();
    // wrong phone → not found
    const wrong = await api.get(`/api/orders/track?orderId=${orderNumber}&phone=0509990000`);
    expect(wrong.status).toBe(404);
  });
});
