import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/axios';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Link } from 'react-router-dom';
import { Briefcase, Activity, Layers, Plus } from 'lucide-react';
import { CreatePortfolioDialog } from './components/CreatePortfolioDialog';
import { usePortfolioStore } from '@/store/portfolioStore';

export const PortfolioList = () => {
    const workspaceId = useWorkspaceStore(s => s.activeWorkspaceId);
    const { setPortfolios } = usePortfolioStore();

    const { data: portfolios = [], isLoading } = useQuery({
        queryKey: ['portfolios', workspaceId],
        queryFn: async () => {
            const res = await api.get(`/portfolios?workspaceId=${workspaceId}`);
            setPortfolios(res.data);
            return res.data;
        },
        enabled: !!workspaceId
    });

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Loading portfolios...</div>;
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-5">
                <div>
                    <h1 className="text-2xl font-bold flex items-center text-gray-900">
                        <Briefcase className="w-6 h-6 mr-3 text-blue-600" />
                        Portfolios
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm">
                        Group programs and projects to track strategic themes and top-line progress.
                    </p>
                </div>
                
                <CreatePortfolioDialog>
                    <button className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition">
                        <Plus size={16} className="mr-2" />
                        Create Portfolio
                    </button>
                </CreatePortfolioDialog>
            </div>

            {portfolios.length === 0 ? (
                <div className="bg-white border border-dashed border-gray-300 rounded-lg p-12 text-center">
                    <Briefcase className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">No portfolios configured</h3>
                    <p className="text-gray-500 mt-1 mb-6 text-sm">Get started by creating a portfolio to group your projects.</p>
                    <CreatePortfolioDialog>
                        <button className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50">
                            Create First Portfolio
                        </button>
                    </CreatePortfolioDialog>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {portfolios.map((portfolio: any) => {
                        // Aggregate some basic stats from the programs to display on the card
                        const totalPrograms = portfolio.programs?.length || 0;
                        let totalProjects = 0;
                        portfolio.programs?.forEach((p: any) => {
                            totalProjects += p.programProjects?.length || 0;
                        });

                        return (
                            <Link 
                                key={portfolio.id} 
                                to={`/portfolios/${portfolio.id}`}
                                className="group block h-full bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 relative"
                            >
                                {/* Color Banner */}
                                <div className="h-2 w-full" style={{ backgroundColor: portfolio.color || '#2563EB' }} />
                                
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                                            {portfolio.name}
                                        </h3>
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${portfolio.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {portfolio.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500 line-clamp-2 h-10 mb-6">
                                        {portfolio.description || 'No description provided.'}
                                    </p>
                                    
                                    <div className="flex items-center gap-4 text-sm text-gray-600 pt-4 border-t border-gray-100">
                                        <div className="flex items-center" title="Total Programs">
                                            <Layers className="w-4 h-4 mr-1.5 text-gray-400" />
                                            <span className="font-medium text-gray-900">{totalPrograms}</span>
                                        </div>
                                        <div className="flex items-center" title="Total Projects in Portfolio">
                                            <Briefcase className="w-4 h-4 mr-1.5 text-gray-400" />
                                            <span className="font-medium text-gray-900">{totalProjects}</span>
                                        </div>
                                        <div className="ml-auto flex items-center text-blue-600 text-xs font-medium bg-blue-50 px-2 py-1 rounded cursor-pointer group-hover:bg-blue-100 transition-colors">
                                            <Activity className="w-3.5 h-3.5 mr-1" />
                                            Dashboard
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
