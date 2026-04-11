import { CheckCircle2, ListTodo, Calendar, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

interface DashboardPersonalProps {
    data: any;
    isLoading: boolean;
}

export function DashboardPersonal({ data, isLoading }: DashboardPersonalProps) {
    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse mt-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-24 rounded-xl bg-gray-100 border border-gray-200" />
                    ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="h-48 rounded-xl bg-gray-100 border border-gray-200" />
                    <div className="h-48 rounded-xl bg-gray-100 border border-gray-200" />
                </div>
            </div>
        );
    }

    if (!data) return null;

    const { myTasks, myHoursThisWeek, myAssignedTasks, myUpcomingDeadlines } = data;
    
    // Progress calculation for 40 hour target
    const hoursProgress = Math.min(Math.round((myHoursThisWeek / 40) * 100), 100);

    return (
        <div className="space-y-6 mt-6">
            {/* Top Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard 
                    label="My Open Tasks" 
                    value={myTasks.total} 
                    icon={ListTodo} 
                    color="text-blue-600" 
                    bg="bg-blue-50" 
                />
                <StatCard 
                    label="Due Today" 
                    value={myTasks.dueToday} 
                    icon={Calendar} 
                    color="text-amber-600" 
                    bg="bg-amber-50" 
                />
                <StatCard 
                    label="Overdue" 
                    value={myTasks.overdue} 
                    icon={AlertCircle} 
                    color="text-red-600" 
                    bg="bg-red-50" 
                />
                <StatCard 
                    label="Completed This Week" 
                    value={myTasks.completedThisWeek} 
                    icon={CheckCircle2} 
                    color="text-emerald-600" 
                    bg="bg-emerald-50" 
                />
            </div>

            {/* Second Row */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border bg-white p-5 shadow-sm col-span-1 md:col-span-1 flex flex-col justify-center items-center text-center">
                    <h3 className="text-sm font-semibold text-gray-700 mb-6 w-full text-left">My Hours This Week</h3>
                    <div className="relative h-32 w-32 mb-4">
                        <svg className="h-full w-full" viewBox="0 0 100 100">
                            <circle
                                className="text-gray-200 stroke-current"
                                strokeWidth="8"
                                cx="50"
                                cy="50"
                                r="40"
                                fill="transparent"
                            ></circle>
                            <circle
                                className="text-blue-600 progress-ring__circle stroke-current"
                                strokeWidth="8"
                                strokeLinecap="round"
                                cx="50"
                                cy="50"
                                r="40"
                                fill="transparent"
                                strokeDasharray={`${hoursProgress * 2.51}, 251.2`}
                                transform="rotate(-90 50 50)"
                            ></circle>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold text-gray-900">{myHoursThisWeek}</span>
                            <span className="text-xs text-gray-500 uppercase font-semibold">/ 40h</span>
                        </div>
                    </div>
                    <p className="text-sm text-gray-500">
                        {myHoursThisWeek >= 40 
                            ? 'Target reached! Good job.' 
                            : `${40 - myHoursThisWeek} hours remaining to target.`}
                    </p>
                    <Link to="../timesheets" className="mt-4 text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-md hover:bg-blue-100 transition-colors">
                        Log Time
                    </Link>
                </div>

                <div className="rounded-xl border bg-white p-5 shadow-sm col-span-1 md:col-span-2 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-semibold text-gray-900">My Upcoming Deadlines</h3>
                        <Link to="/tasks" className="text-xs text-blue-600 hover:underline">View Backlog</Link>
                    </div>
                    
                    {myUpcomingDeadlines.length > 0 ? (
                        <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2">
                            {myUpcomingDeadlines.map((t: any) => {
                                const isOverdue = new Date(t.dueDate) < new Date();
                                return (
                                    <div key={t.id} className="flex justify-between items-center p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-colors group">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-sm text-gray-900 group-hover:text-blue-700">{t.title}</span>
                                            <div className="flex gap-2 items-center mt-1">
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
                                                    t.priority === 'HIGH' || t.priority === 'URGENT' ? 'bg-red-100 text-red-700' :
                                                    t.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                                                }`}>
                                                    {t.priority}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end">
                                            <span className={`text-xs font-semibold px-2 py-1 rounded-md ${
                                                isOverdue ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                            }`}>
                                                {format(new Date(t.dueDate), 'MMM d')}
                                            </span>
                                            {isOverdue && <span className="text-[10px] text-red-500 font-bold uppercase mt-1">Overdue</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-sm text-gray-500 border border-dashed rounded-lg bg-gray-50 py-8">
                            <CheckCircle2 className="h-8 w-8 text-green-400 mb-2" />
                            <span>No upcoming deadlines. Excellent!</span>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Third Row */}
            <div className="rounded-xl border bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">My Open Tasks Overview</h3>
                {myAssignedTasks.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Title</th>
                                    <th className="px-4 py-3 font-semibold">Status</th>
                                    <th className="px-4 py-3 font-semibold">Due</th>
                                </tr>
                            </thead>
                            <tbody>
                                {myAssignedTasks.map((t: any) => (
                                    <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50/50">
                                        <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{t.title}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                                                t.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {t.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {t.dueDate ? format(new Date(t.dueDate), 'MMM dd, yyyy') : '--'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-6 text-sm text-gray-500 bg-gray-50 border-dashed border rounded-lg">
                        You have no assigned tasks.
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
