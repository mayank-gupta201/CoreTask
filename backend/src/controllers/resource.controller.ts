import { Response } from 'express';
import { resourceService } from '../services/resource.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { z } from 'zod';

export const assignTaskSchema = z.object({
    body: z.object({
        userId: z.string().uuid(),
        allocationPercent: z.number().min(1).max(100).default(100),
    }),
});

export const resourceGridParamsSchema = z.object({
    query: z.object({
        dateFrom: z.string().date(),
        dateTo: z.string().date(),
    }),
});

export const availabilitySchema = z.object({
    body: z.object({
        availableHoursPerDay: z.number().min(0).max(24),
        effectiveFrom: z.string().date(),
        effectiveTo: z.string().date().optional().nullable(),
    }),
});

export const holidaySchema = z.object({
    body: z.object({
        name: z.string().min(1),
        date: z.string().date(),
        isRecurring: z.boolean().default(false),
        region: z.string().optional(),
    }),
});

export const costRateSchema = z.object({
    body: z.object({
        hourlyRate: z.number().min(0),
        currency: z.string().length(3).default('USD'),
        effectiveFrom: z.string().date(),
    }),
});

export class ResourceController {
    // Assignments
    async assignTask(req: AuthRequest, res: Response) {
        try {
            const workspaceId = req.workspace!.id;
            const requesterId = req.user!.userId;
            const taskId = req.params.taskId as string;
            const { userId, allocationPercent } = req.body;

            const assignment = await resourceService.assignUserToTask(workspaceId, taskId, userId, allocationPercent, requesterId);
            res.status(201).json(assignment);
        } catch (error: any) {
            if (error.status) res.status(error.status).json({ message: error.detail || error.message });
            else res.status(500).json({ message: error.message });
        }
    }

    async removeAssignment(req: AuthRequest, res: Response) {
        try {
            const workspaceId = req.workspace!.id;
            const requesterId = req.user!.userId;
            const taskId = req.params.taskId as string;
            const userId = req.params.userId as string;

            await resourceService.removeAssignment(workspaceId, taskId, userId, requesterId);
            res.status(204).send();
        } catch (error: any) {
            if (error.status) res.status(error.status).json({ message: error.detail || error.message });
            else res.status(500).json({ message: error.message });
        }
    }

    // Grid View
    async getResourceGrid(req: AuthRequest, res: Response) {
        try {
            const workspaceId = req.workspace!.id;
            const dateFrom = new Date(req.query.dateFrom as string);
            const dateTo = new Date(req.query.dateTo as string);

            const grid = await resourceService.getResourceGrid(workspaceId, dateFrom, dateTo);
            res.json(grid);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    // Availability Settings
    async setAvailability(req: AuthRequest, res: Response) {
        try {
            const workspaceId = req.workspace!.id;
            const requesterId = req.user!.userId;
            const userId = req.params.userId as string;
            
            const data = {
                availableHoursPerDay: req.body.availableHoursPerDay,
                effectiveFrom: new Date(req.body.effectiveFrom),
                effectiveTo: req.body.effectiveTo ? new Date(req.body.effectiveTo) : undefined
            };

            const avail = await resourceService.setAvailability(workspaceId, userId, data, requesterId);
            res.status(201).json(avail);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    // Holidays Setup
    async getHolidays(req: AuthRequest, res: Response) {
        try {
            const workspaceId = req.workspace!.id;
            const yearStr = req.query.year as string;
            const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();

            // Directly resolving from repository since it's just a raw lookup with no large aggregates
            const { resourceRepository } = require('../repositories/resource.repository');
            const holidays = await resourceRepository.getHolidays(workspaceId, year);
            res.json(holidays);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async createHoliday(req: AuthRequest, res: Response) {
        try {
            const workspaceId = req.workspace!.id;
            const requesterId = req.user!.userId;
            
            req.body.date = new Date(req.body.date);
            const holiday = await resourceService.manageHolidays(workspaceId, 'create', req.body, requesterId);
            res.status(201).json(holiday);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async deleteHoliday(req: AuthRequest, res: Response) {
        try {
            const workspaceId = req.workspace!.id;
            const requesterId = req.user!.userId;
            const holidayId = req.params.holidayId as string;

            await resourceService.manageHolidays(workspaceId, 'delete', { holidayId }, requesterId);
            res.status(204).send();
        } catch (error: any) {
            if (error.status) res.status(error.status).json({ message: error.detail || error.message });
            else res.status(500).json({ message: error.message });
        }
    }

    // Cost Rate Setup
    async setCostRate(req: AuthRequest, res: Response) {
        try {
            const workspaceId = req.workspace!.id;
            const requesterId = req.user!.userId;
            const userId = req.params.userId as string;

            const data = {
                hourlyRate: req.body.hourlyRate,
                currency: req.body.currency,
                effectiveFrom: new Date(req.body.effectiveFrom)
            };

            const rate = await resourceService.setUserCostRate(workspaceId, userId, data, requesterId);
            res.status(201).json(rate);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }
}

export const resourceController = new ResourceController();
