import sharp from 'sharp';
import { BadRequestError } from '../../core';
import { logger } from '../../config';

export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif';

export interface ImageResizeOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  withoutEnlargement?: boolean;
}

export interface ImageCompressOptions {
  quality?: number;
  format?: ImageFormat;
}

export interface ImageMetadata {
  width?: number;
  height?: number;
  format?: string;
  size: number;
  space?: string;
  channels?: number;
}

export class ImageProcessor {
  /**
   * Resizes an image buffer to specified dimensions with configurable aspect fit.
   */
  public async resize(buffer: Buffer, options: ImageResizeOptions): Promise<Buffer> {
    try {
      return await sharp(buffer)
        .resize({
          width: options.width,
          height: options.height,
          fit: options.fit ?? 'cover',
          withoutEnlargement: options.withoutEnlargement ?? false,
        })
        .toBuffer();
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to resize image');
      throw new BadRequestError('Invalid image data for resizing');
    }
  }

  /**
   * Compresses and converts an image to a modern optimized format (default: webp, quality: 80).
   */
  public async compress(buffer: Buffer, options?: ImageCompressOptions): Promise<Buffer> {
    const quality = options?.quality ?? 80;
    const format = options?.format ?? 'webp';

    try {
      let pipeline = sharp(buffer);

      switch (format) {
        case 'jpeg':
          pipeline = pipeline.jpeg({ quality });
          break;
        case 'png':
          pipeline = pipeline.png({ quality: Math.min(100, Math.max(1, quality)) });
          break;
        case 'avif':
          pipeline = pipeline.avif({ quality });
          break;
        case 'webp':
        default:
          pipeline = pipeline.webp({ quality });
          break;
      }

      return await pipeline.toBuffer();
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to compress image');
      throw new BadRequestError('Invalid image data for compression');
    }
  }

  /**
   * Generates a square thumbnail with optimized WebP compression.
   */
  public async generateThumbnail(buffer: Buffer, size = 150): Promise<Buffer> {
    try {
      return await sharp(buffer)
        .resize({
          width: size,
          height: size,
          fit: 'cover',
        })
        .webp({ quality: 80 })
        .toBuffer();
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to generate thumbnail');
      throw new BadRequestError('Invalid image data for thumbnail generation');
    }
  }

  /**
   * Inspects and returns metadata for an image buffer.
   */
  public async getMetadata(buffer: Buffer): Promise<ImageMetadata> {
    try {
      const meta = await sharp(buffer).metadata();
      return {
        width: meta.width,
        height: meta.height,
        format: meta.format,
        size: buffer.length,
        space: meta.space,
        channels: meta.channels,
      };
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to read image metadata');
      throw new BadRequestError('Invalid or corrupted image format');
    }
  }
}

export const imageProcessor = new ImageProcessor();
