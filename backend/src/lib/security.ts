// Security primitives: password hashing, opaque session tokens, CSRF, reset tokens.
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/** Generate a cryptographically-random opaque token (e.g. session cookie value). */
export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/** Hash a token for storage (sessions, password-reset tokens). */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Timing-safe comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// ---- CSRF: double-submit cookie pattern ----
// A random value is set in a readable cookie; state-changing requests must
// echo it in the X-CSRF-Token header. SameSite=Lax cookies already stop the
// most common CSRF vectors; this adds a second layer for older browsers.

export function generateCsrfToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function csrfTokenValid(cookieValue: string | undefined, headerValue: string | undefined): boolean {
  if (!cookieValue || !headerValue) return false;
  return safeEqual(cookieValue, headerValue);
}
