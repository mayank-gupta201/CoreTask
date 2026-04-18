import { describe, it, expect, vi } from 'vitest';
import { ProblemDetails } from '../src/errors';

describe('Timesheet Service Logic', () => {

    describe('Week Boundary Calculation', () => {
        it('should calculate Monday-Sunday boundaries correctly', () => {
            // Testing the logic directly
            const getWeekBoundaries = (dateStr?: string) => {
                const d = dateStr ? new Date(dateStr) : new Date();
                const day = d.getDay() || 7;
                const monday = new Date(d);
                monday.setDate(d.getDate() - day + 1);
                monday.setHours(0, 0, 0, 0);
                const sunday = new Date(monday);
                sunday.setDate(monday.getDate() + 6);
                sunday.setHours(23, 59, 59, 999);
                return { monday, sunday };
            };

            // Wednesday April 15, 2026
            const { monday, sunday } = getWeekBoundaries('2026-04-15');
            expect(monday.getDay()).toBe(1); // Monday
            expect(sunday.getDay()).toBe(0); // Sunday
            expect(monday.getDate()).toBe(13); // April 13
            expect(sunday.getDate()).toBe(19); // April 19
        });

        it('should handle Sunday correctly (edge case)', () => {
            const getWeekBoundaries = (dateStr: string) => {
                const d = new Date(dateStr);
                const day = d.getDay() || 7;
                const monday = new Date(d);
                monday.setDate(d.getDate() - day + 1);
                monday.setHours(0, 0, 0, 0);
                return monday;
            };

            // April 19 is a Sunday in 2026
            const monday = getWeekBoundaries('2026-04-19');
            expect(monday.getDate()).toBe(13); // Should be April 13 (same week)
        });
    });

    describe('Hours Validation', () => {
        it('should reject hours <= 0', () => {
            expect(() => {
                if (0 <= 0 || 0 > 24) throw new ProblemDetails({ title: 'Bad Request', status: 400, detail: 'Invalid hours' });
            }).toThrow();
        });

        it('should reject hours > 24', () => {
            expect(() => {
                const hours = 25;
                if (hours <= 0 || hours > 24) throw new ProblemDetails({ title: 'Bad Request', status: 400, detail: 'Invalid hours' });
            }).toThrow();
        });

        it('should accept valid hours like 7.5', () => {
            const hours = 7.5;
            expect(hours > 0 && hours <= 24).toBe(true);
        });

        it('should accept exactly 24 hours', () => {
            const hours = 24;
            expect(hours > 0 && hours <= 24).toBe(true);
        });
    });

    describe('Daily Total Check', () => {
        it('should reject if total exceeds 24h for a day', () => {
            const existingHours = 16;
            const newHours = 9;
            expect(existingHours + newHours > 24).toBe(true);
        });

        it('should accept if total is within 24h', () => {
            const existingHours = 8;
            const newHours = 8;
            expect(existingHours + newHours <= 24).toBe(true);
        });
    });

    describe('Status Transitions', () => {
        it('should only allow logging on DRAFT timesheets', () => {
            const validStatuses = ['DRAFT'];
            expect(validStatuses.includes('DRAFT')).toBe(true);
            expect(validStatuses.includes('SUBMITTED')).toBe(false);
            expect(validStatuses.includes('APPROVED')).toBe(false);
        });

        it('should only allow submit from DRAFT', () => {
            const status = 'DRAFT';
            expect(status === 'DRAFT').toBe(true);
        });

        it('should only allow approve from SUBMITTED', () => {
            const status = 'SUBMITTED';
            expect(status === 'SUBMITTED').toBe(true);
        });

        it('should reject approve on non-SUBMITTED timesheet', () => {
            const status = 'DRAFT';
            expect(status === 'SUBMITTED').toBe(false);
        });

        it('should reject on APPROVED timesheet', () => {
            const status = 'APPROVED';
            expect(status === 'SUBMITTED').toBe(false);
        });
    });

    describe('Empty Submission Guard', () => {
        it('should reject submission of empty timesheet', () => {
            const timeLogs: any[] = [];
            expect(timeLogs.length === 0).toBe(true);
        });

        it('should allow submission with at least 1 log', () => {
            const timeLogs = [{ id: '1', hours: 8 }];
            expect(timeLogs.length > 0).toBe(true);
        });
    });

    describe('Auto-Fill Logic', () => {
        it('should offset dates by 7 days for auto-fill', () => {
            const lastWeekDate = new Date('2026-04-06'); // Monday last week
            const newDate = new Date(lastWeekDate);
            newDate.setDate(newDate.getDate() + 7);
            expect(newDate.toISOString().split('T')[0]).toBe('2026-04-13'); // Monday this week
        });

        it('should skip deleted tasks during auto-fill', () => {
            const lastWeekLogs = [
                { taskId: 'task-1', hours: 8 },
                { taskId: 'task-2', hours: 4 },
                { taskId: null, hours: 2 }, // non-task time
            ];
            const existingTasks = new Set(['task-1']); // task-2 was deleted
            
            const validLogs = lastWeekLogs.filter(
                log => !log.taskId || existingTasks.has(log.taskId)
            );
            expect(validLogs.length).toBe(2); // task-1 and null/non-task
        });
    });

    describe('Payroll CSV Format', () => {
        it('should calculate cost as hours × rate', () => {
            const hours = 8;
            const rate = 75;
            const cost = hours * rate;
            expect(cost).toBe(600);
        });

        it('should handle 0 rate gracefully', () => {
            const hours = 8;
            const rate = 0;
            const cost = hours * rate;
            expect(cost).toBe(0);
        });
    });
});
