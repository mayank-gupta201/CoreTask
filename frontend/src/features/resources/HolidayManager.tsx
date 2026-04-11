import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarHeart, Trash2, Plus } from 'lucide-react';
import { api } from '@/api/axios';
import { toast } from 'sonner';
import { useWorkspaceStore } from '@/store/workspaceStore';

interface HolidayFormState {
    name: string;
    date: string;
    isRecurring: boolean;
}

const defaultForm: HolidayFormState = { name: '', date: '', isRecurring: false };

export function HolidayManager() {
    const { activeWorkspaceId } = useWorkspaceStore();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState<HolidayFormState>(defaultForm);

    const { data: holidays = [], isLoading } = useQuery({
        queryKey: ['holidays', activeWorkspaceId],
        queryFn: async () => {
            if (!activeWorkspaceId) return [];
            const res = await api.get(`/workspaces/${activeWorkspaceId}/holidays`);
            return res.data;
        },
        enabled: !!activeWorkspaceId && open
    });

    const createMutation = useMutation({
        mutationFn: async (data: HolidayFormState) => {
            return await api.post(`/workspaces/${activeWorkspaceId!}/holidays`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['holidays', activeWorkspaceId] });
            queryClient.invalidateQueries({ queryKey: ['resources', activeWorkspaceId] });
            setForm(defaultForm);
            toast.success("Holiday added successfully");
        },
        onError: () => {
            toast.error("Failed to add holiday");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (holidayId: string) => {
            return await api.delete(`/workspaces/${activeWorkspaceId!}/holidays/${holidayId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['holidays', activeWorkspaceId] });
            queryClient.invalidateQueries({ queryKey: ['resources', activeWorkspaceId] });
            toast.success("Holiday removed");
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.date) {
            toast.error("Name and date are required");
            return;
        }
        createMutation.mutate(form);
    };

    return (
        <>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
                <CalendarHeart className="h-4 w-4" />
                Holidays
            </Button>

            <Sheet open={open} onClose={() => setOpen(false)}>
                <div className="mb-6">
                    <h2 className="text-lg font-semibold">Manage Holidays</h2>
                    <p className="text-sm text-muted-foreground">Configure workspace-wide holidays and off-days.</p>
                </div>

                <div className="space-y-6">
                    {/* Add form */}
                    <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                        <h3 className="text-sm font-medium mb-4">Add New Holiday</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="holiday-name">Holiday Name</Label>
                                <Input
                                    id="holiday-name"
                                    value={form.name}
                                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. New Year's Day"
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="holiday-date">Date</Label>
                                <Input
                                    id="holiday-date"
                                    type="date"
                                    value={form.date}
                                    onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                                />
                            </div>

                            <div className="flex items-center gap-2 mt-2">
                                <input
                                    type="checkbox"
                                    id="isRecurring"
                                    checked={form.isRecurring}
                                    onChange={(e) => setForm(f => ({ ...f, isRecurring: e.target.checked }))}
                                    className="rounded border-gray-300"
                                />
                                <Label htmlFor="isRecurring" className="text-sm font-normal">Repeats annually</Label>
                            </div>

                            <Button type="submit" className="w-full gap-2" disabled={createMutation.isPending}>
                                <Plus className="h-4 w-4" />
                                Add Holiday
                            </Button>
                        </form>
                    </div>

                    {/* List */}
                    <div>
                        <h3 className="text-sm font-medium mb-3">Existing Holidays</h3>
                        {isLoading ? (
                            <div className="text-sm text-muted-foreground text-center py-4">Loading...</div>
                        ) : holidays.length === 0 ? (
                            <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">No holidays configured</div>
                        ) : (
                            <div className="space-y-2">
                                {holidays.map((h: any) => (
                                    <div key={h.id} className="flex items-center justify-between p-3 rounded-md border text-sm">
                                        <div className="flex flex-col">
                                            <span className="font-medium">{h.name}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {h.date} {h.isRecurring && '(Recurring)'}
                                            </span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => deleteMutation.mutate(h.id)}
                                            disabled={deleteMutation.isPending}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Sheet>
        </>
    );
}
