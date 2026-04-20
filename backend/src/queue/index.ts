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

// Critical path queue - compute zero-float critical paths using CPM
export const criticalPathQueue = new Queue('criticalPathQueue', { connection: connection as any });

// Utilization compute queue - detects >100% capacity overloading
export const utilizationQueue = new Queue('utilizationQueue', { connection: connection as any });

// Report generation queue - background generation of PDF/DOCX/XLSX reports
export const reportGenerationQueue = new Queue('reportGenerationQueue', { connection: connection as any });


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
        logger.info(`Processing ${type || 'generic'} email job ${job.id} for ${to}`);

        let htmlContext = '';
        if (type === 'VERIFY_EMAIL') {
            htmlContext = `<p>Please click here to verify your email address: <a href="http://localhost:5173/verify-email?token=${payload.token}">Verify Email</a></p>`;
        } else if (type === 'RESET_PASSWORD') {
            htmlContext = `<p>You requested a password reset. Click here to reset your password: <a href="http://localhost:5173/reset-password?token=${payload.token}">Reset Password</a></p>`;
        } else if (type === 'WORKSPACE_INVITE_EXISTING') {
            htmlContext = `
                <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
                    <h2 style="color: #1e293b; font-size: 20px; margin: 0 0 16px;">You've been invited!</h2>
                    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 8px;">
                        Hi there,
                    </p>
                    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                        <strong>${payload.inviterName}</strong> has invited you to collaborate on 
                        <strong>"${payload.workspaceName}"</strong> on CoreTask.
                    </p>
                    <a href="${payload.loginUrl}" 
                       style="display: inline-block; padding: 12px 28px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
                        Accept Invitation
                    </a>
                    <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; line-height: 1.5;">
                        Log in to your CoreTask dashboard to view your new workspace and start collaborating.
                    </p>
                </div>
            `;
        } else if (type === 'WORKSPACE_INVITE_NEW') {
            htmlContext = `
                <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
                    <h2 style="color: #1e293b; font-size: 20px; margin: 0 0 16px;">You've been invited!</h2>
                    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 8px;">
                        Hi there,
                    </p>
                    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                        <strong>${payload.inviterName}</strong> has invited you to collaborate on 
                        <strong>"${payload.workspaceName}"</strong> on CoreTask.
                    </p>
                    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                        Sign up for a free account to join the workspace and start collaborating with your team.
                    </p>
                    <a href="${payload.registerUrl}" 
                       style="display: inline-block; padding: 12px 28px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
                        Sign Up &amp; Join
                    </a>
                    <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; line-height: 1.5;">
                        After signing up, you'll automatically have access to the "${payload.workspaceName}" workspace.
                    </p>
                </div>
            `;
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

// Start node-cron routines
import '../workers/timesheetReminderWorker';

