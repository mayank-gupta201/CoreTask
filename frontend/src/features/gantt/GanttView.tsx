import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gantt, Task as GanttTaskType } from 'gantt-task-react';
import "gantt-task-react/dist/index.css";
import { api } from '@/api/axios';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useSocket } from '@/hooks/useSocket';
import { useGanttStore } from '@/store/ganttStore';
import { DependencyModal } from './DependencyModal';
import { TaskSheet } from '../tasks/TaskSheet';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, LayoutList } from 'lucide-react';
import { cn } from '@/lib/utils';


// Scoped custom CSS to force critical paths explicitly 
const CRITICAL_PATH_CSS = `
  .critical-path-task rect.bar-wrapper {
    stroke: #ef4444 !important;
    stroke-width: 3px !important;
    filter: drop-shadow(0 0 4px rgba(239, 68, 68, 0.5));
  }
`;

export function GanttView() {
    const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
    const { zoomLevel, setZoomLevel } = useGanttStore();
    const socket = useSocket();
    const queryClient = useQueryClient();

    const [dependencyModalOpen, setDependencyModalOpen] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>();
    const [taskSheetOpen, setTaskSheetOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<any | null>(null);

    // Fetch members for TaskSheet assignment
    const { data: members = [] } = useQuery({
        queryKey: ['workspace-members', activeWorkspaceId],
        queryFn: async () => {
            if (!activeWorkspaceId) return [];
            const res = await api.get(`/workspaces/${activeWorkspaceId}/members`);
            return res.data;
        },
        enabled: !!activeWorkspaceId,
    });

    // Fetch Gantt specific payload
    const { data: ganttData, isLoading } = useQuery({
        queryKey: ['gantt', activeWorkspaceId],
        queryFn: async () => {
            if (!activeWorkspaceId) return null;
            const res = await api.get(`/workspaces/${activeWorkspaceId}/gantt`);
            return res.data;
        },
        enabled: !!activeWorkspaceId,
    });

    useEffect(() => {
        if (!socket || !activeWorkspaceId) return;

        const handleReload = () => {
            queryClient.invalidateQueries({ queryKey: ['gantt', activeWorkspaceId] });
        };

        socket.on('dependency:created', handleReload);
        socket.on('dependency:deleted', handleReload);
        socket.on('critical-path:updated', handleReload);
        socket.on('taskCreated', handleReload);
        socket.on('taskUpdated', handleReload);

        return () => {
            socket.off('dependency:created', handleReload);
            socket.off('dependency:deleted', handleReload);
            socket.off('critical-path:updated', handleReload);
            socket.off('taskCreated', handleReload);
            socket.off('taskUpdated', handleReload);
        };
    }, [socket, activeWorkspaceId, queryClient]);

    const updateTaskDateMutation = useMutation({
        mutationFn: async ({ id, startDate, dueDate }: { id: string, startDate: Date, dueDate: Date }) => {
            return api.put(`/tasks/${id}`, { 
                startDate: startDate.toISOString(), 
                dueDate: dueDate.toISOString() 
            });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gantt', activeWorkspaceId] })
    });

    const handleDateChange = (task: GanttTaskType) => {
        updateTaskDateMutation.mutate({
            id: task.id,
            startDate: task.start,
            dueDate: task.end,
        });
    };

    // Format tasks for the library
    const formattedTasks: GanttTaskType[] = [];

    if (ganttData) {
        ganttData.tasks.forEach((t: any) => {
            const isCritical = ganttData.criticalPathTaskIds.includes(t.id);
            const statusConfig: Record<string, string> = {
                TODO: '#3b82f6', // blue-500
                IN_PROGRESS: '#f59e0b', // amber-500
                DONE: '#10b981', // emerald-500
            };
            
            const start = t.startDate ? new Date(t.startDate) : new Date();
            const fallbackEnd = new Date(start);
            fallbackEnd.setHours(fallbackEnd.getHours() + (t.estimatedHours || 8)); // fallback end

            formattedTasks.push({
                id: t.id,
                name: `[${t.status.replace('_', ' ')}] ${t.title}`,
                type: 'task',
                start: start,
                end: t.dueDate ? new Date(t.dueDate) : fallbackEnd,
                progress: t.status === 'DONE' ? 100 : t.status === 'IN_PROGRESS' ? 50 : 0,
                dependencies: t.dependencies
                    ?.filter((d: any) => d.successorId === t.id && d.type === 'FS') // Map Predecessors -> library uses dependency array string mapping
                    .map((d: any) => d.predecessorId) || [],
                styles: {
                    backgroundColor: statusConfig[t.status] || statusConfig.TODO,
                    progressColor: '#ffffff40',
                },
                // We use standard classes appended safely for critical-paths
                project: isCritical ? 'critical-path-task' : '' 
            } as GanttTaskType);
        });

        ganttData.milestones.forEach((m: any) => {
            formattedTasks.push({
                id: m.id,
                name: m.title,
                type: 'milestone',
                start: new Date(m.dueDate),
                end: new Date(m.dueDate),
                progress: m.isComplete ? 100 : 0,
                styles: {
                    backgroundColor: '#8b5cf6', // violet-500
                }
            } as GanttTaskType);
        });
    }

    if (isLoading || !activeWorkspaceId) {
        return (
            <div className="flex flex-col h-full items-center justify-center p-6 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p>Loading Gantt timeline...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full space-y-4">
            <style>{CRITICAL_PATH_CSS}</style>

            <div className="flex justify-between items-center sm:flex-row flex-col gap-3">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight focus-visible:outline-none flex items-center gap-2">
                        <LayoutList className="h-5 w-5 text-primary" />
                        Gantt Workspace
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5 tracking-tight">
                        Timeline and critical path constraints overview.
                        {ganttData?.criticalPathTaskIds?.length > 0 && (
                            <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-600 rounded-lg text-xs border border-red-200">
                                {ganttData.criticalPathTaskIds.length} Critical Path Tasks
                            </span>
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="bg-muted p-0.5 rounded-lg border border-border flex text-xs">
                        {['Day', 'Week', 'Month'].map(zoom => (
                            <button
                                key={zoom}
                                onClick={() => setZoomLevel(zoom as any)}
                                className={cn(
                                    "px-3 py-1.5 rounded-md transition-smooth font-medium",
                                    zoomLevel === zoom ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {zoom}
                            </button>
                        ))}
                    </div>

                    <Button variant="outline" size="sm" className="h-8 text-xs bg-muted/50">Save Baseline</Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs bg-muted/50">Add Milestone</Button>
                    <Button onClick={() => setDependencyModalOpen(true)} size="sm" className="h-8 text-xs">
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Dependency
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-auto rounded-xl border border-border/60 bg-card w-full shadow-sm relative">
                {updateTaskDateMutation.isPending && (
                    <div className="absolute inset-0 bg-background/50 z-50 flex items-center justify-center backdrop-blur-[1px]">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                )}
                {formattedTasks.length > 0 ? (
                    <Gantt
                        tasks={formattedTasks}
                        viewMode={zoomLevel as any}
                        onDateChange={handleDateChange}
                        onClick={(task) => {
                            if (task.type === 'task') {
                                const rawTask = ganttData?.tasks.find((t: any) => t.id === task.id);
                                if (rawTask) {
                                    setEditingTask(rawTask);
                                    setTaskSheetOpen(true);
                                }
                            }
                        }}
                        onDoubleClick={(task) => {
                            if (task.type === 'task') {
                                setSelectedTaskId(task.id);
                                setDependencyModalOpen(true);
                            }
                        }}
                        listCellWidth={window.innerWidth < 768 ? "" : "220px"} // Widened to fit status prefix
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm border-dashed">
                        No tasks to graph yet.
                    </div>
                )}
            </div>

            {/* Post-trigger manual Dependency Creator Dialog */}
            <DependencyModal 
                open={dependencyModalOpen} 
                onClose={() => { setDependencyModalOpen(false); setSelectedTaskId(undefined); }} 
                tasks={ganttData?.tasks || []} 
                defaultPredecessorId={selectedTaskId}
            />

            {/* Task Detail Slide-over */}
            <TaskSheet
                open={taskSheetOpen}
                onClose={() => { setTaskSheetOpen(false); setEditingTask(null); }}
                editingTask={editingTask}
                members={members}
            />
        </div>
    );
}
