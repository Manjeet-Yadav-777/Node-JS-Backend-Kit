export interface StorageFile {
  key?: string;
  originalName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}

export interface UploadOptions {
  prefix?: string;
  isPublic?: boolean;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  mimeType: string;
  provider: string;
}

export interface IStorageProvider {
  /**
   * Uploads a file to the underlying storage provider.
   */
  upload(file: StorageFile, options?: UploadOptions): Promise<UploadResult>;

  /**
   * Retrieves a file buffer from the storage provider by key.
   */
  download(key: string): Promise<Buffer>;

  /**
   * Deletes a file from the storage provider by key.
   */
  delete(key: string): Promise<void>;

  /**
   * Generates a temporary accessible URL or signed download link.
   */
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;

  /**
   * Checks if a file exists in the storage provider.
   */
  exists(key: string): Promise<boolean>;
}
