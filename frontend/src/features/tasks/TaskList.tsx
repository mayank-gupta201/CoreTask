import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/api/axios';
import { Button } from '@/components/ui/button';
import { PlusCircle, Trash2, Calendar, LayoutGrid, LayoutList, Sparkles, Loader2, Repeat, X, Users, ChevronRight, Search, Filter } from 'lucide-react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { useSocket } from '@/hooks/useSocket';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { TaskSheet } from './TaskSheet';

import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';

interface Task {
    id: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    category?: string;
    dueDate?: string;
    recurrenceRule?: string | null;
    isRecurringInstance?: boolean;
    assignedTo?: string | null;
    parentTaskId?: string | null;
    deletedAt?: string | null;
}

interface WorkspaceMember {
    userId: string;
    email: string;
    role: string;
}

interface PaginatedResponse {
    items: Task[];
    nextCursor: string | null;
    total: number;
}

const priorityStyle: Record<string, string> = {
    URGENT: 'bg-red-50 text-red-600 border-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/40',
    HIGH: 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900/40',
    MEDIUM: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/40',
    LOW: 'bg-zinc-50 text-zinc-500 border-zinc-100 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800',
};

const statusStyle: Record<string, string> = {
    TODO: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
    IN_PROGRESS: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
    DONE: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
};

const TaskCardDisplay = ({ task, onDelete, onEdit, viewMode, isOverlay = false, dragListeners, dragAttributes, members, subtaskCount }: any) => {
    const assignee = members?.find((m: WorkspaceMember) => m.userId === task.assignedTo);

    return (
        <div className={`rounded-xl border bg-card transition-smooth group relative ${isOverlay ? 'shadow-lg scale-[1.02] cursor-grabbing border-primary/40 ring-1 ring-primary/20' : 'border-border/60 hover:border-border hover:shadow-sm'}`}>
            {/* Card body — clickable to edit, draggable */}
            <div
                className="p-4 cursor-grab"
                {...(dragListeners || {})}
                {...(dragAttributes || {})}
                onClick={() => {
                    onEdit(task);
                }}
            >
                <p className="text-[13px] font-medium leading-snug pr-7">{task.title}</p>

                {task.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5 mb-2">{task.description}</p>
                )}

                <div className="flex flex-wrap gap-1.5 items-center mt-2">
                    {viewMode === 'list' && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusStyle[task.status] || statusStyle.TODO}`}>
                            {task.status.replace('_', ' ')}
                        </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${priorityStyle[task.priority] || priorityStyle.MEDIUM}`}>
                        {task.priority}
                    </span>
                    {task.category && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground max-w-[80px] truncate">
                            {task.category}
                        </span>
                    )}
                    {(task.recurrenceRule || task.isRecurringInstance) && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center gap-1">
                            <Repeat className="h-2.5 w-2.5" />
                            {task.recurrenceRule || 'Instance'}
                        </span>
                    )}
                    {/* Feature 6: Subtask count badge */}
                    {subtaskCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400 flex items-center gap-1">
                            <ChevronRight className="h-2.5 w-2.5" />
                            {subtaskCount} sub
                        </span>
                    )}
                </div>

                {/* Feature 1: Assigned user + Due date row */}
                <div className="flex items-center gap-3 mt-3">
                    {assignee && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Users className="h-3 w-3" />
                            <span className="truncate max-w-[100px]">{assignee.email.split('@')[0]}</span>
                        </div>
                    )}
                    {task.dueDate && (
                        <div className="text-[11px] text-muted-foreground flex items-center">
                            <Calendar className="mr-1 h-3 w-3" />
                            {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </div>
                    )}
                </div>
            </div>

            {/* Delete button — absolutely positioned, uses stopImmediatePropagation to prevent dnd-kit */}
            {!isOverlay && (
                <button
                    className="absolute top-3 right-3 h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/30 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-smooth"
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        e.nativeEvent.stopImmediatePropagation();
                        e.preventDefault();
                    }}
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onDelete(task.id);
                    }}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    );
};

const SortableTaskCard = ({ task, onEdit, onDelete, viewMode, members, subtaskCount }: any) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: task.id,
        data: { type: 'Task', task }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="touch-none block outline-none">
            <TaskCardDisplay task={task} onEdit={onEdit} onDelete={onDelete} viewMode={viewMode} dragListeners={listeners} dragAttributes={attributes} members={members} subtaskCount={subtaskCount} />
        </div>
    );
};

const KanbanColumn = ({ title, status, tasks, onEdit, onDelete, viewMode, members, subtaskCounts }: any) => {
    const { setNodeRef, isOver } = useDroppable({
        id: status,
        data: { type: 'Column', status }
    });

    return (
        <div
            className={`flex flex-col gap-2.5 rounded-xl border p-4 min-w-[300px] max-w-[380px] flex-1 transition-smooth ${isOver ? 'border-primary/40 bg-primary/5' : 'border-border/60 bg-muted/20'}`}
            ref={setNodeRef}
        >
            <div className="flex items-center gap-2 mb-1 px-0.5">
                <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
                <span className="text-[11px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{tasks.length}</span>
            </div>
            <div className="flex flex-col gap-2.5 min-h-[120px] flex-1">
                <SortableContext items={tasks.map((t: any) => t.id)} strategy={verticalListSortingStrategy}>
                    {tasks.map((t: any) => <SortableTaskCard key={t.id} task={t} onEdit={onEdit} onDelete={onDelete} viewMode={viewMode} members={members} subtaskCount={subtaskCounts?.[t.id] || 0} />)}
                </SortableContext>
                {tasks.length === 0 && (
                    <div className="flex-1 flex items-center justify-center border border-dashed border-border/60 rounded-lg text-xs text-muted-foreground/50 min-h-[120px]">
                        Drop tasks here
                    </div>
                )}
            </div>
        </div>
    );
};

// SubtaskList extracted to TaskSheet.tsx

export function TaskList() {
    const queryClient = useQueryClient();
    const [isSheetOpen, setSheetOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');

    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Feature 5: Filters
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [filterPriority, setFilterPriority] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);

    // Drag and Drop local state
    const [localTasks, setLocalTasks] = useState<Task[]>([]);
    const [activeTask, setActiveTask] = useState<Task | null>(null);

    const { activeWorkspaceId } = useWorkspaceStore();
    const socket = useSocket();

    // Feature 1: Fetch workspace members for assignment dropdown
    const { data: members = [] } = useQuery<WorkspaceMember[]>({
        queryKey: ['workspace-members', activeWorkspaceId],
        queryFn: async () => {
            if (!activeWorkspaceId) return [];
            const res = await api.get(`/workspaces/${activeWorkspaceId}/members`);
            return res.data;
        },
        enabled: !!activeWorkspaceId,
    });

    useEffect(() => {
        if (!socket) return;

        const handleTaskChange = () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        };
        const handleActivityCreated = (data: { taskId: string, activity: any }) => {
            queryClient.invalidateQueries({ queryKey: ['tasks', data.taskId, 'activities'] });
        };

        socket.on('taskCreated', handleTaskChange);
        socket.on('taskUpdated', handleTaskChange);
        socket.on('taskDeleted', handleTaskChange);
        socket.on('taskActivityCreated', handleActivityCreated);

        return () => {
            socket.off('taskCreated', handleTaskChange);
            socket.off('taskUpdated', handleTaskChange);
            socket.off('taskDeleted', handleTaskChange);
            socket.off('taskActivityCreated', handleActivityCreated);
        };
    }, [socket, queryClient]);

    // Activities infinite query and addCommentMutation extracted to TaskSheet

    // Feature 5: Infinite query for tasks with cursor-based pagination
    const buildFilterParams = () => {
        const params: Record<string, string> = { limit: '50' };
        if (filterStatus) params.status = filterStatus;
        if (filterPriority) params.priority = filterPriority;
        if (searchQuery) params.search = searchQuery;
        return params;
    };

    const {
        data: tasksData,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteQuery({
        queryKey: ['tasks', filterStatus, filterPriority, searchQuery],
        queryFn: async ({ pageParam }) => {
            const params = new URLSearchParams(buildFilterParams());
            if (pageParam) params.set('cursor', pageParam);
            const res = await api.get(`/tasks?${params.toString()}`);
            return res.data as PaginatedResponse;
        },
        initialPageParam: '' as string,
        getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    });

    const allTasks = useMemo(() => tasksData?.pages.flatMap(p => p.items) || [], [tasksData]);
    const totalCount = tasksData?.pages[0]?.total || 0;

    // Feature 6: Track subtask counts per parent task
    const [subtaskCounts] = useState<Record<string, number>>({});

    // Synchronize local drag and drop state when server state updates
    useEffect(() => {
        if (allTasks.length > 0) setLocalTasks(allTasks);
    }, [allTasks]);

    // Infinite scroll observer
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const observerCallback = useCallback((entries: IntersectionObserverEntry[]) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    useEffect(() => {
        const observer = new IntersectionObserver(observerCallback, { threshold: 0.1 });
        if (loadMoreRef.current) observer.observe(loadMoreRef.current);
        return () => observer.disconnect();
    }, [observerCallback]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        const task = localTasks.find(t => t.id === active.id);
        if (task) setActiveTask(task);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        if (activeId === overId) return;

        const isActiveTask = active.data.current?.type === 'Task';
        const isOverTask = over.data.current?.type === 'Task';
        const isOverColumn = over.data.current?.type === 'Column';

        if (!isActiveTask) return;

        setLocalTasks(prev => {
            const activeIndex = prev.findIndex(t => t.id === activeId);

            if (isOverTask) {
                const overIndex = prev.findIndex(t => t.id === overId);
                const overStatus = prev[overIndex].status;
                if (prev[activeIndex].status !== overStatus) {
                    const newTasks = [...prev];
                    newTasks[activeIndex] = { ...newTasks[activeIndex], status: overStatus };
                    return arrayMove(newTasks, activeIndex, overIndex);
                }
                return arrayMove(prev, activeIndex, overIndex);
            }

            if (isOverColumn) {
                const newStatus = over.data.current?.status;
                if (prev[activeIndex].status !== newStatus) {
                    const newTasks = [...prev];
                    newTasks[activeIndex] = { ...newTasks[activeIndex], status: newStatus };
                    return arrayMove(newTasks, activeIndex, newTasks.length - 1);
                }
            }
            return prev;
        });
    };

    const dragMutation = useMutation({
        mutationFn: async ({ id, status, title }: { id: string, status: string, title?: string }) => {
            return api.put(`/tasks/${id}`, { status, title });
        },
    });

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveTask(null);
        const { active, over } = event;
        if (!over) return;

        const activeId = String(active.id);
        const movedItem = localTasks.find(t => t.id === activeId);
        if (!movedItem) return;

        const originalTask = allTasks.find(t => t.id === activeId);
        if (originalTask && originalTask.status !== movedItem.status) {
            dragMutation.mutate({ id: activeId, status: movedItem.status, title: originalTask.title });
        }
    };

    const { reset } = useForm();

    const handleOpenNew = () => {
        setEditingTask(null);
        reset({ title: '', description: '', status: 'TODO', priority: 'MEDIUM', category: '', dueDate: '', recurrenceRule: '', assignedTo: '' });
        setSheetOpen(true);
    };

    const handleOpenEdit = (task: Task) => {
        setEditingTask(task);
        reset({
            title: task.title,
            description: task.description || '',
            status: task.status,
            priority: task.priority || 'MEDIUM',
            category: task.category || '',
            dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
            recurrenceRule: task.recurrenceRule || '',
            assignedTo: task.assignedTo || '',
        });
        setSheetOpen(true);
    };
// saveMutation extracted to TaskSheet
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => api.delete(`/tasks/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    });

    const generateAiTasksMutation = useMutation({
        mutationFn: async (prompt: string) => {
            setIsGenerating(true);
            return api.post('/tasks/ai-breakdown', { goalContext: prompt });
        },
        onSuccess: async (response) => {
            const aiTasks = response.data?.subTasks;
            if (aiTasks && Array.isArray(aiTasks)) {
                await Promise.all(
                    aiTasks.map(t => api.post('/tasks', {
                        title: t.title,
                        status: 'TODO',
                        priority: t.priority || 'MEDIUM',
                        category: t.category || 'AI Generated'
                    }))
                );
                setAiPrompt('');
                queryClient.invalidateQueries({ queryKey: ['tasks'] });
            }
            setIsGenerating(false);
        },
        onError: () => {
            setIsGenerating(false);
            alert('AI task generation failed. Please check if GEMINI_API_KEY is configured in the backend .env file.');
        }
    });

    const handleAiGenerate = () => {
        if (!aiPrompt.trim()) return;
        generateAiTasksMutation.mutate(aiPrompt);
    };

    const handleDelete = (id: string) => {
        deleteMutation.mutate(id);
    };

    // Feature 5: Clear all filters
    const clearFilters = () => {
        setFilterStatus('');
        setFilterPriority('');
        setSearchQuery('');
    };

    const hasActiveFilters = filterStatus || filterPriority || searchQuery;

    const renderTaskCard = (task: Task) => (
        <div key={task.id}>
            <TaskCardDisplay task={task} onEdit={handleOpenEdit} onDelete={handleDelete} viewMode={viewMode} members={members} subtaskCount={subtaskCounts[task.id] || 0} />
        </div>
    );

    if (isLoading) return (
        <div className="flex h-[400px] items-center justify-center text-muted-foreground text-sm">Loading tasks...</div>
    );

    return (
        <div className="space-y-5 h-full flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">Tasks</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Manage your tasks and priorities.
                        {totalCount > 0 && <span className="ml-1 text-foreground/70">({totalCount} total)</span>}
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-grow justify-end max-w-md">
                    <div className="relative flex-1">
                        <Input
                            placeholder="Ask AI to break down a goal..."
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            className="h-9 pr-9 text-sm"
                            disabled={isGenerating}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAiGenerate(); }}
                        />
                        <Button
                            size="icon"
                            variant="ghost"
                            className="absolute right-0.5 top-0.5 h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={handleAiGenerate}
                            disabled={isGenerating || !aiPrompt.trim()}
                        >
                            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 p-0.5 rounded-lg border border-border/60 bg-muted/30">
                        <button
                            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-smooth ${viewMode === 'kanban' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setViewMode('kanban')}
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Board</span>
                        </button>
                        <button
                            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-smooth ${viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setViewMode('list')}
                        >
                            <LayoutList className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">List</span>
                        </button>
                    </div>

                    {/* Feature 5: Filter toggle */}
                    <Button
                        variant={showFilters ? 'default' : 'outline'}
                        size="sm"
                        className="h-9 text-xs"
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <Filter className="h-3.5 w-3.5 mr-1" />
                        Filters
                        {hasActiveFilters && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" />}
                    </Button>
                </div>

                <Button onClick={handleOpenNew} size="sm" className="h-9 text-[13px]">
                    <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                    Add Task
                </Button>
            </div>

            {/* Feature 5: Filter bar */}
            {showFilters && (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-muted/20 flex-wrap">
                    <div className="relative flex-1 min-w-[160px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search tasks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-8 pl-8 text-xs"
                        />
                    </div>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="h-8 rounded-lg border border-border/60 bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                        <option value="">All Status</option>
                        <option value="TODO">To Do</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="DONE">Done</option>
                    </select>
                    <select
                        value={filterPriority}
                        onChange={(e) => setFilterPriority(e.target.value)}
                        className="h-8 rounded-lg border border-border/60 bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                        <option value="">All Priority</option>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                    </select>
                    {hasActiveFilters && (
                        <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={clearFilters}>
                            <X className="h-3 w-3 mr-1" />
                            Clear
                        </Button>
                    )}
                </div>
            )}

            {/* Content */}
            {viewMode === 'list' ? (
                <div className="space-y-3 pb-10">
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {localTasks.map(renderTaskCard)}
                    </div>
                    {localTasks.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-16 border border-dashed border-border/60 rounded-xl text-muted-foreground text-sm">
                            {hasActiveFilters ? 'No tasks match your filters.' : 'No tasks yet. Create one to get started.'}
                        </div>
                    )}
                    {/* Infinite scroll sentinel */}
                    <div ref={loadMoreRef} className="h-1" />
                    {isFetchingNextPage && (
                        <div className="flex justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    )}
                </div>
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
                    <div className="flex gap-4 overflow-x-auto pb-6 -mx-4 px-4 h-full items-start">
                        <KanbanColumn title="To Do" status="TODO" tasks={localTasks.filter(t => t.status === 'TODO')} onEdit={handleOpenEdit} onDelete={handleDelete} viewMode={viewMode} members={members} subtaskCounts={subtaskCounts} />
                        <KanbanColumn title="In Progress" status="IN_PROGRESS" tasks={localTasks.filter(t => t.status === 'IN_PROGRESS')} onEdit={handleOpenEdit} onDelete={handleDelete} viewMode={viewMode} members={members} subtaskCounts={subtaskCounts} />
                        <KanbanColumn title="Done" status="DONE" tasks={localTasks.filter(t => t.status === 'DONE')} onEdit={handleOpenEdit} onDelete={handleDelete} viewMode={viewMode} members={members} subtaskCounts={subtaskCounts} />
                    </div>
                    <DragOverlay>
                        {activeTask ? <div className="opacity-90"><TaskCardDisplay task={activeTask} onEdit={() => { }} onDelete={() => { }} viewMode={viewMode} isOverlay={true} members={members} /></div> : null}
                    </DragOverlay>
                </DndContext>
            )}

            {/* Task Sheet */}
            <TaskSheet
                open={isSheetOpen}
                onClose={() => setSheetOpen(false)}
                editingTask={editingTask}
                members={members}
            />
        </div>
    );
}
