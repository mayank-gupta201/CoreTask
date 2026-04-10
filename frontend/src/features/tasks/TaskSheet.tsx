import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/api/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet } from '@/components/ui/sheet';
import { Loader2, X, PlusCircle, Trash2, ChevronRight, Users } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { FileAttachments } from '@/components/FileAttachments';

export interface Task {
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

export interface WorkspaceMember {
    userId: string;
    email: string;
    role: string;
}

const selectClass = "flex h-9 w-full rounded-lg border border-border/60 bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-smooth";

const priorityStyle: Record<string, string> = {
    URGENT: 'bg-red-50 text-red-600 border-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/40',
    HIGH: 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900/40',
    MEDIUM: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/40',
    LOW: 'bg-zinc-50 text-zinc-500 border-zinc-100 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800',
};

const SubtaskList = ({ parentId }: { parentId: string }) => {
    const queryClient = useQueryClient();
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

    const { data: subtasks = [], isLoading } = useQuery<Task[]>({
        queryKey: ['tasks', parentId, 'subtasks'],
        queryFn: async () => {
            const res = await api.get(`/tasks/${parentId}/subtasks`);
            return res.data;
        },
    });

    const createSubtaskMutation = useMutation({
        mutationFn: async (title: string) => {
            return api.post('/tasks', { title, parentTaskId: parentId, status: 'TODO' });
        },
        onSuccess: () => {
            setNewSubtaskTitle('');
            setShowCreateForm(false);
            queryClient.invalidateQueries({ queryKey: ['tasks', parentId, 'subtasks'] });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        },
    });

    const updateSubtaskStatus = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            return api.put(`/tasks/${id}`, { status });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks', parentId, 'subtasks'] });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        },
    });

    const deleteSubtask = useMutation({
        mutationFn: async (id: string) => api.delete(`/tasks/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks', parentId, 'subtasks'] });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        },
    });

    return (
        <div className="space-y-2.5">
            <div className="flex items-center justify-between">
                <h4 className="text-[13px] font-semibold flex items-center gap-1.5">
                    <ChevronRight className="h-3.5 w-3.5" />
                    Subtasks {subtasks.length > 0 && <span className="text-muted-foreground font-normal">({subtasks.length})</span>}
                </h4>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowCreateForm(!showCreateForm)}
                >
                    <PlusCircle className="h-3 w-3 mr-1" />
                    Add
                </Button>
            </div>

            {showCreateForm && (
                <div className="flex gap-2">
                    <Input
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        placeholder="Subtask title..."
                        className="h-8 text-xs flex-1"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && newSubtaskTitle.trim()) {
                                createSubtaskMutation.mutate(newSubtaskTitle.trim());
                            }
                        }}
                    />
                    <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={!newSubtaskTitle.trim() || createSubtaskMutation.isPending}
                        onClick={() => createSubtaskMutation.mutate(newSubtaskTitle.trim())}
                    >
                        {createSubtaskMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
                    </Button>
                </div>
            )}

            {isLoading ? (
                <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : subtasks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">No subtasks yet.</p>
            ) : (
                <div className="space-y-1.5">
                    {subtasks.map((sub) => (
                        <div key={sub.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/40 group hover:bg-muted/50 transition-smooth">
                            <input
                                type="checkbox"
                                checked={sub.status === 'DONE'}
                                className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                                onChange={() => {
                                    updateSubtaskStatus.mutate({
                                        id: sub.id,
                                        status: sub.status === 'DONE' ? 'TODO' : 'DONE',
                                    });
                                }}
                            />
                            <span className={`text-xs flex-1 ${sub.status === 'DONE' ? 'line-through text-muted-foreground' : ''}`}>
                                {sub.title}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${priorityStyle[sub.priority] || priorityStyle.MEDIUM}`}>
                                {sub.priority}
                            </span>
                            <button
                                onClick={() => deleteSubtask.mutate(sub.id)}
                                className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-smooth"
                            >
                                <Trash2 className="h-2.5 w-2.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

interface TaskSheetProps {
    open: boolean;
    onClose: () => void;
    editingTask: Task | null;
    members: WorkspaceMember[];
}

export function TaskSheet({ open, onClose, editingTask, members }: TaskSheetProps) {
    const queryClient = useQueryClient();
    const { register, handleSubmit, reset } = useForm();
    const [newComment, setNewComment] = useState('');

    useEffect(() => {
        if (open) {
            if (editingTask) {
                reset({
                    title: editingTask.title,
                    description: editingTask.description || '',
                    status: editingTask.status,
                    priority: editingTask.priority || 'MEDIUM',
                    category: editingTask.category || '',
                    dueDate: editingTask.dueDate ? new Date(editingTask.dueDate).toISOString().split('T')[0] : '',
                    recurrenceRule: editingTask.recurrenceRule || '',
                    assignedTo: editingTask.assignedTo || '',
                });
            } else {
                reset({ title: '', description: '', status: 'TODO', priority: 'MEDIUM', category: '', dueDate: '', recurrenceRule: '', assignedTo: '' });
            }
        }
    }, [open, editingTask, reset]);

    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            const payload = { ...data };
            if (!payload.dueDate) delete payload.dueDate;
            else payload.dueDate = new Date(payload.dueDate).toISOString();
            if (!payload.recurrenceRule) payload.recurrenceRule = null;
            if (!payload.assignedTo) payload.assignedTo = null;

            if (editingTask) return api.put(`/tasks/${editingTask.id}`, payload);
            return api.post('/tasks', payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            queryClient.invalidateQueries({ queryKey: ['gantt'] }); // Support Gantt refresh
            onClose();
        },
        onError: (error: any) => {
            const detail = error.response?.data?.detail;
            alert(typeof detail === 'string' ? detail : 'Failed to save task. Please try again.');
        },
    });

    const {
        data: activitiesData,
        fetchNextPage: fetchMoreActivities,
        hasNextPage: hasMoreActivities,
        isLoading: isLoadingActivities,
        isFetchingNextPage: isFetchingMoreActivities,
    } = useInfiniteQuery({
        queryKey: ['tasks', editingTask?.id, 'activities'],
        queryFn: async ({ pageParam }) => {
            const params = new URLSearchParams({ limit: '30' });
            if (pageParam) params.set('cursor', pageParam);
            const res = await api.get(`/tasks/${editingTask!.id}/activities?${params.toString()}`);
            return res.data as { items: any[], nextCursor: string | null, total: number };
        },
        initialPageParam: '' as string,
        getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
        enabled: !!editingTask && open,
    });

    const activities = activitiesData?.pages.flatMap(p => p.items) || [];

    const addCommentMutation = useMutation({
        mutationFn: async ({ taskId, content }: { taskId: string, content: string }) => {
            return api.post(`/tasks/${taskId}/comments`, { content });
        },
        onSuccess: (_, variables) => {
            setNewComment('');
            queryClient.invalidateQueries({ queryKey: ['tasks', variables.taskId, 'activities'] });
        }
    });

    const handleAddComment = () => {
        if (!newComment.trim() || !editingTask) return;
        addCommentMutation.mutate({ taskId: editingTask.id, content: newComment });
    };

    const onSubmit = (data: any) => saveMutation.mutate(data);

    return (
        <Sheet open={open} onClose={onClose}>
            <div className="flex flex-col h-full bg-background">
                <div className="flex-1 overflow-y-auto">
                    <div className="px-6 py-5 space-y-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold tracking-tight">{editingTask ? 'Edit Task' : 'New Task'}</h2>
                                <p className="text-xs text-muted-foreground mt-0.5">{editingTask ? 'Update your task details.' : 'Fill in the details for your new task.'}</p>
                            </div>
                            <button className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth" onClick={onClose}>
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form id="task-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="title" className="text-[13px] font-medium">Title <span className="text-destructive">*</span></Label>
                                <Input id="title" placeholder="e.g., Design homepage UI" {...register('title', { required: true })} className="h-9" />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="description" className="text-[13px] font-medium">Description</Label>
                                <textarea
                                    id="description"
                                    placeholder="Add more details..."
                                    className="flex min-h-[80px] w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-smooth resize-y"
                                    {...register('description')}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="status" className="text-[13px] font-medium">Status</Label>
                                    <select id="status" className={selectClass} {...register('status')}>
                                        <option value="TODO">To Do</option>
                                        <option value="IN_PROGRESS">In Progress</option>
                                        <option value="DONE">Done</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="priority" className="text-[13px] font-medium">Priority</Label>
                                    <select id="priority" className={selectClass} {...register('priority')}>
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                        <option value="URGENT">Urgent</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="category" className="text-[13px] font-medium">Category</Label>
                                    <Input id="category" placeholder="e.g., Frontend" {...register('category')} className="h-9" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="dueDate" className="text-[13px] font-medium">Due Date</Label>
                                    <Input type="date" id="dueDate" {...register('dueDate')} className="h-9 block w-full" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="recurrenceRule" className="text-[13px] font-medium">Recurrence</Label>
                                    <select id="recurrenceRule" className={selectClass} {...register('recurrenceRule')}>
                                        <option value="">None (One-time)</option>
                                        <option value="DAILY">Daily</option>
                                        <option value="WEEKLY">Weekly</option>
                                        <option value="MONTHLY">Monthly</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="assignedTo" className="text-[13px] font-medium flex items-center gap-1">
                                        <Users className="h-3 w-3" /> Assign To
                                    </Label>
                                    <select id="assignedTo" className={selectClass} {...register('assignedTo')}>
                                        <option value="">Unassigned</option>
                                        {members.map((m) => (
                                            <option key={m.userId} value={m.userId}>{m.email}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </form>

                        {editingTask && (
                            <div className="pt-4 border-t border-border/60">
                                <SubtaskList parentId={editingTask.id} />
                            </div>
                        )}

                        {editingTask && (
                            <div className="pt-4 border-t border-border/60">
                                <FileAttachments taskId={editingTask.id} />
                            </div>
                        )}

                        {editingTask && (
                            <div className="pt-4 border-t border-border/60 space-y-3">
                                <h3 className="text-[13px] font-semibold">Activity</h3>
                                <div className="space-y-2.5 max-h-[250px] overflow-y-auto">
                                    {isLoadingActivities ? (
                                        <div className="text-xs text-muted-foreground flex items-center justify-center py-4"><Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Loading...</div>
                                    ) : activities?.length === 0 ? (
                                        <div className="text-xs text-muted-foreground text-center py-4">No activity yet.</div>
                                    ) : (
                                        <>
                                            {activities?.map((activity: any) => (
                                                <div key={activity.id} className="text-xs p-3 rounded-lg bg-muted/30 border border-border/60">
                                                    <div className="flex justify-between items-center text-muted-foreground mb-1.5">
                                                        <span className="font-medium text-foreground/80">{activity.user?.email || 'Unknown'}</span>
                                                        <span>{new Date(activity.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    <p className="whitespace-pre-wrap leading-relaxed text-foreground/70">{activity.content}</p>
                                                </div>
                                            ))}
                                            {hasMoreActivities && (
                                                <button
                                                    onClick={() => fetchMoreActivities()}
                                                    disabled={isFetchingMoreActivities}
                                                    className="w-full text-center text-xs text-primary hover:underline py-2 disabled:opacity-50"
                                                >
                                                    {isFetchingMoreActivities ? <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> : null}
                                                    Load more activity
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                                <div className="flex gap-2 items-start">
                                    <textarea
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder="Write a comment..."
                                        className="flex-1 min-h-[60px] rounded-lg border border-border/60 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); }
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        onClick={handleAddComment}
                                        disabled={!newComment.trim() || addCommentMutation.isPending}
                                        size="sm"
                                        className="h-9"
                                    >
                                        {addCommentMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Send'}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex gap-2 justify-end px-6 py-4 border-t border-border/60 bg-muted/20">
                    <Button variant="outline" size="sm" onClick={onClose} className="h-9">Cancel</Button>
                    <Button type="submit" form="task-form" size="sm" className="h-9" disabled={saveMutation.isPending}>
                        {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                        {editingTask ? 'Save Changes' : 'Create Task'}
                    </Button>
                </div>
            </div>
        </Sheet>
    );
}
