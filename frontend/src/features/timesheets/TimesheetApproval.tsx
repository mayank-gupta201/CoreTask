import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    useReactTable,
    getCoreRowModel,
    getFilteredRowModel,
    flexRender,
    createColumnHelper,
    RowSelectionState,
} from '@tanstack/react-table';
import { api } from '@/api/axios';
import { useWorkspaceStore } from '@/store/workspaceStore';

import { format, addDays } from 'date-fns';
import { TimesheetStatusBadge } from './components/TimesheetStatusBadge';
import { TimesheetGrid } from './components/TimesheetGrid';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Download, Check, X, Eye, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useSocket } from '@/hooks/useSocket';

// Type for a timesheet row
interface TimesheetRow {
    id: string;
    user: { id: string; email: string; name?: string };
    weekStart: string;
    status: string;
    submittedAt: string | null;
    timeLogs: any[];
}

const columnHelper = createColumnHelper<TimesheetRow>();

export const TimesheetApproval = () => {
    const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
    const queryClient = useQueryClient();

    const [weekStart, setWeekStart] = useState(() => {
        const d = new Date();
        const day = d.getDay() || 7; 
        d.setDate(d.getDate() - day + 1);
        d.setHours(0, 0, 0, 0);
        return format(d, 'yyyy-MM-dd');
    });

    const [statusFilter, setStatusFilter] = useState('SUBMITTED');
    const [memberFilter, setMemberFilter] = useState('ALL');
    
    // Row selection for batch actions
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

    // View Details slide-over
    const [detailSheet, setDetailSheet] = useState<TimesheetRow | null>(null);
    
    // Reject dialog
    const [rejectTarget, setRejectTarget] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

    // Approve confirm dialog
    const [approveTarget, setApproveTarget] = useState<string | null>(null);
    const [approveDialogOpen, setApproveDialogOpen] = useState(false);


    // Socket.io listener for real-time submitted events
    const socket = useSocket();
    
    useEffect(() => {
        if (!workspaceId || !socket) return;
        
        const handleTimesheetSubmitted = (data: any) => {
            toast.info(`New timesheet submitted by ${data?.userName || 'a team member'}`, { icon: '🔔' });
            queryClient.invalidateQueries({ queryKey: ['timesheets', 'approvals'] });
        };

        socket.on('timesheet:submitted', handleTimesheetSubmitted);

        return () => {
            socket.off('timesheet:submitted', handleTimesheetSubmitted);
        };
    }, [workspaceId, queryClient, socket]);

    // Fetch timesheets
    const { data: timesheets = [], isLoading } = useQuery({
        queryKey: ['timesheets', 'approvals', workspaceId, weekStart, statusFilter],
        queryFn: async () => {
            let url = `/workspaces/${workspaceId}/timesheets?weekStart=${weekStart}`;
            if (statusFilter !== 'ALL') url += `&status=${statusFilter}`;
            const res = await api.get(url);
            return res.data;
        },
        enabled: !!workspaceId
    });

    // Fetch workspace members for filter dropdown
    const { data: members = [] } = useQuery({
        queryKey: ['workspace-members', workspaceId],
        queryFn: async () => {
            const res = await api.get(`/workspaces/${workspaceId}/members`);
            return res.data;
        },
        enabled: !!workspaceId
    });

    // Filter by member client-side
    const filteredTimesheets = useMemo(() => {
        if (memberFilter === 'ALL') return timesheets;
        return timesheets.filter((ts: TimesheetRow) => ts.user.id === memberFilter);
    }, [timesheets, memberFilter]);

    // Mutations
    const approveMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.post(`/workspaces/${workspaceId}/timesheets/${id}/approve`);
        },
        onSuccess: () => {
            toast.success('Timesheet approved');
            setApproveDialogOpen(false);
            setApproveTarget(null);
            queryClient.invalidateQueries({ queryKey: ['timesheets', 'approvals'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Error approving timesheet');
        }
    });

    const batchApproveMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            await Promise.all(ids.map(id => api.post(`/workspaces/${workspaceId}/timesheets/${id}/approve`)));
        },
        onSuccess: () => {
            toast.success('All selected timesheets approved!');
            setRowSelection({});
            queryClient.invalidateQueries({ queryKey: ['timesheets', 'approvals'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Error batch approving timesheets');
        }
    });

    const rejectMutation = useMutation({
        mutationFn: async ({ id, reason }: { id: string, reason: string }) => {
            await api.post(`/workspaces/${workspaceId}/timesheets/${id}/reject`, { reason });
        },
        onSuccess: () => {
            toast.success('Timesheet rejected successfully');
            setRejectDialogOpen(false);
            setRejectReason('');
            setRejectTarget(null);
            queryClient.invalidateQueries({ queryKey: ['timesheets', 'approvals'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Error rejecting timesheet');
        }
    });

    // Export payroll CSV
    const exportPayroll = async () => {
        try {
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            
            const res = await api.get(`/workspaces/${workspaceId}/timesheets/payroll-export?weekStart=${weekStart}&weekEnd=${format(weekEnd, 'yyyy-MM-dd')}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `payroll-${weekStart}.csv`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch(e) {
            toast.error('Failed to export payroll CSV.');
        }
    };

    // Column definitions for @tanstack/react-table
    const columns = useMemo(() => [
        // Checkbox column for batch selection
        columnHelper.display({
            id: 'select',
            header: ({ table }) => (
                <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={table.getIsAllPageRowsSelected()}
                    ref={(input) => {
                        if (input) {
                            input.indeterminate = table.getIsSomePageRowsSelected();
                        }
                    }}
                    onChange={table.getToggleAllPageRowsSelectedHandler()}
                />
            ),
            cell: ({ row }) => (
                <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={row.getIsSelected()}
                    disabled={!row.getCanSelect()}
                    onChange={row.getToggleSelectedHandler()}
                />
            ),
            size: 40,
        }),
        columnHelper.accessor(row => row.user.name || row.user.email, {
            id: 'memberName',
            header: 'Member Name',
            cell: info => <span className="font-medium text-gray-800">{info.getValue()}</span>,
        }),
        columnHelper.accessor('weekStart', {
            header: 'Week',
            cell: info => {
                const ws = new Date(info.getValue());
                const we = addDays(ws, 6);
                return <span className="text-sm text-gray-600">{format(ws, 'MMM d')} – {format(we, 'MMM d, yyyy')}</span>;
            },
        }),
        columnHelper.accessor(
            row => row.timeLogs.reduce((acc: number, l: any) => acc + parseFloat(l.hours), 0),
            {
                id: 'totalHours',
                header: 'Total Hours',
                cell: info => <span className="font-semibold">{info.getValue().toFixed(1)} h</span>,
            }
        ),
        columnHelper.accessor('status', {
            header: 'Status',
            cell: info => <TimesheetStatusBadge status={info.getValue()} />,
        }),
        columnHelper.accessor('submittedAt', {
            header: 'Submitted At',
            cell: info => {
                const val = info.getValue();
                return <span className="text-sm text-gray-500">{val ? format(new Date(val), 'PPp') : '—'}</span>;
            },
        }),
        columnHelper.display({
            id: 'actions',
            header: () => <span className="text-right block">Actions</span>,
            cell: ({ row }) => {
                const ts = row.original;
                return (
                    <div className="flex gap-2 justify-end">
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-gray-600 border-gray-200 hover:bg-gray-50"
                            onClick={() => setDetailSheet(ts)}
                        >
                            <Eye size={14} className="mr-1" /> View
                        </Button>
                        {ts.status === 'SUBMITTED' && (
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-green-600 border-green-200 hover:bg-green-50"
                                    onClick={() => { setApproveTarget(ts.id); setApproveDialogOpen(true); }}
                                >
                                    <Check size={14} className="mr-1" /> Approve
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() => { setRejectTarget(ts.id); setRejectDialogOpen(true); }}
                                >
                                    <X size={14} className="mr-1" /> Reject
                                </Button>
                            </>
                        )}
                    </div>
                );
            },
        }),
    ], []);

    const table = useReactTable({
        data: filteredTimesheets,
        columns,
        state: { rowSelection },
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        enableRowSelection: (row) => row.original.status === 'SUBMITTED',
        getRowId: (row) => row.id,
    });

    // Batch approve: get selected submitted IDs
    const selectedIds = Object.keys(rowSelection).filter(id => {
        const ts = filteredTimesheets.find((t: TimesheetRow) => t.id === id);
        return ts?.status === 'SUBMITTED';
    });

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center text-gray-900">
                        Timesheet Approvals
                    </h1>
                    <p className="text-gray-500 mt-1">Review team hours and export payroll.</p>
                </div>
                
                <div className="flex items-center gap-3">
                    {selectedIds.length > 0 && (
                        <Button
                            onClick={() => batchApproveMutation.mutate(selectedIds)}
                            disabled={batchApproveMutation.isPending}
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            <CheckCheck className="w-4 h-4 mr-2" />
                            Approve All Selected ({selectedIds.length})
                        </Button>
                    )}
                    <Button onClick={exportPayroll} variant="outline" className="text-green-700 border-green-200 bg-green-50 hover:bg-green-100">
                        <Download className="w-4 h-4 mr-2" />
                        Export Payroll CSV
                    </Button>
                </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 mb-1">Week</label>
                    <input 
                        type="date" 
                        className="border rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        value={weekStart}
                        onChange={(e) => { setWeekStart(e.target.value); setRowSelection({}); }}
                    />
                </div>
                <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 mb-1">Status</label>
                    <select 
                        className="border rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setRowSelection({}); }}
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="DRAFT">Draft</option>
                        <option value="SUBMITTED">Pending Approval</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                    </select>
                </div>
                <div className="flex flex-col">
                    <label className="text-xs font-medium text-gray-500 mb-1">Member</label>
                    <select 
                        className="border rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[180px]"
                        value={memberFilter}
                        onChange={(e) => { setMemberFilter(e.target.value); setRowSelection({}); }}
                    >
                        <option value="ALL">All Members</option>
                        {members.map((m: any) => (
                            <option key={m.userId} value={m.userId}>
                                {m.user?.name || m.user?.email || m.userId}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded border overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b">
                        {table.getHeaderGroups().map(headerGroup => (
                            <tr key={headerGroup.id} className="text-sm font-semibold text-gray-600">
                                {headerGroup.headers.map(header => (
                                    <th key={header.id} className="p-4" style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(header.column.columnDef.header, header.getContext())
                                        }
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={columns.length} className="p-10 text-center text-gray-500">Loading timesheets…</td></tr>
                        ) : table.getRowModel().rows.length === 0 ? (
                            <tr><td colSpan={columns.length} className="p-10 text-center text-gray-500">No timesheets match current criteria.</td></tr>
                        ) : (
                            table.getRowModel().rows.map(row => (
                                <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                                    {row.getVisibleCells().map(cell => (
                                        <td key={cell.id} className="p-4">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Approve Confirm Dialog */}
            <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Approve Timesheet</DialogTitle>
                        <DialogDescription>Are you sure you want to approve this timesheet? This action cannot be undone.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => { setApproveDialogOpen(false); setApproveTarget(null); }}>Cancel</Button>
                        <Button
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => approveTarget && approveMutation.mutate(approveTarget)}
                            disabled={approveMutation.isPending}
                        >
                            Confirm Approve
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Timesheet</DialogTitle>
                        <DialogDescription>Please provide a reason to the user.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <textarea 
                            className="w-full border rounded p-3 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none resize-none"
                            rows={4}
                            placeholder="Reason for rejection..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setRejectDialogOpen(false); setRejectTarget(null); setRejectReason(''); }}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={() => rejectTarget && rejectMutation.mutate({ id: rejectTarget, reason: rejectReason })}
                            disabled={!rejectReason.trim() || rejectMutation.isPending}
                        >
                            Reject Timesheet
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Details Slide-Over */}
            <Sheet open={!!detailSheet} onClose={() => setDetailSheet(null)} className="!max-w-2xl !w-full md:!w-2/3">
                {detailSheet && (
                    <div className="space-y-6 pt-6">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Timesheet Details</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                {detailSheet.user.name || detailSheet.user.email} — {' '}
                                {(() => {
                                    const ws = new Date(detailSheet.weekStart);
                                    const we = addDays(ws, 6);
                                    return `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`;
                                })()}
                            </p>
                            <div className="mt-2">
                                <TimesheetStatusBadge status={detailSheet.status} />
                            </div>
                        </div>
                        <TimesheetGrid
                            weekStart={detailSheet.weekStart}
                            timesheet={{ ...detailSheet, status: 'APPROVED' }}  
                            onLogTime={() => {}}
                            onUpdateLog={() => {}}
                        />
                        <div className="text-xs text-gray-400">
                            {detailSheet.submittedAt && `Submitted: ${format(new Date(detailSheet.submittedAt), 'PPpp')}`}
                        </div>
                    </div>
                )}
            </Sheet>
        </div>
    );
};
