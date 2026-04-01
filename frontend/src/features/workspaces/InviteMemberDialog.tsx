import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/api/axios';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet } from '@/components/ui/sheet';
import { UserPlus, Loader2 } from 'lucide-react';

const inviteSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

export function InviteMemberDialog() {
    const [open, setOpen] = useState(false);
    const { activeWorkspaceId } = useWorkspaceStore();
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<InviteFormValues>({
        resolver: zodResolver(inviteSchema),
        defaultValues: { email: '' },
    });

    const inviteMutation = useMutation({
        mutationFn: async (data: InviteFormValues) => {
            if (!activeWorkspaceId) throw new Error('No active workspace selected');
            const res = await api.post(`/workspaces/${activeWorkspaceId}/invites`, data);
            return res.data;
        },
        onSuccess: () => {
            setMessage({ type: 'success', text: 'Member invited successfully.' });
            reset();
            setTimeout(() => {
                setOpen(false);
                setMessage(null);
            }, 2000);
        },
        onError: (error: any) => {
            setMessage({
                type: 'error',
                text: error.response?.data?.detail || error.response?.data?.message || 'Failed to invite member. Please try again.',
            });
        },
    });

    const onSubmit = (data: InviteFormValues) => {
        setMessage(null);
        inviteMutation.mutate(data);
    };

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                className="ml-2 gap-2"
                disabled={!activeWorkspaceId}
                onClick={() => setOpen(true)}
            >
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Invite Member</span>
            </Button>

            <Sheet open={open} onClose={() => {
                setOpen(false);
                reset();
                setMessage(null);
            }}>
                <div className="mb-6">
                    <h2 className="text-lg font-semibold leading-none tracking-tight">Invite Member</h2>
                    <p className="text-sm text-muted-foreground mt-2">
                        Invite a new member to the currently active workspace. They will receive an email notification.
                    </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {message && (
                        <div className={`p-3 text-sm rounded-md ${message.type === 'success' ? 'bg-green-100/50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100/50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                            {message.text}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                            id="email"
                            placeholder="colleague@example.com"
                            {...register('email')}
                        />
                        {errors.email && (
                            <p className="text-sm font-medium text-destructive">{errors.email.message}</p>
                        )}
                    </div>

                    <Button type="submit" className="w-full" disabled={inviteMutation.isPending || !activeWorkspaceId}>
                        {inviteMutation.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Sending...
                            </>
                        ) : (
                            'Send Invitation'
                        )}
                    </Button>
                </form>
            </Sheet>
        </>
    );
}

