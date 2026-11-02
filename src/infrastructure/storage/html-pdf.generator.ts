import puppeteer, { PaperFormat, PDFMargin } from 'puppeteer';
import { logger } from '../../config';
import { BadRequestError } from '../../core';

export interface HtmlPdfOptions {
  format?: PaperFormat;
  landscape?: boolean;
  printBackground?: boolean;
  margin?: PDFMargin;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  preferCSSPageSize?: boolean;
}

export class HtmlPdfGenerator {
  /**
   * Converts any raw HTML string (with CSS / inline styles / web fonts) into a pixel-perfect PDF Buffer.
   */
  public async generateFromHtml(html: string, options?: HtmlPdfOptions): Promise<Buffer> {
    if (!html || !html.trim()) {
      throw new BadRequestError('HTML content cannot be empty');
    }

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });

      const page = await browser.newPage();

      await page.setContent(html, {
        waitUntil: 'load',
      });

      const pdfUint8Array = await page.pdf({
        format: options?.format ?? 'A4',
        landscape: options?.landscape ?? false,
        printBackground: options?.printBackground ?? true,
        margin: options?.margin ?? {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px',
        },
        displayHeaderFooter: options?.displayHeaderFooter ?? false,
        headerTemplate: options?.headerTemplate,
        footerTemplate: options?.footerTemplate,
        preferCSSPageSize: options?.preferCSSPageSize ?? false,
      });

      return Buffer.from(pdfUint8Array);
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to generate PDF from HTML');
      throw error;
    } finally {
      if (browser) {
        await browser.close().catch((err: unknown) => {
          logger.warn({ err }, 'Error closing headless browser');
        });
      }
    }
  }
}

export const htmlPdfGenerator = new HtmlPdfGenerator();
