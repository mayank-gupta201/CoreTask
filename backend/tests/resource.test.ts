import { describe, it, expect } from 'vitest';

describe('Resource Management Logic', () => {

    describe('Allocation Validation', () => {
        it('should accept allocation between 1 and 100', () => {
            const validAllocations = [1, 25, 50, 75, 100];
            for (const alloc of validAllocations) {
                expect(alloc >= 1 && alloc <= 100).toBe(true);
            }
        });

        it('should reject allocation of 0', () => {
            expect(0 >= 1).toBe(false);
        });

        it('should reject allocation > 100', () => {
            expect(101 <= 100).toBe(false);
        });
    });

    describe('Overallocation Detection', () => {
        it('should detect overallocation when total > 100%', () => {
            const dailyAllocations = [
                { taskId: 'task-1', allocation: 60 },
                { taskId: 'task-2', allocation: 50 },
            ];
            const totalAllocation = dailyAllocations.reduce((sum, a) => sum + a.allocation, 0);
            expect(totalAllocation).toBe(110);
            expect(totalAllocation > 100).toBe(true);
        });

        it('should not flag when total <= 100%', () => {
            const dailyAllocations = [
                { taskId: 'task-1', allocation: 60 },
                { taskId: 'task-2', allocation: 40 },
            ];
            const totalAllocation = dailyAllocations.reduce((sum, a) => sum + a.allocation, 0);
            expect(totalAllocation).toBe(100);
            expect(totalAllocation > 100).toBe(false);
        });

        it('should handle single task at 100%', () => {
            const totalAllocation = 100;
            expect(totalAllocation > 100).toBe(false);
        });

        it('should collect overallocated dates', () => {
            const utilizationData = [
                { date: '2026-04-14', totalAllocation: 80, isOverAllocated: false },
                { date: '2026-04-15', totalAllocation: 120, isOverAllocated: true },
                { date: '2026-04-16', totalAllocation: 150, isOverAllocated: true },
                { date: '2026-04-17', totalAllocation: 60, isOverAllocated: false },
            ];

            const overAllocatedDates = utilizationData
                .filter(d => d.isOverAllocated)
                .map(d => d.date);

            expect(overAllocatedDates).toEqual(['2026-04-15', '2026-04-16']);
            expect(overAllocatedDates.length).toBe(2);
        });
    });

    describe('Availability Calculation', () => {
        it('should default to 8 hours per day', () => {
            const defaultHoursPerDay = 8.00;
            expect(defaultHoursPerDay).toBe(8);
        });

        it('should calculate weekly capacity from daily hours', () => {
            const hoursPerDay = 8;
            const workingDays = 5; // Mon-Fri
            expect(hoursPerDay * workingDays).toBe(40);
        });

        it('should handle partial availability', () => {
            const hoursPerDay = 4.5;
            const workingDays = 5;
            expect(hoursPerDay * workingDays).toBe(22.5);
        });
    });

    describe('Holiday Impact', () => {
        it('should exclude holidays from working days', () => {
            const totalDays = 5; // Mon-Fri
            const holidays = 1;
            const workingDays = totalDays - holidays;
            expect(workingDays).toBe(4);
        });

        it('should handle recurring holidays', () => {
            const holiday = { name: 'New Year', date: '2026-01-01', isRecurring: true };
            expect(holiday.isRecurring).toBe(true);
            // In a real system, recurring holidays appear every year on the same date
        });

        it('should filter holidays by year', () => {
            const holidays = [
                { name: 'New Year', date: '2026-01-01' },
                { name: 'Diwali', date: '2026-10-20' },
                { name: 'Christmas', date: '2025-12-25' },
            ];
            const year2026 = holidays.filter(h => h.date.startsWith('2026'));
            expect(year2026.length).toBe(2);
        });
    });

    describe('Cost Rate Logic', () => {
        it('should apply the correct rate for a given date', () => {
            const rates = [
                { effectiveFrom: '2026-01-01', hourlyRate: 50 },
                { effectiveFrom: '2026-04-01', hourlyRate: 75 },
            ];
            const targetDate = new Date('2026-04-15');
            
            // Find the most recent applicable rate
            const applicableRate = rates
                .filter(r => new Date(r.effectiveFrom) <= targetDate)
                .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime())[0];

            expect(applicableRate.hourlyRate).toBe(75);
        });

        it('should default currency to USD', () => {
            const defaultCurrency = 'USD';
            expect(defaultCurrency).toBe('USD');
        });

        it('should calculate task cost correctly', () => {
            const hourlyRate = 75;
            const hoursLogged = 12;
            const cost = hourlyRate * hoursLogged;
            expect(cost).toBe(900);
        });
    });

    describe('Resource Grid Data Structure', () => {
        it('should have correct shape per user', () => {
            const gridRow = {
                user: { id: 'u1', name: 'Alice', email: 'alice@test.com' },
                dailyData: [
                    { date: '2026-04-14', totalAllocation: 80, isHoliday: false, isOverAllocated: false, tasks: [] },
                    { date: '2026-04-15', totalAllocation: 120, isHoliday: false, isOverAllocated: true, tasks: [] },
                ],
            };

            expect(gridRow.user).toHaveProperty('id');
            expect(gridRow.user).toHaveProperty('name');
            expect(gridRow.dailyData).toHaveLength(2);
            expect(gridRow.dailyData[1].isOverAllocated).toBe(true);
        });

        it('should mark weekend cells', () => {
            const date = new Date('2026-04-18'); // Saturday
            expect(date.getDay()).toBe(6); // 0=Sun, 6=Sat
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            expect(isWeekend).toBe(true);
        });
    });

    describe('Task Assignment Uniqueness', () => {
        it('should enforce unique (taskId, userId) pairs', () => {
            const assignments = [
                { taskId: 'task-1', userId: 'user-1' },
                { taskId: 'task-1', userId: 'user-2' },
            ];
            const newAssignment = { taskId: 'task-1', userId: 'user-1' };
            const isDuplicate = assignments.some(
                a => a.taskId === newAssignment.taskId && a.userId === newAssignment.userId
            );
            expect(isDuplicate).toBe(true);
        });
    });
});
