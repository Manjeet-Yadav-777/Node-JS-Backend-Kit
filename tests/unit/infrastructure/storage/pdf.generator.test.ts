import { describe, it, expect } from 'vitest';
import { Readable } from 'stream';
import { PdfGenerator } from '../../../../src/infrastructure';

describe('PdfGenerator', () => {
  const generator = new PdfGenerator();

  describe('generatePdf', () => {
    it('should generate a valid PDF buffer with %PDF magic header', async () => {
      const buffer = await generator.generatePdf({
        title: 'Invoice #1001',
        subtitle: 'Tax Invoice & Receipt',
        author: 'ACME Corp',
        metadata: {
          'Invoice Number': 'INV-1001',
          Date: '2026-11-02',
          Customer: 'Acme Client Inc.',
        },
        items: [
          {
            description: 'Cloud Server (Monthly)',
            quantity: 2,
            unitPrice: 50.0,
            total: 100.0,
          },
          {
            description: 'SSL Certificate (Annual)',
            quantity: 1,
            unitPrice: 35.0,
            total: 35.0,
          },
        ],
        notes: 'Payment is due within 14 days of invoice date.',
        footerText: 'ACME Corp - Thank you for your business!',
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(500);

      // Verify PDF magic bytes '%PDF-'
      const header = buffer.subarray(0, 5).toString('ascii');
      expect(header).toBe('%PDF-');
    });

    it('should generate a simple PDF with minimal required options', async () => {
      const buffer = await generator.generatePdf({
        title: 'Simple Document',
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    });
  });

  describe('createPdfStream', () => {
    it('should return a readable stream that outputs PDF chunks', async () => {
      const stream = generator.createPdfStream({
        title: 'Streamed Document',
        subtitle: 'Real-time Streaming Export',
      });

      expect(stream).toBeInstanceOf(Readable);

      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve());
        stream.on('error', (err) => reject(err));
      });

      const fullBuffer = Buffer.concat(chunks);
      expect(fullBuffer.length).toBeGreaterThan(200);
      expect(fullBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    });
  });
});
