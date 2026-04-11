import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/axios';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface CreatePortfolioDialogProps {
    children: React.ReactNode;
}

const PREDEFINED_COLORS = [
    { name: 'Blue', value: '#2563EB' },
    { name: 'Red', value: '#DC2626' },
    { name: 'Green', value: '#16A34A' },
    { name: 'Purple', value: '#9333EA' },
    { name: 'Orange', value: '#EA580C' },
    { name: 'Pink', value: '#DB2777' },
    { name: 'Teal', value: '#0D9488' },
    { name: 'Slate', value: '#475569' }
];

export const CreatePortfolioDialog = ({ children }: CreatePortfolioDialogProps) => {
    const workspaceId = useWorkspaceStore(s => s.activeWorkspaceId);
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState('#2563EB'); // default Blue

    const mutation = useMutation({
        mutationFn: async () => {
            const res = await api.post('/portfolios', { workspaceId, name, description, color });
            return res.data;
        },
        onSuccess: () => {
            toast.success('Portfolio created successfully');
            setOpen(false);
            setName('');
            setDescription('');
            setColor('#2563EB');
            queryClient.invalidateQueries({ queryKey: ['portfolios', workspaceId] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Failed to create portfolio. Are you an Admin or Owner?');
        }
    });

    const handleConfirm = () => {
        if (!name.trim()) return;
        mutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create New Portfolio</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700">Portfolio Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="e.g. Q3 Strategic Initiatives"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700">Description (Optional)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            rows={3}
                            placeholder="Brief description of this portfolio's goals..."
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Theme Color</label>
                        <div className="flex flex-wrap gap-2">
                            {PREDEFINED_COLORS.map(c => (
                                <button
                                    key={c.value}
                                    type="button"
                                    onClick={() => setColor(c.value)}
                                    className={`w-8 h-8 rounded-full border-2 transition-all ${color === c.value ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'}`}
                                    style={{ backgroundColor: c.value }}
                                    title={c.name}
                                />
                            ))}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleConfirm} disabled={!name.trim() || mutation.isPending}>
                        Create Portfolio
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
