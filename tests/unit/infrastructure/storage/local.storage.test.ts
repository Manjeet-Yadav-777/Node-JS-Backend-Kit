import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { LocalStorageAdapter, StorageFile } from '../../../../src/infrastructure';
import { BadRequestError, NotFoundError } from '../../../../src/core';

describe('LocalStorageAdapter', () => {
  let tempDir: string;
  let adapter: LocalStorageAdapter;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'storage-test-'));
    adapter = new LocalStorageAdapter({
      uploadDir: tempDir,
      baseUrl: 'http://localhost:5000/static',
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  describe('upload', () => {
    it('should upload a file and return correct metadata and url', async () => {
      const file: StorageFile = {
        originalName: 'test-document.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('PDF content mock'),
      };

      const result = await adapter.upload(file, { prefix: 'documents' });

      expect(result).toBeDefined();
      expect(result.provider).toBe('local');
      expect(result.size).toBe(1024);
      expect(result.mimeType).toBe('application/pdf');
      expect(result.key).toMatch(/^documents\/[0-9a-f-]+-test-document\.pdf$/);
      expect(result.url).toBe(`http://localhost:5000/static/${result.key}`);

      const existsOnDisk = await adapter.exists(result.key);
      expect(existsOnDisk).toBe(true);
    });

    it('should use explicit key when provided', async () => {
      const file: StorageFile = {
        key: 'custom/path/file.txt',
        originalName: 'file.txt',
        mimeType: 'text/plain',
        size: 12,
        buffer: Buffer.from('hello world!'),
      };

      const result = await adapter.upload(file);

      expect(result.key).toBe('custom/path/file.txt');
      const downloaded = await adapter.download('custom/path/file.txt');
      expect(downloaded.toString('utf-8')).toBe('hello world!');
    });

    it('should prevent directory traversal attacks during upload', async () => {
      const file: StorageFile = {
        key: '../../secret.txt',
        originalName: 'secret.txt',
        mimeType: 'text/plain',
        size: 4,
        buffer: Buffer.from('hack'),
      };

      await expect(adapter.upload(file)).rejects.toThrow(BadRequestError);
    });
  });

  describe('download', () => {
    it('should download a stored file as buffer', async () => {
      const file: StorageFile = {
        key: 'downloads/sample.txt',
        originalName: 'sample.txt',
        mimeType: 'text/plain',
        size: 13,
        buffer: Buffer.from('download test'),
      };

      await adapter.upload(file);
      const buffer = await adapter.download('downloads/sample.txt');

      expect(buffer.toString('utf-8')).toBe('download test');
    });

    it('should throw NotFoundError if file does not exist', async () => {
      await expect(adapter.download('non-existent-key.txt')).rejects.toThrow(NotFoundError);
    });

    it('should prevent directory traversal attacks during download', async () => {
      await expect(adapter.download('../../../etc/passwd')).rejects.toThrow(BadRequestError);
    });
  });

  describe('delete', () => {
    it('should delete an existing file from disk', async () => {
      const file: StorageFile = {
        key: 'delete-me.txt',
        originalName: 'delete-me.txt',
        mimeType: 'text/plain',
        size: 4,
        buffer: Buffer.from('temp'),
      };

      await adapter.upload(file);
      expect(await adapter.exists('delete-me.txt')).toBe(true);

      await adapter.delete('delete-me.txt');
      expect(await adapter.exists('delete-me.txt')).toBe(false);
    });

    it('should not throw when deleting a non-existent file (idempotent)', async () => {
      await expect(adapter.delete('never-existed.txt')).resolves.not.toThrow();
    });
  });

  describe('exists', () => {
    it('should return true for existing file and false for missing file', async () => {
      const file: StorageFile = {
        key: 'exists-check.txt',
        originalName: 'exists-check.txt',
        mimeType: 'text/plain',
        size: 5,
        buffer: Buffer.from('check'),
      };

      expect(await adapter.exists('exists-check.txt')).toBe(false);
      await adapter.upload(file);
      expect(await adapter.exists('exists-check.txt')).toBe(true);
    });
  });

  describe('getSignedUrl', () => {
    it('should return a formatted public URL for the key', async () => {
      const url = await adapter.getSignedUrl('images/avatar.png');
      expect(url).toBe('http://localhost:5000/static/images/avatar.png');
    });
  });
});
