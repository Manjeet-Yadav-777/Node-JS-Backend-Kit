import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';
import crypto from 'crypto';
import { IStorageProvider, StorageFile, UploadOptions, UploadResult } from './storage.interface';
import { NotFoundError } from '../../core';
import { env, logger } from '../../config';

export interface S3StorageConfig {
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

export class S3StorageAdapter implements IStorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly endpoint?: string;

  constructor(config?: S3StorageConfig) {
    this.region = config?.region ?? env.AWS_REGION;
    this.bucket = config?.bucket ?? env.AWS_S3_BUCKET;
    this.endpoint = config?.endpoint ?? env.AWS_S3_ENDPOINT;

    const accessKeyId = config?.accessKeyId ?? env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = config?.secretAccessKey ?? env.AWS_SECRET_ACCESS_KEY;
    const forcePathStyle = config?.forcePathStyle ?? env.AWS_S3_FORCE_PATH_STYLE;

    const clientConfig: S3ClientConfig = {
      region: this.region,
      ...(this.endpoint && { endpoint: this.endpoint }),
      ...(forcePathStyle !== undefined && { forcePathStyle }),
      ...(accessKeyId &&
        secretAccessKey && {
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        }),
    };

    this.client = new S3Client(clientConfig);
  }

  public getClient(): S3Client {
    return this.client;
  }

  public async upload(file: StorageFile, options?: UploadOptions): Promise<UploadResult> {
    const prefix = options?.prefix ? options.prefix.replace(/^[/\\]+|[/\\]+$/g, '') : '';
    const safeName = path.basename(file.originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueId = crypto.randomUUID();
    const key =
      file.key ?? (prefix ? `${prefix}/${uniqueId}-${safeName}` : `${uniqueId}-${safeName}`);
    const mimeType = options?.contentType ?? file.mimeType;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: mimeType,
      Metadata: options?.metadata,
    });

    await this.client.send(command);

    logger.debug({ bucket: this.bucket, key, size: file.size }, 'File uploaded to S3');

    const url = this.endpoint
      ? `${this.endpoint.replace(/\/+$/, '')}/${this.bucket}/${key}`
      : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

    return {
      key,
      url,
      size: file.size,
      mimeType,
      provider: 's3',
    };
  }

  public async download(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new NotFoundError(`File body empty in S3: ${key}`);
      }

      const byteArray = await response.Body.transformToByteArray();
      return Buffer.from(byteArray);
    } catch (error: unknown) {
      const errName = (error as { name?: string }).name;
      if (errName === 'NoSuchKey' || errName === 'NotFound') {
        throw new NotFoundError(`File not found in S3: ${key}`);
      }
      throw error;
    }
  }

  public async delete(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      logger.debug({ bucket: this.bucket, key }, 'File deleted from S3');
    } catch (error: unknown) {
      logger.error({ bucket: this.bucket, key, error }, 'Failed to delete file from S3');
      throw error;
    }
  }

  public async getSignedUrl(key: string, expiresInSeconds = 900): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  public async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error: unknown) {
      const errName = (error as { name?: string }).name;
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;

      if (errName === 'NotFound' || errName === 'NoSuchKey' || status === 404) {
        return false;
      }
      throw error;
    }
  }
}

export const s3StorageAdapter = new S3StorageAdapter();
