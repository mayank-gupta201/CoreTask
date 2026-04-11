import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/axios';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useTimesheetStore } from '@/store/timesheetStore';
import { TimesheetGrid } from './components/TimesheetGrid';
import { WeekNavigator } from './components/WeekNavigator';
import { TimesheetStatusBadge } from './components/TimesheetStatusBadge';
import { Button } from '@/components/ui/button';
import { Clock, Send, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

export const TimesheetWeekly = () => {
    const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
    const { currentWeekStart, setWeek } = useTimesheetStore();
    const queryClient = useQueryClient();
    const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
    const [isAutoFillAnimating, setIsAutoFillAnimating] = useState(false);

    const { data: timesheet, isLoading } = useQuery({
        queryKey: ['timesheets', 'current', workspaceId, currentWeekStart],
        queryFn: async () => {
            const res = await api.get(`/workspaces/${workspaceId}/timesheets/current?weekStart=${currentWeekStart}`);
            return res.data;
        },
        enabled: !!workspaceId
    });

    const isReadOnly = timesheet?.status === 'SUBMITTED' || timesheet?.status === 'APPROVED';

    const logMutation = useMutation({
        mutationFn: async ({ taskId, date, hours }: { taskId: string | null, date: string, hours: number }) => {
            const res = await api.post(`/workspaces/${workspaceId}/timesheets/${timesheet.id}/logs`, {
                taskId, logDate: date, hours
            });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timesheets', 'current'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Failed to save hours');
        }
    });

    const updateLogMutation = useMutation({
        mutationFn: async ({ logId, hours }: { logId: string, hours: number | null }) => {
            if (hours === null) {
                await api.delete(`/workspaces/${workspaceId}/timesheets/${timesheet.id}/logs/${logId}`);
            } else {
                await api.patch(`/workspaces/${workspaceId}/timesheets/${timesheet.id}/logs/${logId}`, { hours });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timesheets', 'current'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Failed to update hours');
            queryClient.invalidateQueries({ queryKey: ['timesheets', 'current'] }); // Rollback UI
        }
    });

    const autofillMutation = useMutation({
        mutationFn: async () => {
            const res = await api.post(`/workspaces/${workspaceId}/timesheets/${timesheet.id}/autofill`);
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(`Auto-filled ${data.createdCount} entries from last week!`);
            // Trigger animation before query invalidation refreshes the grid
            setIsAutoFillAnimating(true);
            queryClient.invalidateQueries({ queryKey: ['timesheets', 'current'] });
            // Reset animation flag after the staggered effect completes (~2s)
            setTimeout(() => setIsAutoFillAnimating(false), 2000);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Failed to auto-fill timesheet');
        }
    });

    const submitMutation = useMutation({
        mutationFn: async () => {
            await api.post(`/workspaces/${workspaceId}/timesheets/${timesheet.id}/submit`);
        },
        onSuccess: () => {
             toast.success('Timesheet successfully submitted for approval.');
             setSubmitDialogOpen(false);
             queryClient.invalidateQueries({ queryKey: ['timesheets', 'current'] });
        },
        onError: (err: any) => {
             toast.error(err.response?.data?.message || 'Failed to submit timesheet');
             setSubmitDialogOpen(false);
        }
    });

    const handleLogTime = (taskId: string | null, date: string, hours: number) => {
        logMutation.mutate({ taskId, date, hours });
    };

    const handleUpdateLog = (logId: string, hours: number | null) => {
        updateLogMutation.mutate({ logId, hours });
    };

    // Calculate sum of hours for "Submit" button disabled logic
    const totalHoursLogged = (timesheet?.timeLogs || []).reduce((acc: number, val: any) => acc + parseFloat(val.hours), 0);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center text-gray-900">
                        My Timesheet
                        {timesheet && (
                            <span className="ml-4">
                                <TimesheetStatusBadge status={timesheet.status} />
                            </span>
                        )}
                    </h1>
                    <p className="text-gray-500 mt-1">Log your weekly hours. Max 24 hours per day.</p>
                </div>
                
                <div className="flex items-center space-x-3">
                    {!isReadOnly && timesheet && (
                         <Button 
                             variant="outline" 
                             onClick={() => autofillMutation.mutate()}
                             disabled={autofillMutation.isPending}
                         >
                             <Clock className="w-4 h-4 mr-2 text-gray-500" />
                             Auto-Fill Previous Week
                         </Button>
                    )}
                    
                    {!isReadOnly && timesheet && (
                         <Button 
                             onClick={() => setSubmitDialogOpen(true)} 
                             disabled={totalHoursLogged === 0 || submitMutation.isPending}
                             className="bg-blue-600 hover:bg-blue-700 text-white"
                         >
                             <Send className="w-4 h-4 mr-2" />
                             Submit Timesheet
                         </Button>
                    )}
                </div>
            </div>

            <div className="flex justify-between items-center bg-white p-3 border rounded shadow-sm">
                 <WeekNavigator currentWeekStart={currentWeekStart} onWeekChange={setWeek} />
                 
                 <div className="text-sm font-medium text-gray-600 border px-3 py-1.5 rounded bg-gray-50">
                     Total Week Hours: <span className="text-gray-900 font-bold ml-1">{totalHoursLogged.toFixed(1)}</span>
                 </div>
            </div>

            {timesheet?.status === 'REJECTED' && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md flex">
                    <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                    <div>
                        <h3 className="font-semibold text-sm">Timesheet Rejected</h3>
                        <p className="text-sm mt-1">{timesheet.rejectionReason}</p>
                        <p className="text-sm mt-2 underline cursor-pointer text-red-600" onClick={() => toast.info('Please amend your hours directly in the grid below.')}>Edit & Resubmit</p>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="text-center py-20 text-gray-400">Loading Timesheet Matrix...</div>
            ) : timesheet ? (
                <TimesheetGrid 
                     weekStart={currentWeekStart}
                     timesheet={timesheet}
                     onLogTime={handleLogTime}
                     onUpdateLog={handleUpdateLog}
                     isAutoFillAnimating={isAutoFillAnimating}
                />
            ) : (
                <div className="text-center py-20 text-gray-400 border border-dashed rounded">
                     No Timesheet Context
                </div>
            )}

            <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Submit Timesheet</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to submit your timesheet for approval? You will not be able to edit your hours once submitted unless a Manager rejects it.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-6">
                        <Button variant="outline" onClick={() => setSubmitDialogOpen(false)}>Cancel</Button>
                        <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                            Confirm Submission
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
