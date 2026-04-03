import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWorkspaceStore } from '@/store/workspaceStore';

interface DependencyModalProps {
    open: boolean;
    onClose: () => void;
    tasks: any[];
    defaultPredecessorId?: string; // Optional context if user clicked specifically from a prepopulated action
}

export function DependencyModal({ open, onClose, tasks, defaultPredecessorId }: DependencyModalProps) {
    const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
    const queryClient = useQueryClient();

    const [predecessorId, setPredecessorId] = useState(defaultPredecessorId || '');
    const [successorId, setSuccessorId] = useState('');
    const [type, setType] = useState('FS');
    const [lagDays, setLagDays] = useState('0');

    const addDependencyMutation = useMutation({
        mutationFn: async () => {
            const res = await api.post(`/workspaces/${activeWorkspaceId}/tasks/${predecessorId}/dependencies`, {
                successorTaskId: successorId,
                dependencyType: type,
                lagDays: parseInt(lagDays, 10) || 0,
            });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['gantt', activeWorkspaceId] });
            // Close and reset
            setPredecessorId('');
            setSuccessorId('');
            setType('FS');
            setLagDays('0');
            onClose();
        },
        onError: (err: any) => {
            alert(err?.response?.data?.message || 'Failed to draw dependency. Check for circular references.');
        }
    });

    const isSubmittable = predecessorId && successorId && predecessorId !== successorId && !addDependencyMutation.isPending;

    return (
        <Dialog open={open} onOpenChange={(val: boolean) => !val && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Dependency</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="flex flex-col space-y-1.5">
                        <Label>Predecessor Task (Blocks)</Label>
                        <Select value={predecessorId} onValueChange={setPredecessorId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select task" />
                            </SelectTrigger>
                            <SelectContent>
                                {tasks?.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col space-y-1.5">
                        <Label>Successor Task (Waits)</Label>
                        <Select value={successorId} onValueChange={setSuccessorId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select task" />
                            </SelectTrigger>
                            <SelectContent>
                                {tasks?.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col space-y-1.5">
                        <Label>Dependency Type</Label>
                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="FS">Finish to Start (FS)</SelectItem>
                                <SelectItem value="SS">Start to Start (SS)</SelectItem>
                                <SelectItem value="FF">Finish to Finish (FF)</SelectItem>
                                <SelectItem value="SF">Start to Finish (SF)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col space-y-1.5">
                        <Label>Lag (Days)</Label>
                        <Input
                            type="number"
                            value={lagDays}
                            onChange={(e) => setLagDays(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button 
                        disabled={!isSubmittable} 
                        onClick={() => addDependencyMutation.mutate()}
                    >
                        {addDependencyMutation.isPending ? 'Connecting...' : 'Connect'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
