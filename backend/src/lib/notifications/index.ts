// Notification service abstraction — Email / SMS / WhatsApp providers.
// Drivers: "console" (dev, logs), "smtp" (email via SMTP), "http" (generic webhook
// for SMS/WhatsApp — plug any provider such as Twilio, WhatsApp Business API...).
// Provider credentials live in environment variables, never in code.
import { config } from '../../config';
import { logger } from '../logger';

interface SendEmailArgs {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(args: SendEmailArgs): Promise<{ ok: boolean; via: string }> {
  if (config.email.driver === 'smtp') {
    try {
      const nodemailer = (await import('nodemailer')).default;
      const transport = nodemailer.createTransport({
        host: config.email.smtpHost,
        port: config.email.smtpPort,
        secure: config.email.smtpSecure,
        auth: config.email.smtpUser ? { user: config.email.smtpUser, pass: config.email.smtpPass } : undefined,
      });
      await transport.sendMail({
        from: config.email.from,
        to: args.to,
        subject: args.subject,
        text: args.text,
        html: args.html || undefined,
      });
      logger.info('Email sent via SMTP', { to: args.to, subject: args.subject });
      return { ok: true, via: 'smtp' };
    } catch (err) {
      logger.error('SMTP send failed', { err: (err as Error).message });
      return { ok: false, via: 'smtp' };
    }
  }
  logger.info('[EMAIL:console]', { to: args.to, subject: args.subject, text: args.text.slice(0, 500) });
  return { ok: true, via: 'console' };
}

export async function sendSms(to: string, message: string): Promise<{ ok: boolean; via: string }> {
  if (config.sms.driver === 'http' && config.sms.webhookUrl) {
    try {
      await fetch(config.sms.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.sms.apiKey}` },
        body: JSON.stringify({ to, from: config.sms.from, message }),
      });
      return { ok: true, via: 'http' };
    } catch (err) {
      logger.error('SMS webhook failed', { err: (err as Error).message });
      return { ok: false, via: 'http' };
    }
  }
  logger.info(`[SMS:console] to=${to}`, { message });
  return { ok: true, via: 'console' };
}

export async function sendWhatsApp(to: string, message: string): Promise<{ ok: boolean; via: string }> {
  if (config.whatsapp.driver === 'http' && config.whatsapp.webhookUrl) {
    try {
      await fetch(config.whatsapp.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.whatsapp.apiKey}` },
        body: JSON.stringify({ to, message }),
      });
      return { ok: true, via: 'http' };
    } catch (err) {
      logger.error('WhatsApp webhook failed', { err: (err as Error).message });
      return { ok: false, via: 'http' };
    }
  }
  logger.info(`[WHATSAPP:console] to=${to}`, { message });
  return { ok: true, via: 'console' };
}

// ---------- Order notification templates ----------

export function orderConfirmationSms(order: { orderNumber: string; total: string; emirate: string; items: string }) {
  return `DesertCart: Order ${order.orderNumber} confirmed for AED ${order.total}. Delivery to ${order.emirate}. Items: ${order.items}. Pay cash on delivery. Thank you!`;
}

export function orderStatusSms(orderNumber: string, statusLabel: string) {
  return `DesertCart: Your order ${orderNumber} is now: ${statusLabel}. Thank you for shopping with us!`;
}

export function orderWhatsAppTemplate(order: {
  orderNumber: string;
  total: string;
  emirate: string;
  customerName: string;
}) {
  return `Hello ${order.customerName}! 👋\n\nYour DesertCart order *${order.orderNumber}* for *AED ${order.total}* has been confirmed ✅\nDelivery: ${order.emirate}\nPayment: Cash on Delivery 💵\n\nTrack your order anytime from our website. Thank you for shopping with us! 🛍️`;
}
