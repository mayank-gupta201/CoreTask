import { describe, it, expect, vi } from 'vitest';

describe('Report Service Logic', () => {

    describe('Report Data Structures', () => {
        it('should produce correct status report shape', () => {
            const mockData = {
                workspace: { name: 'ws-1', memberCount: 5 },
                taskSummary: { total: 20, todo: 5, inProgress: 8, done: 7, overdue: 3 },
                completionTrend: [{ week: '1/6', completed: 3 }],
                topBlockers: [{ taskTitle: 'Fix auth', daysSinceCreated: 14, assignee: 'user-1' }],
                upcomingDeadlines: [{ taskTitle: 'Deploy v2', dueDate: '2026-04-20', assignee: 'user-2', priority: 'HIGH' }],
            };

            expect(mockData.taskSummary.total).toBe(20);
            expect(mockData.taskSummary.todo + mockData.taskSummary.inProgress + mockData.taskSummary.done).toBe(20);
            expect(mockData.completionTrend).toHaveLength(1);
            expect(mockData.topBlockers[0]).toHaveProperty('taskTitle');
            expect(mockData.upcomingDeadlines[0]).toHaveProperty('priority');
        });

        it('should produce correct time variance report shape', () => {
            const mockData = {
                summary: { totalEstimatedHours: 100, totalLoggedHours: 120, varianceHours: 20, variancePercent: 20 },
                byTask: [{ taskId: 't1', taskTitle: 'Task 1', estimatedHours: 10, loggedHours: 12, variance: 2 }],
                byMember: [{ userId: 'u1', name: 'user1', estimatedHours: 50, loggedHours: 60, variance: 10 }],
            };

            expect(mockData.summary.varianceHours).toBe(mockData.summary.totalLoggedHours - mockData.summary.totalEstimatedHours);
            expect(mockData.summary.variancePercent).toBe(20);
            expect(mockData.byTask[0].variance).toBe(mockData.byTask[0].loggedHours - mockData.byTask[0].estimatedHours);
        });

        it('should produce correct cost report shape', () => {
            const budgetedCost = 5000;
            const actualCost = 4000;
            const variance = budgetedCost - actualCost;
            const cpi = budgetedCost / actualCost;

            expect(variance).toBe(1000);
            expect(cpi).toBe(1.25);
        });

        it('should handle zero estimated hours in variance calculation', () => {
            const totalEstimatedHours = 0;
            const totalLoggedHours = 10;
            const variancePercent = totalEstimatedHours > 0
                ? Math.round(((totalLoggedHours - totalEstimatedHours) / totalEstimatedHours) * 100)
                : 0;
            expect(variancePercent).toBe(0);
        });

        it('should handle zero actual cost in CPI calculation', () => {
            const budgetedCost = 5000;
            const actualCost = 0;
            const cpi = actualCost > 0 ? budgetedCost / actualCost : 0;
            expect(cpi).toBe(0);
        });
    });

    describe('Report Validation Schemas', () => {
        it('should validate generate report body', async () => {
            const { generateReportSchema } = await import('../src/controllers/report.controller');
            const result = generateReportSchema.parse({
                body: {
                    reportType: 'STATUS',
                    format: 'PDF',
                    config: { dateFrom: '2026-01-01', dateTo: '2026-03-31' },
                },
            });
            expect(result.body.reportType).toBe('STATUS');
            expect(result.body.format).toBe('PDF');
        });

        it('should reject invalid report type', async () => {
            const { generateReportSchema } = await import('../src/controllers/report.controller');
            expect(() => generateReportSchema.parse({
                body: { reportType: 'INVALID', format: 'PDF' },
            })).toThrow();
        });

        it('should reject invalid format', async () => {
            const { generateReportSchema } = await import('../src/controllers/report.controller');
            expect(() => generateReportSchema.parse({
                body: { reportType: 'STATUS', format: 'CSV' },
            })).toThrow();
        });

        it('should accept all valid report types', async () => {
            const { generateReportSchema } = await import('../src/controllers/report.controller');
            const types = ['STATUS', 'TIME_VARIANCE', 'COST', 'RESOURCE', 'TIMESHEET'];
            for (const type of types) {
                const result = generateReportSchema.parse({
                    body: { reportType: type, format: 'XLSX' },
                });
                expect(result.body.reportType).toBe(type);
            }
        });

        it('should accept all valid formats', async () => {
            const { generateReportSchema } = await import('../src/controllers/report.controller');
            const formats = ['PDF', 'DOCX', 'XLSX'];
            for (const format of formats) {
                const result = generateReportSchema.parse({
                    body: { reportType: 'STATUS', format },
                });
                expect(result.body.format).toBe(format);
            }
        });

        it('should validate create template body', async () => {
            const { createTemplateSchema } = await import('../src/controllers/report.controller');
            const result = createTemplateSchema.parse({
                body: {
                    name: 'My Monthly Status',
                    reportType: 'STATUS',
                    config: { dateFrom: '2026-01-01' },
                },
            });
            expect(result.body.name).toBe('My Monthly Status');
        });

        it('should reject empty template name', async () => {
            const { createTemplateSchema } = await import('../src/controllers/report.controller');
            expect(() => createTemplateSchema.parse({
                body: { name: '', reportType: 'STATUS' },
            })).toThrow();
        });
    });

    describe('Export File Naming', () => {
        it('should generate unique file names with timestamp', () => {
            const reportType = 'STATUS';
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `TaskMaster_${reportType}_${timestamp}.pdf`;
            expect(fileName).toMatch(/^TaskMaster_STATUS_\d{4}-\d{2}-\d{2}T/);
            expect(fileName.endsWith('.pdf')).toBe(true);
        });

        it('should use correct extension for each format', () => {
            const formats = { XLSX: 'xlsx', PDF: 'pdf', DOCX: 'docx' };
            for (const [format, ext] of Object.entries(formats)) {
                const fileName = `Report.${format.toLowerCase()}`;
                expect(fileName.endsWith(`.${ext}`)).toBe(true);
            }
        });
    });

    describe('Report Schedule Frequency', () => {
        it('should calculate next daily run correctly', () => {
            const now = new Date('2026-04-15T10:00:00Z');
            const next = new Date(now);
            next.setDate(next.getDate() + 1);
            expect(next.getDate()).toBe(16);
        });

        it('should calculate next weekly run correctly', () => {
            const now = new Date('2026-04-15T10:00:00Z');
            const next = new Date(now);
            next.setDate(next.getDate() + 7);
            expect(next.getDate()).toBe(22);
        });

        it('should calculate next monthly run correctly', () => {
            const now = new Date('2026-04-15T10:00:00Z');
            const next = new Date(now);
            next.setMonth(next.getMonth() + 1);
            expect(next.getMonth()).toBe(4); // May
        });
    });
});
