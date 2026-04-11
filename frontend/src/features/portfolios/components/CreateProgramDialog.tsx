import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface CreateProgramDialogProps {
    portfolioId: string;
    children: React.ReactNode;
}

export const CreateProgramDialog = ({ portfolioId, children }: CreateProgramDialogProps) => {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const mutation = useMutation({
        mutationFn: async () => {
            const data: any = { name, description };
            if (startDate) data.startDate = new Date(startDate).toISOString();
            if (endDate) data.endDate = new Date(endDate).toISOString();
            const res = await api.post(`/portfolios/${portfolioId}/programs`, data);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Program created successfully');
            setOpen(false);
            setName('');
            setDescription('');
            setStartDate('');
            setEndDate('');
            // Invalidate dependencies
            queryClient.invalidateQueries({ queryKey: ['portfolio-dashboard', portfolioId] });
            queryClient.invalidateQueries({ queryKey: ['portfolio-programs', portfolioId] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Failed to create program. Are you the portfolio owner?');
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
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Create New Program</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700">Program Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="e.g. FY26 Digital Transformation"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700">Description (Optional)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            rows={3}
                            placeholder="Brief description..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700">Start Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">End Date</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleConfirm} disabled={!name.trim() || mutation.isPending}>
                        Create Program
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
