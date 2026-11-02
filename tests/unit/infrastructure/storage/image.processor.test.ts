import { describe, it, expect, beforeAll } from 'vitest';
import sharp from 'sharp';
import { ImageProcessor } from '../../../../src/infrastructure';
import { BadRequestError } from '../../../../src/core';

describe('ImageProcessor', () => {
  let processor: ImageProcessor;
  let samplePngBuffer: Buffer;

  beforeAll(async () => {
    processor = new ImageProcessor();
    // Generate a valid 200x100 red PNG image in-memory for testing
    samplePngBuffer = await sharp({
      create: {
        width: 200,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();
  });

  describe('getMetadata', () => {
    it('should extract correct dimensions and format from valid image buffer', async () => {
      const meta = await processor.getMetadata(samplePngBuffer);

      expect(meta.width).toBe(200);
      expect(meta.height).toBe(100);
      expect(meta.format).toBe('png');
      expect(meta.size).toBe(samplePngBuffer.length);
      expect(meta.channels).toBe(3);
    });

    it('should throw BadRequestError when given corrupted/non-image buffer', async () => {
      const invalidBuffer = Buffer.from('definitely not an image');

      await expect(processor.getMetadata(invalidBuffer)).rejects.toThrow(BadRequestError);
    });
  });

  describe('resize', () => {
    it('should resize image to specified dimensions', async () => {
      const resized = await processor.resize(samplePngBuffer, {
        width: 80,
        height: 40,
      });

      const meta = await processor.getMetadata(resized);
      expect(meta.width).toBe(80);
      expect(meta.height).toBe(40);
    });

    it('should throw BadRequestError on invalid buffer', async () => {
      await expect(processor.resize(Buffer.from('corrupt'), { width: 50 })).rejects.toThrow(
        BadRequestError,
      );
    });
  });

  describe('compress', () => {
    it('should convert and compress image to webp format by default', async () => {
      const compressed = await processor.compress(samplePngBuffer, { quality: 75 });
      const meta = await processor.getMetadata(compressed);

      expect(meta.format).toBe('webp');
    });

    it('should convert to jpeg format when specified', async () => {
      const compressed = await processor.compress(samplePngBuffer, {
        format: 'jpeg',
        quality: 60,
      });
      const meta = await processor.getMetadata(compressed);

      expect(meta.format).toBe('jpeg');
    });

    it('should convert to avif format when specified', async () => {
      const compressed = await processor.compress(samplePngBuffer, {
        format: 'avif',
        quality: 50,
      });
      const meta = await processor.getMetadata(compressed);

      expect(meta.format).toBe('heif'); // libheif / avif format identification in sharp
    });

    it('should throw BadRequestError on invalid buffer during compression', async () => {
      await expect(processor.compress(Buffer.from('corrupt'))).rejects.toThrow(BadRequestError);
    });
  });

  describe('generateThumbnail', () => {
    it('should generate a square thumbnail in webp format', async () => {
      const thumbnail = await processor.generateThumbnail(samplePngBuffer, 120);
      const meta = await processor.getMetadata(thumbnail);

      expect(meta.width).toBe(120);
      expect(meta.height).toBe(120);
      expect(meta.format).toBe('webp');
    });

    it('should throw BadRequestError on invalid buffer during thumbnail generation', async () => {
      await expect(processor.generateThumbnail(Buffer.from('corrupt'))).rejects.toThrow(
        BadRequestError,
      );
    });
  });
});
