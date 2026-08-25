// Test helpers: app instance, CSRF-enabled request builder, seed fixtures.
import { beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

export const app = createApp();

// --- Seed minimal fixtures (products, categories, admin) ---
export async function seedFixtures() {
  const cat = await prisma.category.upsert({
    where: { slug: 'test-electronics' },
    create: { name: 'Test Electronics', slug: 'test-electronics', isActive: true },
    update: {},
  });
  const p1 = await prisma.product.create({
    data: {
      sku: `TEST-P1-${Date.now()}`,
      slug: `test-product-1-${Date.now()}`,
      title: 'Test Product One',
      price: 100,
      compareAtPrice: 150,
      stock: 10,
      categoryId: cat.id,
      status: 'PUBLISHED',
      images: { create: [{ url: '/images/products/blender.jpg', sortOrder: 0, isThumbnail: true }] },
    },
  });
  const p2 = await prisma.product.create({
    data: {
      sku: `TEST-P2-${Date.now()}`,
      slug: `test-product-2-${Date.now()}`,
      title: 'Test Product Two',
      price: 50,
      stock: 5,
      categoryId: cat.id,
      status: 'PUBLISHED',
    },
  });
  const admin = await prisma.adminUser.create({
    data: {
      email: `test-admin-${Date.now()}@desertcart.test`,
      name: 'Test Admin',
      passwordHash: await bcrypt.hash('TestPass123!', 10),
      role: 'SUPER_ADMIN',
    },
  });
  const viewer = await prisma.adminUser.create({
    data: {
      email: `test-viewer-${Date.now()}@desertcart.test`,
      name: 'Test Viewer',
      passwordHash: await bcrypt.hash('TestPass123!', 10),
      role: 'VIEWER',
    },
  });
  return { cat, p1, p2, admin, viewer };
}

export async function cleanupFixtures(fixtures: Awaited<ReturnType<typeof seedFixtures>>) {
  await prisma.order.deleteMany({ where: { customerPhone: { startsWith: '050999' } } });
  // phones are stored normalized (9715…)
  await prisma.customer.deleteMany({ where: { OR: [{ phone: { startsWith: '050999' } }, { phone: { startsWith: '97150999' } }] } });
  await prisma.product.deleteMany({ where: { id: { in: [fixtures.p1.id, fixtures.p2.id] } } });
  await prisma.adminUser.deleteMany({ where: { id: { in: [fixtures.admin.id, fixtures.viewer.id] } } });
  await prisma.category.deleteMany({ where: { slug: 'test-electronics' } });
}

// --- CSRF + cookie aware client ---
export class Api {
  private cookies: string[] = [];
  private csrf = '';

  async init() {
    const res = await request(app).get('/api/health');
    this.cookies = res.headers['set-cookie'] as unknown as string[];
    const csrfCookie = (this.cookies || []).find((c) => c.startsWith('dc_csrf='));
    this.csrf = csrfCookie ? decodeURIComponent(csrfCookie.split(';')[0].split('=')[1]) : '';
  }

  private headers(): Record<string, string> {
    return {
      ...(this.csrf ? { 'X-CSRF-Token': this.csrf } : {}),
    };
  }

  get(path: string) {
    return request(app).get(path).set('Cookie', this.cookies);
  }
  post(path: string, body?: unknown) {
    let r = request(app).post(path).set('Cookie', this.cookies).set('Content-Type', 'application/json').set('Accept', 'application/json');
    if (body !== undefined) r = r.send(body);
    r = r.set(this.headers());
    return r;
  }
  patch(path: string, body?: unknown) {
    let r = request(app).patch(path).set('Cookie', this.cookies).set('Content-Type', 'application/json').set('Accept', 'application/json');
    if (body !== undefined) r = r.send(body);
    r = r.set(this.headers());
    return r;
  }
  put(path: string, body?: unknown) {
    let r = request(app).put(path).set('Cookie', this.cookies).set('Content-Type', 'application/json').set('Accept', 'application/json');
    if (body !== undefined) r = r.send(body);
    r = r.set(this.headers());
    return r;
  }
  del(path: string) {
    return request(app).delete(path).set('Cookie', this.cookies).set(this.headers());
  }
  capture(res: request.Response) {
    const setCookies = res.headers['set-cookie'] as unknown as string[] | undefined;
    if (setCookies) {
      // merge session cookies
      for (const c of setCookies) {
        const name = c.split('=')[0];
        this.cookies = this.cookies.filter((x) => !x.startsWith(`${name}=`));
        this.cookies.push(c.split(';')[0]);
      }
    }
  }
}

beforeAll(async () => {
  // ensure fresh test DB state for clean runs
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "AnalyticsEvent", "CartSession", "CouponUsage", "CouponProduct", "CouponCategory", "OrderStatusHistory", "OrderItem", "Order", "Review", "WishlistItem", "FlashSaleItem", "FlashSale", "Coupon", "NewsletterSubscriber", "PasswordResetToken", "AdminSession", "CustomerSession", "Address", "AuditLog", "Notification" RESTART IDENTITY CASCADE');
  await prisma.customer.deleteMany({ where: { phone: { startsWith: '97150999' } } });
});

afterAll(async () => {
  await prisma.$disconnect();
});
