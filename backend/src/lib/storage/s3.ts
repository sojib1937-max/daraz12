// S3-compatible object storage driver (AWS S3, Cloudflare R2, DigitalOcean Spaces, ...).
// Configure via S3_* environment variables; STORAGE_DRIVER=s3.
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../../config';
import { AppError } from '../errors';
import type { StorageDriver } from './types';

export class S3Storage implements StorageDriver {
  private client: S3Client;
  private bucket: string;
  private publicBaseUrl: string;

  constructor() {
    if (!config.s3.bucket || !config.s3.accessKeyId || !config.s3.secretAccessKey) {
      throw AppError.badRequest('S3 storage selected but S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY are not configured');
    }
    this.bucket = config.s3.bucket;
    this.publicBaseUrl = config.s3.publicBaseUrl || `https://${this.bucket}.s3.${config.s3.region || 'us-east-1'}.amazonaws.com`;
    this.client = new S3Client({
      region: config.s3.region || 'us-east-1',
      endpoint: config.s3.endpoint,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
    });
  }

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
    return `${this.publicBaseUrl}/${key}`;
  }

  async delete(keyOrUrl: string): Promise<void> {
    let key = keyOrUrl;
    if (keyOrUrl.startsWith('http')) {
      const url = new URL(keyOrUrl);
      key = url.pathname.replace(/^\//, '');
    }
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
