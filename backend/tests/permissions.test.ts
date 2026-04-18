import { describe, it, expect } from 'vitest';
import { getRolePermissions, ALL_PERMISSIONS, PermissionString } from '../src/config/permissions';

describe('Permissions Configuration', () => {
    describe('getRolePermissions', () => {
        it('should return all permissions for OWNER', () => {
            const perms = getRolePermissions('OWNER');
            expect(perms.length).toBe(ALL_PERMISSIONS.length);
            for (const p of ALL_PERMISSIONS) {
                expect(perms).toContain(p);
            }
        });

        it('should return all permissions except workspace:manage for ADMIN', () => {
            const perms = getRolePermissions('ADMIN');
            expect(perms).not.toContain('workspace:manage');
            expect(perms.length).toBe(ALL_PERMISSIONS.length - 1);
        });

        it('should give PROJECT_MANAGER task management, dependency, timesheet approve, reports and dashboard perms', () => {
            const perms = getRolePermissions('PROJECT_MANAGER');
            expect(perms).toContain('task:create');
            expect(perms).toContain('task:read');
            expect(perms).toContain('task:update');
            expect(perms).toContain('task:delete');
            expect(perms).toContain('task:assign');
            expect(perms).toContain('dependency:manage');
            expect(perms).toContain('timesheet:approve');
            expect(perms).toContain('timesheet:read');
            expect(perms).toContain('report:generate');
            expect(perms).toContain('report:manage');
            expect(perms).toContain('dashboard:read');
            expect(perms).toContain('resource:read');
        });

        it('should NOT give PROJECT_MANAGER workspace:manage or resource:manage', () => {
            const perms = getRolePermissions('PROJECT_MANAGER');
            expect(perms).not.toContain('workspace:manage');
            expect(perms).not.toContain('resource:manage');
        });

        it('should give RESOURCE_MANAGER resource:manage, resource:read, timesheet:read, timesheet:approve', () => {
            const perms = getRolePermissions('RESOURCE_MANAGER');
            expect(perms).toContain('resource:manage');
            expect(perms).toContain('resource:read');
            expect(perms).toContain('timesheet:read');
            expect(perms).toContain('timesheet:approve');
            expect(perms).toContain('dashboard:read');
        });

        it('should NOT give RESOURCE_MANAGER task:create or dependency:manage', () => {
            const perms = getRolePermissions('RESOURCE_MANAGER');
            expect(perms).not.toContain('task:create');
            expect(perms).not.toContain('dependency:manage');
            expect(perms).not.toContain('report:generate');
        });

        it('should give MEMBER basic task and timesheet submit access', () => {
            const perms = getRolePermissions('MEMBER');
            expect(perms).toContain('task:create');
            expect(perms).toContain('task:read');
            expect(perms).toContain('task:update');
            expect(perms).toContain('timesheet:submit');
            expect(perms).toContain('timesheet:read');
            expect(perms).toContain('dashboard:read');
            expect(perms).toContain('resource:read');
        });

        it('should NOT give MEMBER admin-level permissions', () => {
            const perms = getRolePermissions('MEMBER');
            expect(perms).not.toContain('task:delete');
            expect(perms).not.toContain('task:assign');
            expect(perms).not.toContain('dependency:manage');
            expect(perms).not.toContain('resource:manage');
            expect(perms).not.toContain('timesheet:approve');
            expect(perms).not.toContain('report:generate');
            expect(perms).not.toContain('workspace:manage');
        });

        it('should give VIEWER read-only permissions only', () => {
            const perms = getRolePermissions('VIEWER');
            const readPerms = perms.filter(p => p.includes(':read') || p === 'dashboard:read');
            // VIEWER should only have read-type permissions
            expect(perms.length).toBe(readPerms.length);
            expect(perms).toContain('task:read');
            expect(perms).toContain('portfolio:read');
            expect(perms).toContain('resource:read');
            expect(perms).toContain('timesheet:read');
            expect(perms).toContain('dashboard:read');
        });

        it('should NOT give VIEWER any write/manage permissions', () => {
            const perms = getRolePermissions('VIEWER');
            expect(perms).not.toContain('task:create');
            expect(perms).not.toContain('task:update');
            expect(perms).not.toContain('task:delete');
            expect(perms).not.toContain('resource:manage');
            expect(perms).not.toContain('timesheet:submit');
            expect(perms).not.toContain('report:generate');
        });

        it('should default to VIEWER permissions for unknown roles', () => {
            const perms = getRolePermissions('UNKNOWN_ROLE');
            const viewerPerms = getRolePermissions('VIEWER');
            expect(perms).toEqual(viewerPerms);
        });

        it('should handle case-insensitive role names', () => {
            const perms = getRolePermissions('owner');
            expect(perms.length).toBe(ALL_PERMISSIONS.length);
        });
    });

    describe('ALL_PERMISSIONS constant', () => {
        it('should contain all expected permission strings', () => {
            const expected: PermissionString[] = [
                'portfolio:create', 'portfolio:read', 'portfolio:manage',
                'program:create', 'program:read', 'program:manage',
                'task:create', 'task:read', 'task:update', 'task:delete', 'task:assign',
                'dependency:manage',
                'resource:manage', 'resource:read',
                'timesheet:submit', 'timesheet:approve', 'timesheet:read',
                'report:generate', 'report:manage',
                'dashboard:read',
                'workspace:manage',
            ];
            expect(ALL_PERMISSIONS).toEqual(expected);
        });

        it('should have 21 total permission strings', () => {
            expect(ALL_PERMISSIONS.length).toBe(21);
        });
    });
});
