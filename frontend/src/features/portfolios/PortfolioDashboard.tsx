import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/axios';
import { ArrowLeft, CheckCircle2, AlertCircle, BarChart3, Milestone, Target, X, Plus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { CreateProgramDialog } from './components/CreateProgramDialog';
import { AddProjectToProgram } from './components/AddProjectToProgram';

export const PortfolioDashboard = () => {
    const { id: portfolioId } = useParams<{ id: string }>();
    const queryClient = useQueryClient();

    const { data: dashboard, isLoading: dashLoading } = useQuery({
        queryKey: ['portfolio-dashboard', portfolioId],
        queryFn: async () => {
            const res = await api.get(`/portfolios/${portfolioId}/dashboard`);
            return res.data;
        },
        enabled: !!portfolioId,
        staleTime: 60 * 1000 // Cache for 1 min client side
    });

    const { data: programs = [], isLoading: progLoading } = useQuery({
        queryKey: ['portfolio-programs', portfolioId],
        queryFn: async () => {
            const res = await api.get(`/portfolios/${portfolioId}/programs`);
            return res.data;
        },
        enabled: !!portfolioId
    });

    const removeProjectMutation = useMutation({
        mutationFn: async ({ programId, workspaceId }: { programId: string, workspaceId: string }) => {
            await api.delete(`/portfolios/${portfolioId}/programs/${programId}/projects/${workspaceId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['portfolio-dashboard', portfolioId] });
            queryClient.invalidateQueries({ queryKey: ['portfolio-programs', portfolioId] });
        }
    });

    const chartData = useMemo(() => {
        if (!dashboard) return [];
        return dashboard.projectHealth.map((ph: any) => {
            // Distribute budget mock logically for the waterfall based on completion %
            const mockBudget = ph.totalTasks * 50; 
            const mockSpent = Math.round((ph.completionPercent / 100) * mockBudget);
            return {
                name: ph.workspaceName,
                Planned: mockBudget,
                Actual: mockSpent
            };
        });
    }, [dashboard]);

    if (dashLoading || progLoading) return <div className="p-8 text-center text-gray-500">Loading portfolio analytics...</div>;
    if (!dashboard || !dashboard.portfolio) return <div className="p-8 text-center text-red-500">Portfolio not found or access denied.</div>;

    const { portfolio, totalProjects, totalTasks, completedTasks, overallCompletionPercent, projectHealth, upcomingMilestones, totalBudget, spentBudget } = dashboard;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div className="flex items-center space-x-4">
                    <Link to="/portfolios" className="text-gray-400 hover:text-gray-700">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <div className="flex items-center space-x-3">
                            <div className="w-5 h-5 rounded-full" style={{ backgroundColor: portfolio.color }} />
                            <h1 className="text-2xl font-bold text-gray-900">{portfolio.name}</h1>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${portfolio.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {portfolio.status}
                            </span>
                        </div>
                    </div>
                </div>
                <Link to={`/portfolios/${portfolioId}/roadmap`} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 text-sm font-medium rounded-md hover:bg-gray-50 flex items-center">
                    <Target size={16} className="mr-2 text-blue-600" />
                    Portfolio Roadmap
                </Link>
            </div>

            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard title="Total Projects" value={totalProjects} icon={<Target size={20} className="text-blue-500" />} />
                <StatCard title="Total Tasks" value={totalTasks} subtext={`${completedTasks} completed`} icon={<CheckCircle2 size={20} className="text-emerald-500" />} />
                <StatCard title="Completion %" value={`${overallCompletionPercent}%`} icon={<BarChart3 size={20} className="text-purple-500" />} />
                <StatCard title="Budget Consumed" value={`$${spentBudget.toLocaleString()}`} subtext={`of $${totalBudget.toLocaleString()} planned`} icon={<Activity size={20} className="text-orange-500" />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Main Left Column (Health Table) */}
                <div className="col-span-1 lg:col-span-2 space-y-6">
                    <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
                            <h3 className="font-semibold text-gray-800">Project Health</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500">
                                    <tr>
                                        <th className="p-3 font-semibold">Project Name</th>
                                        <th className="p-3 font-semibold w-40">Progress</th>
                                        <th className="p-3 font-semibold text-center">Overdue</th>
                                        <th className="p-3 font-semibold text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {projectHealth.length === 0 ? (
                                        <tr><td colSpan={4} className="p-4 text-center text-gray-400">No projects mapped.</td></tr>
                                    ) : (
                                        projectHealth.map((ph: any) => (
                                            <tr key={ph.workspaceId} className="hover:bg-gray-50 transition-colors">
                                                <td className="p-3 font-medium text-gray-900">{ph.workspaceName}</td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                                            <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${ph.completionPercent}%` }} />
                                                        </div>
                                                        <span className="text-xs text-gray-500 w-8">{ph.completionPercent}%</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center">
                                                    {ph.overdueTasks > 0 ? (
                                                        <span className="inline-flex items-center text-red-600 text-xs font-medium">
                                                            <AlertCircle size={14} className="mr-1" /> {ph.overdueTasks}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">0</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <HealthBadge status={ph.health} />
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Charting */}
                    <div className="bg-white border rounded-xl overflow-hidden shadow-sm p-4">
                        <h3 className="font-semibold text-gray-800 mb-6">Budget Waterfall (Planned vs Actual)</h3>
                        <div className="h-64">
                            {chartData.length === 0 || totalBudget === 0 ? (
                                <div className="h-full flex items-center justify-center text-sm text-gray-400 border border-dashed rounded">
                                    Insufficient budgeting data to render chart.
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" tick={{fontSize: 12}} />
                                        <YAxis tick={{fontSize: 12}} tickFormatter={(val) => `$${val}`} />
                                        <RechartsTooltip cursor={{fill: '#f3f4f6'}} formatter={(value: any) => [`$${value}`, undefined]} />
                                        <Legend />
                                        <Bar dataKey="Planned" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Actual" fill="#0369a1" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Right Column */}
                <div className="col-span-1 space-y-6">
                    {/* Milestones Timeline widget */}
                    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                        <div className="p-4 border-b bg-gray-50/50 flex items-center">
                            <Milestone size={18} className="text-gray-500 mr-2" />
                            <h3 className="font-semibold text-gray-800">Upcoming Milestones</h3>
                        </div>
                        <div className="p-4">
                            {upcomingMilestones.length === 0 ? (
                                <p className="text-sm text-gray-500 italic">No pending milestones.</p>
                            ) : (
                                <div className="space-y-4">
                                    {upcomingMilestones.map((m: any, idx: number) => (
                                        <div key={idx} className="relative pl-6">
                                            <div className="absolute left-1.5 top-1.5 w-2 h-2 rounded-full bg-blue-500 ring-4 ring-blue-50" />
                                            {idx !== upcomingMilestones.length - 1 && (
                                                <div className="absolute left-[9px] top-4 bottom-[-16px] w-[2px] bg-gray-100" />
                                            )}
                                            <h4 className="text-sm font-medium text-gray-800">{m.title}</h4>
                                            <p className="text-xs text-gray-500 mt-0.5">{m.workspaceName} • {format(new Date(m.dueDate), 'MMM d, yyyy')}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Manage Programs Section */}
                    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                        <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
                            <h3 className="font-semibold text-gray-800">Manage Programs</h3>
                            <CreateProgramDialog portfolioId={portfolioId as string}>
                                <button className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors" title="Create Program">
                                    <Plus size={18} />
                                </button>
                            </CreateProgramDialog>
                        </div>
                        <div className="p-0">
                            {programs.length === 0 ? (
                                <div className="p-4 text-center text-sm text-gray-500">No programs exist.</div>
                            ) : (
                                <ul className="divide-y divide-gray-100">
                                    {programs.map((prog: any) => (
                                        <li key={prog.id} className="p-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-medium text-gray-900 text-sm">{prog.name}</h4>
                                                <AddProjectToProgram portfolioId={portfolioId as string} programId={prog.id}>
                                                    <button className="text-xs text-blue-600 font-medium hover:underline flex items-center">
                                                        <Plus size={12} className="mr-0.5" /> Project
                                                    </button>
                                                </AddProjectToProgram>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {prog.programProjects.length === 0 ? (
                                                    <span className="text-xs text-gray-400 italic">No projects added.</span>
                                                ) : (
                                                    prog.programProjects.map((pp: any) => (
                                                        <span key={pp.workspaceId} className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 text-[11px] font-medium rounded border border-gray-200">
                                                            {pp.workspace?.name || 'Unknown'}
                                                            <button 
                                                                onClick={() => removeProjectMutation.mutate({ programId: prog.id, workspaceId: pp.workspaceId })}
                                                                className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </span>
                                                    ))
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Inline helper components
const StatCard = ({ title, value, subtext, icon }: any) => (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start space-x-4">
        <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
        <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <h3 className="text-xl font-bold text-gray-900 mt-1">{value}</h3>
            {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
        </div>
    </div>
);

// Generic Activity icon stand-in 
const Activity = ({ size, className }: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
);

const HealthBadge = ({ status }: { status: string }) => {
    switch (status) {
        case 'ON_TRACK':
            return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">On Track</span>;
        case 'AT_RISK':
            return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">At Risk</span>;
        case 'OFF_TRACK':
            return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Off Track</span>;
        default:
            return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
};
