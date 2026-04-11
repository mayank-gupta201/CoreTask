import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { api } from '@/api/axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface AddProjectToProgramProps {
    portfolioId: string;
    programId: string;
    children: React.ReactNode;
}

export const AddProjectToProgram = ({ portfolioId, programId, children }: AddProjectToProgramProps) => {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');

    // Fetch workspaces the user is a part of
    const { data: userWorkspaces = [], isLoading } = useQuery({
        queryKey: ['my-workspaces'],
        queryFn: async () => {
            const res = await api.get('/workspaces');
            return res.data;
        },
        enabled: open
    });

    const mutation = useMutation({
        mutationFn: async () => {
            const res = await api.post(`/portfolios/${portfolioId}/programs/${programId}/projects`, { 
                workspaceId: selectedWorkspaceId 
            });
            return res.data;
        },
        onSuccess: () => {
            toast.success('Project added to program successfully');
            setOpen(false);
            setSelectedWorkspaceId('');
            queryClient.invalidateQueries({ queryKey: ['portfolio-dashboard', portfolioId] });
            queryClient.invalidateQueries({ queryKey: ['portfolio-programs', portfolioId] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Failed to add project. You must be an Admin of the project.');
        }
    });

    const handleConfirm = () => {
        if (!selectedWorkspaceId) return;
        mutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add Project to Program</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <p className="text-sm text-gray-500 mb-4">
                        Select an existing Project (Workspace) to add to this Program. You must be an Owner or Admin of the selected project.
                    </p>
                    
                    {isLoading ? (
                        <p className="text-sm text-gray-400">Loading your projects...</p>
                    ) : (
                        <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a project" />
                            </SelectTrigger>
                            <SelectContent>
                                {userWorkspaces.map((w: any) => (
                                    <SelectItem key={w.id} value={w.id}>
                                        {w.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleConfirm} disabled={!selectedWorkspaceId || mutation.isPending}>
                        {mutation.isPending ? 'Adding...' : 'Add Project'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
