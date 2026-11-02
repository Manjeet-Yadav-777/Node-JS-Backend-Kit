import { describe, it, expect, vi, beforeEach } from 'vitest';
import { S3StorageAdapter, StorageFile } from '../../../../src/infrastructure';
import { NotFoundError } from '../../../../src/core';
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://mock-signed-url.com/file.png?token=xyz'),
}));

describe('S3StorageAdapter', () => {
  let adapter: S3StorageAdapter;
  let sendSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    adapter = new S3StorageAdapter({
      bucket: 'test-bucket',
      region: 'us-west-2',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    sendSpy = vi.spyOn(adapter.getClient(), 'send');
  });

  describe('upload', () => {
    it('should upload file to S3 and return UploadResult with AWS URL', async () => {
      sendSpy.mockResolvedValue({} as never);

      const file: StorageFile = {
        originalName: 'photo.png',
        mimeType: 'image/png',
        size: 500,
        buffer: Buffer.from('image bytes'),
      };

      const result = await adapter.upload(file, { prefix: 'avatars' });

      expect(result.provider).toBe('s3');
      expect(result.size).toBe(500);
      expect(result.mimeType).toBe('image/png');
      expect(result.key).toMatch(/^avatars\/[0-9a-f-]+-photo\.png$/);
      expect(result.url).toBe(`https://test-bucket.s3.us-west-2.amazonaws.com/${result.key}`);

      expect(sendSpy).toHaveBeenCalledWith(expect.any(PutObjectCommand));
    });

    it('should use custom endpoint when provided (Cloudflare R2 / MinIO)', async () => {
      const customAdapter = new S3StorageAdapter({
        bucket: 'r2-bucket',
        endpoint: 'https://custom-r2.cloudflarestorage.com',
      });
      const customSendSpy = vi.spyOn(customAdapter.getClient(), 'send');
      customSendSpy.mockResolvedValue({} as never);

      const file: StorageFile = {
        key: 'custom/doc.pdf',
        originalName: 'doc.pdf',
        mimeType: 'application/pdf',
        size: 100,
        buffer: Buffer.from('pdf data'),
      };

      const result = await customAdapter.upload(file);

      expect(result.key).toBe('custom/doc.pdf');
      expect(result.url).toBe('https://custom-r2.cloudflarestorage.com/r2-bucket/custom/doc.pdf');
    });
  });

  describe('download', () => {
    it('should retrieve file as Buffer from S3 GetObjectCommand', async () => {
      const mockByteArray = new Uint8Array(Buffer.from('s3 file content'));
      sendSpy.mockResolvedValue({
        Body: {
          transformToByteArray: vi.fn().mockResolvedValue(mockByteArray),
        },
      } as never);

      const buffer = await adapter.download('files/test.txt');

      expect(buffer.toString('utf-8')).toBe('s3 file content');
      expect(sendSpy).toHaveBeenCalledWith(expect.any(GetObjectCommand));
    });

    it('should throw NotFoundError if S3 returns NoSuchKey or NotFound', async () => {
      const error = new Error('NoSuchKey');
      error.name = 'NoSuchKey';
      sendSpy.mockRejectedValue(error);

      await expect(adapter.download('missing.txt')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError if response Body is null', async () => {
      sendSpy.mockResolvedValue({ Body: null } as never);

      await expect(adapter.download('empty.txt')).rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    it('should execute DeleteObjectCommand on S3', async () => {
      sendSpy.mockResolvedValue({} as never);

      await adapter.delete('to-delete.png');

      expect(sendSpy).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });

    it('should throw error when S3 delete fails', async () => {
      sendSpy.mockRejectedValue(new Error('S3 Access Denied'));

      await expect(adapter.delete('error.png')).rejects.toThrow('S3 Access Denied');
    });
  });

  describe('getSignedUrl', () => {
    it('should delegate to presigner getSignedUrl', async () => {
      const signedUrl = await adapter.getSignedUrl('private/invoice.pdf', 300);

      expect(signedUrl).toBe('https://mock-signed-url.com/file.png?token=xyz');
      expect(getSignedUrl).toHaveBeenCalledWith(adapter.getClient(), expect.any(GetObjectCommand), {
        expiresIn: 300,
      });
    });
  });

  describe('exists', () => {
    it('should return true when HeadObjectCommand succeeds', async () => {
      sendSpy.mockResolvedValue({} as never);

      const exists = await adapter.exists('exists.png');

      expect(exists).toBe(true);
      expect(sendSpy).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
    });

    it('should return false when HeadObjectCommand returns 404 or NotFound', async () => {
      const notFoundError = new Error('NotFound');
      notFoundError.name = 'NotFound';
      sendSpy.mockRejectedValue(notFoundError);

      const exists = await adapter.exists('not-found.png');

      expect(exists).toBe(false);
    });

    it('should throw when unexpected error occurs during HeadObjectCommand', async () => {
      sendSpy.mockRejectedValue(new Error('Network failure'));

      await expect(adapter.exists('error.png')).rejects.toThrow('Network failure');
    });
  });
});
