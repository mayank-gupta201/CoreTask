import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useWorkspaceStore } from '../store/workspaceStore';

// We must use the same backend URL that our axios instance uses
const SOCKET_URL = 'http://localhost:4000';

export function useSocket() {
    const { token } = useAuthStore();
    const { activeWorkspaceId } = useWorkspaceStore();
    const [socket, setSocket] = useState<Socket | null>(null);

    useEffect(() => {
        const isAuthenticated = !!token;
        if (!isAuthenticated || !activeWorkspaceId) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
            }
            return;
        }

        // Initialize socket connection
        const newSocket = io(SOCKET_URL, {
            withCredentials: true,
        });

        // Event listeners
        newSocket.on('connect', () => {
            console.log(`[Socket] Connected with ID: ${newSocket.id}`);
            // Join the workspace room immediately upon connection
            newSocket.emit('joinWorkspace', activeWorkspaceId);
        });

        newSocket.on('disconnect', () => {
            console.log('[Socket] Disconnected');
        });

        setSocket(newSocket);

        // Cleanup on unmount or workspace change
        return () => {
            newSocket.emit('leaveWorkspace', activeWorkspaceId);
            newSocket.disconnect();
        };
    }, [token, activeWorkspaceId]);

    return socket;
}
