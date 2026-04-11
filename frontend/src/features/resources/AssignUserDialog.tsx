import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { UserPlus } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/api/axios';
import { toast } from 'sonner';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function AssignUserDialog() {
    const { activeWorkspaceId } = useWorkspaceStore();
    const [open, setOpen] = useState(false);
    
    const [taskId, setTaskId] = useState('');
    const [userId, setUserId] = useState('');
    const [allocation, setAllocation] = useState([100]); // Slider expects array

    // Fetch workspace tasks
    const { data: tasks = [] } = useQuery({
        queryKey: ['tasks', activeWorkspaceId],
        queryFn: async () => {
            if (!activeWorkspaceId) return [];
            const res = await api.get(`/workspaces/${activeWorkspaceId}/tasks`);
            return res.data.items || [];
        },
        enabled: !!activeWorkspaceId && open
    });

    // Fetch workspace members
    const { data: members = [] } = useQuery({
        queryKey: ['workspace-members', activeWorkspaceId],
        queryFn: async () => {
            if (!activeWorkspaceId) return [];
            const res = await api.get(`/workspaces/${activeWorkspaceId}/members`);
            return res.data;
        },
        enabled: !!activeWorkspaceId && open
    });

    const assignMutation = useMutation({
        mutationFn: async () => {
            return await api.post(`/workspaces/${activeWorkspaceId!}/tasks/${taskId}/assignments`, {
                userId,
                allocationPercent: allocation[0]
            });
        },
        onSuccess: () => {
            toast.success("Assignment created successfully");
            setOpen(false);
            // Triggered automatically soon internally by Socket.io, but we can invalidate eagerly safely too
            // queryClient.invalidateQueries({ queryKey: ['resources'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || "Failed to assign user");
        }
    });

    const handleSubmit = () => {
        if (!taskId || !userId) {
            toast.error("Please select a task and user");
            return;
        }
        assignMutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={(v) => setOpen(v)}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    Assign Resource
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Assign Task to Resource</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 pt-4">
                    <div className="space-y-2">
                        <Label>Select Task</Label>
                        <Select value={taskId} onValueChange={setTaskId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Choose a task" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                                {tasks.map((t: any) => (
                                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Select Team Member</Label>
                        <Select value={userId} onValueChange={setUserId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Choose a member" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                                {members.map((m: any) => (
                                    <SelectItem key={m.userId} value={m.userId}>
                                        {m.user?.email || m.userId}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-4 pt-2">
                        <div className="flex justify-between items-center">
                            <Label>Allocation Percentage</Label>
                            <span className="text-sm font-medium">{allocation[0]}%</span>
                        </div>
                        <Slider 
                            value={allocation} 
                            onValueChange={setAllocation} 
                            max={100} 
                            min={5} 
                            step={5} 
                        />
                        <p className="text-xs text-muted-foreground">
                            Specify how much of the user's daily capacity this task will require.
                        </p>
                    </div>

                    <Button 
                        onClick={handleSubmit} 
                        className="w-full" 
                        disabled={assignMutation.isPending || !taskId || !userId}
                    >
                        {assignMutation.isPending ? "Assigning..." : "Confirm Assignment"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
