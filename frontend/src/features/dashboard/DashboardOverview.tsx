import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/axios';
import { CheckCircle2, Circle, ListTodo, TrendingUp } from 'lucide-react';

interface Task {
    id: string;
    title: string;
    status: 'TODO' | 'IN_PROGRESS' | 'DONE';
}

interface PaginatedResponse {
    items: Task[];
    nextCursor: string | null;
    total: number;
}

export function DashboardOverview() {
    const { data, isLoading } = useQuery<PaginatedResponse>({
        queryKey: ['tasks'],
        queryFn: async () => {
            const res = await api.get('/tasks?limit=100');
            return res.data;
        },
    });

    if (isLoading) return (
        <div className="flex h-[400px] items-center justify-center text-muted-foreground text-sm">
            Loading dashboard...
        </div>
    );

    const tasks = data?.items || [];
    const total = data?.total || 0;
    const done = tasks.filter((t) => t.status === 'DONE').length;
    const todo = tasks.filter((t) => t.status !== 'DONE').length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    const stats = [
        { label: 'Total Tasks', value: total, icon: ListTodo, color: 'text-foreground', bg: 'bg-primary/10' },
        { label: 'Pending', value: todo, icon: Circle, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Completed', value: done, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Progress', value: `${progress}%`, icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10' },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
                <p className="text-sm text-muted-foreground mt-1">Overview of your workspace activity.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map(({ label, value, icon: Icon, color, bg }) => (
                    <div key={label} className="rounded-xl border border-border/60 bg-card p-5 transition-smooth hover:shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
                            <div className={`h-8 w-8 rounded-lg ${bg} flex items-center justify-center`}>
                                <Icon className={`h-4 w-4 ${color}`} />
                            </div>
                        </div>
                        <div className="text-2xl font-bold tracking-tight">{value}</div>
                    </div>
                ))}
            </div>

            {/* Recent tasks */}
            {tasks && tasks.length > 0 && (
                <div className="rounded-xl border border-border/60 bg-card">
                    <div className="px-5 py-4 border-b border-border/60">
                        <h2 className="text-sm font-semibold">Recent Tasks</h2>
                    </div>
                    <div className="divide-y divide-border/60">
                        {tasks.slice(0, 5).map((task) => (
                            <div key={task.id} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-muted/50 transition-smooth">
                                <span className="font-medium truncate pr-4">{task.title}</span>
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${task.status === 'DONE' ? 'bg-emerald-50 text-emerald-700' :
                                        task.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700' :
                                            'bg-zinc-100 text-zinc-600'
                                    }`}>
                                    {task.status.replace('_', ' ')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
