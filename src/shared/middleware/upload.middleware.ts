import { Request, Response, NextFunction, RequestHandler } from 'express';
import multer from 'multer';
import { BadRequestError } from '../../core';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export interface UploadMiddlewareOptions {
  fieldName?: string;
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  maxFiles?: number;
}

const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Creates an Express middleware for single file uploads with validation.
 */
export function uploadSingle(options?: UploadMiddlewareOptions): RequestHandler {
  const fieldName = options?.fieldName ?? 'file';
  const maxSize = options?.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
  const allowedTypes = options?.allowedMimeTypes;

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSize },
    fileFilter: (_req, file, cb) => {
      if (allowedTypes && !allowedTypes.includes(file.mimetype)) {
        return cb(
          new BadRequestError(
            `Invalid file type '${file.mimetype}'. Allowed types: ${allowedTypes.join(', ')}`,
          ),
        );
      }
      cb(null, true);
    },
  }).single(fieldName);

  return (req: Request, res: Response, next: NextFunction): void => {
    upload(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          const limitMb = (maxSize / (1024 * 1024)).toFixed(1);
          return next(new BadRequestError(`File size exceeds allowed limit of ${limitMb}MB`));
        }
        return next(new BadRequestError(`File upload error: ${err.message}`));
      }
      if (err) {
        return next(err);
      }
      next();
    });
  };
}

/**
 * Creates an Express middleware for multiple files upload with validation.
 */
export function uploadMultiple(options?: UploadMiddlewareOptions): RequestHandler {
  const fieldName = options?.fieldName ?? 'files';
  const maxSize = options?.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
  const maxFiles = options?.maxFiles ?? 5;
  const allowedTypes = options?.allowedMimeTypes;

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSize, files: maxFiles },
    fileFilter: (_req, file, cb) => {
      if (allowedTypes && !allowedTypes.includes(file.mimetype)) {
        return cb(
          new BadRequestError(
            `Invalid file type '${file.mimetype}'. Allowed types: ${allowedTypes.join(', ')}`,
          ),
        );
      }
      cb(null, true);
    },
  }).array(fieldName, maxFiles);

  return (req: Request, res: Response, next: NextFunction): void => {
    upload(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          const limitMb = (maxSize / (1024 * 1024)).toFixed(1);
          return next(new BadRequestError(`File size exceeds allowed limit of ${limitMb}MB`));
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return next(new BadRequestError(`Too many files. Maximum allowed is ${maxFiles}`));
        }
        return next(new BadRequestError(`File upload error: ${err.message}`));
      }
      if (err) {
        return next(err);
      }
      next();
    });
  };
}
