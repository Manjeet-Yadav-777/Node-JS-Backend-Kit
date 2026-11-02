import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import { logger } from '../../config';

export interface PdfTableItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PdfDocumentOptions {
  title: string;
  subtitle?: string;
  author?: string;
  metadata?: Record<string, string>;
  items?: PdfTableItem[];
  notes?: string;
  footerText?: string;
}

export class PdfGenerator {
  /**
   * Generates a programmatic PDF document and returns it as a Buffer.
   */
  public async generatePdf(options: PdfDocumentOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margin: 50,
          info: {
            Title: options.title,
            Author: options.author ?? 'Node Backend Kit',
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err: Error) => reject(err));

        this.buildDocument(doc, options);
        doc.end();
      } catch (error: unknown) {
        logger.error({ error }, 'Failed to initialize PDF generation');
        reject(error);
      }
    });
  }

  /**
   * Generates a programmatic PDF document and returns a Readable stream for HTTP downloads.
   */
  public createPdfStream(options: PdfDocumentOptions): Readable {
    const doc = new PDFDocument({
      margin: 50,
      info: {
        Title: options.title,
        Author: options.author ?? 'Node Backend Kit',
      },
    });

    this.buildDocument(doc, options);
    doc.end();

    return doc;
  }

  private buildDocument(doc: PDFKit.PDFDocument, options: PdfDocumentOptions): void {
    doc
      .fillColor('#1e293b')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text(options.title, { align: 'left' });

    if (options.subtitle) {
      doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor('#64748b')
        .text(options.subtitle, { align: 'left' })
        .moveDown(1);
    } else {
      doc.moveDown(1);
    }

    doc
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .stroke()
      .moveDown(1);

    if (options.metadata && Object.keys(options.metadata).length > 0) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#334155');
      for (const [key, value] of Object.entries(options.metadata)) {
        doc.font('Helvetica-Bold').text(`${key}: `, { continued: true });
        doc.font('Helvetica').fillColor('#475569').text(value);
      }
      doc.moveDown(1.5);
    }

    if (options.items && options.items.length > 0) {
      const tableTop = doc.y;
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e293b');

      doc.text('Description', 50, tableTop);
      doc.text('Qty', 280, tableTop, { width: 50, align: 'right' });
      doc.text('Unit Price', 340, tableTop, { width: 80, align: 'right' });
      doc.text('Total', 430, tableTop, { width: 90, align: 'right' });

      doc
        .strokeColor('#cbd5e1')
        .lineWidth(1)
        .moveTo(50, doc.y + 5)
        .lineTo(550, doc.y + 5)
        .stroke();

      let currentY = doc.y + 12;
      let grandTotal = 0;

      doc.font('Helvetica').fontSize(10).fillColor('#334155');

      for (const item of options.items) {
        doc.text(item.description, 50, currentY, { width: 220 });
        doc.text(item.quantity.toString(), 280, currentY, { width: 50, align: 'right' });
        doc.text(`$${item.unitPrice.toFixed(2)}`, 340, currentY, { width: 80, align: 'right' });
        doc.text(`$${item.total.toFixed(2)}`, 430, currentY, { width: 90, align: 'right' });

        grandTotal += item.total;
        currentY += 20;
      }

      doc
        .strokeColor('#e2e8f0')
        .lineWidth(1)
        .moveTo(340, currentY + 5)
        .lineTo(550, currentY + 5)
        .stroke();

      currentY += 12;
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#0f172a')
        .text('Grand Total:', 340, currentY, { width: 80, align: 'right' })
        .text(`$${grandTotal.toFixed(2)}`, 430, currentY, { width: 90, align: 'right' });

      doc.moveDown(2);
    }

    if (options.notes) {
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#475569')
        .text('Notes & Terms:')
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#64748b')
        .text(options.notes)
        .moveDown(1);
    }

    const footer = options.footerText ?? 'Generated automatically by Node Backend Kit';
    doc.fontSize(8).fillColor('#94a3b8').text(footer, 50, 720, { align: 'center', width: 500 });
  }
}

export const pdfGenerator = new PdfGenerator();
