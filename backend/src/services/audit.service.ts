import { db } from '../db';
import { auditLogs } from '../db/schema';

export class AuditService {
    async logAction(data: {
        userId?: string;
        action: string;
        resource: string;
        metadata?: any;
    }) {
        try {
            await db.insert(auditLogs).values({
                userId: data.userId || null,
                action: data.action,
                resource: data.resource,
                metadata: data.metadata ? JSON.stringify(data.metadata) : null,
            });
        } catch (error) {
            console.error('Failed to write audit log:', error);
            // We intentionally catch this so audit log failures don't crash main flows
        }
    }
}

export const auditService = new AuditService();
