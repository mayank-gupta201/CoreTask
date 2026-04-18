import { Worker, Job } from 'bullmq';
import cron from 'node-cron';
import { connection } from '../queue';
import { reportService } from '../services/report.service';
import { generateExcel } from '../services/export/excelExporter';
import { generatePdf } from '../services/export/pdfExporter';
import { generateDocx } from '../services/export/docxExporter';
import { db } from '../db';
import { generatedReports, reportSchedules } from '../db/schema';
import { eq, and, lte, sql } from 'drizzle-orm';
import { getIO } from '../socket';
import { logger } from '../middlewares/logger.middleware';

// Import S3 service for file upload
import { s3Service } from '../services/s3.service';

interface ReportJobData {
    reportType: string;
    workspaceId: string;
    format: 'PDF' | 'DOCX' | 'XLSX';
    config?: { dateFrom?: string; dateTo?: string; userId?: string };
    requesterId: string;
    templateId?: string;
}

const reportWorker = new Worker(
    'reportGenerationQueue',
    async (job: Job<ReportJobData>) => {
        const { reportType, workspaceId, format, config, requesterId, templateId } = job.data;
        
        logger.info(`Starting report generation: type=${reportType}, format=${format}, workspace=${workspaceId}`);

        try {
            // 1. Fetch report data using appropriate data service
            const dateFrom = config?.dateFrom || getDefaultDateFrom();
            const dateTo = config?.dateTo || new Date().toISOString().split('T')[0];
            
            let reportData: any;
            switch (reportType) {
                case 'STATUS':
                    reportData = await reportService.getStatusReportData(workspaceId, dateFrom, dateTo);
                    break;
                case 'TIME_VARIANCE':
                    reportData = await reportService.getTimeVarianceData(workspaceId, dateFrom, dateTo);
                    break;
                case 'COST':
                    reportData = await reportService.getCostReportData(workspaceId, dateFrom, dateTo);
                    break;
                case 'RESOURCE':
                    reportData = await reportService.getResourceAvailabilityData(workspaceId, dateFrom, dateTo);
                    break;
                case 'TIMESHEET':
                    reportData = await reportService.getTimesheetReportData(workspaceId, dateFrom, dateTo, config?.userId);
                    break;
                default:
                    throw new Error(`Unknown report type: ${reportType}`);
            }

            // 2. Generate file using appropriate exporter
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `TaskMaster_${reportType}_${timestamp}.${format.toLowerCase()}`;
            
            let fileBuffer: Buffer;
            let mimeType: string;

            switch (format) {
                case 'XLSX':
                    fileBuffer = await generateExcel(reportType, reportData, fileName);
                    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                    break;
                case 'PDF':
                    fileBuffer = await generatePdf(reportType, reportData, fileName);
                    mimeType = 'application/pdf';
                    break;
                case 'DOCX':
                    fileBuffer = await generateDocx(reportType, reportData, fileName);
                    mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                    break;
                default:
                    throw new Error(`Unknown format: ${format}`);
            }

            // 3. Upload to S3
            let s3Url = '';
            try {
                const s3Key = `reports/${workspaceId}/${fileName}`;
                s3Url = await s3Service.uploadBuffer(fileBuffer, s3Key, mimeType);
            } catch (s3Err: any) {
                logger.warn(`S3 upload failed (report stored locally): ${s3Err.message}`);
                s3Url = `local://${fileName}`; // Fallback
            }

            // 4. Insert row into generated_reports
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30); // 30-day expiry

            const [report] = await db.insert(generatedReports).values({
                reportTemplateId: templateId || null,
                generatedBy: requesterId,
                format,
                s3Url,
                fileName,
                expiresAt,
            }).returning();

            // 5. Emit Socket.io 'report:ready' event to the requesting user
            const io = getIO();
            io.to(`workspace_${workspaceId}`).emit('report:ready' as any, {
                reportId: report.id,
                downloadUrl: s3Url,
                fileName,
                format,
                reportType,
            });

            logger.info(`Report generated successfully: ${fileName}, id=${report.id}`);
            
            return { reportId: report.id, downloadUrl: s3Url, fileName };
        } catch (error: any) {
            logger.error(`Report generation failed: ${error.message}`);
            throw error;
        }
    },
    { connection: connection as any }
);

reportWorker.on('completed', (job) => {
    logger.info(`Report job ${job.id} completed successfully.`);
});

reportWorker.on('failed', (job, err) => {
    logger.error(`Report job ${job?.id} failed: ${err.message}`);
});

/**
 * Report Schedule Cron — runs every 15 minutes to check for scheduled reports.
 * Picks up report_schedules where next_run_at <= NOW() and is_active = true.
 */
cron.schedule('*/15 * * * *', async () => {
    try {
        const now = new Date();
        const dueSchedules = await db.select()
            .from(reportSchedules)
            .where(
                and(
                    lte(reportSchedules.nextRunAt, now),
                    eq(reportSchedules.isActive, true)
                )
            );

        if (dueSchedules.length === 0) return;

        logger.info(`Report scheduler found ${dueSchedules.length} due reports.`);

        const { reportGenerationQueue } = await import('../queue');

        for (const schedule of dueSchedules) {
            // Fetch the template to know reportType + config
            const template = await db.query.reportTemplates.findFirst({
                where: eq(reportSchedules.reportTemplateId, schedule.reportTemplateId),
            });

            if (!template) continue;

            // Enqueue report generation job
            await reportGenerationQueue.add('scheduled-report', {
                reportType: template.reportType,
                workspaceId: template.workspaceId,
                format: 'XLSX', // Default format for scheduled reports
                config: template.config as any,
                requesterId: schedule.createdBy,
                templateId: template.id,
            });

            // Calculate next run based on frequency
            const nextRun = calculateNextRun(schedule.frequency, now);
            await db.update(reportSchedules)
                .set({ lastRunAt: now, nextRunAt: nextRun })
                .where(eq(reportSchedules.id, schedule.id));
        }
    } catch (error: any) {
        logger.error(`Report schedule cron error: ${error.message}`);
    }
});

function calculateNextRun(frequency: string, from: Date): Date {
    const next = new Date(from);
    switch (frequency) {
        case 'DAILY':
            next.setDate(next.getDate() + 1);
            break;
        case 'WEEKLY':
            next.setDate(next.getDate() + 7);
            break;
        case 'MONTHLY':
            next.setMonth(next.getMonth() + 1);
            break;
        default:
            next.setDate(next.getDate() + 7); // Default weekly
    }
    return next;
}

function getDefaultDateFrom(): string {
    const d = new Date();
    d.setMonth(d.getMonth() - 1); // Default 1 month back
    return d.toISOString().split('T')[0];
}

export { reportWorker };
