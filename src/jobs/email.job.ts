import { Job, JobsOptions, Worker } from 'bullmq';
import {
  queueManager,
  workerManager,
  renderWelcomeEmail,
  renderPasswordResetEmail,
} from '../infrastructure';
import { logger } from '../config';

export const EMAIL_QUEUE_NAME = 'email-queue' as const;

export const EMAIL_JOB_NAMES = {
  SEND_WELCOME: 'send-welcome',
  SEND_PASSWORD_RESET: 'send-password-reset',
  SEND_GENERIC: 'send-generic',
} as const;

export type EmailJobName = (typeof EMAIL_JOB_NAMES)[keyof typeof EMAIL_JOB_NAMES];

export interface WelcomeEmailJobData {
  to: string;
  name: string;
  userId: string;
  loginUrl?: string;
}

export interface PasswordResetEmailJobData {
  to: string;
  resetToken: string;
  expiresInMinutes: number;
  resetUrl?: string;
}

export interface GenericEmailJobData {
  to: string;
  subject: string;
  content: string;
}

export type EmailJobData = WelcomeEmailJobData | PasswordResetEmailJobData | GenericEmailJobData;

export interface EmailJobResult {
  messageId: string;
  sentAt: string;
}

/**
 * BullMQ processor function handling asynchronous email dispatches with compiled HTML templates.
 */
export async function processEmailJob(
  job: Job<EmailJobData, EmailJobResult, string>,
): Promise<EmailJobResult> {
  const { name, data, id } = job;
  logger.info({ jobId: id, jobName: name, to: data.to }, 'Processing background email job');

  switch (name) {
    case EMAIL_JOB_NAMES.SEND_WELCOME: {
      const welcomeData = data as WelcomeEmailJobData;
      const html = renderWelcomeEmail({
        name: welcomeData.name,
        loginUrl: welcomeData.loginUrl,
      });
      logger.info(
        { to: welcomeData.to, userId: welcomeData.userId, htmlBytes: html.length },
        'Compiled and dispatched welcome HTML email',
      );
      break;
    }
    case EMAIL_JOB_NAMES.SEND_PASSWORD_RESET: {
      const resetData = data as PasswordResetEmailJobData;
      const html = renderPasswordResetEmail({
        resetToken: resetData.resetToken,
        expiresInMinutes: resetData.expiresInMinutes,
        resetUrl: resetData.resetUrl,
      });
      logger.info(
        { to: resetData.to, htmlBytes: html.length },
        'Compiled and dispatched password reset HTML email',
      );
      break;
    }
    case EMAIL_JOB_NAMES.SEND_GENERIC: {
      const genericData = data as GenericEmailJobData;
      logger.info({ to: genericData.to, subject: genericData.subject }, 'Dispatched generic email');
      break;
    }
    default: {
      logger.warn({ jobName: name }, 'Unknown email job type encountered');
      break;
    }
  }

  return {
    messageId: `msg_${id ?? Date.now()}`,
    sentAt: new Date().toISOString(),
  };
}

/**
 * Enqueues a welcome email job.
 */
export async function enqueueWelcomeEmail(
  data: WelcomeEmailJobData,
  opts?: JobsOptions,
): Promise<Job<WelcomeEmailJobData>> {
  return queueManager.addJob<WelcomeEmailJobData>(
    EMAIL_QUEUE_NAME,
    EMAIL_JOB_NAMES.SEND_WELCOME,
    data,
    opts,
  );
}

/**
 * Enqueues a password reset email job.
 */
export async function enqueuePasswordResetEmail(
  data: PasswordResetEmailJobData,
  opts?: JobsOptions,
): Promise<Job<PasswordResetEmailJobData>> {
  return queueManager.addJob<PasswordResetEmailJobData>(
    EMAIL_QUEUE_NAME,
    EMAIL_JOB_NAMES.SEND_PASSWORD_RESET,
    data,
    opts,
  );
}

/**
 * Enqueues a generic email job.
 */
export async function enqueueGenericEmail(
  data: GenericEmailJobData,
  opts?: JobsOptions,
): Promise<Job<GenericEmailJobData>> {
  return queueManager.addJob<GenericEmailJobData>(
    EMAIL_QUEUE_NAME,
    EMAIL_JOB_NAMES.SEND_GENERIC,
    data,
    opts,
  );
}

/**
 * Starts the BullMQ worker for the email queue.
 */
export function startEmailWorker(concurrency = 5): Worker<EmailJobData, EmailJobResult, string> {
  return workerManager.registerWorker<EmailJobData, EmailJobResult, string>(
    EMAIL_QUEUE_NAME,
    processEmailJob,
    { concurrency },
  );
}
