// Admin API router. Everything under /api/admin is protected by
// requireAdmin (session cookie) + per-route RBAC permissions.
// The admin login flow lives at /api/admin/auth/*.
import { Router } from 'express';
import { requireAdmin } from '../../middleware/adminAuth';
import { adminAuthRouter } from './auth';
import { dashboardRouter } from './dashboard';
import { productsRouter } from './products';
import { categoriesRouter } from './categories';
import { ordersRouter } from './orders';
import { customersRouter } from './customers';
import { reviewsRouter } from './reviews';
import { couponsRouter } from './coupons';
import { flashSalesRouter } from './flashsales';
import { shippingRouter } from './shipping';
import { settingsRouter } from './settings';
import { homepageRouter } from './homepage';
import { mediaRouter } from './media';
import { usersRouter } from './users';
import { auditRouter, notificationsRouter, analyticsRouter, cartsRouter } from './misc';

export const adminRouter = Router();

// Auth endpoints (no session required — they create sessions)
adminRouter.use('/auth', adminAuthRouter);

// Everything below requires a valid admin session
adminRouter.use(requireAdmin);

adminRouter.use('/dashboard', dashboardRouter);
adminRouter.use('/products', productsRouter);
adminRouter.use('/categories', categoriesRouter);
adminRouter.use('/orders', ordersRouter);
adminRouter.use('/customers', customersRouter);
adminRouter.use('/reviews', reviewsRouter);
adminRouter.use('/coupons', couponsRouter);
adminRouter.use('/flash-sales', flashSalesRouter);
adminRouter.use('/shipping', shippingRouter);
adminRouter.use('/settings', settingsRouter);
adminRouter.use('/homepage', homepageRouter);
adminRouter.use('/media', mediaRouter);
adminRouter.use('/users', usersRouter);
adminRouter.use('/audit', auditRouter);
adminRouter.use('/notifications', notificationsRouter);
adminRouter.use('/analytics', analyticsRouter);
adminRouter.use('/carts', cartsRouter);
