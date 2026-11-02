import { describe, it, expect } from 'vitest';
import { HtmlPdfGenerator } from '../../../../src/infrastructure';
import { BadRequestError } from '../../../../src/core';

describe('HtmlPdfGenerator', () => {
  const generator = new HtmlPdfGenerator();

  describe('generateFromHtml', () => {
    it('should throw BadRequestError when html string is empty or whitespace', async () => {
      await expect(generator.generateFromHtml('')).rejects.toThrow(BadRequestError);
      await expect(generator.generateFromHtml('   ')).rejects.toThrow(BadRequestError);
    });

    it('should render custom HTML with CSS styles into a valid PDF buffer', async () => {
      const customHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Helvetica, Arial, sans-serif; padding: 40px; }
              .header { color: #4f46e5; border-bottom: 2px solid #e0e7ff; padding-bottom: 10px; }
              .invoice-box { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-top: 20px; }
              .amount { font-size: 24px; font-weight: bold; color: #0f172a; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Invoice #2048</h1>
            </div>
            <div class="invoice-box">
              <p>Billed to: <strong>Rohan Sharma</strong></p>
              <div class="amount">Total: $249.00</div>
            </div>
          </body>
        </html>
      `;

      const pdfBuffer = await generator.generateFromHtml(customHtml, {
        format: 'A4',
        printBackground: true,
      });

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(1000);

      // Verify PDF magic bytes '%PDF-'
      const magicBytes = pdfBuffer.subarray(0, 5).toString('ascii');
      expect(magicBytes).toBe('%PDF-');
    }, 15000); // Allow sufficient timeout for initial headless chromium launch
  });
});
