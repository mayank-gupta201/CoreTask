import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/axios';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useAuthStore } from '@/store/authStore';
import { useSocket } from '@/hooks/useSocket';

import { DashboardProject } from './components/DashboardProject';
import { DashboardPersonal } from './components/DashboardPersonal';

export function DashboardOverview() {
    const { activeWorkspaceId: workspaceId } = useWorkspaceStore();
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const socket = useSocket();
    const [activeTab, setActiveTab] = useState<'PROJECT' | 'PERSONAL'>('PROJECT');

    // Project Dashboard Datastream
    const { data: projectData, isLoading: isLoadingProject } = useQuery({
        queryKey: ['dashboard', workspaceId],
        queryFn: async () => {
            const res = await api.get(`/workspaces/${workspaceId}/dashboard`);
            return res.data;
        },
        enabled: !!workspaceId && activeTab === 'PROJECT',
        staleTime: 60_000, 
    });

    // Personal Dashboard Datastream
    const { data: personalData, isLoading: isLoadingPersonal } = useQuery({
        queryKey: ['dashboard:personal', workspaceId, user?.id],
        queryFn: async () => {
            const res = await api.get(`/workspaces/${workspaceId}/dashboard/personal`);
            return res.data;
        },
        enabled: !!workspaceId && !!user?.id && activeTab === 'PERSONAL',
        staleTime: 60_000,
    });

    // Real-Time Socket.io integrations
    useEffect(() => {
        if (!workspaceId || !socket) return;

        const invalidateProject = () => queryClient.invalidateQueries({ queryKey: ['dashboard', workspaceId] });
        const invalidatePersonal = () => {
            if (user?.id) queryClient.invalidateQueries({ queryKey: ['dashboard:personal', workspaceId, user.id] });
        };

        // Task CRUD triggers project refresh
        socket.on('taskCreated', invalidateProject);
        socket.on('taskUpdated', invalidateProject);
        socket.on('taskDeleted', invalidateProject);
        
        // Activity/Time logs triggers
        socket.on('taskActivityCreated', () => {
            invalidateProject();
            invalidatePersonal();
        });

        return () => {
            socket.off('taskCreated', invalidateProject);
            socket.off('taskUpdated', invalidateProject);
            socket.off('taskDeleted', invalidateProject);
            socket.off('taskActivityCreated');
        };
    }, [workspaceId, user?.id, queryClient, socket]);

    return (
        <div className="flex flex-col h-full max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-1">Overview of your workspace activity and personal workload.</p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('PROJECT')}
                        className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                            ${activeTab === 'PROJECT' 
                                ? 'border-blue-500 text-blue-600' 
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                        `}
                    >
                        Project Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('PERSONAL')}
                        className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                            ${activeTab === 'PERSONAL' 
                                ? 'border-blue-500 text-blue-600' 
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                        `}
                    >
                        My Work
                    </button>
                </nav>
            </div>

            {/* Tab Content */}
            <div className="flex-1 pb-10">
                {activeTab === 'PROJECT' ? (
                    <DashboardProject data={projectData} isLoading={isLoadingProject} />
                ) : (
                    <DashboardPersonal data={personalData} isLoading={isLoadingPersonal} />
                )}
            </div>
        </div>
    );
}
