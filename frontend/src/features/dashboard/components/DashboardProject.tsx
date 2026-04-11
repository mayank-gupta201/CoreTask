import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';
import { Target, CheckCircle2, AlertCircle, Users, Activity } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

interface DashboardProjectProps {
    data: any;
    isLoading: boolean;
}

export function DashboardProject({ data, isLoading }: DashboardProjectProps) {
    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-24 rounded-xl bg-gray-100 border border-gray-200" />
                    ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="h-64 rounded-xl bg-gray-100 border border-gray-200" />
                    <div className="h-64 rounded-xl bg-gray-100 border border-gray-200" />
                </div>
            </div>
        );
    }

    if (!data || data.stats.totalTasks === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 text-center">
                <Target className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No data available</h3>
                <p className="mt-1 text-sm text-gray-500">Create your first task to see project insights.</p>
            </div>
        );
    }

    const { stats, tasksByStatus, teamVelocity, budgetBurn, upcomingDeadlines, recentActivity } = data;

    const PIE_COLORS = ['#3b82f6', '#f59e0b', '#10b981']; // TODO: blue, IN_PROGRESS: amber, DONE: green

    return (
        <div className="space-y-6 mt-6">
            {/* Top Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard 
                    label="Total Tasks" 
                    value={stats.totalTasks} 
                    icon={Target} 
                    color="text-blue-600" 
                    bg="bg-blue-50" 
                />
                <StatCard 
                    label="Completed" 
                    value={stats.completedTasks} 
                    icon={CheckCircle2} 
                    color="text-emerald-600" 
                    bg="bg-emerald-50" 
                />
                <StatCard 
                    label="Overdue" 
                    value={stats.overdueTasks} 
                    icon={AlertCircle} 
                    color="text-red-600" 
                    bg="bg-red-50" 
                />
                <StatCard 
                    label="Team Members" 
                    value={stats.teamSize} 
                    icon={Users} 
                    color="text-indigo-600" 
                    bg="bg-indigo-50" 
                />
            </div>

            {/* Second Row: Charts */}
            <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border bg-white p-5 shadow-sm min-h-[300px] flex flex-col">
                    <h3 className="text-sm font-semibold mb-4">Task Status Distribution</h3>
                    <div className="flex-1 relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={tasksByStatus}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="count"
                                >
                                    {tasksByStatus.map((_: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(val: any) => [val, 'Tasks']} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-2xl font-bold">{stats.completionPercent}%</span>
                            <span className="text-xs text-gray-500 uppercase font-semibold">Complete</span>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border bg-white p-5 shadow-sm min-h-[300px] flex flex-col">
                    <h3 className="text-sm font-semibold mb-4">Team Velocity (Last 8 Weeks)</h3>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={teamVelocity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.5} />
                                <XAxis dataKey="week" tick={{fontSize: 12}} />
                                <YAxis tick={{fontSize: 12}} />
                                <Tooltip cursor={{fill: '#f3f4f6'}} />
                                <Bar dataKey="tasksCompleted" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Tasks Completed" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Third Row */}
            <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border bg-white p-5 shadow-sm min-h-[300px] flex flex-col">
                    <h3 className="text-sm font-semibold mb-4">Budget Burn (Hours/Cost tracking)</h3>
                    {budgetBurn.some((b: any) => b.planned > 0) ? (
                        <div className="flex-1">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={budgetBurn} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.5} />
                                    <XAxis dataKey="date" tick={{fontSize: 12}} />
                                    <YAxis tick={{fontSize: 12}} tickFormatter={v => `$${v}`} />
                                    <Tooltip formatter={(value: any) => [`$${value}`, undefined]} />
                                    <Area type="monotone" dataKey="planned" stroke="#3b82f6" strokeDasharray="5 5" fill="transparent" name="Planned" />
                                    <Area type="monotone" dataKey="actual" stroke="#10b981" fillOpacity={1} fill="url(#colorActual)" name="Actual Logged" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-sm text-gray-500 border border-dashed rounded-lg bg-gray-50">
                            Configure estimated hours on tasks to see budget tracking.
                        </div>
                    )}
                </div>

                <div className="rounded-xl border bg-white p-5 shadow-sm flex flex-col min-h-[300px]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-semibold">Upcoming Deadlines</h3>
                        <Link to="/tasks" className="text-xs text-blue-600 hover:underline">View All</Link>
                    </div>
                    {upcomingDeadlines.length > 0 ? (
                        <div className="flex-1 overflow-auto pr-2 space-y-3">
                            {upcomingDeadlines.map((t: any) => (
                                <div key={t.id} className="flex justify-between flex-wrap gap-2 text-sm border-b pb-2 last:border-0 last:pb-0">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${
                                            t.priority === 'HIGH' || t.priority === 'URGENT' ? 'bg-red-500' :
                                            t.priority === 'MEDIUM' ? 'bg-yellow-500' : 'bg-green-500'
                                        }`} />
                                        <span className="font-medium truncate max-w-[200px]">{t.title}</span>
                                    </div>
                                    <span className="text-xs font-semibold px-2 py-1 bg-gray-100 rounded-md text-gray-600">
                                        {format(new Date(t.dueDate), 'MMM d, yyyy')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
                            No upcoming deadlines in the next 7 days.
                        </div>
                    )}
                </div>
            </div>

            {/* Fourth Row: Recent Activity */}
            <div className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Activity className="h-4 w-4 text-gray-500" />
                    <h3 className="text-sm font-semibold">Recent Activity Feed</h3>
                </div>
                {recentActivity.length > 0 ? (
                    <div className="space-y-4">
                        {recentActivity.map((act: any) => (
                            <div key={act.id} className="flex items-start gap-4">
                                <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                                    {act.userEmail.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm">
                                        <span className="font-medium text-gray-900">{act.userEmail}</span>
                                        {' '}
                                        <span className="text-gray-600">{act.action}</span>
                                        {' '}
                                        <span className="font-medium text-gray-900 border-b border-gray-200">
                                            {act.taskTitle}
                                        </span>
                                    </p>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-gray-500 py-4 text-center border-dashed border rounded-lg bg-gray-50">
                        No recent activity recorded yet.
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({ label, value, icon: Icon, color, bg }: any) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5 transition-all hover:shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <span className="text-[13px] font-medium text-gray-500">{label}</span>
                <div className={`h-8 w-8 rounded-lg ${bg} flex items-center justify-center`}>
                    <Icon className={`h-4 w-4 ${color}`} />
                </div>
            </div>
            <div className="text-3xl font-bold tracking-tight text-gray-900">{value}</div>
        </div>
    );
}
