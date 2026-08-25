// Storage abstraction — cloud-compatible object storage.
// Driver "local" (default, zero-config, works everywhere) or "s3" (S3-compatible).
import { config } from '../../config';
import { AppError } from '../errors';
import { logger } from '../logger';
import type { StorageDriver } from './types';

async function getDriver(): Promise<StorageDriver> {
  if (config.storageDriver === 's3') {
    const { S3Storage } = await import('./s3');
    return new S3Storage();
  }
  const { LocalStorage } = await import('./local');
  return new LocalStorage();
}

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

/** Allowed image MIME types + extensions. */
export const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
  'image/x-icon',
]);

export function validateImageFile(file: UploadedFile, maxBytes: number) {
  if (!file || !file.buffer) throw AppError.badRequest('No file uploaded');
  if (!ALLOWED_MIME.has(file.mimetype)) {
    throw AppError.badRequest(`Unsupported file type "${file.mimetype}". Allowed: JPEG, PNG, WEBP, GIF, AVIF, SVG, ICO.`);
  }
  const ext = (file.originalname.split('.').pop() || '').toLowerCase();
  const allowedExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg', 'ico'];
  if (!allowedExt.includes(ext)) {
    throw AppError.badRequest(`Unsupported file extension ".${ext}".`);
  }
  if (file.size > maxBytes) {
    throw AppError.badRequest(`File too large (max ${Math.round(maxBytes / 1024 / 1024)} MB).`);
  }
}

export async function storeImage(
  file: UploadedFile,
  folder: string,
  opts: { publicUrl?: string; alt?: string; kind?: string } = {}
) {
  validateImageFile(file, config.uploadMaxMb * 1024 * 1024);
  const driver = await getDriver();
  const safeFolder = folder.replace(/[^a-z0-9-_/]/gi, '');
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${(file.originalname.split('.').pop() || 'jpg').toLowerCase()}`;
  const key = `${safeFolder}/${safeName}`;
  const url = await driver.put(key, file.buffer, file.mimetype, opts.publicUrl);
  logger.info('Image stored', { key, driver: config.storageDriver });
  return { key, url, filename: file.originalname, mimeType: file.mimetype, size: file.size };
}

export async function deleteStored(keyOrUrl: string) {
  try {
    const driver = await getDriver();
    await driver.delete(keyOrUrl);
  } catch (err) {
    logger.warn('Failed to delete stored file', { keyOrUrl, err: (err as Error).message });
  }
}

export function publicUrlOf(keyOrUrl: string): string {
  if (/^https?:\/\//.test(keyOrUrl)) return keyOrUrl;
  return `${config.apiUrl}${config.storageBaseUrl}/${keyOrUrl.replace(/^\/+/, '')}`;
}
