// Local disk storage driver — default. Files are served by the backend at /uploads/*
import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config';
import { AppError } from '../errors';
import type { StorageDriver } from './types';

export class LocalStorage implements StorageDriver {
  private baseDir: string;

  constructor(baseDir = config.storageLocalDir) {
    this.baseDir = baseDir;
  }

  private resolve(key: string): string {
    // Prevent path traversal.
    const clean = key.replace(/^\/+/, '');
    const full = path.resolve(this.baseDir, clean);
    if (!full.startsWith(path.resolve(this.baseDir))) {
      throw AppError.badRequest('Invalid path');
    }
    return full;
  }

  async put(key: string, data: Buffer): Promise<string> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    // URLs are relative so the same code works behind any domain/proxy.
    return `${config.storageBaseUrl}/${key}`;
  }

  async delete(keyOrUrl: string): Promise<void> {
    const key = keyOrUrl.replace(`${config.storageBaseUrl}/`, '');
    try {
      await fs.unlink(this.resolve(key));
    } catch {
      /* already gone */
    }
  }
}
