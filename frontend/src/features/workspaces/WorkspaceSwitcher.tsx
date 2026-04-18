import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/axios';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Workspace {
    id: string;
    name: string;
}

export function WorkspaceSwitcher() {
    const { activeWorkspaceId, setActiveWorkspace } = useWorkspaceStore();
    const queryClient = useQueryClient();

    const handleWorkspaceChange = (id: string) => {
        setActiveWorkspace(id);
        // Clear all queries as we switched workspace context
        queryClient.clear();
    };

    const { data: workspaces, isLoading } = useQuery<Workspace[]>({
        queryKey: ['workspaces'],
        queryFn: async () => {
            const res = await api.get('/workspaces');
            return res.data;
        },
    });

    // Auto-select the first workspace if none is set, or if the current one is somehow invalid
    useEffect(() => {
        if (!isLoading && workspaces && workspaces.length > 0) {
            const isValidWorkspace = workspaces.some(w => w.id === activeWorkspaceId);
            if (!activeWorkspaceId || !isValidWorkspace) {
                // Don't call queryClient.clear here initially, just set the ID
                setActiveWorkspace(workspaces[0].id);
            }
        }
    }, [isLoading, workspaces, activeWorkspaceId, setActiveWorkspace]);

    if (isLoading) {
        return <div className="h-9 w-[180px] bg-muted animate-pulse rounded-md" />;
    }

    return (
        <Select value={activeWorkspaceId || ''} onValueChange={handleWorkspaceChange}>
            <SelectTrigger className="w-[180px] h-9 bg-background">
                <SelectValue placeholder="Select a workspace" />
            </SelectTrigger>
            <SelectContent>
                {workspaces?.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>
                        {ws.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
