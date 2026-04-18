import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProblemDetails } from '../src/errors';

// Mock dependencies
const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ id: 'task-1' }]),
};

const mockDependencyRepo = {
    checkCircular: vi.fn(),
    createDependency: vi.fn(),
    deleteDependency: vi.fn(),
};

const mockIO = {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
};

const mockCriticalPathQueue = {
    add: vi.fn(),
};

vi.mock('../src/db', () => ({ db: mockDb }));
vi.mock('../src/repositories/dependency.repository', () => ({ dependencyRepository: mockDependencyRepo }));
vi.mock('../src/socket', () => ({ getIO: () => mockIO }));
vi.mock('../src/queue', () => ({ criticalPathQueue: mockCriticalPathQueue }));

describe('Dependency Service Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.limit.mockResolvedValue([{ id: 'task-1' }]);
    });

    describe('Circular Dependency Detection', () => {
        it('should reject circular dependencies', async () => {
            mockDependencyRepo.checkCircular.mockResolvedValue(true);
            
            const { DependencyService } = await import('../src/services/dependency.service');
            const service = new DependencyService();
            
            await expect(service.addDependency('ws-1', 'user-1', {
                predecessorTaskId: 'task-1',
                successorTaskId: 'task-2',
                dependencyType: 'FS',
                lagDays: 0,
            })).rejects.toThrow();
        });

        it('should allow non-circular dependencies', async () => {
            mockDependencyRepo.checkCircular.mockResolvedValue(false);
            mockDependencyRepo.createDependency.mockResolvedValue({ id: 'dep-1', predecessorTaskId: 'task-1', successorTaskId: 'task-2' });

            const { DependencyService } = await import('../src/services/dependency.service');
            const service = new DependencyService();

            const result = await service.addDependency('ws-1', 'user-1', {
                predecessorTaskId: 'task-1',
                successorTaskId: 'task-2',
                dependencyType: 'FS',
                lagDays: 0,
            });

            expect(result).toHaveProperty('id', 'dep-1');
            expect(mockDependencyRepo.createDependency).toHaveBeenCalledOnce();
        });
    });

    describe('Socket Event Emission', () => {
        it('should emit dependency:created on successful add', async () => {
            mockDependencyRepo.checkCircular.mockResolvedValue(false);
            mockDependencyRepo.createDependency.mockResolvedValue({ id: 'dep-1' });

            const { DependencyService } = await import('../src/services/dependency.service');
            const service = new DependencyService();

            await service.addDependency('ws-1', 'user-1', {
                predecessorTaskId: 'task-1',
                successorTaskId: 'task-2',
                dependencyType: 'FS',
            });

            expect(mockIO.to).toHaveBeenCalledWith('workspace_ws-1');
            expect(mockIO.emit).toHaveBeenCalledWith('dependency:created', { dependency: { id: 'dep-1' } });
        });

        it('should emit dependency:deleted on successful remove', async () => {
            mockDependencyRepo.deleteDependency.mockResolvedValue(true);

            const { DependencyService } = await import('../src/services/dependency.service');
            const service = new DependencyService();

            await service.removeDependency('ws-1', 'dep-1', 'user-1');

            expect(mockIO.emit).toHaveBeenCalledWith('dependency:deleted', { dependencyId: 'dep-1' });
        });
    });

    describe('Critical Path Queue', () => {
        it('should enqueue critical-path-compute on add', async () => {
            mockDependencyRepo.checkCircular.mockResolvedValue(false);
            mockDependencyRepo.createDependency.mockResolvedValue({ id: 'dep-1' });

            const { DependencyService } = await import('../src/services/dependency.service');
            const service = new DependencyService();

            await service.addDependency('ws-1', 'user-1', {
                predecessorTaskId: 'task-1',
                successorTaskId: 'task-2',
                dependencyType: 'FS',
            });

            expect(mockCriticalPathQueue.add).toHaveBeenCalledWith('critical-path-compute', { workspaceId: 'ws-1' });
        });

        it('should enqueue critical-path-compute on remove', async () => {
            mockDependencyRepo.deleteDependency.mockResolvedValue(true);

            const { DependencyService } = await import('../src/services/dependency.service');
            const service = new DependencyService();

            await service.removeDependency('ws-1', 'dep-1', 'user-1');

            expect(mockCriticalPathQueue.add).toHaveBeenCalledWith('critical-path-compute', { workspaceId: 'ws-1' });
        });
    });

    describe('Validation Zod Schema', () => {
        it('should validate correct dependency body', async () => {
            const { addDependencySchema } = await import('../src/controllers/dependency.controller');
            const result = addDependencySchema.parse({
                body: {
                    successorTaskId: '550e8400-e29b-41d4-a716-446655440000',
                    dependencyType: 'FS',
                    lagDays: 2,
                },
            });
            expect(result.body.dependencyType).toBe('FS');
            expect(result.body.lagDays).toBe(2);
        });

        it('should reject invalid dependency type', async () => {
            const { addDependencySchema } = await import('../src/controllers/dependency.controller');
            expect(() => addDependencySchema.parse({
                body: {
                    successorTaskId: '550e8400-e29b-41d4-a716-446655440000',
                    dependencyType: 'INVALID',
                },
            })).toThrow();
        });

        it('should default dependencyType to FS', async () => {
            const { addDependencySchema } = await import('../src/controllers/dependency.controller');
            const result = addDependencySchema.parse({
                body: {
                    successorTaskId: '550e8400-e29b-41d4-a716-446655440000',
                },
            });
            expect(result.body.dependencyType).toBe('FS');
        });
    });
});
