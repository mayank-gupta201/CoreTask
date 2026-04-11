import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { logger } from './middlewares/logger.middleware';

export interface ServerToClientEvents {
    // Standard Tasks
    taskCreated: (task: any) => void;
    taskUpdated: (task: any) => void;
    taskDeleted: (payload: { id: string, workspaceId: string }) => void;
    taskActivityCreated: (payload: { taskId: string, activity: any }) => void;
    
    // Dependencies (PROMPT 1C)
    'dependency:created': (payload: { dependency: any }) => void;
    'dependency:deleted': (payload: { dependencyId: string }) => void;
    'critical-path:updated': (payload: { workspaceId: string, criticalPathTaskIds: string[] }) => void;

    // Resource Management (PROMPT 2A)
    'assignment:created': (payload: { taskId: string, userId: string, allocationPercent: number }) => void;
    'assignment:removed': (payload: { taskId: string, userId: string }) => void;
    'resource:overallocated': (payload: { userId: string, userName: string, overAllocatedDates: string[] }) => void;

    // Timesheets (PROMPT 2C)
    'timelog:added': (payload: { timesheetId: string, logId: string }) => void;
    'timesheet:submitted': (payload: { timesheetId: string, userId: string }) => void;
    'timesheet:approved': (payload: { timesheetId: string, userId: string }) => void;
    'timesheet:rejected': (payload: { timesheetId: string, userId: string }) => void;
}

export interface ClientToServerEvents {
    joinWorkspace: (workspaceId: string) => void;
    leaveWorkspace: (workspaceId: string) => void;
}

let io: Server<ClientToServerEvents, ServerToClientEvents>;

export const initSocket = (server: HttpServer) => {
    io = new Server(server, {
        cors: {
            origin: 'http://localhost:5173',
            credentials: true,
        },
    });

    io.on('connection', (socket: Socket) => {
        logger.info(`Socket connected: ${socket.id}`);

        socket.on('joinWorkspace', (workspaceId: string) => {
            const roomName = `workspace_${workspaceId}`;
            socket.join(roomName);
            logger.info(`Socket ${socket.id} joined room: ${roomName}`);
        });

        socket.on('leaveWorkspace', (workspaceId: string) => {
            const roomName = `workspace_${workspaceId}`;
            socket.leave(roomName);
            logger.info(`Socket ${socket.id} left room: ${roomName}`);
        });

        socket.on('disconnect', () => {
            logger.info(`Socket disconnected: ${socket.id}`);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io is not initialized!');
    }
    return io;
};
