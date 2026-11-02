import { describe, it, expect } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import {
  uploadSingle,
  uploadMultiple,
  errorMiddleware,
  ALLOWED_IMAGE_TYPES,
} from '../../../src/shared';

function createSingleUploadApp(options?: Parameters<typeof uploadSingle>[0]) {
  const app = express();
  app.post('/upload-single', uploadSingle(options), (req: Request, res: Response) => {
    res.status(200).json({
      filename: req.file?.originalname,
      mimetype: req.file?.mimetype,
      size: req.file?.size,
      content: req.file?.buffer.toString('utf-8'),
    });
  });
  app.use(errorMiddleware);
  return app;
}

function createMultipleUploadApp(options?: Parameters<typeof uploadMultiple>[0]) {
  const app = express();
  app.post('/upload-multiple', uploadMultiple(options), (req: Request, res: Response) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    res.status(200).json({
      count: files.length,
      files: files.map((f) => ({
        filename: f.originalname,
        size: f.size,
        mimetype: f.mimetype,
      })),
    });
  });
  app.use(errorMiddleware);
  return app;
}

describe('Upload Middleware', () => {
  describe('uploadSingle', () => {
    it('should upload a single valid file successfully', async () => {
      const app = createSingleUploadApp({
        allowedMimeTypes: [...ALLOWED_IMAGE_TYPES],
      });

      const response = await request(app)
        .post('/upload-single')
        .attach('file', Buffer.from('fake-image-content'), {
          filename: 'avatar.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(200);
      expect(response.body.filename).toBe('avatar.png');
      expect(response.body.mimetype).toBe('image/png');
      expect(response.body.content).toBe('fake-image-content');
    });

    it('should reject file when MIME type is not allowed', async () => {
      const app = createSingleUploadApp({
        allowedMimeTypes: ['image/png'],
      });

      const response = await request(app)
        .post('/upload-single')
        .attach('file', Buffer.from('malicious-script'), {
          filename: 'script.js',
          contentType: 'application/javascript',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Invalid file type 'application/javascript'");
    });

    it('should reject file exceeding maximum size limit', async () => {
      const app = createSingleUploadApp({
        maxFileSize: 10, // 10 bytes max
      });

      const oversizedBuffer = Buffer.alloc(50, 'a');

      const response = await request(app)
        .post('/upload-single')
        .attach('file', oversizedBuffer, 'oversized.txt');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('File size exceeds allowed limit');
    });

    it('should support custom fieldName', async () => {
      const app = express();
      app.post(
        '/upload-custom',
        uploadSingle({ fieldName: 'document' }),
        (req: Request, res: Response) => {
          res.status(200).json({ filename: req.file?.originalname });
        },
      );
      app.use(errorMiddleware);

      const response = await request(app)
        .post('/upload-custom')
        .attach('document', Buffer.from('doc-data'), 'resume.pdf');

      expect(response.status).toBe(200);
      expect(response.body.filename).toBe('resume.pdf');
    });
  });

  describe('uploadMultiple', () => {
    it('should upload multiple files successfully', async () => {
      const app = createMultipleUploadApp({
        maxFiles: 3,
        allowedMimeTypes: ['text/plain'],
      });

      const response = await request(app)
        .post('/upload-multiple')
        .attach('files', Buffer.from('file 1'), {
          filename: 'doc1.txt',
          contentType: 'text/plain',
        })
        .attach('files', Buffer.from('file 2'), {
          filename: 'doc2.txt',
          contentType: 'text/plain',
        });

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(2);
      expect(response.body.files[0].filename).toBe('doc1.txt');
      expect(response.body.files[1].filename).toBe('doc2.txt');
    });

    it('should reject request when file count exceeds maxFiles limit', async () => {
      const app = createMultipleUploadApp({
        maxFiles: 2,
      });

      const response = await request(app)
        .post('/upload-multiple')
        .attach('files', Buffer.from('1'), 'f1.txt')
        .attach('files', Buffer.from('2'), 'f2.txt')
        .attach('files', Buffer.from('3'), 'f3.txt');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Too many files');
    });

    it('should reject request when any of the multiple files has disallowed MIME type', async () => {
      const app = createMultipleUploadApp({
        allowedMimeTypes: ['image/png'],
      });

      const response = await request(app)
        .post('/upload-multiple')
        .attach('files', Buffer.from('img'), {
          filename: 'good.png',
          contentType: 'image/png',
        })
        .attach('files', Buffer.from('bad'), {
          filename: 'bad.exe',
          contentType: 'application/x-msdownload',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid file type');
    });
  });
});
