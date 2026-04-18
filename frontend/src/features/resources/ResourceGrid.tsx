import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useResourceStore } from '@/store/resourceStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { api } from '@/api/axios';
import { useSocket } from '@/hooks/useSocket';
import { toast } from 'sonner';
import { addDays, addWeeks, subWeeks, startOfWeek, endOfWeek, differenceInDays } from 'date-fns';

import { ResourceGridRow } from './ResourceGridRow';
import { HolidayManager } from './HolidayManager';
import { AssignUserDialog } from './AssignUserDialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function ResourceGrid() {
    const { activeWorkspaceId } = useWorkspaceStore();
    const queryClient = useQueryClient();
    
    const { dateFrom, dateTo, viewMode, expandedMembers, setDateRange, setViewMode, toggleMemberExpand } = useResourceStore();
    const [overAllocatedUsers, setOverAllocatedUsers] = useState<Set<string>>(new Set());


    // Connect to Socket.io for Realtime assignments feedback
    const socket = useSocket();
    
    useEffect(() => {
        if (!activeWorkspaceId || !socket) return;
        
        const handleAssignmentUpdate = () => queryClient.invalidateQueries({ queryKey: ['resources', activeWorkspaceId] });
        const handleOverallocated = (data: { userName: string }) => {
            queryClient.invalidateQueries({ queryKey: ['resources', activeWorkspaceId] });
            toast.error(`Resource Alert: ${data.userName} is overallocated!`, {
                icon: <AlertTriangle className="h-4 w-4 text-red-500" />
            });
        };

        socket.on('assignment:created', handleAssignmentUpdate);
        socket.on('assignment:removed', handleAssignmentUpdate);
        socket.on('resource:overallocated', handleOverallocated);

        return () => {
            socket.off('assignment:created', handleAssignmentUpdate);
            socket.off('assignment:removed', handleAssignmentUpdate);
            socket.off('resource:overallocated', handleOverallocated);
        };
    }, [activeWorkspaceId, queryClient, socket]);

    // Fetch grid Data
    const { data: gridData = [], isLoading } = useQuery({
        queryKey: ['resources', activeWorkspaceId, dateFrom, dateTo],
        queryFn: async () => {
            if (!activeWorkspaceId) return [];
            const res = await api.get(`/workspaces/${activeWorkspaceId}/resources`, {
                params: { dateFrom, dateTo }
            });
            return res.data;
        },
        enabled: !!activeWorkspaceId
    });

    // Determine the list of dates based on store configuration
    const dates = useMemo(() => {
        const start = new Date(dateFrom);
        const end = new Date(dateTo);
        const totalDays = differenceInDays(end, start) + 1;
        const arr = [];
        for (let i = 0; i < totalDays; i++) {
            arr.push(addDays(start, i));
        }
        return arr;
    }, [dateFrom, dateTo]);

    // Check for overallocated capacities locally to trigger Top Banner
    useEffect(() => {
        const overAllocatedNames = new Set<string>();
        gridData.forEach((row: any) => {
            if (row.dailyData.some((d: any) => d.isOverAllocated)) {
                overAllocatedNames.add(row.user.name);
            }
        });
        setOverAllocatedUsers(prev => {
            if (prev.size === overAllocatedNames.size && Array.from(prev).every(name => overAllocatedNames.has(name))) {
                return prev;
            }
            return overAllocatedNames;
        });
    }, [gridData]);

    const handleToday = () => {
        const today = new Date();
        const from = viewMode === 'week' ? startOfWeek(today, { weekStartsOn: 1 }) : startOfWeek(subWeeks(today, 2), { weekStartsOn: 1 });
        const to = viewMode === 'week' ? endOfWeek(today, { weekStartsOn: 1 }) : endOfWeek(addWeeks(today, 2), { weekStartsOn: 1 });
        setDateRange(from.toISOString().split('T')[0], to.toISOString().split('T')[0]);
    };

    const handlePrev = () => {
        const currentFrom = new Date(dateFrom);
        const currentTo = new Date(dateTo);
        const offset = viewMode === 'week' ? 1 : 4;
        const newFrom = subWeeks(currentFrom, offset);
        const newTo = subWeeks(currentTo, offset);
        setDateRange(newFrom.toISOString().split('T')[0], newTo.toISOString().split('T')[0]);
    };

    const handleNext = () => {
        const currentFrom = new Date(dateFrom);
        const currentTo = new Date(dateTo);
        const offset = viewMode === 'week' ? 1 : 4;
        const newFrom = addWeeks(currentFrom, offset);
        const newTo = addWeeks(currentTo, offset);
        setDateRange(newFrom.toISOString().split('T')[0], newTo.toISOString().split('T')[0]);
    };

    if (!activeWorkspaceId) {
        return <div className="p-8 text-center text-muted-foreground">Select a workspace to view resources.</div>;
    }

    return (
        <div className="flex flex-col h-full space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Resource Management</h2>
                    <p className="text-muted-foreground text-sm">Monitor workloads and manage daily team allocations.</p>
                </div>
                <div className="flex items-center gap-3">
                    <HolidayManager />
                    <AssignUserDialog />
                </div>
            </div>

            {/* Over-allocation Banner */}
            {overAllocatedUsers.size > 0 && (
                <Alert variant="destructive" className="bg-red-50 text-red-900 border-red-200">
                    <AlertTriangle className="h-4 w-4" color="#ef4444" />
                    <AlertTitle className="font-semibold text-red-800">Overallocation Warning</AlertTitle>
                    <AlertDescription className="text-red-700 mt-1">
                        The following users exceed 100% capacity in this timeframe: 
                        <span className="font-medium ml-1">{Array.from(overAllocatedUsers).join(', ')}</span>.
                        Please balance their workload.
                    </AlertDescription>
                </Alert>
            )}

            {/* Toolbar */}
            <div className="flex items-center justify-between bg-card p-2 px-4 border rounded-lg shadow-sm">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleToday}>
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        Today
                    </Button>
                    <div className="flex items-center border rounded-md overflow-hidden">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={handlePrev}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="px-3 text-sm font-medium border-x bg-muted/30">
                            {dates[0]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} 
                            {' - '} 
                            {dates[dates.length - 1]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={handleNext}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="flex items-center border rounded-md p-1 bg-muted/20">
                    <Button 
                        variant={viewMode === 'week' ? "secondary" : "ghost"} 
                        size="sm" 
                        className={`h-7 px-3 text-xs ${viewMode === 'week' ? 'shadow-sm' : ''}`}
                        onClick={() => {
                            setViewMode('week');
                            handleToday(); // Reset to current week
                        }}
                    >
                        Week
                    </Button>
                    <Button 
                        variant={viewMode === 'month' ? "secondary" : "ghost"} 
                        size="sm" 
                        className={`h-7 px-3 text-xs ${viewMode === 'month' ? 'shadow-sm' : ''}`}
                        onClick={() => {
                            setViewMode('month');
                            handleToday(); // Will jump to 4 week spread
                        }}
                    >
                        Month
                    </Button>
                </div>
            </div>

            {/* Grid Container */}
            <div className="flex-1 overflow-auto rounded-lg border bg-card relative shadow-sm">
                <table className="w-full text-left border-collapse min-w-max">
                    <thead className="bg-muted/50 sticky top-0 z-30 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
                        <tr>
                            <th className="sticky left-0 z-40 bg-muted/90 backdrop-blur-sm p-3 font-semibold text-sm border-r border-border/40 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] w-[250px] min-w-[250px]">
                                Team Member
                            </th>
                            {dates.map(date => {
                                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                return (
                                    <th key={date.toISOString()} className={`p-2 border-r border-border/20 text-center text-xs font-medium w-[50px] min-w-[50px] ${isWeekend ? 'bg-muted/70' : ''}`}>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-muted-foreground uppercase">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                            <span className="text-sm">{date.getDate()}</span>
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={dates.length + 1} className="p-8 text-center text-muted-foreground">
                                    Loading resource matrix...
                                </td>
                            </tr>
                        ) : gridData.length === 0 ? (
                            <tr>
                                <td colSpan={dates.length + 1} className="p-8 text-center text-muted-foreground">
                                    No members found in this workspace.
                                </td>
                            </tr>
                        ) : (
                            gridData.map((row: any) => (
                                <ResourceGridRow 
                                    key={row.user.id}
                                    user={row.user}
                                    dailyData={row.dailyData}
                                    dates={dates}
                                    isExpanded={expandedMembers.has(row.user.id)}
                                    onToggleExpand={toggleMemberExpand}
                                />
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
