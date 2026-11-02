import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { IStorageProvider, StorageFile, UploadOptions, UploadResult } from './storage.interface';
import { BadRequestError, NotFoundError } from '../../core';
import { logger } from '../../config';

export interface LocalStorageConfig {
  uploadDir?: string;
  baseUrl?: string;
}

export class LocalStorageAdapter implements IStorageProvider {
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor(config?: LocalStorageConfig) {
    this.uploadDir = path.resolve(config?.uploadDir ?? path.join(process.cwd(), 'uploads'));
    this.baseUrl = (config?.baseUrl ?? 'http://localhost:5000/uploads').replace(/\/+$/, '');
  }

  /**
   * Resolves and verifies that a relative key stays safely within the configured upload directory.
   */
  private resolveSafePath(key: string): string {
    const safeKey = key.replace(/^[/\\]+/, '');
    const fullPath = path.resolve(this.uploadDir, safeKey);

    if (!fullPath.startsWith(this.uploadDir)) {
      throw new BadRequestError('Invalid file key: directory traversal detected');
    }

    return fullPath;
  }

  public async upload(file: StorageFile, options?: UploadOptions): Promise<UploadResult> {
    const prefix = options?.prefix ? options.prefix.replace(/^[/\\]+|[/\\]+$/g, '') : '';
    const safeName = path.basename(file.originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueId = crypto.randomUUID();
    const key =
      file.key ?? (prefix ? `${prefix}/${uniqueId}-${safeName}` : `${uniqueId}-${safeName}`);

    const filePath = this.resolveSafePath(key);
    const dir = path.dirname(filePath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, file.buffer);

    logger.debug({ key, size: file.size, mimeType: file.mimeType }, 'File stored on local disk');

    return {
      key,
      url: `${this.baseUrl}/${key}`,
      size: file.size,
      mimeType: options?.contentType ?? file.mimeType,
      provider: 'local',
    };
  }

  public async download(key: string): Promise<Buffer> {
    const filePath = this.resolveSafePath(key);

    try {
      return await fs.readFile(filePath);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundError(`File not found: ${key}`);
      }
      throw error;
    }
  }

  public async delete(key: string): Promise<void> {
    const filePath = this.resolveSafePath(key);

    try {
      await fs.unlink(filePath);
      logger.debug({ key }, 'File deleted from local disk');
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  public async getSignedUrl(key: string): Promise<string> {
    return `${this.baseUrl}/${key}`;
  }

  public async exists(key: string): Promise<boolean> {
    const filePath = this.resolveSafePath(key);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export const localStorageAdapter = new LocalStorageAdapter();
