import nodemailer, { Transporter } from 'nodemailer';
import { env, logger } from '../../config';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface SendMailResult {
  messageId: string;
  previewUrl?: string | false;
}

export class EmailService {
  private transporter: Transporter | null = null;

  /**
   * Returns a configured Nodemailer Transporter.
   * If real SMTP credentials are provided, connects to the SMTP server.
   * Otherwise, creates a non-blocking mock/json transporter for development and testing.
   */
  public getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    if (env.SMTP_HOST && env.SMTP_USER) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
      logger.info(
        { host: env.SMTP_HOST, port: env.SMTP_PORT },
        'SMTP email transporter initialized',
      );
    } else {
      // Development or test fallback when external SMTP is not yet configured
      this.transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
      logger.info('Initialized local development/test JSON email transporter');
    }

    return this.transporter;
  }

  /**
   * Sends an email with HTML and optional plain-text body.
   */
  public async sendEmail(options: SendMailOptions): Promise<SendMailResult> {
    const transporter = this.getTransporter();
    const from = options.from ?? env.EMAIL_FROM;

    try {
      const info = await transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      const messageId = info.messageId || `msg_${Date.now()}`;
      const previewUrl = nodemailer.getTestMessageUrl(info);

      logger.info(
        {
          messageId,
          to: options.to,
          subject: options.subject,
          ...(previewUrl && { previewUrl }),
        },
        'Email successfully dispatched',
      );

      return {
        messageId,
        previewUrl,
      };
    } catch (error) {
      logger.error({ to: options.to, subject: options.subject, error }, 'Failed to dispatch email');
      throw error;
    }
  }
}

export const emailService = new EmailService();
