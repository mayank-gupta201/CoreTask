import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { logger } from './middlewares/logger.middleware';

let io: Server;

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
