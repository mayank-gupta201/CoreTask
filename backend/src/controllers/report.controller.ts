import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { reportService } from '../services/report.service';
import { z } from 'zod';

// Validation schemas
export const generateReportSchema = z.object({
    body: z.object({
        reportType: z.enum(['STATUS', 'TIME_VARIANCE', 'COST', 'RESOURCE', 'TIMESHEET']),
        format: z.enum(['PDF', 'DOCX', 'XLSX']),
        config: z.object({
            dateFrom: z.string().optional(),
            dateTo: z.string().optional(),
            userId: z.string().uuid().optional(),
        }).optional(),
    }),
});

export const createTemplateSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(255),
        reportType: z.enum(['STATUS', 'TIME_VARIANCE', 'COST', 'RESOURCE', 'TIMESHEET']),
        config: z.any().default({}),
    }),
});

export class ReportController {

    /**
     * POST /api/workspaces/:workspaceId/reports/generate
     * Enqueues a background report generation job.
     */
    async generateReport(req: AuthRequest, res: Response) {
        try {
            const workspaceId = req.params.workspaceId as string;
            const userId = req.user!.userId;
            const { reportType, format, config } = req.body;

            // Dynamic import to avoid circular dependency
            const { reportGenerationQueue } = await import('../queue');
            
            const job = await reportGenerationQueue.add('generate-report', {
                reportType,
                workspaceId,
                format,
                config: config || {},
                requesterId: userId,
            });

            res.status(202).json({
                data: { jobId: job.id },
                message: 'Report generation started. You will be notified when ready.',
            });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    /**
     * GET /api/workspaces/:workspaceId/reports/status/:jobId
     * Returns BullMQ job status for polling.
     */
    async getJobStatus(req: AuthRequest, res: Response) {
        try {
            const { jobId } = req.params as { jobId: string };
            const { reportGenerationQueue } = await import('../queue');
            
            const job = await reportGenerationQueue.getJob(jobId as string);
            if (!job) {
                return res.status(404).json({ message: 'Job not found.' });
            }

            const state = await job.getState();
            const result = job.returnvalue;

            res.json({
                data: {
                    jobId: job.id,
                    status: state.toUpperCase(), // WAITING | ACTIVE | COMPLETED | FAILED
                    result: state === 'completed' ? result : null,
                },
                message: `Job is ${state}.`,
            });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    /**
     * GET /api/workspaces/:workspaceId/reports
     * Returns list of generated reports for this workspace.
     */
    async getGeneratedReports(req: AuthRequest, res: Response) {
        try {
            const workspaceId = req.params.workspaceId as string;
            const reports = await reportService.getGeneratedReports(workspaceId);
            res.json({ data: reports.rows, message: 'Generated reports fetched.' });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    /**
     * GET /api/workspaces/:workspaceId/report-templates
     */
    async getReportTemplates(req: AuthRequest, res: Response) {
        try {
            const workspaceId = req.params.workspaceId as string;
            const templates = await reportService.getReportTemplates(workspaceId);
            res.json({ data: templates, message: 'Report templates fetched.' });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    /**
     * POST /api/workspaces/:workspaceId/report-templates
     */
    async createReportTemplate(req: AuthRequest, res: Response) {
        try {
            const workspaceId = req.params.workspaceId as string;
            const userId = req.user!.userId;
            const { name, reportType, config } = req.body;

            const template = await reportService.createReportTemplate(workspaceId, userId, { name, reportType, config });
            res.status(201).json({ data: template, message: 'Report template created.' });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    /**
     * DELETE /api/workspaces/:workspaceId/report-templates/:id
     */
    async deleteReportTemplate(req: AuthRequest, res: Response) {
        try {
            const workspaceId = req.params.workspaceId as string;
            const templateId = req.params.id as string;

            const deleted = await reportService.deleteReportTemplate(templateId, workspaceId);
            if (!deleted) {
                return res.status(404).json({ message: 'Template not found.' });
            }
            res.status(204).send();
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }
}

export const reportController = new ReportController();
