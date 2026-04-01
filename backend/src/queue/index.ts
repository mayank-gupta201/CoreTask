import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../middlewares/logger.middleware';
import nodemailer from 'nodemailer';

export const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    retryStrategy() {
        return null; // Don't retry indefinitely, let it fail gracefully
    }
});

connection.on('error', (err) => {
    logger.warn(`Redis connection error (Queues disabled): ${err.message}`);
});

export const emailQueue = new Queue('emailQueue', { connection: connection as any });

// Recurring tasks queue — runs at midnight daily
export const recurringTasksQueue = new Queue('recurringTasksQueue', { connection: connection as any });

// Schedule the recurring job (runs at 00:00 every day)
recurringTasksQueue.upsertJobScheduler(
    'nightly-recurring-scan',
    { pattern: '0 0 * * *' }, // cron: midnight every day
    { name: 'processRecurringTasks', data: {} }
).catch((err) => {
    logger.warn(`Could not schedule recurring task job (Redis may be unavailable): ${err.message}`);
});

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.SMTP_PORT || '587'),
    auth: {
        user: process.env.SMTP_USER || 'ethereal.user@ethereal.email',
        pass: process.env.SMTP_PASS || 'etherealPassword',
    },
});

const emailWorker = new Worker(
    'emailQueue',
    async (job: Job) => {
        const { to, subject, type, payload } = job.data;
        logger.info(`Processing ${type} email job ${job.id} for ${to}`);

        let htmlContext = '';
        if (type === 'VERIFY_EMAIL') {
            htmlContext = `<p>Please click here to verify your email address: <a href="http://localhost:5173/verify-email?token=${payload.token}">Verify Email</a></p>`;
        } else if (type === 'RESET_PASSWORD') {
            htmlContext = `<p>You requested a password reset. Click here to reset your password: <a href="http://localhost:5173/reset-password?token=${payload.token}">Reset Password</a></p>`;
        }

        const info = await transporter.sendMail({
            from: '"TaskMaster" <noreply@taskmaster.app>',
            to,
            subject,
            html: htmlContext || `<p>${subject}</p>`,
        });

        logger.info(`Email job ${job.id} completed. Preview URL: ${nodemailer.getTestMessageUrl(info) || 'N/A'}`);
    },
    { connection: connection as any }
);

emailWorker.on('completed', (job) => {
    logger.debug(`Job with id ${job.id} has been completed`);
});

emailWorker.on('failed', (job, err) => {
    logger.error(`Job with id ${job?.id} has failed with ${err.message}`);
});

