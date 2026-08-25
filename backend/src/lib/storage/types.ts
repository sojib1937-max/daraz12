export interface StorageDriver {
  put(key: string, data: Buffer, contentType: string, publicUrl?: string): Promise<string>;
  delete(keyOrUrl: string): Promise<void>;
}
