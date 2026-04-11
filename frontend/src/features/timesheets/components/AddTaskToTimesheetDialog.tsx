import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/axios';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AddTaskToTimesheetDialogProps {
    onAddRow: (taskId: string | null, taskLabel: string) => void;
    children: React.ReactNode;
}

export const AddTaskToTimesheetDialog = ({ onAddRow, children }: AddTaskToTimesheetDialogProps) => {
    const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
    const [open, setOpen] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    const { data: tasks = [], isLoading } = useQuery({
        queryKey: ['workspace-tasks', workspaceId],
        queryFn: async () => {
            if (!workspaceId) return [];
            const res = await api.get(`/workspaces/${workspaceId}/tasks`);
            return res.data?.tasks || res.data || [];
        },
        enabled: open && !!workspaceId
    });

    const handleConfirm = () => {
        const isUnassigned = selectedTaskId === 'unassigned';
        const taskId = isUnassigned ? null : selectedTaskId;
        const taskLabel = isUnassigned
            ? 'Unassigned Time'
            : (tasks.find((t: any) => t.id === selectedTaskId)?.title || 'Unknown Task');

        onAddRow(taskId, taskLabel);
        setOpen(false);
        setSelectedTaskId(null);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add Row to Timesheet</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <p className="text-sm border-b pb-2 mb-4 text-gray-500">Select a task to allocate hours for the current week.</p>
                    {isLoading ? (
                        <p className="text-sm">Loading tasks...</p>
                    ) : (
                        <Select
                            value={selectedTaskId || ''}
                            onValueChange={(val) => setSelectedTaskId(val)}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a task" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="unassigned">-- Unassigned/General --</SelectItem>
                                {tasks.map((task: any) => (
                                    <SelectItem key={task.id} value={task.id}>
                                        {task.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleConfirm} disabled={!selectedTaskId}>Add Row</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
