import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 20000,
    hookTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://desertcart_test:desertcart_test@127.0.0.1:5432/desertcart_test?schema=public',
      DEMO_MODE: 'true',
      SESSION_SECRET: 'test-session-secret',
      // Tests hit the app in-process (supertest) — plain cookie handling, no TLS
      COOKIE_SECURE: 'false',
      COOKIE_SAME_SITE: 'lax',
      STORAGE_DRIVER: 'local',
      STORAGE_LOCAL_DIR: '/tmp/desertcart-test-uploads',
      EMAIL_DRIVER: 'console',
      SMS_DRIVER: 'console',
      WHATSAPP_DRIVER: 'console',
      RATE_LIMIT_GLOBAL_MAX: '100000',
      RATE_LIMIT_AUTH_MAX: '100000',
      RATE_LIMIT_ORDER_MAX: '100000',
    },
    include: ['tests/**/*.test.ts'],
    // Run sequentially — tests share one database
    fileParallelism: false,
  },
});
